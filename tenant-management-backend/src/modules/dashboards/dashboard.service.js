import { Tenant } from "../tenant/Tenant.Model.js";
import { Block } from "../blocks/Block.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Unit } from "../units/Unit.Model.js";
import {
  getNepaliMonthDates,
  addNepaliDays,
} from "../../utils/nepaliDateHelper.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { Payment } from "../payment/payment.model.js";
import { Transaction } from "../ledger/transactions/Transaction.Model.js";
import { Generator } from "../maintenance/generators/Generator.Model.js";

/**
 * Fetches dashboard stats (Nepali-date-based). Use this when you need the data
 * without sending an HTTP response (e.g. from payment controller).
 */
export async function getDashboardStatsData() {
  const {
    firstDayDate,
    lastDayEndDate,
    nepaliToday,
    nepaliTodayDate,
    npYear,
    npMonth,
  } = getNepaliMonthDates();

  /* ===============================
     1️⃣ TENANT & UNIT STATS (Nepali month)
  =============================== */

  const [
    totalTenants,
    activeTenants,
    tenantsThisMonth,
    totalUnits,
    occupiedUnits,
  ] = await Promise.all([
    Tenant.countDocuments({ isDeleted: false }),
    Tenant.countDocuments({ isDeleted: false, status: "active" }),
    Tenant.countDocuments({
      isDeleted: false,
      $or: [
        { createdAt: { $gte: firstDayDate, $lt: lastDayEndDate } },
        { dateOfAgreementSigned: { $gte: firstDayDate, $lt: lastDayEndDate } },
      ],
    }),
    Unit.countDocuments(),
    Unit.countDocuments({ isOccupied: true }),
  ]);

  const occupancyRate =
    totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  /* ===============================
     2️⃣ RENT SUMMARY — uses paisa fields for precision
  =============================== */

  const [
    rentAgg,
    revenueAgg,
    revenueByMonthAgg,
    revenueBreakdownAgg,
    revenueBreakdownThisMonthAgg,
  ] = await Promise.all([
    Rent.aggregate([
      {
        $project: {
          rentAmountPaisa: 1,
          paidAmountPaisa: 1,
          remaining: {
            $max: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCollectedPaisa: { $sum: "$paidAmountPaisa" },
          totalRentPaisa: { $sum: "$rentAmountPaisa" },
          totalOutstandingPaisa: { $sum: "$remaining" },
        },
      },
    ]),

    Revenue.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]),

    // Revenue trend: group by npYear + npMonth (stored on document at write time).
    // Both fields are indexed — this aggregation is O(index scan), not O(collection scan).
    Revenue.aggregate([
      {
        $match: {
          npYear: { $in: [npYear, npYear - 1] },
        },
      },
      {
        $group: {
          _id: { year: "$npYear", month: "$npMonth" },
          total: { $sum: { $divide: ["$amountPaisa", 100] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // Revenue breakdown by source — for the summary card.
    // $lookup replaces the source ObjectId with the source document in one pipeline.
    Revenue.aggregate([
      {
        $group: {
          _id: "$source",
          totalAmountPaisa: { $sum: "$amountPaisa" },
        },
      },
      {
        $lookup: {
          from: RevenueSource.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "source",
        },
      },
      { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          code: "$source.code",
          name: "$source.name",
          category: "$source.category",
          totalAmountPaisa: 1,
        },
      },
      { $sort: { totalAmountPaisa: -1 } }, // highest first
    ]),

    // Revenue breakdown by source — scoped to current Nepali month only.
    Revenue.aggregate([
      {
        $match: { npYear, npMonth },
      },
      {
        $group: {
          _id: "$source",
          totalAmountPaisa: { $sum: "$amountPaisa" },
        },
      },
      {
        $lookup: {
          from: RevenueSource.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "source",
        },
      },
      { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          code: "$source.code",
          name: "$source.name",
          category: "$source.category",
          totalAmountPaisa: 1,
        },
      },
      { $sort: { totalAmountPaisa: -1 } },
    ]),
  ]);

  const rentSummary = rentAgg[0] || {};
  const revenueSummary = revenueAgg[0] || {};

  const NEPALI_MONTH_NAMES = [
    "Baisakh",
    "Jestha",
    "Ashadh",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
  ];

  // Build a complete 12-month array for a Nepali year, zero-filling missing months.
  const buildFullNepaliYear = (year) =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1; // 1-based
      const found = revenueByMonthAgg.find(
        (r) => r._id.year === year && r._id.month === month,
      );
      return {
        month,
        name: NEPALI_MONTH_NAMES[i],
        total: found?.total ?? 0,
      };
    });

  const revenueThisYear = buildFullNepaliYear(npYear);
  const revenueLastYear = buildFullNepaliYear(npYear - 1);

  // Keep flat array for legacy consumers
  const revenueByMonth = revenueByMonthAgg.map((r) => ({
    year: r._id.year,
    month: r._id.month,
    total: r.total,
  }));

  /* ===============================
     3️⃣ OVERDUE RENTS (TOP 3) – due before Nepali today
  =============================== */

  const overdueRents = await Rent.aggregate([
    {
      $match: {
        nepaliDueDate: { $lt: nepaliTodayDate },
        $expr: {
          $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
        },
      },
    },
    { $sort: { nepaliDueDate: 1 } },
    { $limit: 3 },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant",
        foreignField: "_id",
        as: "tenant",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        remaining: { $subtract: ["$rentAmount", "$paidAmount"] },
        remainingPaisa: { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
      },
    },
    {
      $project: {
        tenant: 1,
        property: 1,
        rentAmount: 1,
        paidAmount: 1,
        rentAmountPaisa: 1,
        paidAmountPaisa: 1,
        nepaliDueDate: 1,
        status: 1,
        remaining: 1,
        remainingPaisa: 1,
      },
    },
  ]);

  /* ===============================
     4️⃣ MAINTENANCE — count + top 3
  =============================== */

  const [maintenanceList, maintenanceOpen] = await Promise.all([
    Maintenance.find({ status: "OPEN" }).limit(3).lean(),
    Maintenance.countDocuments({ status: "OPEN" }),
  ]);

  /* ===============================
     4️⃣ UPCOMING RENTS (next 7 Nepali days)
  =============================== */

  const nepaliUpcomingEnd = addNepaliDays(nepaliToday, 7);
  const upcomingEndDate = nepaliUpcomingEnd.getDateObject();

  const upcomingRents = await Rent.aggregate([
    {
      $match: {
        nepaliDueDate: { $gte: nepaliTodayDate, $lte: upcomingEndDate },
        $expr: {
          $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
        },
      },
    },
    { $sort: { nepaliDueDate: 1 } },
    { $limit: 3 },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant",
        foreignField: "_id",
        as: "tenant",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        remaining: { $subtract: ["$rentAmount", "$paidAmount"] },
        remainingPaisa: { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
      },
    },
    {
      $project: {
        tenant: 1,
        property: 1,
        rentAmount: 1,
        paidAmount: 1,
        rentAmountPaisa: 1,
        paidAmountPaisa: 1,
        nepaliDueDate: 1,
        status: 1,
        remaining: 1,
        remainingPaisa: 1,
      },
    },
  ]);

  /* ===============================
     5️⃣ CONTRACTS ENDING SOON (30 NEPALI DAYS)
  =============================== */

  const nepali30DaysLater = addNepaliDays(nepaliToday, 30);
  const leaseEndLimitDate = nepali30DaysLater.getDateObject();

  const [contractsEndingSoon, upcomingMaintenance, generatorsDueService] =
    await Promise.all([
      Tenant.aggregate([
        {
          $match: {
            isDeleted: false,
            status: "active",
            leaseEndDate: {
              $gte: nepaliTodayDate,
              $lte: leaseEndLimitDate,
            },
          },
        },
        { $sort: { leaseEndDate: 1 } },
        { $limit: 3 },
        { $project: { name: 1, leaseEndDate: 1 } },
        {
          $addFields: {
            daysUntilEnd: {
              $ceil: {
                $divide: [
                  { $subtract: ["$leaseEndDate", nepaliTodayDate] },
                  1000 * 60 * 60 * 24,
                ],
              },
            },
          },
        },
      ]),

      // Upcoming open/in-progress maintenance tasks scheduled within the next 30 days
      Maintenance.find({
        status: { $in: ["OPEN", "IN_PROGRESS"] },
        scheduledDate: { $gte: nepaliTodayDate, $lte: leaseEndLimitDate },
      })
        .sort({ scheduledDate: 1 })
        .limit(5)
        .populate("property", "name")
        .populate("unit", "name")
        .populate("assignedTo", "name")
        .lean(),

      // Generators whose nextServiceDate is within the next 30 days or already overdue, or low fuel
      Generator.find({
        isActive: true,
        status: { $ne: "DECOMMISSIONED" },
        $or: [
          { nextServiceDate: { $exists: true, $lte: leaseEndLimitDate } },
          { currentFuelPercent: { $lte: 20 } },
        ],
      })
        .sort({ nextServiceDate: 1 })
        .limit(5)
        .populate("property", "name")
        .lean(),
    ]);

  /* ===============================
     6️⃣ RECENT ACTIVITY FEED
     Pulls the 10 most recent non-voided Transactions and maps them
     to the normalised shape expected by RecentActivities component.
  =============================== */

  const TX_TYPE_MAP = {
    RENT_PAYMENT_RECEIVED: { type: "payment", label: "Rent payment received" },
    CAM_PAYMENT_RECEIVED: { type: "payment", label: "CAM payment received" },
    ELECTRICITY_PAYMENT: {
      type: "payment",
      label: "Electricity payment received",
    },
    RENT_CHARGE: { type: "rent", label: "Rent charged" },
    CAM_CHARGE: { type: "rent", label: "CAM charged" },
    ELECTRICITY_CHARGE: { type: "rent", label: "Electricity charged" },
    SECURITY_DEPOSIT: { type: "rent", label: "Security deposit recorded" },
    MAINTENANCE_EXPENSE: { type: "maintenance", label: "Maintenance expense" },
    REVENUE_STREAM: { type: "revenue", label: "Revenue recorded" },
    OTHER_INCOME: { type: "revenue", label: "Other income" },
    UTILITY_EXPENSE: { type: "expense", label: "Utility expense" },
    OTHER_EXPENSE: { type: "expense", label: "Other expense" },
    ADJUSTMENT: { type: "expense", label: "Adjustment" },
  };

  const recentTransactions = await Transaction.find({
    status: { $ne: "VOIDED" },
  })
    .sort({ transactionDate: -1 })
    .limit(10)
    .lean();

  const recentActivity = recentTransactions.map((tx, i) => {
    const mapped = TX_TYPE_MAP[tx.type] ?? {
      type: "default",
      label: tx.description ?? "Transaction",
    };
    const amount =
      tx.totalAmountPaisa != null ? tx.totalAmountPaisa / 100 : null;
    return {
      id: tx._id?.toString() ?? i,
      type: mapped.type,
      mainText: mapped.label,
      sub: tx.description ?? "",
      amount,
      time: tx.transactionDate ?? tx.createdAt,
    };
  });

  /* ===============================
     7️⃣ RESPONSE DATA
  =============================== */

  return {
    success: true,
    message: "Dashboard stats fetched successfully",
    data: {
      // Tenants & Units
      totalTenants,
      activeTenants,
      tenantsThisMonth,
      totalUnits,
      occupiedUnits,
      occupancyRate,

      // Rent summary — both paisa (precise) and rupees (display)
      rentSummary: {
        totalCollectedPaisa: rentSummary.totalCollectedPaisa || 0,
        totalRentPaisa: rentSummary.totalRentPaisa || 0,
        totalOutstandingPaisa: rentSummary.totalOutstandingPaisa || 0,
        totalCollected: (rentSummary.totalCollectedPaisa || 0) / 100,
        totalRent: (rentSummary.totalRentPaisa || 0) / 100,
        totalOutstanding: (rentSummary.totalOutstandingPaisa || 0) / 100,
      },

      // Revenue
      totalRevenue: revenueSummary.totalRevenue || 0,
      revenueBreakdown: revenueBreakdownAgg.map((item) => ({
        code: item.code ?? "OTHER",
        name: item.name ?? "Other",
        category: item.category ?? "OPERATING",
        amount: (item.totalAmountPaisa ?? 0) / 100,
      })),
      revenueBreakdownThisMonth: revenueBreakdownThisMonthAgg.map((item) => ({
        code: item.code ?? "OTHER",
        name: item.name ?? "Other",
        category: item.category ?? "OPERATING",
        amount: (item.totalAmountPaisa ?? 0) / 100,
      })),
      revenueByMonth, // [{ year, month, total }] — legacy, kept for compatibility
      revenueThisYear, // [{ month: 1-12, name, total }] — 12 entries, zeros filled
      revenueLastYear, // [{ month: 1-12, name, total }] — 12 entries, zeros filled

      // Attention-needed items
      overdueRents,
      upcomingRents,

      // Maintenance
      maintenance: maintenanceList, // top 3 for sidebar list
      maintenanceOpen, // total count for the badge/counter widget
      upcomingMaintenance, // open/in-progress tasks due within 30 days
      generatorsDueService, // generators needing service or low on fuel

      // Contracts
      contractsEndingSoon,

      // Activity feed
      recentActivity,

      // Nepali date context
      nepaliToday: nepaliToday.toString(),
      npYear,
      npMonth,
    },
  };
}

export async function getDashboardStats(req, res) {
  try {
    const result = await getDashboardStatsData();
    res.json(result);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
}
