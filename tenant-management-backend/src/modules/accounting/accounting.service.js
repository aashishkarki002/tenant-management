import NepaliDate from "nepali-datetime";
import { ledgerService } from "../ledger/ledger.service.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Liability } from "../liabilities/Liabilities.Model.js";
import { LiabilitySource } from "../liabilities/LiabilitesSource.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { paisaToRupees } from "../../utils/moneyUtil.js";
import { buildEntityFilter } from "../../utils/buildEntityFilter.js";

// ─── Constants ────────────────────────────────────────────────────────────────

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

/**
 * Nepal fiscal year quarters (Shrawan-based, 0-indexed BS month):
 *   Q1 → Shrawan(3), Bhadra(4),  Ashwin(5)
 *   Q2 → Kartik(6),  Mangsir(7), Poush(8)
 *   Q3 → Magh(9),    Falgun(10), Chaitra(11)
 *   Q4 → Baisakh(0), Jestha(1),  Ashadh(2)
 */
const FISCAL_QUARTER_MONTHS = {
  1: [3, 4, 5],
  2: [6, 7, 8],
  3: [9, 10, 11],
  4: [0, 1, 2],
};

/** All 12 BS months in Nepal fiscal year order (Shrawan → Ashadh). */
const FISCAL_YEAR_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

const OPERATING_REF_TYPES = new Set(["MAINTENANCE", "UTILITY", "SALARY"]);

/** Shown when `referenceType === LOAN_INTEREST` but `source` is not an ExpenseSource (legacy rows). */
const INTEREST_EXPENSE_LABEL = "Interest expense";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildDateFilter(startDate, endDate) {
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return Object.keys(filter).length ? filter : undefined;
}

function toBS(date) {
  try {
    const nd = new NepaliDate(date);
    return { year: nd.getYear(), month0: nd.getMonth() };
  } catch {
    return null;
  }
}

/**
 * BS label for a Revenue row: prefer denormalized nepali* (authoritative billing month),
 * else derive from englishDate. Mirrors getExpenseBreakdownSummary transaction logic.
 */
function revenueTransactionBsDate(r) {
  const eng = r.englishDate ?? r.createdAt;
  if (r.nepaliYear && r.nepaliMonth) {
    const m0 = (r.nepaliMonth - 1) % 12;
    const name = NEPALI_MONTH_NAMES[m0];
    if (r.nepaliDate && /^\d{4}-\d{2}-\d{2}$/.test(r.nepaliDate)) {
      const day = parseInt(String(r.nepaliDate).split("-")[2], 10);
      if (day >= 1 && day <= 32) return `${day} ${name} ${r.nepaliYear}`;
    }
    return `${name} ${r.nepaliYear}`;
  }
  const bs = toBS(new Date(eng));
  if (!bs) return "—";
  const d = new NepaliDate(eng instanceof Date ? eng : new Date(eng)).getDate();
  return `${d} ${NEPALI_MONTH_NAMES[bs.month0]} ${bs.year}`;
}

function addRevenueTrendBucket(r, trendMap) {
  let key;
  let label;
  if (r.nepaliYear && r.nepaliMonth) {
    const month0 = (r.nepaliMonth - 1) % 12;
    key = `${r.nepaliYear}-${String(r.nepaliMonth).padStart(2, "0")}`;
    label = NEPALI_MONTH_NAMES[month0];
  } else {
    const bs = toBS(new Date(r.englishDate ?? r.createdAt));
    if (!bs) return;
    key = `${bs.year}-${String(bs.month0 + 1).padStart(2, "0")}`;
    label = NEPALI_MONTH_NAMES[bs.month0];
  }
  if (!trendMap.has(key)) {
    trendMap.set(key, {
      key,
      label,
      amountPaisa: 0,
      count: 0,
    });
  }
  const entry = trendMap.get(key);
  entry.amountPaisa += r.amountPaisa || 0;
  entry.count += 1;
}

function bsMonthToDateRange(year, month0) {
  const firstNp = new NepaliDate(year, month0, 1);
  const lastDay = NepaliDate.getDaysOfMonth(year, month0);
  const lastNp = new NepaliDate(year, month0, lastDay);
  const toISO = (nd) => nd.getDateObject().toISOString().split("T")[0];
  return { startDate: toISO(firstNp), endDate: toISO(lastNp) };
}

function getLastNMonths(n = 5) {
  const now = new NepaliDate();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    let month0 = now.getMonth() - i;
    let year = now.getYear();
    while (month0 < 0) {
      month0 += 12;
      year -= 1;
    }
    months.push({ year, month0 });
  }
  return months;
}

function getQuarterMonths(quarter, fiscalYear) {
  const year = fiscalYear ?? new NepaliDate().getYear();
  // Q4 months (Baisakh=0, Jestha=1, Ashadh=2) fall in fiscalYear+1, not fiscalYear.
  // e.g. FY 2081 Q4 → Baisakh 2082, Jestha 2082, Ashadh 2082.
  return FISCAL_QUARTER_MONTHS[quarter].map((month0) => ({
    year: calendarYearForBsMonth(month0, year),
    month0,
  }));
}

// Baisakh(0), Jestha(1), Ashadh(2) end the FY and fall in the *next* BS year
// (e.g. FY 2081 → Baisakh 2082). All other months fall within the FY year.
function calendarYearForBsMonth(month0, fiscalYear) {
  return month0 <= 2 ? fiscalYear + 1 : fiscalYear;
}

function getFiscalYearMonths(fiscalYear) {
  return FISCAL_YEAR_MONTH_ORDER.map((month0) => ({
    year: calendarYearForBsMonth(month0, fiscalYear),
    month0,
  }));
}

function resolveMonthToDateRange(month, fiscalYear) {
  const month0 = month - 1;
  const fy = fiscalYear ?? new NepaliDate().getYear();
  return bsMonthToDateRange(calendarYearForBsMonth(month0, fy), month0);
}

