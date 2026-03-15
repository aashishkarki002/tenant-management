import { Tenant } from "../tenant/Tenant.Model.js";
import { Block } from "../blocks/Block.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Unit } from "../units/unit.model.js";
import {
  getNepaliMonthDates,
  addNepaliDays,
  NEPALI_MONTH_NAMES,
} from "../../utils/nepaliDateHelper.js";
import { getMonthsInQuarter } from "../../utils/nepaliMonthQuarter.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { Payment } from "../payment/payment.model.js";
import { Transaction } from "../ledger/transactions/Transaction.Model.js";
import { Generator } from "../maintenance/generators/Generator.Model.js";
import { Cam } from "../cam/cam.model.js";

// ─── Nepali FY Quarter definitions ────────────────────────────────────────────
//
// Quarters use getMonthsInQuarter() from nepaliMonthQuarter.js instead of
// hardcoded month arrays. This is the single source of truth for quarter→month
// mapping across the entire codebase.
//
// Nepali fiscal year quarter order (Baisakh = month 1):
//   Q1: months 1–3   (Baisakh, Jestha, Ashadh)
//   Q2: months 4–6   (Shrawan, Bhadra, Ashwin)
//   Q3: months 7–9   (Kartik, Mangsir, Poush)
//   Q4: months 10–12 (Magh, Falgun, Chaitra)
//
// Note: The NP_FY_QUARTERS array below uses getMonthsInQuarter(q) so that if
// the quarter definition ever changes in nepaliMonthQuarter.js, the dashboard
// service automatically picks it up with no manual update needed.

const NP_FY_QUARTERS = [1, 2, 3, 4].map((q) => ({
  label: `Q${q}`,
  months: getMonthsInQuarter(q), // e.g. Q1 → [1, 2, 3]
}));

/**
 * Derives quarterly totals from a 12-entry monthly revenue array.
 * Pure in-memory aggregation — no extra DB round-trip.
 *
 * @param {Array<{month: number, name: string, total: number}>} yearData
 * @returns {Array<{label, months, total, monthlyBreakdown}>}
 */
function buildQuarterly(yearData) {
  return NP_FY_QUARTERS.map((q) => {
    const monthlyBreakdown = q.months.map((m) => {
      const found = yearData.find((d) => d.month === m);
      return {
        month: m,
        name: NEPALI_MONTH_NAMES[m - 1] ?? "", // NEPALI_MONTH_NAMES is 0-based; month is 1-based
        total: found?.total ?? 0,
      };
    });
    return {
      label: q.label,
      months: q.months,
      total: monthlyBreakdown.reduce((sum, m) => sum + m.total, 0),
      monthlyBreakdown,
    };
  });
}

// ─── Building Performance Aggregation ─────────────────────────────────────────
//
// DATA MODEL (confirmed from uploaded schemas):
//
//   Property  (single — "Narendra Sadhan Property")
//     └── Block  (Block.property → Property._id)
//           e.g. "Narendra Sadhan", "Birendra Sadhan"    ← "Building" in UI
//           └── InnerBlock  (InnerBlock.block → Block._id)
//                 e.g. "Umanga", "Saurya", "Sagar", "Jyoti"  ← "Block" in UI
//
//   Unit.block  → Block._id  (confirmed: rent.Model.js uses Unit.block)
//   Rent.block  → Block._id  (confirmed: rent.Model.js schema)
//   Revenue has NO block ref — revenue per building derived from Rent.paidAmountPaisa
//
// DATE INPUTS come from the getNepaliMonthDates() call in getDashboardStatsData()
// and are passed in to avoid a second call. nepaliTodayDate is a plain JS Date
// (the .getDateObject() result) — correct format for MongoDB $lt/$gte comparisons.

