import NepaliDate from "nepali-datetime";
import { ledgerService } from "../ledger/ledger.service.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Liability } from "../liabilities/Liabilities.Model.js";
import { LiabilitySource } from "../liabilities/LiabilitesSource.Model.js";
import { paisaToRupees } from "../../utils/moneyUtil.js";

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Build a Gregorian date filter from optional ISO startDate / endDate strings.
 * Returns undefined when neither is provided (match-all).
 */
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

/**
 * Convert a JS Date → { year, month0 } in Bikram Sambat.
 * Returns null on failure.
 */
function toBS(date) {
  try {
    const nd = new NepaliDate(date);
    return { year: nd.getYear(), month0: nd.getMonth() };
  } catch {
    return null;
  }
}

/**
 * Return the ISO start/end dates for a given BS year + 0-indexed month.
 */
function bsMonthToDateRange(year, month0) {
  const firstNp = new NepaliDate(year, month0, 1);
  const lastDay = NepaliDate.getDaysOfMonth(year, month0);
  const lastNp = new NepaliDate(year, month0, lastDay);
  const toISO = (nd) => nd.getDateObject().toISOString().split("T")[0];
  return { startDate: toISO(firstNp), endDate: toISO(lastNp) };
}

/**
 * Get the last N BS months ending at today, as [{ year, month0 }].
 */
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

/**
 * Get the 3 BS months for a fiscal quarter.
 * @param {1|2|3|4} quarter
 * @param {number}  [fiscalYear]  Override BS year (defaults to current)
 */
function getQuarterMonths(quarter, fiscalYear) {
  const year = fiscalYear ?? new NepaliDate().getYear();
  return FISCAL_QUARTER_MONTHS[quarter].map((month0) => ({ year, month0 }));
}

/**
 * Compute % change; returns null when base is 0 (avoids division by zero).
 */