function pctChange(base, next) {
  if (!base) return null;
  return +(((next - base) / base) * 100).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. ACCOUNTING SUMMARY ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build accounting summary for dashboard (revenue, liabilities, cash flow, breakdowns).
 *
 * Filter priority (first match wins):
 *   1. startDate + endDate  — explicit Gregorian range
 *   2. month + fiscalYear   — single BS month
 *   3. quarter + fiscalYear — 3-month BS quarter
 *   4. (none)               — all-time
 *
 * Entity scoping:
 *   entityId = null/undefined → merged (all entities)
 *   entityId = "private"      → private entity only (includes legacy null entries)
 *   entityId = <ObjectId>     → specific entity only
 */
export async function getAccountingSummary({
  startDate,
  endDate,
  nepaliYear,
  quarter,
  month,
  fiscalYear,
  entityId = null,
  paymentMethod = null, // Payment method filter (cash, bank_transfer, cheque, mobile_wallet)
}) {
  // ── Resolve date range ────────────────────────────────────────────────────
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (!resolvedStart && !resolvedEnd) {
    if (month) {
      ({ startDate: resolvedStart, endDate: resolvedEnd } =
        resolveMonthToDateRange(Number(month), fiscalYear));
    } else if (quarter) {
      const months = getQuarterMonths(Number(quarter), fiscalYear);
      const first = bsMonthToDateRange(months[0].year, months[0].month0);
      const last = bsMonthToDateRange(
        months[months.length - 1].year,
        months[months.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    } else if (fiscalYear) {
      const fyMonths = getFiscalYearMonths(fiscalYear);
      const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
      const last = bsMonthToDateRange(
        fyMonths[fyMonths.length - 1].year,
        fyMonths[fyMonths.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    }
  }

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  // ── Revenue aggregation ───────────────────────────────────────────────────
  const revenueMatch = { ...entityFilter };
  if (dateFilter) revenueMatch.englishDate = dateFilter;
  if (paymentMethod) revenueMatch.paymentMethod = paymentMethod;

  const revenueAggregation = await Revenue.aggregate([
    { $match: revenueMatch },
    {
      $lookup: {
        from: RevenueSource.collection.name,
        localField: "source",
        foreignField: "_id",
        as: "sourceDetails",
      },
    },
    { $unwind: { path: "$sourceDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$source",
        totalAmountPaisa: { $sum: "$amountPaisa" },
        name: { $first: "$sourceDetails.name" },
        code: { $first: "$sourceDetails.code" },
      },
    },
  ]);

  // ── Liability aggregation ─────────────────────────────────────────────────
  // LOAN liabilities are created at disbursement but remain outstanding until
  // fully repaid. Filtering by englishDate (disbursement date) excludes loans
  // taken out before the queried period even though they're still active.
  // Fix: when a date filter is active, include docs that EITHER fall within the
  // date range OR are active loans (loanStatus = "ACTIVE").
  const liabilityMatch = { ...entityFilter };
  if (dateFilter) {
    liabilityMatch.$or = [
      { englishDate: dateFilter },
      { referenceType: "LOAN", loanStatus: "ACTIVE" },
    ];
  }
  if (paymentMethod) liabilityMatch.paymentMethod = paymentMethod;

  const liabilityAggregation = await Liability.aggregate([
    { $match: liabilityMatch },
    {
      $lookup: {
        from: LiabilitySource.collection.name,
        localField: "source",
        foreignField: "_id",
        as: "sourceDetails",
      },
    },
    { $unwind: { path: "$sourceDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$source",
        totalAmountPaisa: { $sum: "$amountPaisa" },
        name: { $first: "$sourceDetails.name" },
        code: { $first: "$sourceDetails.code" },
      },
    },
  ]);

  // ── Expenses from Expense collection ─────────────────────────────────────
  //
  // IMPORTANT: Revenue comes from the Revenue collection, expenses from the
  // Expense collection — both are the single source of truth for P&L.
  // The Ledger is for double-entry audit trail only, not for summary totals.
  //
  // We explicitly EXCLUDE referenceType "ELECTRICITY_NEA_COST" here because
  // that represents an unsettled NEA Payable (liability) — it is not a cash
  // expense until the NEA bill is actually paid and the payable is cleared.
  const expenseMatch = { ...entityFilter };
  if (dateFilter) expenseMatch.englishDate = dateFilter;
  expenseMatch.referenceType = { $ne: "ELECTRICITY_NEA_COST" };
  if (paymentMethod) expenseMatch.paymentMethod = paymentMethod;

  const expenseAggregation = await Expense.aggregate([
    { $match: expenseMatch },
    {
      $lookup: {
        from: ExpenseSource.collection.name,
        localField: "source",
        foreignField: "_id",
        as: "sourceDetails",
      },
    },
    { $unwind: { path: "$sourceDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$source",
        totalAmountPaisa: { $sum: "$amountPaisa" },
        name: { $first: "$sourceDetails.name" },
        code: { $first: "$sourceDetails.code" },
        referenceType: { $first: "$referenceType" },
      },
    },
  ]);

  // Also fetch the ledger summary for the audit trail / ledger tab only
  // (not used for P&L totals — that comes from Revenue + Expense collections)
  const ledgerSummary = await ledgerService.getLedgerSummary({
    startDate: resolvedStart,
    endDate: resolvedEnd,
    nepaliYear,
    quarter,
    entityId,
  });

  const totalRevenue = revenueAggregation.reduce(
    (sum, item) => sum + paisaToRupees(item.totalAmountPaisa || 0),
    0,
  );
  const totalLiabilities = liabilityAggregation.reduce(
    (sum, item) => sum + paisaToRupees(item.totalAmountPaisa || 0),
    0,
  );
  const totalExpenses = expenseAggregation.reduce(
    (sum, item) => sum + paisaToRupees(item.totalAmountPaisa || 0),
    0,
  );
  const netCashFlow = totalRevenue - totalExpenses;

  const camelKey = (name = "") =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ""))
      .replace(/[^a-z0-9]/g, "");

  const incomeStreams = revenueAggregation.reduce(
    (streams, item) => {
      const name = item.name || item.code || "revenue";
      const key = camelKey(name) || "revenue";
      const amount = paisaToRupees(item.totalAmountPaisa || 0);

      streams.breakdown.push({ code: item.code, name, amount });

      if (item.code === "RENT") streams.rentRevenue = amount;
      if (item.code === "PARKING") streams.parkingRevenue = amount;
      if (item.code === "AD") streams.otherRevenue = amount;

      streams[key] = (streams[key] || 0) + amount;
      return streams;
    },
    { breakdown: [] },
  );

  const liabilitiesBreakdown = liabilityAggregation.map((item) => ({
    code: item.code,
    name: item.name || item.code || "liability",
    amount: Math.abs(paisaToRupees(item.totalAmountPaisa || 0)),
  }));

  // expensesBreakdown now comes from Expense collection (not ledger accounts)
  // so it is consistent with totalExpenses above. Names/codes come from
  // ExpenseSource via $lookup — same pattern as revenue → RevenueSource.
  const expensesBreakdown = expenseAggregation.map((item) => {
    const isLoanInterest = item.referenceType === "LOAN_INTEREST";
    return {
      code:
        item.code ??
        (isLoanInterest ? "INTEREST" : String(item._id ?? "unknown")),
      name:
        item.name ||
        item.code ||
        (isLoanInterest ? INTEREST_EXPENSE_LABEL : String(item._id ?? "expense")),
      amount: paisaToRupees(item.totalAmountPaisa || 0),
    };
  });

  return {
    totals: { totalRevenue, totalLiabilities, totalExpenses, netCashFlow },
    incomeStreams,
    liabilitiesBreakdown,
    ledger: ledgerSummary,
    expensesBreakdown,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1b. PORTFOLIO HEALTH ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns portfolio-level health metrics for the dashboard:
 *   - collection: rent collection rate + outstanding amounts
 *   - arrearsAging: open rents bucketed by days overdue (cross-period, always live)
 *   - noi: Net Operating Income (revenue minus operating expenses, excludes loan interest)
 *   - yoyDeltas: % change vs same period one fiscal year ago
 *
 * All monetary values in paisa. Percentages as floats (e.g. 87.5 not 0.875).
 */
export async function getPortfolioHealth({
  startDate,
  endDate,
  quarter,
  month,
  fiscalYear,
  entityId = null,
} = {}) {
  // ── Resolve date range (same logic as getAccountingSummary) ──────────────────
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (!resolvedStart && !resolvedEnd) {
    if (month) {
      ({ startDate: resolvedStart, endDate: resolvedEnd } =
        resolveMonthToDateRange(Number(month), fiscalYear));
    } else if (quarter) {
      const qMonths = getQuarterMonths(Number(quarter), fiscalYear);
      const first = bsMonthToDateRange(qMonths[0].year, qMonths[0].month0);
      const last = bsMonthToDateRange(qMonths[qMonths.length - 1].year, qMonths[qMonths.length - 1].month0);
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    } else if (fiscalYear) {
      const fyMonths = getFiscalYearMonths(fiscalYear);
      const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
      const last = bsMonthToDateRange(fyMonths[fyMonths.length - 1].year, fyMonths[fyMonths.length - 1].month0);
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    }
  }

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  // ── 1. Current + previous year summaries (for YoY deltas) ───────────────────
  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;
  const [currentSummary, prevSummary] = await Promise.all([
    getAccountingSummary({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    prevFiscalYear !== null
      ? getAccountingSummary({ quarter, month, fiscalYear: prevFiscalYear, entityId })
      : Promise.resolve(null),
  ]);

  // ── 2. Collection rate — Rent collection filtered by due date range ───────────
  // Rent does not have entityId; collection rate is a portfolio-wide metric.
  const rentMatch = { status: { $ne: "cancelled" } };
  if (dateFilter) rentMatch.englishDueDate = dateFilter;

  const rentStats = await Rent.aggregate([
    { $match: rentMatch },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        grossPaisa: { $sum: "$grossRentAmountPaisa" },
        paidPaisa: { $sum: "$paidAmountPaisa" },
        tdsPaisa: { $sum: { $ifNull: ["$tdsAmountPaisa", 0] } },
      },
    },
  ]);

  let totalRents = 0, paidCount = 0, outstandingPaisa = 0, totalExpectedNetPaisa = 0;
  for (const s of rentStats) {
    totalRents += s.count;
    const netExpected = s.grossPaisa - s.tdsPaisa;
    totalExpectedNetPaisa += netExpected;
    if (s._id === "paid") {
      paidCount += s.count;
    } else {
      outstandingPaisa += netExpected - s.paidPaisa;
    }
  }
  outstandingPaisa = Math.max(0, outstandingPaisa);

  // ── 3. Arrears aging — all currently open rents, aged by days past due ───────
  // This is always cross-period (live snapshot of what is currently owed).
  const nowMs = Date.now();

  const agingPipeline = await Rent.aggregate([
    { $match: { status: { $in: ["pending", "partially_paid", "overdue"] } } },
    {
      $addFields: {
        netOwedPaisa: {
          $max: [
            0,
            {
              $subtract: [
                { $subtract: ["$grossRentAmountPaisa", { $ifNull: ["$tdsAmountPaisa", 0] }] },
                "$paidAmountPaisa",
              ],
            },
          ],
        },
        daysPastDue: {
          $divide: [
            { $subtract: [new Date(nowMs), "$englishDueDate"] },
            86400000,
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lte: ["$daysPastDue", 0] }, then: "current" },
              { case: { $lte: ["$daysPastDue", 30] }, then: "1-30" },
              { case: { $lte: ["$daysPastDue", 60] }, then: "31-60" },
            ],
            default: "60+",
          },
        },
        count: { $sum: 1 },
        amountPaisa: { $sum: "$netOwedPaisa" },
      },
    },
  ]);

  const arrearsAging = {
    current:  { count: 0, amountPaisa: 0 },
    days30:   { count: 0, amountPaisa: 0 },
    days60:   { count: 0, amountPaisa: 0 },
    days90Plus: { count: 0, amountPaisa: 0 },
  };
  for (const b of agingPipeline) {
    const key = b._id === "1-30" ? "days30" : b._id === "31-60" ? "days60" : b._id === "60+" ? "days90Plus" : "current";
    arrearsAging[key] = { count: b.count, amountPaisa: Math.max(0, b.amountPaisa) };
  }

  // ── 4. NOI = Revenue − Operating Expenses (excludes loan interest & NEA cost) ─
  const expOpMatch = { ...entityFilter };
  if (dateFilter) expOpMatch.englishDate = dateFilter;
  expOpMatch.referenceType = { $nin: ["ELECTRICITY_NEA_COST", "LOAN_INTEREST"] };

  const [expOpAgg] = await Expense.aggregate([
    { $match: expOpMatch },
    { $group: { _id: null, total: { $sum: "$amountPaisa" } } },
  ]);
  const operatingExpensesPaisa = expOpAgg?.total ?? 0;
  const currentRevenuePaisa = Math.round((currentSummary.totals.totalRevenue ?? 0) * 100);
  const noiPaisa = currentRevenuePaisa - operatingExpensesPaisa;

  // ── 5. YoY deltas ────────────────────────────────────────────────────────────
  const yoyDeltas = prevSummary
    ? {
        revenue: {
          currentPaisa: currentRevenuePaisa,
          prevPaisa: Math.round((prevSummary.totals.totalRevenue ?? 0) * 100),
          pct: pctChange(prevSummary.totals.totalRevenue, currentSummary.totals.totalRevenue),
        },
        expenses: {
          currentPaisa: Math.round((currentSummary.totals.totalExpenses ?? 0) * 100),
          prevPaisa: Math.round((prevSummary.totals.totalExpenses ?? 0) * 100),
          pct: pctChange(prevSummary.totals.totalExpenses, currentSummary.totals.totalExpenses),
        },
        netCashFlow: {
          currentPaisa: Math.round((currentSummary.totals.netCashFlow ?? 0) * 100),
          prevPaisa: Math.round((prevSummary.totals.netCashFlow ?? 0) * 100),
          pct: pctChange(prevSummary.totals.netCashFlow, currentSummary.totals.netCashFlow),
        },
      }
    : null;

  return {
    collection: {
      totalRents,
      paidCount,
      pendingCount: totalRents - paidCount,
      ratePct: totalRents > 0 ? +((paidCount / totalRents) * 100).toFixed(1) : 0,
      outstandingPaisa,
      totalExpectedNetPaisa,
    },
    arrearsAging,
    noi: {
      revenuePaisa: currentRevenuePaisa,
      operatingExpensesPaisa,
      noiPaisa,
      noiMarginPct:
        currentRevenuePaisa > 0
          ? +((noiPaisa / currentRevenuePaisa) * 100).toFixed(1)
          : 0,
    },
    yoyDeltas,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 2. MONTHLY CHART DATA ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Return per-month revenue/expenses/liabilities for:
 *   - a single quarter    (quarter=1-4)
 *   - a full fiscal year  (allYear=true, fiscalYear=BS year)
 *   - last 5 months       (default fallback)
 *
 * entityId is forwarded to getAccountingSummary for each month bucket.
 */
export async function getMonthlyChartData({
  quarter,
  fiscalYear,
  allYear = false,
  entityId = null,
  paymentMethod = null, // Payment method filter
} = {}) {
  let months;

  if (allYear) {
    const year = fiscalYear ?? new NepaliDate().getYear();
    months = getFiscalYearMonths(year);
  } else if (quarter) {
    months = getQuarterMonths(Number(quarter), fiscalYear);
  } else {
    months = getLastNMonths(5);
  }

  // FIX: Was N sequential getAccountingSummary() calls (one per month).
  // Replaced with 3 single aggregations (Revenue, Expense, Liability) that
  // fetch all months at once and group by year+month in-memory.
  // For a 12-month allYear view this goes from 12×3 DB round-trips → 3.

  // Build the date range covering all target months
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const { startDate: rangeStart } = bsMonthToDateRange(
    firstMonth.year,
    firstMonth.month0,
  );
  const { endDate: rangeEnd } = bsMonthToDateRange(
    lastMonth.year,
    lastMonth.month0,
  );

  const dateFilter = buildDateFilter(rangeStart, rangeEnd);
  const entityFilter = buildEntityFilter(entityId);

  const revMatch = { ...entityFilter };
  if (dateFilter) revMatch.englishDate = dateFilter;
  if (paymentMethod) revMatch.paymentMethod = paymentMethod;

  const expMatch = { ...entityFilter };
  if (dateFilter) expMatch.englishDate = dateFilter;
  expMatch.referenceType = { $ne: "ELECTRICITY_NEA_COST" }; // exclude unsettled NEA liability
  if (paymentMethod) expMatch.paymentMethod = paymentMethod;

  const liabMatch = { ...entityFilter };
  if (dateFilter) liabMatch.englishDate = dateFilter;
  if (paymentMethod) liabMatch.paymentMethod = paymentMethod;

  const [revDocs, expDocs, liabDocs] = await Promise.all([
    Revenue.aggregate([
      { $match: revMatch },
      {
        $group: {
          _id: { year: "$nepaliYear", month: "$nepaliMonth" },
          total: { $sum: "$amountPaisa" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: expMatch },
      {
        $group: {
          _id: { year: "$nepaliYear", month: "$nepaliMonth" },
          total: { $sum: "$amountPaisa" },
        },
      },
    ]),
    Liability.aggregate([
      { $match: liabMatch },
      {
        $group: {
          _id: { year: "$nepaliYear", month: "$nepaliMonth" },
          total: { $sum: "$amountPaisa" },
        },
      },
    ]),
  ]);

  // Index by "YYYY-MM" key for O(1) lookup
  const revByKey = new Map(
    revDocs.map((d) => [
      `${d._id.year}-${String(d._id.month).padStart(2, "0")}`,
      d.total,
    ]),
  );
  const expByKey = new Map(
    expDocs.map((d) => [
      `${d._id.year}-${String(d._id.month).padStart(2, "0")}`,
      d.total,
    ]),
  );
  const liabByKey = new Map(
    liabDocs.map((d) => [
      `${d._id.year}-${String(d._id.month).padStart(2, "0")}`,
      d.total,
    ]),
  );

  const results = months.map(({ year, month0 }) => {
    const nepaliMonth = month0 + 1; // DB stores 1-based
    const key = `${year}-${String(nepaliMonth).padStart(2, "0")}`;
    return {
      key,
      label: NEPALI_MONTH_NAMES[month0],
      revenue: paisaToRupees(revByKey.get(key) ?? 0),
      expenses: paisaToRupees(expByKey.get(key) ?? 0),
      liabilities: paisaToRupees(liabByKey.get(key) ?? 0),
    };
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. REVENUE BREAKDOWN SUMMARY ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full revenue breakdown for the RevenueBreakDown page.
 *
 * entityId scopes which entity's revenue records are returned.
 */
export async function getRevenueBreakdownSummary({
  startDate,
  endDate,
  quarter,
  fiscalYear,
  month,
  entityId = null,
  paymentMethod = null, // Payment method filter
} = {}) {
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (!resolvedStart && !resolvedEnd) {
    if (month) {
      ({ startDate: resolvedStart, endDate: resolvedEnd } =
        resolveMonthToDateRange(Number(month), fiscalYear));
    } else if (quarter && quarter !== "custom") {
      const months = getQuarterMonths(Number(quarter), fiscalYear);
      const first = bsMonthToDateRange(months[0].year, months[0].month0);
      const last = bsMonthToDateRange(
        months[months.length - 1].year,
        months[months.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    } else if (fiscalYear) {
      const fyMonths = getFiscalYearMonths(fiscalYear);
      const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
      const last = bsMonthToDateRange(
        fyMonths[fyMonths.length - 1].year,
        fyMonths[fyMonths.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    }
  }

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  // Merge date + entity + payment method filters
  const match = { ...entityFilter };
  if (dateFilter) match.englishDate = dateFilter;
  if (paymentMethod) match.paymentMethod = paymentMethod;

  const revenues = await Revenue.aggregate([
    { $match: match },
    {
      $lookup: {
        from: RevenueSource.collection.name,
        localField: "source",
        foreignField: "_id",
        as: "source",
      },
    },
    { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    { $sort: { englishDate: -1 } },
  ]);

  if (!revenues.length) {
    return {
      totals: { total: 0, count: 0, avg: 0, momPct: null },
      streams: [],
      trend: [],
      payerSplit: [],
      paymentMethodSplit: [],
      refTypes: [],
      topTenants: [],
      statusMap: {},
      transactions: [],
    };
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalPaisa = revenues.reduce((s, r) => s + (r.amountPaisa || 0), 0);
  const total = paisaToRupees(totalPaisa);
  const count = revenues.length;
  const avg = count ? total / count : 0;

  // ── Revenue streams by source ─────────────────────────────────────────────
  const srcMap = new Map();
  revenues.forEach((r) => {
    const id = String(r.source?._id ?? "unknown");
    if (!srcMap.has(id)) {
      srcMap.set(id, {
        code: r.source?.code ?? "?",
        name: r.source?.name ?? "Unknown",
        amountPaisa: 0,
        count: 0,
      });
    }
    const entry = srcMap.get(id);
    entry.amountPaisa += r.amountPaisa || 0;
    entry.count += 1;
  });

  const streams = [...srcMap.values()]
    .map((s) => ({
      code: s.code,
      name: s.name,
      amount: paisaToRupees(s.amountPaisa),
      count: s.count,
      pct:
        total > 0
          ? +((paisaToRupees(s.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Monthly trend (prefer stored nepaliYear/nepaliMonth — same as Expense breakdown)
  const trendMap = new Map();
  revenues.forEach((r) => addRevenueTrendBucket(r, trendMap));

  const trend = [...trendMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8)
    .map((m) => ({
      ...m,
      revenue: paisaToRupees(m.amountPaisa),
      amountPaisa: undefined,
    }));

  const momPct =
    trend.length >= 2
      ? pctChange(
          trend[trend.length - 2].revenue,
          trend[trend.length - 1].revenue,
        )
      : null;

  // ── Payer split ───────────────────────────────────────────────────────────
  let tenantPaisa = 0;
  let externalPaisa = 0;
  revenues.forEach((r) => {
    if (r.payerType === "TENANT") tenantPaisa += r.amountPaisa || 0;
    else externalPaisa += r.amountPaisa || 0;
  });
  const payerSplit = [
    {
      name: "Tenant",
      amount: paisaToRupees(tenantPaisa),
      pct:
        total > 0
          ? +((paisaToRupees(tenantPaisa) / total) * 100).toFixed(1)
          : 0,
    },
    {
      name: "External",
      amount: paisaToRupees(externalPaisa),
      pct:
        total > 0
          ? +((paisaToRupees(externalPaisa) / total) * 100).toFixed(1)
          : 0,
    },
  ].filter((p) => p.amount > 0);

  // ── Payment method split ──────────────────────────────────────────────────
  const methodMap = new Map();
  revenues.forEach((r) => {
    const method = r.paymentMethod ?? "unknown";
    if (!methodMap.has(method)) {
      methodMap.set(method, { method, amountPaisa: 0, count: 0 });
    }
    const entry = methodMap.get(method);
    entry.amountPaisa += r.amountPaisa || 0;
    entry.count += 1;
  });
  const paymentMethodSplit = [...methodMap.values()]
    .map((m) => ({
      method: m.method,
      amount: paisaToRupees(m.amountPaisa),
      count: m.count,
      pct:
        total > 0
          ? +((paisaToRupees(m.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Reference types ───────────────────────────────────────────────────────
  const refMap = new Map();
  revenues.forEach((r) => {
    const t = r.referenceType ?? "MANUAL";
    if (!refMap.has(t)) refMap.set(t, { type: t, amountPaisa: 0, count: 0 });
    const entry = refMap.get(t);
    entry.amountPaisa += r.amountPaisa || 0;
    entry.count += 1;
  });
  const refTypes = [...refMap.values()]
    .map((r) => ({
      type: r.type,
      amount: paisaToRupees(r.amountPaisa),
      count: r.count,
      pct:
        total > 0
          ? +((paisaToRupees(r.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Top tenants ───────────────────────────────────────────────────────────
  const tenantMap = new Map();
  revenues
    .filter((r) => r.payerType === "TENANT")
    .forEach((r) => {
      const id = String(r.tenant?._id ?? "unknown");
      if (!tenantMap.has(id)) {
        tenantMap.set(id, {
          id,
          name: r.tenant?.name ?? "Unknown Tenant",
          amountPaisa: 0,
          count: 0,
          sources: new Set(),
        });
      }
      const entry = tenantMap.get(id);
      entry.amountPaisa += r.amountPaisa || 0;
      entry.count += 1;
      if (r.source?.name) entry.sources.add(r.source.name);
    });

  const topTenants = [...tenantMap.values()]
    .map((t) => ({
      id: t.id,
      name: t.name,
      amount: paisaToRupees(t.amountPaisa),
      count: t.count,
      pctOfTotal:
        total > 0
          ? +((paisaToRupees(t.amountPaisa) / total) * 100).toFixed(1)
          : 0,
      sources: [...t.sources].join(", "),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusMap = {};
  revenues.forEach((r) => {
    const s = r.status ?? "RECORDED";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  // ── Transactions ──────────────────────────────────────────────────────────
  const transactions = revenues.map((r) => {
    const bsDate = revenueTransactionBsDate(r);

    return {
      id: String(r._id),
      payer:
        r.payerType === "TENANT"
          ? (r.tenant?.name ?? "Tenant")
          : (r.externalPayer?.name ?? "External"),
      source: r.source?.name ?? "—",
      refType: r.referenceType ?? "MANUAL",
      payerType: r.payerType,
      amount: paisaToRupees(r.amountPaisa || 0),
      bsDate,
      status: r.status ?? "RECORDED",
      paymentMethod: r.paymentMethod ?? null,
    };
  });

  return {
    totals: { total, count, avg, momPct },
    streams,
    trend,
    payerSplit,
    paymentMethodSplit,
    refTypes,
    topTenants,
    statusMap,
    transactions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 4. EXPENSE BREAKDOWN SUMMARY ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full expense breakdown for the ExpenseBreakDown page.
 *
 * entityId scopes which entity's expense records are returned.
 */
export async function getExpenseBreakdownSummary({
  startDate,
  endDate,
  quarter,
  fiscalYear,
  month,
  entityId = null,
  paymentMethod = null, // Payment method filter
} = {}) {
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (!resolvedStart && !resolvedEnd) {
    if (month) {
      ({ startDate: resolvedStart, endDate: resolvedEnd } =
        resolveMonthToDateRange(Number(month), fiscalYear));
    } else if (quarter && quarter !== "custom") {
      const months = getQuarterMonths(Number(quarter), fiscalYear);
      const first = bsMonthToDateRange(months[0].year, months[0].month0);
      const last = bsMonthToDateRange(
        months[months.length - 1].year,
        months[months.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    } else if (fiscalYear) {
      const fyMonths = getFiscalYearMonths(fiscalYear);
      const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
      const last = bsMonthToDateRange(
        fyMonths[fyMonths.length - 1].year,
        fyMonths[fyMonths.length - 1].month0,
      );
      resolvedStart = first.startDate;
      resolvedEnd = last.endDate;
    }
  }

  const entityFilter = buildEntityFilter(entityId);

  // ── Build match ───────────────────────────────────────────────────────────
  // Prefer nepaliMonth index match for quarter (stored field, no date conversion).
  let match = { ...entityFilter };

  if (!startDate && !endDate) {
    if (month) {
      match.nepaliMonth = Number(month);
      if (fiscalYear) match.nepaliYear = Number(fiscalYear);
    } else if (quarter && quarter !== "custom") {
      const nepaliMonths = FISCAL_QUARTER_MONTHS[Number(quarter)].map(
        (m0) => m0 + 1,
      );
      match.nepaliMonth = { $in: nepaliMonths };
      if (fiscalYear) match.nepaliYear = Number(fiscalYear);
    } else if (fiscalYear) {
      const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
      if (dateFilter) match.englishDate = dateFilter;
    }
  } else {
    const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
    if (dateFilter) match.englishDate = dateFilter;
  }

  // Add payment method filter
  if (paymentMethod) match.paymentMethod = paymentMethod;

  const expenses = await Expense.aggregate([
    { $match: match },
    {
      $lookup: {
        from: ExpenseSource.collection.name,
        localField: "source",
        foreignField: "_id",
        as: "source",
      },
    },
    { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    { $sort: { englishDate: -1 } },
  ]);

  if (!expenses.length) {
    return {
      totals: { total: 0, count: 0, avg: 0, momPct: null },
      categories: [],
      trend: [],
      payeeSplit: [],
      refTypes: [],
      operatingAmt: 0,
      nonOpAmt: 0,
      statusMap: {},
      transactions: [],
    };
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalPaisa = expenses.reduce((s, e) => s + (e.amountPaisa || 0), 0);
  const total = paisaToRupees(totalPaisa);
  const count = expenses.length;
  const avg = count ? total / count : 0;

  // ── Categories by source ──────────────────────────────────────────────────
  const catMap = new Map();
  expenses.forEach((e) => {
    const isLoanInterest = e.referenceType === "LOAN_INTEREST";
    const src = e.source && e.source._id ? e.source : null;
    const id = src
      ? String(src._id)
      : isLoanInterest
        ? "__LOAN_INTEREST__"
        : `orphan_${e._id}`;
    if (!catMap.has(id)) {
      catMap.set(id, {
        code: src?.code ?? (isLoanInterest ? "INTEREST" : "?"),
        name: src?.name ?? (isLoanInterest ? INTEREST_EXPENSE_LABEL : "Unknown"),
        amountPaisa: 0,
        count: 0,
      });
    }
    const entry = catMap.get(id);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });

  const categories = [...catMap.values()]
    .map((c) => ({
      code: c.code,
      name: c.name,
      amount: paisaToRupees(c.amountPaisa),
      count: c.count,
      pct:
        total > 0
          ? +((paisaToRupees(c.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const trendMap = new Map();
  expenses.forEach((e) => {
    if (!e.nepaliYear || !e.nepaliMonth) return;
    const month0 = (e.nepaliMonth - 1) % 12;
    const key = `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}`;
    if (!trendMap.has(key)) {
      trendMap.set(key, {
        key,
        label: NEPALI_MONTH_NAMES[month0],
        amountPaisa: 0,
        count: 0,
      });
    }
    const entry = trendMap.get(key);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });

  const trend = [...trendMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8)
    .map((m) => ({
      key: m.key,
      label: m.label,
      expenses: paisaToRupees(m.amountPaisa),
      count: m.count,
    }));

  const momPct =
    trend.length >= 2
      ? pctChange(
          trend[trend.length - 2].expenses,
          trend[trend.length - 1].expenses,
        )
      : null;

  // ── Payee split ───────────────────────────────────────────────────────────
  let extPaisa = 0;
  let tenPaisa = 0;
  expenses.forEach((e) => {
    if (e.payeeType === "EXTERNAL") extPaisa += e.amountPaisa || 0;
    else tenPaisa += e.amountPaisa || 0;
  });
  const payeeSplit = [
    {
      name: "External",
      amount: paisaToRupees(extPaisa),
      pct:
        total > 0 ? +((paisaToRupees(extPaisa) / total) * 100).toFixed(1) : 0,
    },
    {
      name: "Tenant",
      amount: paisaToRupees(tenPaisa),
      pct:
        total > 0 ? +((paisaToRupees(tenPaisa) / total) * 100).toFixed(1) : 0,
    },
  ].filter((p) => p.amount > 0);

  // ── Payment method split ──────────────────────────────────────────────────
  const methodMap = new Map();
  expenses.forEach((e) => {
    const method = e.paymentMethod ?? "unknown";
    if (!methodMap.has(method)) {
      methodMap.set(method, { method, amountPaisa: 0, count: 0 });
    }
    const entry = methodMap.get(method);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });
  const paymentMethodSplit = [...methodMap.values()]
    .map((m) => ({
      method: m.method,
      amount: paisaToRupees(m.amountPaisa),
      count: m.count,
      pct:
        total > 0
          ? +((paisaToRupees(m.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Reference types ───────────────────────────────────────────────────────
  const refMap = new Map();
  expenses.forEach((e) => {
    const t = e.referenceType ?? "MANUAL";
    if (!refMap.has(t)) refMap.set(t, { type: t, amountPaisa: 0, count: 0 });
    const entry = refMap.get(t);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });
  const refTypes = [...refMap.values()]
    .map((r) => ({
      type: r.type,
      amount: paisaToRupees(r.amountPaisa),
      count: r.count,
      pct:
        total > 0
          ? +((paisaToRupees(r.amountPaisa) / total) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Operating vs non-operating ────────────────────────────────────────────
  let operatingPaisa = 0;
  let nonOpPaisa = 0;
  expenses.forEach((e) => {
    if (OPERATING_REF_TYPES.has(e.referenceType))
      operatingPaisa += e.amountPaisa || 0;
    else nonOpPaisa += e.amountPaisa || 0;
  });

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusMap = {};
  expenses.forEach((e) => {
    const s = e.status ?? "RECORDED";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  // ── Transactions ──────────────────────────────────────────────────────────
  const transactions = expenses.map((e) => ({
    id: String(e._id),
    source:
      e.source?.name ??
      (e.referenceType === "LOAN_INTEREST" ? INTEREST_EXPENSE_LABEL : "—"),
    refType: e.referenceType ?? "MANUAL",
    payeeType: e.payeeType,
    amount: paisaToRupees(e.amountPaisa || 0),
    bsDate:
      e.nepaliYear && e.nepaliMonth
        ? `${NEPALI_MONTH_NAMES[(e.nepaliMonth - 1) % 12]} ${e.nepaliYear}`
        : (() => {
            const bs = toBS(new Date(e.englishDate ?? e.createdAt));
            return bs ? `${NEPALI_MONTH_NAMES[bs.month0]} ${bs.year}` : "—";
          })(),
    status: e.status ?? "RECORDED",
    notes: e.notes ?? "",
    paymentMethod: e.paymentMethod ?? null,
  }));

  return {
    totals: { total, count, avg, momPct },
    categories,
    trend,
    payeeSplit,
    paymentMethodSplit,
    refTypes,
    operatingAmt: paisaToRupees(operatingPaisa),
    nonOpAmt: paisaToRupees(nonOpPaisa),
    statusMap,
    transactions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 5. PROFIT & LOSS STATEMENT ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Structured Profit & Loss statement for the selected period.
 *
 *   Gross Revenue
 *   − Operating Expenses  (MAINTENANCE + UTILITY + SALARY + other)
 *   = Operating Profit (EBIT / NOI)
 *   − Interest Expense    (LOAN_INTEREST)
 *   = Net Income
 *
 * Includes YoY comparison when fiscalYear is provided.
 */
export async function getProfitLossStatement({
  startDate,
  endDate,
  quarter,
  month,
  fiscalYear,
  entityId = null,
}) {
  // ── Resolve date range ────────────────────────────────────────────────────
  let resolvedStart = startDate;
  let resolvedEnd   = endDate;

  if (!resolvedStart && !resolvedEnd) {
    if (month) {
      ({ startDate: resolvedStart, endDate: resolvedEnd } = resolveMonthToDateRange(Number(month), fiscalYear));
    } else if (quarter) {
      const months = getQuarterMonths(Number(quarter), fiscalYear);
      const first  = bsMonthToDateRange(months[0].year, months[0].month0);
      const last   = bsMonthToDateRange(months[months.length - 1].year, months[months.length - 1].month0);
      resolvedStart = first.startDate;
      resolvedEnd   = last.endDate;
    } else if (fiscalYear) {
      const fyMonths = getFiscalYearMonths(fiscalYear);
      const first    = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
      const last     = bsMonthToDateRange(fyMonths[fyMonths.length - 1].year, fyMonths[fyMonths.length - 1].month0);
      resolvedStart  = first.startDate;
      resolvedEnd    = last.endDate;
    }
  }

  const dateFilter   = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  // ── Fetch current & previous period summaries in parallel ─────────────────
  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;
  const [currentSummary, prevSummary] = await Promise.all([
    getAccountingSummary({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    prevFiscalYear !== null
      ? getAccountingSummary({ quarter, month, fiscalYear: prevFiscalYear, entityId })
      : Promise.resolve(null),
  ]);

  // ── Aggregate expenses by referenceType ───────────────────────────────────
  const expMatch = { ...entityFilter };
  if (dateFilter) expMatch.englishDate = dateFilter;

  const expByRefType = await Expense.aggregate([
    { $match: expMatch },
    {
      $group: {
        _id: { $ifNull: ["$referenceType", "OTHER"] },
        totalPaisa: { $sum: "$amountPaisa" },
        count:      { $sum: 1 },
      },
    },
  ]);

  const refMap = {};
  for (const row of expByRefType) refMap[row._id] = row.totalPaisa;

  const maintenancePaisa     = refMap.MAINTENANCE         ?? 0;
  const utilityPaisa         = refMap.UTILITY             ?? 0;
  const salaryPaisa          = refMap.SALARY              ?? 0;
  const interestPaisa        = refMap.LOAN_INTEREST        ?? 0;
  const electricityPaisa     = refMap.ELECTRICITY_NEA_COST ?? 0;
  const manualPaisa          = refMap.MANUAL              ?? 0;

  // Total cash expenses (excludes ELECTRICITY_NEA_COST which is a payable, not cash out)
  const totalCashExpPaisa    = maintenancePaisa + utilityPaisa + salaryPaisa + interestPaisa + manualPaisa;
  const operatingExpPaisa    = maintenancePaisa + utilityPaisa + salaryPaisa + manualPaisa;

  const grossRevenuePaisa    = Math.round((currentSummary.totals.totalRevenue ?? 0) * 100);
  const ebitPaisa            = grossRevenuePaisa - operatingExpPaisa;
  const netIncomePaisa       = ebitPaisa - interestPaisa;

  const ebitMarginPct        = grossRevenuePaisa > 0 ? +((ebitPaisa / grossRevenuePaisa) * 100).toFixed(1) : 0;
  const netMarginPct         = grossRevenuePaisa > 0 ? +((netIncomePaisa / grossRevenuePaisa) * 100).toFixed(1) : 0;
  const expenseRatioPct      = grossRevenuePaisa > 0 ? +((totalCashExpPaisa / grossRevenuePaisa) * 100).toFixed(1) : 0;

  // ── Monthly trend (full fiscal year) ──────────────────────────────────────
  const monthlyTrend = fiscalYear
    ? await getMonthlyChartData({ fiscalYear, allYear: true, entityId })
    : await getMonthlyChartData({ quarter, entityId });

  // ── YoY comparison ────────────────────────────────────────────────────────
  let comparison = null;
  if (prevSummary) {
    const prevRevPaisa = Math.round((prevSummary.totals.totalRevenue  ?? 0) * 100);
    const prevExpPaisa = Math.round((prevSummary.totals.totalExpenses ?? 0) * 100);
    const prevNetPaisa = Math.round((prevSummary.totals.netCashFlow   ?? 0) * 100);
    comparison = {
      prevFiscalYear,
      prevRevenuePaisa:   prevRevPaisa,
      prevExpensesPaisa:  prevExpPaisa,
      prevNetIncomePaisa: prevNetPaisa,
      revenuePct:  pctChange(prevSummary.totals.totalRevenue,  currentSummary.totals.totalRevenue),
      expensesPct: pctChange(prevSummary.totals.totalExpenses, currentSummary.totals.totalExpenses),
      netPct:      pctChange(prevSummary.totals.netCashFlow,   currentSummary.totals.netCashFlow),
    };
  }

  return {
    period: { fiscalYear, quarter, month, startDate: resolvedStart, endDate: resolvedEnd },
    revenue: {
      totalPaisa:   grossRevenuePaisa,
      totalRupees:  paisaToRupees(grossRevenuePaisa),
      breakdown:    currentSummary.incomeStreams?.breakdown ?? [],
    },
    expenses: {
      totalCashPaisa:     totalCashExpPaisa,
      totalCashRupees:    paisaToRupees(totalCashExpPaisa),
      operatingPaisa:     operatingExpPaisa,
      operatingRupees:    paisaToRupees(operatingExpPaisa),
      interestPaisa,
      interestRupees:     paisaToRupees(interestPaisa),
      electricityPaisa,   // pending payable — shown separately
      maintenancePaisa,
      utilityPaisa,
      salaryPaisa,
      manualPaisa,
      breakdown:          currentSummary.expensesBreakdown ?? [],
    },
    ebit: {
      paisa:     ebitPaisa,
      rupees:    paisaToRupees(ebitPaisa),
      marginPct: ebitMarginPct,
    },
    netIncome: {
      paisa:     netIncomePaisa,
      rupees:    paisaToRupees(netIncomePaisa),
      marginPct: netMarginPct,
    },
    expenseRatioPct,
    comparison,
    monthlyTrend,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 6. FINANCIAL RATIOS ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Key financial ratios for the selected period with YoY comparison.
 *
 *   Profitability: Net Margin, Operating (NOI) Margin, Expense Ratio
 *   Efficiency:    Collection Rate, Outstanding Ratio, Arrears Aging
 *   Leverage:      Debt-to-Revenue, Total Liabilities
 *   Activity:      Revenue trend, Expense trend
 */
export async function getFinancialRatios({
  startDate,
  endDate,
  quarter,
  month,
  fiscalYear,
  entityId = null,
}) {
  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;

  const [currentSummary, prevSummary, health] = await Promise.all([
    getAccountingSummary({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    prevFiscalYear !== null
      ? getAccountingSummary({ quarter, month, fiscalYear: prevFiscalYear, entityId })
      : Promise.resolve(null),
    getPortfolioHealth({ startDate, endDate, quarter, month, fiscalYear, entityId }),
  ]);

  const revPaisa  = Math.round((currentSummary.totals.totalRevenue    ?? 0) * 100);
  const expPaisa  = Math.round((currentSummary.totals.totalExpenses   ?? 0) * 100);
  const netPaisa  = Math.round((currentSummary.totals.netCashFlow     ?? 0) * 100);
  const liabPaisa = Math.round((currentSummary.totals.totalLiabilities ?? 0) * 100);

  // ── Profitability ─────────────────────────────────────────────────────────
  const netMarginPct       = revPaisa > 0 ? +((netPaisa  / revPaisa) * 100).toFixed(2) : 0;
  const operatingMarginPct = health.noi.noiMarginPct;
  const expenseRatioPct    = revPaisa > 0 ? +((expPaisa  / revPaisa) * 100).toFixed(2) : 0;
  const grossProfitPct     = revPaisa > 0 ? +((health.noi.noiPaisa / revPaisa) * 100).toFixed(2) : 0;

  // ── Previous period ratios ────────────────────────────────────────────────
  let prevRatios = null;
  if (prevSummary) {
    const pRev = Math.round((prevSummary.totals.totalRevenue  ?? 0) * 100);
    const pExp = Math.round((prevSummary.totals.totalExpenses ?? 0) * 100);
    const pNet = Math.round((prevSummary.totals.netCashFlow   ?? 0) * 100);
    prevRatios = {
      netMarginPct:    pRev > 0 ? +((pNet / pRev) * 100).toFixed(2) : 0,
      expenseRatioPct: pRev > 0 ? +((pExp / pRev) * 100).toFixed(2) : 0,
      revenuePaisa:    pRev,
      expensesPaisa:   pExp,
    };
  }

  // ── Leverage ──────────────────────────────────────────────────────────────
  const debtToRevenuePct = revPaisa > 0 ? +((liabPaisa / revPaisa) * 100).toFixed(2) : 0;

  // ── 12-month ratio trend ──────────────────────────────────────────────────
  const monthlyData = fiscalYear
    ? await getMonthlyChartData({ fiscalYear, allYear: true, entityId })
    : await getMonthlyChartData({ quarter, entityId });

  const ratioTrend = monthlyData.map((m) => {
    const rev = m.revenue ?? 0;
    const exp = m.expenses ?? 0;
    const net = rev - exp;
    return {
      key:            m.key,
      label:          m.label,
      revenue:        rev,
      expenses:       exp,
      netMarginPct:   rev > 0 ? +((net / rev) * 100).toFixed(1) : 0,
      expenseRatioPct: rev > 0 ? +((exp / rev) * 100).toFixed(1) : 0,
    };
  });

  return {
    profitability: {
      netMarginPct,
      operatingMarginPct,
      expenseRatioPct,
      grossProfitPct,
      prev: prevRatios,
    },
    efficiency: {
      collectionRatePct:   health.collection.ratePct,
      outstandingRatioPct: health.collection.totalExpectedNetPaisa > 0
        ? +((health.collection.outstandingPaisa / health.collection.totalExpectedNetPaisa) * 100).toFixed(1)
        : 0,
      outstandingPaisa: health.collection.outstandingPaisa,
      paidCount:        health.collection.paidCount,
      totalRents:       health.collection.totalRents,
      arrearsAging:     health.arrearsAging,
    },
    leverage: {
      debtToRevenuePct,
      totalLiabilitiesPaisa: liabPaisa,
      totalLiabilitiesRupees: paisaToRupees(liabPaisa),
    },
    noi: health.noi,
    yoyDeltas: health.yoyDeltas,
    ratioTrend,
    summary: { revenuePaisa: revPaisa, expensesPaisa: expPaisa, netPaisa, liabPaisa },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 7. FINANCIAL PROJECTIONS ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Simple linear regression — returns { slope, intercept } */
function linearRegression(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };

  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** R² coefficient of determination (0–1). */
function rSquared(values, slope, intercept) {
  const mean   = values.reduce((s, v) => s + v, 0) / values.length;
  const ssTot  = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes  = values.reduce((s, v, i) => s + (v - (slope * i + intercept)) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

/**
 * Revenue & expense projections for the next 6 months using linear regression
 * over the last 12 months of actual data (from the two most recent fiscal years).
 *
 * Returns:
 *   historical  — last N months of actuals
 *   projected   — next 6 months (base / optimistic / pessimistic)
 *   model       — regression stats (slope, intercept, r²) for transparency
 */
export async function getProjections({
  fiscalYear,
  entityId = null,
}) {
  const currentFY = fiscalYear ?? new NepaliDate().getYear();
  const prevFY    = currentFY - 1;

  // Fetch 2 full fiscal years to get up to 24 months of history
  const [currentYearData, prevYearData] = await Promise.all([
    getMonthlyChartData({ fiscalYear: currentFY, allYear: true, entityId }),
    getMonthlyChartData({ fiscalYear: prevFY,    allYear: true, entityId }),
  ]);

  // Combine in fiscal year order: prevFY months first, then currentFY months
  const historicalRaw = [...prevYearData, ...currentYearData];

  // Drop leading zeros — only keep from first month with any activity
  const firstActivity = historicalRaw.findIndex((m) => (m.revenue ?? 0) > 0 || (m.expenses ?? 0) > 0);
  const historical     = firstActivity >= 0 ? historicalRaw.slice(firstActivity) : historicalRaw;
  const last12         = historical.slice(-12); // cap at 12 months for projection

  const revValues = last12.map((m) => m.revenue  ?? 0);
  const expValues = last12.map((m) => m.expenses ?? 0);

  const revModel = linearRegression(revValues);
  const expModel = linearRegression(expValues);

  const revR2 = rSquared(revValues, revModel.slope, revModel.intercept);
  const expR2 = rSquared(expValues, expModel.slope, expModel.intercept);

  // ── Generate next 6 months in BS fiscal calendar ─────────────────────────
  const lastActual = last12[last12.length - 1];

  // Parse the last actual key ("YYYY-MM" with 1-based nepali month)
  const [lastYear, lastMonthStr] = (lastActual?.key ?? `${currentFY}-03`).split("-");
  let projYear  = Number(lastYear);
  let projMonth = Number(lastMonthStr); // 1-based nepali month

  const projected = [];
  for (let i = 0; i < 6; i++) {
    projMonth += 1;
    if (projMonth > 12) { projMonth = 1; projYear += 1; }

    const idx   = last12.length + i; // x position in regression
    const baseRev = Math.max(0, revModel.slope * idx + revModel.intercept);
    const baseExp = Math.max(0, expModel.slope * idx + expModel.intercept);

    const key   = `${projYear}-${String(projMonth).padStart(2, "0")}`;
    const label = NEPALI_MONTH_NAMES[(projMonth - 1) % 12];

    projected.push({
      key,
      label,
      isProjected: true,
      base: {
        revenue:  +baseRev.toFixed(2),
        expenses: +baseExp.toFixed(2),
        net:      +(baseRev - baseExp).toFixed(2),
      },
      optimistic: {
        revenue:  +(baseRev * 1.15).toFixed(2),
        expenses: +(baseExp * 0.92).toFixed(2),
        net:      +(baseRev * 1.15 - baseExp * 0.92).toFixed(2),
      },
      pessimistic: {
        revenue:  +(baseRev * 0.85).toFixed(2),
        expenses: +(baseExp * 1.08).toFixed(2),
        net:      +(baseRev * 0.85 - baseExp * 1.08).toFixed(2),
      },
    });
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const avgMonthlyRev = revValues.length > 0 ? revValues.reduce((s, v) => s + v, 0) / revValues.length : 0;
  const avgMonthlyExp = expValues.length > 0 ? expValues.reduce((s, v) => s + v, 0) / expValues.length : 0;

  const revenueGrowthPct = revValues.length >= 2 && revValues[0] > 0
    ? pctChange(revValues[0], revValues[revValues.length - 1])
    : null;

  return {
    historical: last12,
    projected,
    model: {
      revenue:  { slope: +revModel.slope.toFixed(2), intercept: +revModel.intercept.toFixed(2), r2: +revR2.toFixed(3) },
      expenses: { slope: +expModel.slope.toFixed(2), intercept: +expModel.intercept.toFixed(2), r2: +expR2.toFixed(3) },
      dataPoints: last12.length,
    },
    stats: {
      avgMonthlyRevenue:  +avgMonthlyRev.toFixed(2),
      avgMonthlyExpenses: +avgMonthlyExp.toFixed(2),
      avgMonthlyNet:      +(avgMonthlyRev - avgMonthlyExp).toFixed(2),
      projectedAnnualRev: +(projected.reduce((s, m) => s + m.base.revenue, 0) * 2).toFixed(2),
      revenueGrowthPct,
    },
  };
}
