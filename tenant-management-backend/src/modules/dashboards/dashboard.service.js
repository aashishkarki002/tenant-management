import { Tenant } from "../tenant/Tenant.Model.js";
import { Block } from "../blocks/Block.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Unit } from "../units/Unit.Model.js";
import {
  getNepaliMonthDates,
  addNepaliDays,
} from "../../utils/nepaliDateHelper.js";
import { Revenue } from "../revenue/Revenue.Model.js";
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

  const [rentAgg, revenueAgg, revenueByMonthAgg] = await Promise.all([
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

    // Revenue trend: group by Nepali year + month for chart
    Revenue.aggregate([
      {
        $match: {
          npYear: { $in: [npYear, npYear - 1] },
        },
      },
      {
        $group: {
          _id: { year: "$npYear", month: "$npMonth" },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const rentSummary = rentAgg[0] || {};
  const revenueSummary = revenueAgg[0] || {};

  // Normalise revenue trend into a flat array
  const revenueByMonth = revenueByMonthAgg.map((r) => ({
    year: r._id.year,
    month: r._id.month,
    total: r.total,
  }));

  /* ===============================
     3️⃣ OVERDUE RENTS (TOP 3) – due before Nepali today
  =============================== */

  const overdueRents = await Rent.find({
    nepaliDueDate: { $lt: nepaliTodayDate },
    $expr: {
      $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
    },
  })
    .populate("tenant", "name")
    .populate("property", "name")
    .select(
      "tenant property rentAmount paidAmount rentAmountPaisa paidAmountPaisa nepaliDueDate status",
    )
    .sort({ nepaliDueDate: 1 })
    .limit(3)
    .lean()
    .then((rents) =>
      rents.map((rent) => ({
        ...rent,
        remaining: rent.rentAmount - rent.paidAmount,
        remainingPaisa:
          (rent.rentAmountPaisa || 0) - (rent.paidAmountPaisa || 0),
      })),
    );

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

  const upcomingRents = await Rent.find({
    nepaliDueDate: {
      $gte: nepaliTodayDate,
      $lte: upcomingEndDate,
    },
    $expr: {
      $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
    },
  })
    .populate("tenant", "name")
    .populate("property", "name")
    .select(
      "tenant property rentAmount paidAmount rentAmountPaisa paidAmountPaisa nepaliDueDate status",
    )
    .sort({ nepaliDueDate: 1 })
    .limit(3)
    .lean()
    .then((rents) =>
      rents.map((rent) => ({
        ...rent,
        remaining: rent.rentAmount - rent.paidAmount,
        remainingPaisa:
          (rent.rentAmountPaisa || 0) - (rent.paidAmountPaisa || 0),
      })),
    );

  /* ===============================
     5️⃣ CONTRACTS ENDING SOON (30 NEPALI DAYS)
  =============================== */

  const nepali30DaysLater = addNepaliDays(nepaliToday, 30);
  const leaseEndLimitDate = nepali30DaysLater.getDateObject();

  const contractsEndingSoon = await Tenant.find({
    isDeleted: false,
    status: "active",
    leaseEndDate: {
      $gte: nepaliTodayDate,
      $lte: leaseEndLimitDate,
    },
  })
    .select("name leaseEndDate")
    .sort({ leaseEndDate: 1 })
    .limit(3)
    .lean()
    .then((tenants) =>
      tenants.map((tenant) => {
        const endDate = new Date(tenant.leaseEndDate);
        const daysUntilEnd = Math.ceil(
          (endDate - nepaliTodayDate) / (1000 * 60 * 60 * 24),
        );
        return { ...tenant, daysUntilEnd };
      }),
    );

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
      revenueByMonth, // [{ year, month, total }] — powers the Revenue Trend chart

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