async function buildBuildingPerformance({ npYear, npMonth, nepaliTodayDate }) {
  const [blocks, unitsByBlock, rentByBlock, overdueByBlock] = await Promise.all(
    [
      // 1. All active blocks — these are the "Buildings" shown in the UI grid
      Block.find({ isDeleted: { $ne: true } })
        .select("_id name property")
        .lean(),

      // 2. Unit occupancy counts per block
      //    Unit.block → Block._id
      Unit.aggregate([
        {
          $group: {
            _id: "$block",
            total: { $sum: 1 },
            occupied: { $sum: { $cond: ["$isOccupied", 1, 0] } },
          },
        },
      ]),

      // 3. Rent collection for the current Nepali month, grouped by block.
      //    npYear + npMonth come from getNepaliMonthDates() in the caller —
      //    these are the 1-based values stored in the DB (npMonth is 1-based
      //    per nepaliDateHelper.js getNepaliMonthDates() → npMonth1Based).
      //    Hits compound index { nepaliYear, nepaliMonth, status, property }.
      Rent.aggregate([
        { $match: { nepaliYear: npYear, nepaliMonth: npMonth } },
        {
          $group: {
            _id: "$block",
            target: { $sum: { $divide: ["$rentAmountPaisa", 100] } },
            collected: { $sum: { $divide: ["$paidAmountPaisa", 100] } },
          },
        },
      ]),

      // 4. Overdue balance per block.
      //    nepaliTodayDate is nepaliToday.getDateObject() from getNepaliMonthDates().
      //    This is a plain JS Date — the correct format for MongoDB $lt comparisons.
      //    Hits { englishDueDate: 1 } index.
      Rent.aggregate([
        {
          $match: {
            englishDueDate: { $lt: nepaliTodayDate },
            $expr: {
              $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
            },
          },
        },
        {
          $group: {
            _id: "$block",
            overdueAmount: {
              $sum: {
                $divide: [
                  { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
                  100,
                ],
              },
            },
          },
        },
      ]),
    ],
  );

  // O(1) lookup maps keyed by Block._id string
  const unitMap = new Map(unitsByBlock.map((u) => [u._id?.toString(), u]));
  const rentMap = new Map(rentByBlock.map((r) => [r._id?.toString(), r]));
  const overdueMap = new Map(overdueByBlock.map((o) => [o._id?.toString(), o]));

  return blocks.map((block) => {
    const id = block._id.toString();

    const units = unitMap.get(id) ?? { total: 0, occupied: 0 };
    const rent = rentMap.get(id) ?? { target: 0, collected: 0 };
    const overdue = overdueMap.get(id);

    const occupancyRate =
      units.total > 0 ? Math.round((units.occupied / units.total) * 100) : 0;

    const collectionRate =
      rent.target > 0
        ? Math.min(100, Math.round((rent.collected / rent.target) * 100))
        : 0;

    return {
      _id: block._id,
      name: block.name,

      occupancy: {
        occupied: units.occupied,
        total: units.total,
        rate: occupancyRate,
      },

      collection: {
        collected: rent.collected,
        target: rent.target,
        rate: collectionRate,
      },

      // Revenue this month = rent collected for this block this period.
      // Revenue model has no block ref so this is the correct per-block signal.
      revenue: rent.collected,

      overdueAmount: overdue?.overdueAmount ?? 0,
    };
  });
}

// ─── Main data fetcher ────────────────────────────────────────────────────────

export async function getDashboardStatsData() {
  // getNepaliMonthDates() is the single authoritative source for all Nepali
  // date values used throughout this function. No manual date arithmetic below.
  //
  // Key destructured values and their types:
  //   npYear           — number  — 4-digit Nepali year, e.g. 2081
  //   npMonth          — number  — 1-based month (1=Baisakh … 12=Chaitra), for DB
  //   nepaliToday      — NepaliDate instance — current Nepali date
  //   nepaliTodayDate  — JS Date — nepaliToday.getDateObject(), for MongoDB $lt/$gte
  //   firstDayDate     — JS Date — first of current Nepali month
  //   lastDayEndDate   — JS Date — exclusive end (day after last), use with $lt
  //   nepaliMonthName  — string  — human-readable current month name
  //   lastDay          — NepaliDate — last day of current month (used by addNepaliDays)
  const {
    firstDayDate,
    lastDayEndDate,
    nepaliToday,
    nepaliTodayDate,
    npYear,
    npMonth,
  } = getNepaliMonthDates();

  /* ===============================
     1️⃣ TENANT & UNIT STATS
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
        // firstDayDate / lastDayEndDate come from getNepaliMonthDates() above
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
     2️⃣ RENT & REVENUE SUMMARY
  =============================== */

  const [
    rentAgg,
    rentThisMonthAgg,
    camAgg,
    camThisMonthAgg,
    revenueAgg,
    revenueByMonthAgg,
    revenueBreakdownAgg,
    revenueBreakdownThisMonthAgg,
    lateFeeAgg,
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

    // Rent billed + collected for the CURRENT Nepali month only
    Rent.aggregate([
      { $match: { nepaliYear: npYear, nepaliMonth: npMonth } },
      {
        $group: {
          _id: null,
          billedPaisa: { $sum: "$rentAmountPaisa" },
          collectedPaisa: { $sum: "$paidAmountPaisa" },
        },
      },
    ]),

    // CAM all-time totals
    Cam.aggregate([
      {
        $project: {
          amountPaisa: 1,
          paidAmountPaisa: 1,
          remaining: {
            $max: [{ $subtract: ["$amountPaisa", "$paidAmountPaisa"] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalBilledPaisa: { $sum: "$amountPaisa" },
          totalCollectedPaisa: { $sum: "$paidAmountPaisa" },
          totalOutstandingPaisa: { $sum: "$remaining" },
        },
      },
    ]),

    // CAM billed + collected for the CURRENT Nepali month only
    Cam.aggregate([
      { $match: { nepaliYear: npYear, nepaliMonth: npMonth } },
      {
        $group: {
          _id: null,
          billedPaisa: { $sum: "$amountPaisa" },
          collectedPaisa: { $sum: "$paidAmountPaisa" },
        },
      },
    ]),

    Revenue.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),

    // npYear comes from getNepaliMonthDates() — 1-based, matches Revenue.npYear index
    Revenue.aggregate([
      { $match: { npYear: { $in: [npYear, npYear - 1] } } },
      {
        $group: {
          _id: { year: "$npYear", month: "$npMonth" },
          total: { $sum: { $divide: ["$amountPaisa", 100] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    Revenue.aggregate([
      {
        $group: { _id: "$source", totalAmountPaisa: { $sum: "$amountPaisa" } },
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

    // npYear + npMonth from getNepaliMonthDates() — scoped to this billing period
    Revenue.aggregate([
      { $match: { npYear, npMonth } },
      {
        $group: { _id: "$source", totalAmountPaisa: { $sum: "$amountPaisa" } },
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

    // ── Late fee summary — current FY (lateFeeApplied=true means fee was charged) ──
    // Surfaces late fee data that is otherwise invisible on the dashboard.
    // Uses the index { status: 1, lateFeeApplied: 1 } defined in rent.Model.js.
    // Fields: totalLateFeePaisa (accrued), totalLatePaidPaisa (collected),
    //         tenantsCharged (distinct count), tenantsPaid (fully cleared fees).
    Rent.aggregate([
      { $match: { lateFeeApplied: true, npYear } },
      {
        $group: {
          _id: null,
          totalLateFeePaisa: { $sum: "$lateFeePaisa" },
          totalLatePaidPaisa: { $sum: "$latePaidAmountPaisa" },
          tenantsCharged: { $sum: 1 },
          tenantsPaidFees: {
            $sum: {
              $cond: [{ $eq: ["$lateFeeStatus", "paid"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const rentSummary = rentAgg[0] || {};
  const rentThisMonth = rentThisMonthAgg[0] || {};
  const camSummary = camAgg[0] || {};
  const camThisMonth = camThisMonthAgg[0] || {};
  const revenueSummary = revenueAgg[0] || {};

  // Build a complete 12-month array for a given year, zero-filling missing months.
  // NEPALI_MONTH_NAMES is imported from nepaliDateHelper.js — single source of truth.
  // NEPALI_MONTH_NAMES is 0-indexed; month in DB is 1-based → use NEPALI_MONTH_NAMES[i]
  // where i = month - 1.
  const buildFullNepaliYear = (year) =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1; // 1-based to match DB storage
      const found = revenueByMonthAgg.find(
        (r) => r._id.year === year && r._id.month === month,
      );
      return {
        month,
        name: NEPALI_MONTH_NAMES[i], // i = month - 1
        total: found?.total ?? 0,
      };
    });

  const revenueThisYear = buildFullNepaliYear(npYear);
  const revenueLastYear = buildFullNepaliYear(npYear - 1);

  // buildQuarterly uses getMonthsInQuarter() via NP_FY_QUARTERS — no hardcoded
  // month arrays anywhere in this file.
  const quarterlyThisYear = buildQuarterly(revenueThisYear);
  const quarterlyLastYear = buildQuarterly(revenueLastYear);

  const revenueByMonth = revenueByMonthAgg.map((r) => ({
    year: r._id.year,
    month: r._id.month,
    total: r.total,
  }));

  /* ===============================
     3️⃣ OVERDUE RENTS (TOP 3) + OUTSTANDING CONTEXT
  =============================== */

  // ── Outstanding context ───────────────────────────────────────────────────────
  //
  // Three parallel aggregates — all hit existing indexes, run concurrently:
  //
  //   outstandingContextAgg — earliest unpaid englishDueDate this month, plus
  //     a frequency breakdown (monthly vs quarterly) of unpaid rents so the
  //     KPI sub-label can say "6 monthly · 2 quarterly pending" without a
  //     separate query.
  //
  //   overdueCountAgg — rents past their englishDueDate with a balance > 0.
  //     Authoritative overdue headcount + frequency split + total paisa.
  //     The overdueRents query below is a top-3 display sample only.
  //
  // rentFrequency values from rent.Model.js: "monthly" | "quarterly"
  const [outstandingContextAgg, overdueCountAgg] = await Promise.all([
    // Pending this month: unpaid rents in current Nepali month
    // Returns earliest due date + frequency breakdown in a single pass.
    Rent.aggregate([
      {
        $match: {
          nepaliYear: npYear,
          nepaliMonth: npMonth,
          $expr: {
            $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          earliestDueDate: { $min: "$englishDueDate" },
          totalCount: { $sum: 1 },
          monthlyCount: {
            $sum: { $cond: [{ $eq: ["$rentFrequency", "monthly"] }, 1, 0] },
          },
          quarterlyCount: {
            $sum: { $cond: [{ $eq: ["$rentFrequency", "quarterly"] }, 1, 0] },
          },
        },
      },
    ]),

    // Overdue: past englishDueDate, balance > 0 — with frequency split
    Rent.aggregate([
      {
        $match: {
          englishDueDate: { $lt: nepaliTodayDate },
          $expr: {
            $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          monthlyCount: {
            $sum: { $cond: [{ $eq: ["$rentFrequency", "monthly"] }, 1, 0] },
          },
          quarterlyCount: {
            $sum: { $cond: [{ $eq: ["$rentFrequency", "quarterly"] }, 1, 0] },
          },
          totalOutstandingPaisa: {
            $sum: { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
          },
        },
      },
    ]),
  ]);

  const pendingCtx = outstandingContextAgg[0] ?? {};
  const overdueCtx = overdueCountAgg[0] ?? {};

  const earliestDueDate = pendingCtx.earliestDueDate ?? null;
  const pendingMonthly = pendingCtx.monthlyCount ?? 0;
  const pendingQuarterly = pendingCtx.quarterlyCount ?? 0;

  const overdueCount = overdueCtx.count ?? 0;
  const overdueMonthly = overdueCtx.monthlyCount ?? 0;
  const overdueQuarterly = overdueCtx.quarterlyCount ?? 0;
  const overdueAmountPaisa = overdueCtx.totalOutstandingPaisa ?? 0;

  // nepaliTodayDate = nepaliToday.getDateObject() from getNepaliMonthDates().
  // JS Date object — correct type for MongoDB $lt on a Date field.
  const overdueRents = await Rent.aggregate([
    {
      $match: {
        englishDueDate: { $lt: nepaliTodayDate },
        $expr: {
          $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
        },
      },
    },
    { $sort: { englishDueDate: 1 } },
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
        remainingPaisa: {
          $subtract: [
            {
              $subtract: [
                "$rentAmountPaisa",
                { $ifNull: ["$tdsAmountPaisa", 0] },
              ],
            },
            "$paidAmountPaisa",
          ],
        },
        // displayStatus: the correct status derived from payment data, not the
        // stored DB field. The pre-save hook never writes "overdue" — it only
        // writes pending / partially_paid / paid. A rent that is past its due
        // date and unpaid sits in the DB as "pending". We compute the true
        // status here so the frontend always receives the right value.
        //
        //   paid           → paidAmountPaisa >= effectiveRent
        //   partially_paid → some payment made but balance remains
        //   overdue        → nothing paid AND past due date (always true here)
        displayStatus: {
          $switch: {
            branches: [
              {
                case: {
                  $gte: [
                    "$paidAmountPaisa",
                    {
                      $subtract: [
                        "$rentAmountPaisa",
                        { $ifNull: ["$tdsAmountPaisa", 0] },
                      ],
                    },
                  ],
                },
                then: "paid",
              },
              {
                case: { $gt: ["$paidAmountPaisa", 0] },
                then: "partially_paid",
              },
            ],
            default: "overdue",
          },
        },
      },
    },
    {
      $project: {
        tenant: 1,
        property: 1,
        rentAmountPaisa: 1,
        paidAmountPaisa: 1,
        tdsAmountPaisa: 1,
        nepaliDueDate: 1,
        englishDueDate: 1,
        status: 1, // raw DB value (kept for audit)
        displayStatus: 1, // computed correct status — use this in the UI
        remainingPaisa: 1,
      },
    },
  ]);

  /* ===============================
     4️⃣ MAINTENANCE — open + upcoming
  =============================== */

  // Next month computed arithmetically — no addNepaliMonths() needed here
  // because we only need the numeric month/year values for a DB $match, not
  // a NepaliDate instance.
  const nextMonth = npMonth === 12 ? 1 : npMonth + 1;
  const nextMonthYear = npMonth === 12 ? npYear + 1 : npYear;

  const [maintenanceAll, upcomingMaintenance] = await Promise.all([
    Maintenance.find({
      status: { $in: ["OPEN", "IN_PROGRESS"] },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("property", "name")
      .populate("unit", "name")
      .lean(),

    Maintenance.find({
      status: { $in: ["OPEN", "IN_PROGRESS"] },
      $or: [
        { scheduledNepaliYear: npYear, scheduledNepaliMonth: npMonth },
        { scheduledNepaliYear: nextMonthYear, scheduledNepaliMonth: nextMonth },
      ],
    })
      .sort({ scheduledDate: 1 })
      .limit(5)
      .populate("property", "name")
      .populate("unit", "name")
      .populate("assignedTo", "name")
      .lean(),
  ]);

  /* ===============================
     5️⃣ UPCOMING RENTS (next 7 Nepali days)
  =============================== */

  // addNepaliDays(nepaliToday, 7):
  //   nepaliToday   — NepaliDate from getNepaliMonthDates()
  //   addNepaliDays — converts to JS Date, adds days, converts back to NepaliDate
  //   .getDateObject() — returns the JS Date for MongoDB $lte
  const upcomingEndDate = addNepaliDays(nepaliToday, 7).getDateObject();

  const upcomingRents = await Rent.aggregate([
    {
      $match: {
        englishDueDate: { $gte: nepaliTodayDate, $lte: upcomingEndDate },
        $expr: {
          $gt: [{ $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] }, 0],
        },
      },
    },
    { $sort: { englishDueDate: 1 } },
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
        remainingPaisa: {
          $subtract: [
            {
              $subtract: [
                "$rentAmountPaisa",
                { $ifNull: ["$tdsAmountPaisa", 0] },
              ],
            },
            "$paidAmountPaisa",
          ],
        },
        // displayStatus: same logic as overdueRents but due date is in the
        // future — so unpaid rents are correctly "pending", not "overdue".
        //
        //   paid           → paidAmountPaisa >= effectiveRent
        //   partially_paid → some payment made but balance remains
        //   pending        → nothing paid, due date not yet passed (always true here)
        displayStatus: {
          $switch: {
            branches: [
              {
                case: {
                  $gte: [
                    "$paidAmountPaisa",
                    {
                      $subtract: [
                        "$rentAmountPaisa",
                        { $ifNull: ["$tdsAmountPaisa", 0] },
                      ],
                    },
                  ],
                },
                then: "paid",
              },
              {
                case: { $gt: ["$paidAmountPaisa", 0] },
                then: "partially_paid",
              },
            ],
            default: "pending",
          },
        },
      },
    },
    {
      $project: {
        tenant: 1,
        property: 1,
        rentAmountPaisa: 1,
        paidAmountPaisa: 1,
        tdsAmountPaisa: 1,
        nepaliDueDate: 1,
        englishDueDate: 1,
        status: 1, // raw DB value (kept for audit)
        displayStatus: 1, // computed correct status — use this in the UI
        remainingPaisa: 1,
      },
    },
  ]);

  /* ===============================
     6️⃣ CONTRACTS + GENERATORS + BUILDINGS (parallel)
  =============================== */

  // Window dates derived via addNepaliDays(nepaliToday, N).getDateObject():
  //   nepaliToday    — NepaliDate from getNepaliMonthDates()
  //   addNepaliDays  — util from nepaliDateHelper.js
  //   .getDateObject()— returns JS Date for MongoDB range queries
  const leaseEndLimitDate = addNepaliDays(nepaliToday, 60).getDateObject();
  const generatorLimitDate = addNepaliDays(nepaliToday, 30).getDateObject();

  const [contractsEndingSoon, generatorsDueService, buildings] =
    await Promise.all([
      // Leases expiring within 60 days — feeds LeaseRiskCard urgency bands
      Tenant.aggregate([
        {
          $match: {
            isDeleted: false,
            status: "active",
            leaseEndDate: { $gte: nepaliTodayDate, $lte: leaseEndLimitDate },
          },
        },
        { $sort: { leaseEndDate: 1 } },
        { $limit: 10 },
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

      Generator.find({
        isActive: true,
        status: { $ne: "DECOMMISSIONED" },
        $or: [
          { nextServiceDate: { $exists: true, $lte: generatorLimitDate } },
          { currentFuelPercent: { $lte: 20 } },
        ],
      })
        .sort({ nextServiceDate: 1 })
        .limit(5)
        .populate("property", "name")
        .lean(),

      // Per-Block ("Building" in UI) KPI aggregation.
      // Receives npYear, npMonth, nepaliTodayDate from getNepaliMonthDates()
      // to avoid a second call inside buildBuildingPerformance.
      buildBuildingPerformance({ npYear, npMonth, nepaliTodayDate }),
    ]);

  /* ===============================
     7️⃣ RECENT ACTIVITY FEED
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
    return {
      id: tx._id?.toString() ?? i,
      type: mapped.type,
      mainText: mapped.label,
      sub: tx.description ?? "",
      amount: tx.totalAmountPaisa != null ? tx.totalAmountPaisa / 100 : null,
      time: tx.transactionDate ?? tx.createdAt,
    };
  });

  /* ===============================
     8️⃣ RESPONSE
  =============================== */

  return {
    success: true,
    message: "Dashboard stats fetched successfully",
    data: {
      // ── Tenants & Units ───────────────────────────────────────────────────
      totalTenants,
      activeTenants,
      tenantsThisMonth,
      totalUnits,
      occupiedUnits,
      occupancyRate,

      // ── Outstanding context — drives phase-aware KPI tile ─────────────────
      //
      // earliestDueDate: real englishDueDate of the earliest unpaid rent this
      //   Nepali month. Frontend computes daysUntilDue from this + today.
      //
      // pending* / overdue* counts: monthly vs quarterly split so the KPI
      //   sub-label can show "6 monthly · 2 quarterly" without a separate query.
      //   Never used as the hero number — that stays a unified rupee figure.
      outstandingContext: {
        earliestDueDate, // JS Date | null

        // Pending (unpaid, not yet overdue)
        pendingMonthly,
        pendingQuarterly,

        // Overdue (past englishDueDate, balance > 0)
        trulyOverdueCount: overdueCount,
        trulyOverdueAmountPaisa: overdueAmountPaisa,
        overdueMonthly,
        overdueQuarterly,
      },

      // ── Rent summary ──────────────────────────────────────────────────────
      rentSummary: {
        totalCollectedPaisa: rentSummary.totalCollectedPaisa || 0,
        totalRentPaisa: rentSummary.totalRentPaisa || 0,
        totalOutstandingPaisa: rentSummary.totalOutstandingPaisa || 0,
        totalCollected: (rentSummary.totalCollectedPaisa || 0) / 100,
        totalRent: (rentSummary.totalRentPaisa || 0) / 100,
        totalOutstanding: (rentSummary.totalOutstandingPaisa || 0) / 100,
      },

      // ── Collection summary (rent + CAM breakdown) ─────────────────────────
      // Gives the UI everything it needs to render a "Total Collection" card
      // with a rent vs CAM split, both all-time and current-month scoped.
      collectionSummary: {
        // ── Current Nepali month ────────────────────────────────────────────
        thisMonth: {
          // Rent
          rentBilledPaisa: rentThisMonth.billedPaisa || 0,
          rentCollectedPaisa: rentThisMonth.collectedPaisa || 0,
          rentOutstandingPaisa: Math.max(
            0,
            (rentThisMonth.billedPaisa || 0) -
              (rentThisMonth.collectedPaisa || 0),
          ),
          // CAM
          camBilledPaisa: camThisMonth.billedPaisa || 0,
          camCollectedPaisa: camThisMonth.collectedPaisa || 0,
          camOutstandingPaisa: Math.max(
            0,
            (camThisMonth.billedPaisa || 0) -
              (camThisMonth.collectedPaisa || 0),
          ),
          // Combined
          totalBilledPaisa:
            (rentThisMonth.billedPaisa || 0) + (camThisMonth.billedPaisa || 0),
          totalCollectedPaisa:
            (rentThisMonth.collectedPaisa || 0) +
            (camThisMonth.collectedPaisa || 0),
          totalOutstandingPaisa: Math.max(
            0,
            (rentThisMonth.billedPaisa || 0) +
              (camThisMonth.billedPaisa || 0) -
              (rentThisMonth.collectedPaisa || 0) -
              (camThisMonth.collectedPaisa || 0),
          ),
          // Convenience rupee values (÷100)
          rentBilled: (rentThisMonth.billedPaisa || 0) / 100,
          rentCollected: (rentThisMonth.collectedPaisa || 0) / 100,
          rentOutstanding:
            Math.max(
              0,
              (rentThisMonth.billedPaisa || 0) -
                (rentThisMonth.collectedPaisa || 0),
            ) / 100,
          camBilled: (camThisMonth.billedPaisa || 0) / 100,
          camCollected: (camThisMonth.collectedPaisa || 0) / 100,
          camOutstanding:
            Math.max(
              0,
              (camThisMonth.billedPaisa || 0) -
                (camThisMonth.collectedPaisa || 0),
            ) / 100,
          totalBilled:
            ((rentThisMonth.billedPaisa || 0) +
              (camThisMonth.billedPaisa || 0)) /
            100,
          totalCollected:
            ((rentThisMonth.collectedPaisa || 0) +
              (camThisMonth.collectedPaisa || 0)) /
            100,
          totalOutstanding:
            Math.max(
              0,
              (rentThisMonth.billedPaisa || 0) +
                (camThisMonth.billedPaisa || 0) -
                (rentThisMonth.collectedPaisa || 0) -
                (camThisMonth.collectedPaisa || 0),
            ) / 100,
          // Collection rate for progress bar (0–100)
          collectionRate:
            (rentThisMonth.billedPaisa || 0) + (camThisMonth.billedPaisa || 0) >
            0
              ? Math.min(
                  100,
                  Math.round(
                    (((rentThisMonth.collectedPaisa || 0) +
                      (camThisMonth.collectedPaisa || 0)) /
                      ((rentThisMonth.billedPaisa || 0) +
                        (camThisMonth.billedPaisa || 0))) *
                      100,
                  ),
                )
              : 0,
        },

        // ── All-time totals ─────────────────────────────────────────────────
        allTime: {
          // Rent
          rentBilledPaisa: rentSummary.totalRentPaisa || 0,
          rentCollectedPaisa: rentSummary.totalCollectedPaisa || 0,
          rentOutstandingPaisa: rentSummary.totalOutstandingPaisa || 0,
          // CAM
          camBilledPaisa: camSummary.totalBilledPaisa || 0,
          camCollectedPaisa: camSummary.totalCollectedPaisa || 0,
          camOutstandingPaisa: camSummary.totalOutstandingPaisa || 0,
          // Combined
          totalBilledPaisa:
            (rentSummary.totalRentPaisa || 0) +
            (camSummary.totalBilledPaisa || 0),
          totalCollectedPaisa:
            (rentSummary.totalCollectedPaisa || 0) +
            (camSummary.totalCollectedPaisa || 0),
          totalOutstandingPaisa:
            (rentSummary.totalOutstandingPaisa || 0) +
            (camSummary.totalOutstandingPaisa || 0),
          // Rupee values
          rentBilled: (rentSummary.totalRentPaisa || 0) / 100,
          rentCollected: (rentSummary.totalCollectedPaisa || 0) / 100,
          rentOutstanding: (rentSummary.totalOutstandingPaisa || 0) / 100,
          camBilled: (camSummary.totalBilledPaisa || 0) / 100,
          camCollected: (camSummary.totalCollectedPaisa || 0) / 100,
          camOutstanding: (camSummary.totalOutstandingPaisa || 0) / 100,
          totalBilled:
            ((rentSummary.totalRentPaisa || 0) +
              (camSummary.totalBilledPaisa || 0)) /
            100,
          totalCollected:
            ((rentSummary.totalCollectedPaisa || 0) +
              (camSummary.totalCollectedPaisa || 0)) /
            100,
          totalOutstanding:
            ((rentSummary.totalOutstandingPaisa || 0) +
              (camSummary.totalOutstandingPaisa || 0)) /
            100,
        },
      },

      // ── Revenue ───────────────────────────────────────────────────────────
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

      revenueByMonth, // [{year, month, total}] — legacy flat array
      revenueThisYear, // [{month, name, total}] × 12, zeros filled
      revenueLastYear, // [{month, name, total}] × 12, zeros filled

      // Quarterly views — derived in-memory from monthly data via buildQuarterly()
      // which uses getMonthsInQuarter() as the single source of truth.
      quarterlyThisYear,
      quarterlyLastYear,

      // ── Late fee summary — powers the Late Fees KPI tile ─────────────────
      // lateFeeApplied=true rents for the current FY.
      // totalAccrued   — total late fees charged (rupees)
      // totalCollected — total late fees paid back (rupees)
      // totalOutstanding — accrued minus collected
      // tenantsCharged — count of rent records with active late fees
      // tenantsPaidFees — count who have fully cleared their late fee
      lateFeeSummary: (() => {
        const lf = lateFeeAgg[0] ?? {};
        const accrued = (lf.totalLateFeePaisa ?? 0) / 100;
        const collected = (lf.totalLatePaidPaisa ?? 0) / 100;
        return {
          totalAccrued: accrued,
          totalCollected: collected,
          totalOutstanding: Math.max(0, accrued - collected),
          tenantsCharged: lf.tenantsCharged ?? 0,
          tenantsPaidFees: lf.tenantsPaidFees ?? 0,
          hasActiveFees: (lf.tenantsCharged ?? 0) > 0,
        };
      })(),

      // ── Attention ─────────────────────────────────────────────────────────
      overdueRents,
      upcomingRents,

      // ── Maintenance ───────────────────────────────────────────────────────
      maintenance: maintenanceAll,
      upcomingMaintenance,
      generatorsDueService,

      // ── Leases ────────────────────────────────────────────────────────────
      contractsEndingSoon,

      // ── Per-Block building performance ────────────────────────────────────
      // "Building" in UI = Block in DB.
      // e.g. "Narendra Sadhan" card, "Birendra Sadhan" card.
      // Empty array → BuildingPerformanceGrid renders nothing.
      buildings,

      // ── Activity feed ─────────────────────────────────────────────────────
      recentActivity,

      // ── Nepali date context (used by BarDiagram + CurrentMonthCallout) ────
      // nepaliToday.toString() gives a human-readable BS date string.
      // npYear + npMonth (1-based) tell the frontend which month/year to highlight.
      nepaliToday: nepaliToday.toString(),
      npYear,
      npMonth,
    },
  };
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────

export async function getDashboardStats(req, res) {
  try {
    const result = await getDashboardStatsData();
    res.json(result);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
}

// ─── GET /api/dashboard/upcoming-rents ────────────────────────────────────────
//
// Returns rents due within the next 7 Nepali days.
// Used by the Dashboard "Upcoming" toggle in the Needs Attention panel.
//
// Query params:
//   days (optional) — number of days to look ahead (default: 7)
//   limit (optional) — max results (default: 10)

export async function getUpcomingRents(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const limit = parseInt(req.query.limit, 10) || 10;

    const { nepaliToday } = getNepaliMonthDates();

    // nepaliDueDate is stored as the English-equivalent Date of the Nepali
    // due date (via NepaliDate.getDateObject()). Build the query range the
    // same way so the $gte / $lte comparison is apples-to-apples.
    const startDate = nepaliToday.getDateObject();
    const endDate = addNepaliDays(nepaliToday, days).getDateObject();

    const upcomingRents = await Rent.getRentsDueWithinEnglishPeriod(
      startDate,
      endDate,
      limit,
    );

    res.json({
      success: true,
      message: `Upcoming rents within ${days} days fetched successfully`,
      data: {
        upcomingRents,
        count: upcomingRents.length,
        daysAhead: days,
      },
    });
  } catch (error) {
    console.error("Upcoming rents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming rents",
    });
  }
}

// ─── GET /api/dashboard/stats/quarterly ──────────────────────────────────────
//
// Lightweight quarterly breakdown — used by drill-down views.
// Returns only quarterly + monthly revenue; no tenant/maintenance/generator data.
//
// Uses getMonthsInQuarter() via buildQuarterly() — same quarter definition as
// the main stats endpoint, guaranteed consistent.

export async function getQuarterlyStats(req, res) {
  try {
    // getNepaliMonthDates() with no args → current month/year
    const { npYear, npMonth } = getNepaliMonthDates();

    // Single aggregation, both years — one index scan
    const revenueByMonthAgg = await Revenue.aggregate([
      { $match: { npYear: { $in: [npYear, npYear - 1] } } },
      {
        $group: {
          _id: { year: "$npYear", month: "$npMonth" },
          total: { $sum: { $divide: ["$amountPaisa", 100] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // buildFullYear uses NEPALI_MONTH_NAMES from nepaliDateHelper.js
    const buildFullYear = (year) =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const found = revenueByMonthAgg.find(
          (r) => r._id.year === year && r._id.month === month,
        );
        return {
          month,
          name: NEPALI_MONTH_NAMES[i],
          total: found?.total ?? 0,
        };
      });

    res.json({
      success: true,
      data: {
        npYear,
        npMonth,
        // buildQuarterly uses getMonthsInQuarter() — consistent with main endpoint
        thisYear: {
          year: npYear,
          quarters: buildQuarterly(buildFullYear(npYear)),
        },
        lastYear: {
          year: npYear - 1,
          quarters: buildQuarterly(buildFullYear(npYear - 1)),
        },
      },
    });
  } catch (error) {
    console.error("Quarterly stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quarterly stats",
    });
  }
}