function pctChange(base, next) {
  if (!base) return null;
  return +(((next - base) / base) * 100).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. ACCOUNTING SUMMARY (existing, unchanged) ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build accounting summary for dashboard (revenue, liabilities, cash flow, breakdowns).
 * Filters: startDate / endDate (ISO strings) | nepaliYear | quarter (1-4)
 */
export async function getAccountingSummary({
  startDate,
  endDate,
  nepaliYear,
  quarter,
}) {
  const dateFilter = buildDateFilter(startDate, endDate);

  // Aggregate revenues by source
  const revenueMatch = {};
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

  // Aggregate liabilities by source
  const liabilityMatch = {};
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

  // Expenses from ledger (until dedicated expense model is primary)
  const ledgerSummary = await ledgerService.getLedgerSummary({
    startDate,
    endDate,
    nepaliYear,
    quarter,
  });
  const accounts = ledgerSummary.accounts || [];
  const byType = (type) =>
    accounts.filter(
      (acc) => acc.accountType === type || acc.accountDetails?.type === type,
    );
  const sumNet = (list) =>
    list.reduce((sum, acc) => sum + (acc.netBalance || 0), 0);

  const expenseAccounts = byType("EXPENSE");
  const totalExpenses = sumNet(expenseAccounts);

  const totalRevenue = revenueAggregation.reduce(
    (sum, item) => sum + paisaToRupees(item.totalAmountPaisa || 0),
    0,
  );
  const totalLiabilities = liabilityAggregation.reduce(
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

  const expensesBreakdown = expenseAccounts.map((item) => ({
    code: item.accountCode,
    name: item.accountName || item.accountCode || "expense",
    amount: Math.abs(item.netBalance || 0),
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
// ─── 2. MONTHLY CHART (replaces N round-trips in useMonthlyChart) ────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Return per-month revenue/expenses/liabilities for a quarter or last 5 months.
 * Single backend function → single HTTP request; eliminates N client round-trips.
 *
 * @param {1|2|3|4|null} quarter      null = last 5 months
 * @param {number}        [fiscalYear] BS year override
 * @returns {Array<{ key, label, revenue, expenses, liabilities }>}
 */
export async function getMonthlyChartData({ quarter, fiscalYear } = {}) {
  const months = quarter
    ? getQuarterMonths(Number(quarter), fiscalYear)
    : getLastNMonths(5);

  const results = await Promise.all(
    months.map(async ({ year, month0 }) => {
      const { startDate, endDate } = bsMonthToDateRange(year, month0);
      try {
        const summary = await getAccountingSummary({ startDate, endDate });
        return {
          key: `${year}-${String(month0).padStart(2, "0")}`,
          label: NEPALI_MONTH_NAMES[month0],
          revenue: summary.totals.totalRevenue,
          expenses: summary.totals.totalExpenses,
          liabilities: summary.totals.totalLiabilities,
        };
      } catch {
        return {
          key: `${year}-${String(month0).padStart(2, "0")}`,
          label: NEPALI_MONTH_NAMES[month0],
          revenue: 0,
          expenses: 0,
          liabilities: 0,
        };
      }
    }),
  );

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. REVENUE BREAKDOWN SUMMARY ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full revenue breakdown for the RevenueBreakDown page.
 * All aggregation happens here — frontend receives ready-to-render data.
 *
 * Returns:
 *   totals      – { total, count, avg, momPct }
 *   streams     – [{ code, name, amount, count, pct }]   sorted by amount desc
 *   trend       – [{ key, label, revenue, count }]        last 8 BS months
 *   payerSplit  – [{ name, amount, pct, color }]
 *   refTypes    – [{ type, amount, count, pct }]
 *   topTenants  – [{ id, name, amount, count, pctOfTotal, sources }]
 *   statusMap   – { RECORDED: n, SYNCED: n, REVERSED: n }
 *   transactions– [{ id, payer, source, refType, payerType, amount, bsDate, status }]
 */
export async function getRevenueBreakdownSummary({
  startDate,
  endDate,
  quarter,
  fiscalYear,
} = {}) {
  // Resolve date range from quarter if no explicit date range
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (quarter && quarter !== "custom" && !startDate && !endDate) {
    const months = getQuarterMonths(Number(quarter), fiscalYear);
    const first = bsMonthToDateRange(months[0].year, months[0].month0);
    const last = bsMonthToDateRange(
      months[months.length - 1].year,
      months[months.length - 1].month0,
    );
    resolvedStart = first.startDate;
    resolvedEnd = last.endDate;
  }

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const match = dateFilter ? { date: dateFilter } : {};

  // Fetch revenues with populated relations in one aggregation
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
        from: "tenants", // collection name for Tenant model
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

  // ── Monthly trend (last 8 BS months within matched data) ──────────────────
  const trendMap = new Map();
  revenues.forEach((r) => {
    const bs = toBS(new Date(r.date));
    if (!bs) return;
    const key = `${bs.year}-${String(bs.month0).padStart(2, "0")}`;
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

  // MoM % change
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

  // ── Transactions (already sorted desc by date) ────────────────────────────
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
 * Import the Expense and ExpenseSource models.
 * Adjust the import path to match your project structure.
 */
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";

const OPERATING_REF_TYPES = new Set(["MAINTENANCE", "UTILITY", "SALARY"]);

/**
 * Full expense breakdown for the ExpenseBreakDown page.
 * All aggregation happens here — frontend receives ready-to-render data.
 *
 * Returns:
 *   totals       – { total, count, avg, momPct }
 *   categories   – [{ code, name, amount, count, pct }]
 *   trend        – [{ key, label, expenses, count }]
 *   payeeSplit   – [{ name, amount, pct }]
 *   refTypes     – [{ type, amount, count, pct }]
 *   operatingAmt – number (salary + utility + maintenance)
 *   nonOpAmt     – number
 *   statusMap    – { RECORDED: n, … }
 *   transactions – [{ id, source, refType, payeeType, amount, bsDate, status, notes }]
 */
export async function getExpenseBreakdownSummary({
  startDate,
  endDate,
  quarter,
  fiscalYear,
} = {}) {
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  if (quarter && quarter !== "custom" && !startDate && !endDate) {
    const months = getQuarterMonths(Number(quarter), fiscalYear);
    const first = bsMonthToDateRange(months[0].year, months[0].month0);
    const last = bsMonthToDateRange(
      months[months.length - 1].year,
      months[months.length - 1].month0,
    );
    resolvedStart = first.startDate;
    resolvedEnd = last.endDate;
  }

  // Build match using nepaliMonth (stored on model) or EnglishDate
  let match = {};
  if (quarter && quarter !== "custom" && !startDate && !endDate) {
    const nepaliMonths = FISCAL_QUARTER_MONTHS[Number(quarter)].map(
      (m0) => m0 + 1,
    ); // convert to 1-indexed
    match = { nepaliMonth: { $in: nepaliMonths } };
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

  // ── Monthly trend (BS months from nepaliYear + nepaliMonth) ───────────────
  const trendMap = new Map();
  expenses.forEach((e) => {
    if (!e.nepaliYear || !e.nepaliMonth) return;
    const month0 = (e.nepaliMonth - 1) % 12; // convert 1-indexed to 0-indexed
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
    // Prefer stored BS date fields; fall back to converting EnglishDate
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
