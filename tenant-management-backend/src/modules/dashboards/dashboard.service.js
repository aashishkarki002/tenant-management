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

  const [rentAgg, revenueAgg, revenueByMonthAgg, revenueBreakdownAgg] =
    await Promise.all([
      Rent.aggregate([
        {
          $project: {
            rentAmountPaisa: 1,
            paidAmountPaisa: 1,
            remaining: {
              $max: [
                { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
                0,
              ],
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

  const contractsEndingSoon = await Tenant.aggregate([
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
  ]);

  /* ===============================
     6️⃣ RECENT ACTIVITY FEED
     Merges latest payments, maintenance updates, and new tenants
     into a single timeline for the dashboard activity widget.
  =============================== */

  const [recentPayments, recentMaintenance, recentTenants] = await Promise.all([
    Payment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("tenant", "name")
      .populate({
        path: "rent",
        populate: { path: "property", select: "name" },
      })
      .select("tenant rent amountPaisa createdAt paymentMethod")
      .lean(),

    Maintenance.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status unit createdAt")
      .lean(),

    Tenant.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt")
      .lean(),
  ]);

  const recentActivity = [
    ...recentPayments.map((p) => ({
      type: "payment",
      label: `${p.tenant?.name || "Tenant"} paid rent`,
      sub: p.rent?.property?.name || "",
      amount: p.amountPaisa / 100,
      time: p.createdAt,
    })),
    ...recentMaintenance.map((m) => ({
      type: "maintenance",
      label: `Maintenance ${m.status === "OPEN" ? "scheduled" : "updated"}`,
      sub: m.title || "",
      time: m.createdAt,
    })),
    ...recentTenants.map((t) => ({
      type: "tenant",
      label: `New tenant added`,
      sub: t.name,
      time: t.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 10);

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
      revenueByMonth, // [{ year, month, total }] — legacy, kept for compatibility
      revenueThisYear, // [{ month: 1-12, name, total }] — 12 entries, zeros filled
      revenueLastYear, // [{ month: 1-12, name, total }] — 12 entries, zeros filled

      // Attention-needed items
      overdueRents,
      upcomingRents,

      // Maintenance
      maintenance: maintenanceList, // top 3 for sidebar list
      maintenanceOpen, // total count for the badge/counter widget

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
