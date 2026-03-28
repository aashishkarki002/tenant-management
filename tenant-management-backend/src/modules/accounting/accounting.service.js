import NepaliDate from "nepali-datetime";
import { ledgerService } from "../ledger/ledger.service.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Liability } from "../liabilities/Liabilities.Model.js";
import { LiabilitySource } from "../liabilities/LiabilitesSource.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { paisaToRupees } from "../../utils/moneyUtil.js";
import mongoose from "mongoose";

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
  return FISCAL_QUARTER_MONTHS[quarter].map((month0) => ({ year, month0 }));
}

function getFiscalYearMonths(fiscalYear) {
  return FISCAL_YEAR_MONTH_ORDER.map((month0) => {
    const year = month0 <= 2 ? fiscalYear + 1 : fiscalYear;
    return { year, month0 };
  });
}

function resolveMonthToDateRange(month, fiscalYear) {
  const month0 = month - 1;
  const year = fiscalYear ?? new NepaliDate().getYear();
  return bsMonthToDateRange(year, month0);
}

function pctChange(base, next) {
  if (!base) return null;
  return +(((next - base) / base) * 100).toFixed(2);
}

// ─── Entity filter builder ────────────────────────────────────────────────────

/**
 * Build a MongoDB match clause for entity-scoped queries.
 *
 * Rules (mirrors migrationsV2 Decision 5 + correction.md):
 *   entityId = null / undefined  → no filter (merged view — include ALL records)
 *   entityId = "private"         → { $or: [{ entityId: null }, { entityId: { $exists: false } }] }
 *                                    legacy entries (null entityId) are implicitly private
 *   entityId = <ObjectId string> → { entityId: new ObjectId(entityId) }
 *
 * The special string "private" is a sentinel for the "show private entity only"
 * case — it avoids requiring the caller to know the actual private entity's _id
 * when the legacy data has entityId: null.
 *
 * @param {string|null|undefined} entityId
 * @returns {object}  MongoDB $match fragment (may be empty object = match all)
 */
function buildEntityFilter(entityId) {
  if (!entityId) return {}; // merged / all — no filter
  if (entityId === "private") {
    // Private entity: include records explicitly tagged private OR legacy null
    return { $or: [{ entityId: null }, { entityId: { $exists: false } }] };
  }
  try {
    return { entityId: new mongoose.Types.ObjectId(entityId) };
  } catch {
    // If parsing fails, fall back to merged (safe default)
    return {};
  }
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
  entityId = null, // NEW
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
  if (dateFilter) revenueMatch.date = dateFilter;

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
  const liabilityMatch = { ...entityFilter };
  if (dateFilter) liabilityMatch.date = dateFilter;

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
  // Expense model uses EnglishDate (capital E and D) — not 'date' like Revenue.
  // Using the wrong field would silently return all expenses regardless of filter.
  if (dateFilter) expenseMatch.EnglishDate = dateFilter;
  expenseMatch.referenceType = { $ne: "ELECTRICITY_NEA_COST" };

  const expenseAggregation = await Expense.aggregate([
    { $match: expenseMatch },
    {
      $group: {
        _id: "$source",
        totalAmountPaisa: { $sum: "$amountPaisa" },
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
  // so it is consistent with totalExpenses above.
  const expensesBreakdown = expenseAggregation.map((item) => ({
    code: String(item._id ?? "unknown"),
    name: String(item._id ?? "expense"),
    amount: paisaToRupees(item.totalAmountPaisa || 0),
  }));

  return {
    totals: { totalRevenue, totalLiabilities, totalExpenses, netCashFlow },
    incomeStreams,
    liabilitiesBreakdown,
    ledger: ledgerSummary,
    expensesBreakdown,
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
  entityId = null, // NEW
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
  if (dateFilter) revMatch.date = dateFilter;

  const expMatch = { ...entityFilter };
  if (dateFilter) expMatch.EnglishDate = dateFilter;
  expMatch.referenceType = { $ne: "ELECTRICITY_NEA_COST" }; // exclude unsettled NEA liability

  const liabMatch = { ...entityFilter };
  if (dateFilter) liabMatch.date = dateFilter;

  const [revDocs, expDocs, liabDocs] = await Promise.all([
    Revenue.aggregate([
      { $match: revMatch },
      {
        $group: {
          _id: { year: "$npYear", month: "$npMonth" },
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
          _id: { year: "$npYear", month: "$npMonth" },
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
  entityId = null, // NEW
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

  // Merge date + entity filters
  const match = { ...entityFilter };
  if (dateFilter) match.date = dateFilter;

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
    { $sort: { date: -1 } },
  ]);

  if (!revenues.length) {
    return {
      totals: { total: 0, count: 0, avg: 0, momPct: null },
      streams: [],
      trend: [],
      payerSplit: [],
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

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const trendMap = new Map();
  revenues.forEach((r) => {
    const bs = toBS(new Date(r.date));
    if (!bs) return;
    const key = `${bs.year}-${String(bs.month0 + 1).padStart(2, "0")}`;
    if (!trendMap.has(key)) {
      trendMap.set(key, {
        key,
        label: NEPALI_MONTH_NAMES[bs.month0],
        amountPaisa: 0,
        count: 0,
      });
    }
    const entry = trendMap.get(key);
    entry.amountPaisa += r.amountPaisa || 0;
    entry.count += 1;
  });

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
    const bs = toBS(new Date(r.date));
    const bsDate = bs
      ? `${new NepaliDate(r.date instanceof Date ? r.date : new Date(r.date)).getDate()} ${NEPALI_MONTH_NAMES[bs.month0]} ${bs.year}`
      : "—";

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
    };
  });

  return {
    totals: { total, count, avg, momPct },
    streams,
    trend,
    payerSplit,
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
  entityId = null, // NEW
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
      if (dateFilter) match.EnglishDate = dateFilter;
    }
  } else {
    const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
    if (dateFilter) match.EnglishDate = dateFilter;
  }

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
    { $sort: { EnglishDate: -1 } },
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
    const id = String(e.source?._id ?? "unknown");
    if (!catMap.has(id)) {
      catMap.set(id, {
        code: e.source?.code ?? "?",
        name: e.source?.name ?? "Unknown",
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
    source: e.source?.name ?? "—",
    refType: e.referenceType ?? "MANUAL",
    payeeType: e.payeeType,
    amount: paisaToRupees(e.amountPaisa || 0),
    bsDate:
      e.nepaliYear && e.nepaliMonth
        ? `${NEPALI_MONTH_NAMES[(e.nepaliMonth - 1) % 12]} ${e.nepaliYear}`
        : (() => {
            const bs = toBS(new Date(e.EnglishDate ?? e.createdAt));
            return bs ? `${NEPALI_MONTH_NAMES[bs.month0]} ${bs.year}` : "—";
          })(),
    status: e.status ?? "RECORDED",
    notes: e.notes ?? "",
  }));

  return {
    totals: { total, count, avg, momPct },
    categories,
    trend,
    payeeSplit,
    refTypes,
    operatingAmt: paisaToRupees(operatingPaisa),
    nonOpAmt: paisaToRupees(nonOpPaisa),
    statusMap,
    transactions,
  };
}
