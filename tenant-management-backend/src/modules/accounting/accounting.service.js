/**
 * accounting.service.js — v2 (LEDGER-FIRST)
 *
 * C1 FIX: All financial totals (revenue, expenses, liabilities, P&L, monthly
 * charts) now derive from LedgerEntry aggregations by account type/code.
 * Domain collections (Revenue, Expense, Liability) are kept ONLY for detail
 * breakdown views that need payer names, payment methods, and transaction lists
 * — data that does not exist on LedgerEntry.
 *
 * Single source of truth for every financial number: the double-entry ledger.
 *
 * Architecture:
 *   TOTALS (getAccountingSummary, getMonthlyChartData, getProfitLossStatement)
 *     → LedgerEntry + Account join aggregations
 *
 *   DETAILS (getRevenueBreakdownSummary, getExpenseBreakdownSummary)
 *     → Revenue/Expense domain collections (payer, method, status detail only)
 *
 *   OPERATIONAL (getPortfolioHealth collection rate, arrears aging)
 *     → Rent collection (not a financial total — operational metric)
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { LedgerEntry } from "../ledger/Ledger.Model.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { paisaToRupees } from "../../utils/moneyUtil.js";
import { buildEntityFilter } from "../../utils/buildEntityFilter.js";
import {
  FISCAL_QUARTER_MONTHS,
  FISCAL_YEAR_MONTH_ORDER,
} from "../../config/fiscalCalendar.js";
import { NEPALI_MONTH_NAMES } from "../../utils/nepaliDateHelper.js";

const OPERATING_REF_TYPES = new Set(["MAINTENANCE", "UTILITY", "SALARY"]);

const INTEREST_EXPENSE_LABEL = "Interest expense";

// Maps ledger account codes to backward-compat stream keys used by the frontend.
const REVENUE_ACCOUNT_STREAM = {
  "4000": "RENT",
  "4050": "CAM",
  "4100": "UTILITY",
  "4200": "LATE_FEE",
  "4300": "MAINTENANCE_REV",
  "4400": "EVENT",
};

// Maps ledger account codes to P&L expense categories.
// 5610 (NEA energy expense) is LEGACY — no new entries are posted to it.
// Energy charges now go to 1400 (ASSET), so 5610 only appears in historical data.
// 5616 (demand charge) is a real owner-borne operating expense → OPERATING.
const EXPENSE_ACCOUNT_CATEGORY = {
  "5000": "OPERATING",
  "5100": "LOAN_INTEREST",
  "5200": "OPERATING",
  "5450": "OPERATING",
  "5615": "OPERATING",         // common area electricity — owner-borne operating cost
  "5616": "OPERATING",         // NEA demand charge — owner-borne fixed monthly cost
  "5700": "OPERATING",         // bad debt expense
  "5750": "OPERATING",         // salaries
  "5800": "OPERATING",         // property tax
  "5900": "OPERATING",         // miscellaneous
};

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
  let key, label;
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
  if (!trendMap.has(key)) trendMap.set(key, { key, label, amountPaisa: 0, count: 0 });
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
    while (month0 < 0) { month0 += 12; year -= 1; }
    months.push({ year, month0 });
  }
  return months;
}

function calendarYearForBsMonth(month0, fiscalYear) {
  return month0 <= 2 ? fiscalYear + 1 : fiscalYear;
}

function getQuarterMonths(quarter, fiscalYear) {
  const year = fiscalYear ?? new NepaliDate().getYear();
  return FISCAL_QUARTER_MONTHS[quarter].map((month0) => ({
    year: calendarYearForBsMonth(month0, year),
    month0,
  }));
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

/**
 * Resolve filter params to Gregorian date range.
 */
function resolveDateRange({ startDate, endDate, month, quarter, fiscalYear }) {
  if (startDate || endDate) return { resolvedStart: startDate, resolvedEnd: endDate };
  if (month) {
    const { startDate: s, endDate: e } = resolveMonthToDateRange(Number(month), fiscalYear);
    return { resolvedStart: s, resolvedEnd: e };
  }
  if (quarter) {
    const months = getQuarterMonths(Number(quarter), fiscalYear);
    const first = bsMonthToDateRange(months[0].year, months[0].month0);
    const last = bsMonthToDateRange(months[months.length - 1].year, months[months.length - 1].month0);
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }
  if (fiscalYear) {
    const fyMonths = getFiscalYearMonths(fiscalYear);
    const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
    const last = bsMonthToDateRange(fyMonths[fyMonths.length - 1].year, fyMonths[fyMonths.length - 1].month0);
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }
  return { resolvedStart: null, resolvedEnd: null };
}

// ─── Balance-sheet KPI helpers ────────────────────────────────────────────────

/**
 * Returns current balances for cash/bank, AR, and AP accounts.
 * LEDGER-FIRST: derived from LedgerEntry aggregations (all-time cumulative).
 * Account.currentBalancePaisa is NOT read here.
 */
async function getBalanceSheetKPIs(entityId) {
  const entityMatch = {};
  if (entityId && entityId !== "private") {
    try { entityMatch.entityId = new mongoose.Types.ObjectId(String(entityId)); } catch { /* skip */ }
  }

  // Single aggregation: join account, filter to cash/AR/AP codes, group by code
  const agg = await LedgerEntry.aggregate([
    { $match: entityMatch },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "acct",
      },
    },
    { $unwind: "$acct" },
    {
      $match: {
        "acct.isActive": true,
        $or: [
          { "acct.code": { $in: ["1000", "1050", "1200", "2000"] } },
          { "acct.code": { $regex: /^1010/ } },
        ],
      },
    },
    {
      $group: {
        _id: "$acct.code",
        totalDebit: { $sum: "$debitAmountPaisa" },
        totalCredit: { $sum: "$creditAmountPaisa" },
      },
    },
  ]);

  let cashBalancePaisa = 0;
  let arBalancePaisa = 0;
  let apBalancePaisa = 0;

  for (const row of agg) {
    const code = String(row._id);
    if (code === "1000" || code === "1050" || code.startsWith("1010")) {
      cashBalancePaisa += row.totalDebit - row.totalCredit; // ASSET: debit-normal
    } else if (code === "1200") {
      arBalancePaisa = row.totalDebit - row.totalCredit;    // AR: ASSET, debit-normal
    } else if (code === "2000") {
      apBalancePaisa = row.totalCredit - row.totalDebit;    // AP: LIABILITY, credit-normal
    }
  }

  return { cashBalancePaisa, arBalancePaisa, apBalancePaisa };
}

async function getCashAccountIds(entityId) {
  const acctFilter = { type: "ASSET", code: { $regex: /^10/ } };
  if (entityId && entityId !== "private") {
    try { acctFilter.entityId = new mongoose.Types.ObjectId(String(entityId)); } catch { /* skip */ }
  }
  const cashAccts = await Account.find(acctFilter, { _id: 1 }).lean();
  return cashAccts.map((a) => a._id);
}

// Financing account codes excluded from operating cash flow.
// SD receipts (2100), loan proceeds/repayments (2200), and capital movements (3000, 3100)
// are balance-sheet events, not operating cash.
const FINANCING_ACCOUNT_CODES = ["2100", "2200", "3000", "3100"];

/**
 * Operating Cash Flow for the period — cash/bank movements excluding financing.
 * Excludes transactions where the offsetting leg touches a financing account (SD, loans, capital).
 */
async function getOperatingCashFlow(ledgerMatch, entityId) {
  const ids = await getCashAccountIds(entityId);
  if (!ids.length) return 0;

  // Find transaction IDs that involve a financing account — these are not operating flows.
  const financingTxns = await LedgerEntry.aggregate([
    { $match: ledgerMatch },
    { $lookup: { from: "accounts", localField: "account", foreignField: "_id", as: "acct" } },
    { $unwind: "$acct" },
    { $match: { "acct.code": { $in: FINANCING_ACCOUNT_CODES } } },
    { $group: { _id: "$transaction" } },
  ]);
  const excludedTxnIds = financingTxns.map((t) => t._id);

  const cashMatch = { ...ledgerMatch, account: { $in: ids } };
  if (excludedTxnIds.length) cashMatch.transaction = { $nin: excludedTxnIds };

  const result = await LedgerEntry.aggregate([
    { $match: cashMatch },
    { $group: { _id: null, dr: { $sum: "$debitAmountPaisa" }, cr: { $sum: "$creditAmountPaisa" } } },
  ]);
  return (result[0]?.dr ?? 0) - (result[0]?.cr ?? 0);
}

/**
 * Cash-basis inflow/outflow breakdown.
 * Finds all journals touching cash/bank accounts (code ^10), then categorizes
 * by the offsetting (non-cash) account — i.e. WHERE the cash came from or went to.
 *
 * Inflow  = DR cash/bank → categorized by the CR leg of that journal
 * Outflow = CR cash/bank → categorized by the DR leg of that journal
 */
async function getCashFlowBreakdown(ledgerMatch, entityId) {
  const cashIds = await getCashAccountIds(entityId);
  if (!cashIds.length) return { inflows: [], outflows: [], totalIn: 0, totalOut: 0, totalInPaisa: 0, totalOutPaisa: 0, net: 0, netPaisa: 0 };

  const [inflowRows, outflowRows] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: { ...ledgerMatch, account: { $in: cashIds }, debitAmountPaisa: { $gt: 0 } } },
      { $group: { _id: "$transaction" } },
      {
        $lookup: {
          from: "ledgerentries",
          let: { txn: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$transaction", "$$txn"] },
              { $not: { $in: ["$account", cashIds] } },
              { $gt: ["$creditAmountPaisa", 0] },
            ] } } },
            { $lookup: { from: "accounts", localField: "account", foreignField: "_id", as: "acct" } },
            { $unwind: "$acct" },
          ],
          as: "credits",
        },
      },
      { $unwind: "$credits" },
      { $group: { _id: { name: "$credits.acct.name", code: "$credits.acct.code", type: "$credits.acct.type" }, amountPaisa: { $sum: "$credits.creditAmountPaisa" } } },
      { $match: { amountPaisa: { $gt: 0 } } },
      { $sort: { amountPaisa: -1 } },
    ]),

    LedgerEntry.aggregate([
      { $match: { ...ledgerMatch, account: { $in: cashIds }, creditAmountPaisa: { $gt: 0 } } },
      { $group: { _id: "$transaction" } },
      {
        $lookup: {
          from: "ledgerentries",
          let: { txn: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$transaction", "$$txn"] },
              { $not: { $in: ["$account", cashIds] } },
              { $gt: ["$debitAmountPaisa", 0] },
            ] } } },
            { $lookup: { from: "accounts", localField: "account", foreignField: "_id", as: "acct" } },
            { $unwind: "$acct" },
          ],
          as: "debits",
        },
      },
      { $unwind: "$debits" },
      { $group: { _id: { name: "$debits.acct.name", code: "$debits.acct.code", type: "$debits.acct.type" }, amountPaisa: { $sum: "$debits.debitAmountPaisa" } } },
      { $match: { amountPaisa: { $gt: 0 } } },
      { $sort: { amountPaisa: -1 } },
    ]),
  ]);

  const totalInPaisa = inflowRows.reduce((s, r) => s + r.amountPaisa, 0);
  const totalOutPaisa = outflowRows.reduce((s, r) => s + r.amountPaisa, 0);

  const inflows = inflowRows.map(r => ({
    name: r._id.name, code: r._id.code, type: r._id.type,
    amount: paisaToRupees(r.amountPaisa), amountPaisa: r.amountPaisa,
    pct: totalInPaisa > 0 ? +((r.amountPaisa / totalInPaisa) * 100).toFixed(1) : 0,
  }));
  const outflows = outflowRows.map(r => ({
    name: r._id.name, code: r._id.code, type: r._id.type,
    amount: paisaToRupees(r.amountPaisa), amountPaisa: r.amountPaisa,
    pct: totalOutPaisa > 0 ? +((r.amountPaisa / totalOutPaisa) * 100).toFixed(1) : 0,
  }));

  return {
    inflows,
    outflows,
    totalIn: paisaToRupees(totalInPaisa),
    totalOut: paisaToRupees(totalOutPaisa),
    net: paisaToRupees(totalInPaisa - totalOutPaisa),
    totalInPaisa,
    totalOutPaisa,
    netPaisa: totalInPaisa - totalOutPaisa,
  };
}

// ─── Ledger aggregation helpers ───────────────────────────────────────────────

/**
 * Build a LedgerEntry $match stage from common filters.
 * entityId uses the same buildEntityFilter logic as before.
 */
function buildLedgerMatch(resolvedStart, resolvedEnd, entityId) {
  const match = {};
  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  if (dateFilter) match.transactionDate = dateFilter;
  if (entityId) Object.assign(match, buildEntityFilter(entityId));
  return match;
}

/**
 * Core ledger aggregation: groups LedgerEntry by (accountType, accountCode, accountName)
 * over the given match stage. Returns per-account debit/credit totals.
 *
 * This is the single function that replaces all Revenue/Expense/Liability
 * domain-collection aggregations for financial totals.
 */
async function aggregateLedgerByAccount(ledgerMatch) {
  return LedgerEntry.aggregate([
    { $match: ledgerMatch },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "acct",
      },
    },
    { $unwind: "$acct" },
    {
      $group: {
        _id: {
          code: "$acct.code",
          name: "$acct.name",
          type: "$acct.type",
        },
        creditPaisa: { $sum: "$creditAmountPaisa" },
        debitPaisa: { $sum: "$debitAmountPaisa" },
      },
    },
  ]);
}

/**
 * Process aggregateLedgerByAccount results into structured totals.
 * Returns:
 *   totalRevenuePaisa, totalExpensePaisa
 *   revenueByCode  Map<code, { name, netPaisa }>
 *   expenseByCode  Map<code, { name, netPaisa }>
 */
function processAccountTotals(rows) {
  let totalRevenuePaisa = 0;
  let totalExpensePaisa = 0;
  const revenueByCode = new Map();
  const expenseByCode = new Map();

  for (const row of rows) {
    const { code, name, type } = row._id;
    if (type === "REVENUE") {
      const net = row.creditPaisa - row.debitPaisa;
      totalRevenuePaisa += net;
      revenueByCode.set(code, { name, netPaisa: net });
    } else if (type === "EXPENSE") {
      const net = row.debitPaisa - row.creditPaisa;
      totalExpensePaisa += net;
      expenseByCode.set(code, { name, netPaisa: net });
    }
  }

  return { totalRevenuePaisa, totalExpensePaisa, revenueByCode, expenseByCode };
}

/**
 * Get outstanding liability balance.
 * LEDGER-FIRST: aggregated from LedgerEntry (all-time cumulative).
 * LIABILITY accounts are credit-normal: balance = credit − debit.
 */
async function getLiabilityBalancePaisa(entityId) {
  const entityMatch = {};
  if (entityId && entityId !== "private") {
    try { entityMatch.entityId = new mongoose.Types.ObjectId(String(entityId)); } catch { /* skip */ }
  }

  const [result] = await LedgerEntry.aggregate([
    { $match: entityMatch },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "acct",
      },
    },
    { $unwind: "$acct" },
    { $match: { "acct.type": "LIABILITY", "acct.isActive": true } },
    {
      $group: {
        _id: null,
        totalCredit: { $sum: "$creditAmountPaisa" },
        totalDebit: { $sum: "$debitAmountPaisa" },
      },
    },
  ]);

  return (result?.totalCredit ?? 0) - (result?.totalDebit ?? 0);
}

/**
 * Build liabilitiesBreakdown array.
 * LEDGER-FIRST: aggregated from LedgerEntry per liability account.
 */
async function getLiabilitiesBreakdown(entityId) {
  const entityMatch = {};
  if (entityId && entityId !== "private") {
    try { entityMatch.entityId = new mongoose.Types.ObjectId(String(entityId)); } catch { /* skip */ }
  }

  const rows = await LedgerEntry.aggregate([
    { $match: entityMatch },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "acct",
      },
    },
    { $unwind: "$acct" },
    { $match: { "acct.type": "LIABILITY", "acct.isActive": true } },
    {
      $group: {
        _id: { code: "$acct.code", name: "$acct.name" },
        totalCredit: { $sum: "$creditAmountPaisa" },
        totalDebit: { $sum: "$debitAmountPaisa" },
      },
    },
  ]);

  return rows
    .map((row) => {
      const balancePaisa = row.totalCredit - row.totalDebit;
      return {
        code: row._id.code,
        name: row._id.name,
        amount: Math.abs(paisaToRupees(balancePaisa)),
      };
    })
    .filter((a) => a.amount !== 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. ACCOUNTING SUMMARY ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build accounting summary for dashboard.
 * ALL financial totals now derive from LedgerEntry (single source of truth).
 *
 * paymentMethod: no longer filters totals (payment method is encoded in which
 * bank/cash account was debited — it cannot be filtered at the summary level
 * without knowing account codes per entity). It is preserved for backward compat
 * but has no effect on totals. Detail breakdowns (getRevenueBreakdownSummary)
 * still support paymentMethod filtering via domain collections.
 */
export async function getAccountingSummary({
  startDate,
  endDate,
  nepaliYear,
  quarter,
  month,
  fiscalYear,
  entityId = null,
  paymentMethod = null, // preserved for compat; not used in ledger totals
}) {
  const { resolvedStart, resolvedEnd } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });

  const ledgerMatch = buildLedgerMatch(resolvedStart, resolvedEnd, entityId);

  // ── Core ledger aggregation ───────────────────────────────────────────────
  const rentDateFilter = resolvedStart && resolvedEnd
    ? { $gte: resolvedStart, $lte: resolvedEnd }
    : resolvedStart
      ? { $gte: resolvedStart }
      : null;

  const [accountRows, totalLiabilityPaisa, liabilitiesBreakdown, bsKPIs, operatingCashFlowPaisa, collectionRows, cashFlowBreakdown] = await Promise.all([
    aggregateLedgerByAccount(ledgerMatch),
    getLiabilityBalancePaisa(entityId),
    getLiabilitiesBreakdown(entityId),
    getBalanceSheetKPIs(entityId),
    getOperatingCashFlow(ledgerMatch, entityId),
    // Collection gap: billed vs collected from Rent records for the period
    (async () => {
      const match = { status: { $ne: "cancelled" } };
      if (rentDateFilter) match.englishDueDate = rentDateFilter;
      if (entityId && entityId !== "private") {
        try { match.entityId = new mongoose.Types.ObjectId(String(entityId)); } catch { /* skip */ }
      }
      return Rent.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            grossBilledPaisa: { $sum: { $ifNull: ["$grossRentAmountPaisa", 0] } },
            tdsPaisa:         { $sum: { $ifNull: ["$tdsAmountPaisa", 0] } },
            billedPaisa:      { $sum: { $subtract: ["$grossRentAmountPaisa", { $ifNull: ["$tdsAmountPaisa", 0] }] } },
            collectedPaisa:   { $sum: { $ifNull: ["$paidAmountPaisa", 0] } },
            totalRents: { $sum: 1 },
            paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          },
        },
      ]);
    })(),
    getCashFlowBreakdown(ledgerMatch, entityId),
  ]);

  const { totalRevenuePaisa, totalExpensePaisa, revenueByCode, expenseByCode } =
    processAccountTotals(accountRows);

  // ── Collection gap (rent billed vs collected for the period) ─────────────
  const cRow = collectionRows[0] ?? {};
  const grossBilledPaisa       = Math.max(0, cRow.grossBilledPaisa ?? 0);
  const tdsPaisa               = Math.max(0, cRow.tdsPaisa ?? 0);
  const billedPaisa            = Math.max(0, cRow.billedPaisa ?? 0); // net of TDS
  const collectedPaisa         = Math.max(0, cRow.collectedPaisa ?? 0);
  const outstandingCollectionPaisa = Math.max(0, billedPaisa - collectedPaisa);
  const collectionRatePct = billedPaisa > 0
    ? +((collectedPaisa / billedPaisa) * 100).toFixed(1)
    : 100;

  // ── Build incomeStreams (backward-compat shape) ───────────────────────────
  const incomeStreams = { breakdown: [] };
  for (const [code, { name, netPaisa }] of revenueByCode) {
    const streamKey = REVENUE_ACCOUNT_STREAM[code] ?? code;
    const amount = paisaToRupees(netPaisa);
    incomeStreams.breakdown.push({ code: streamKey, name, amount });
    // Backward-compat named properties the frontend dashboard reads
    if (streamKey === "RENT") incomeStreams.rentRevenue = amount;
    if (streamKey === "CAM") incomeStreams.camRevenue = amount;
    if (streamKey === "UTILITY") incomeStreams.utilityRevenue = amount;
  }

  // ── Build expensesBreakdown ───────────────────────────────────────────────
  const expensesBreakdown = [];
  for (const [code, { name, netPaisa }] of expenseByCode) {
    expensesBreakdown.push({ code, name, amount: paisaToRupees(netPaisa) });
  }

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalRevenue = paisaToRupees(totalRevenuePaisa);
  const totalExpenses = paisaToRupees(totalExpensePaisa);
  const totalLiabilities = paisaToRupees(totalLiabilityPaisa);
  const netCashFlow = totalRevenue - totalExpenses;

  // ── Ledger summary (for audit trail / ledger tab) ─────────────────────────
  // Re-aggregate without account join for the raw ledger tab
  const [ledgerTotals] = await LedgerEntry.aggregate([
    { $match: ledgerMatch },
    {
      $group: {
        _id: null,
        totalDebitPaisa: { $sum: "$debitAmountPaisa" },
        totalCreditPaisa: { $sum: "$creditAmountPaisa" },
        entryCount: { $sum: 1 },
      },
    },
  ]);

  return {
    totals: {
      totalRevenue,
      totalLiabilities,
      totalExpenses,
      // netCashFlow kept for backward-compat — NOTE: this is ACCRUAL net income,
      // not true cash flow. Use operatingCashFlow for actual cash movement.
      netCashFlow,
      netIncome: netCashFlow, // correctly-labeled alias
      cashBalance: paisaToRupees(bsKPIs.cashBalancePaisa),
      arBalance: paisaToRupees(bsKPIs.arBalancePaisa),
      apBalance: paisaToRupees(bsKPIs.apBalancePaisa),
      operatingCashFlow: paisaToRupees(operatingCashFlowPaisa),
      // Paisa variants — use these in downstream functions to avoid rupee×100 fragility
      totalRevenuePaisa,
      totalExpensePaisa,
      totalLiabilityPaisa,
      netCashFlowPaisa: totalRevenuePaisa - totalExpensePaisa,
      cashBalancePaisa: bsKPIs.cashBalancePaisa,
      arBalancePaisa: bsKPIs.arBalancePaisa,
      apBalancePaisa: bsKPIs.apBalancePaisa,
      operatingCashFlowPaisa,
    },
    collectionGap: {
      // Gross = full rent before TDS; billed = net tenant cash obligation (gross - TDS)
      grossBilledPaisa,
      tdsPaisa,
      billedPaisa,
      collectedPaisa,
      outstandingPaisa: outstandingCollectionPaisa,
      collectionRatePct,
      grossBilled: paisaToRupees(grossBilledPaisa),
      tds:         paisaToRupees(tdsPaisa),
      billed:      paisaToRupees(billedPaisa),
      collected:   paisaToRupees(collectedPaisa),
      outstanding: paisaToRupees(outstandingCollectionPaisa),
      totalRents: cRow.totalRents ?? 0,
      paidCount:  cRow.paidCount ?? 0,
    },
    incomeStreams,
    liabilitiesBreakdown,
    expensesBreakdown,
    cashFlowBreakdown,
    ledger: {
      grandTotal: {
        paisa: {
          totalDebit: ledgerTotals?.totalDebitPaisa ?? 0,
          totalCredit: ledgerTotals?.totalCreditPaisa ?? 0,
          netBalance: (ledgerTotals?.totalDebitPaisa ?? 0) - (ledgerTotals?.totalCreditPaisa ?? 0),
        },
        totalDebit: paisaToRupees(ledgerTotals?.totalDebitPaisa ?? 0),
        totalCredit: paisaToRupees(ledgerTotals?.totalCreditPaisa ?? 0),
        totalEntries: ledgerTotals?.entryCount ?? 0,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1b. PORTFOLIO HEALTH ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPortfolioHealth({
  startDate, endDate, quarter, month, fiscalYear, entityId = null,
} = {}) {
  const { resolvedStart, resolvedEnd } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  // ── 1. YoY summaries ──────────────────────────────────────────────────────
  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;
  const [currentSummary, prevSummary] = await Promise.all([
    getAccountingSummary({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    prevFiscalYear !== null
      ? getAccountingSummary({ quarter, month, fiscalYear: prevFiscalYear, entityId })
      : Promise.resolve(null),
  ]);

  // ── 2. Collection rate ────────────────────────────────────────────────────
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
    if (s._id === "paid") paidCount += s.count;
    else outstandingPaisa += netExpected - s.paidPaisa;
  }
  outstandingPaisa = Math.max(0, outstandingPaisa);

  // ── 3. Arrears aging ──────────────────────────────────────────────────────
  const nowMs = Date.now();
  const agingPipeline = await Rent.aggregate([
    { $match: { status: { $in: ["pending", "partially_paid", "overdue"] } } },
    {
      $addFields: {
        netOwedPaisa: {
          $max: [0, {
            $subtract: [
              { $subtract: ["$grossRentAmountPaisa", { $ifNull: ["$tdsAmountPaisa", 0] }] },
              "$paidAmountPaisa",
            ],
          }],
        },
        daysPastDue: { $divide: [{ $subtract: [new Date(nowMs), "$englishDueDate"] }, 86400000] },
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
    current: { count: 0, amountPaisa: 0 },
    days30: { count: 0, amountPaisa: 0 },
    days60: { count: 0, amountPaisa: 0 },
    days90Plus: { count: 0, amountPaisa: 0 },
  };
  for (const b of agingPipeline) {
    const key = b._id === "1-30" ? "days30" : b._id === "31-60" ? "days60" : b._id === "60+" ? "days90Plus" : "current";
    arrearsAging[key] = { count: b.count, amountPaisa: Math.max(0, b.amountPaisa) };
  }

  // ── 4. NOI (from ledger totals now) ──────────────────────────────────────
  // NOI = Revenue − Operating Expenses (excl. loan interest)
  // 5616 (demand charge) and 5615 (common area) are now OPERATING → included in NOI calc.
  // 5610 legacy entries remain ELECTRICITY_NEA → excluded (same as before).
  const { resolvedStart: s, resolvedEnd: e } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });
  const noiLedgerMatch = buildLedgerMatch(s, e, entityId);
  const expRows = await aggregateLedgerByAccount(noiLedgerMatch);

  let operatingExpensesPaisa = 0;
  for (const row of expRows) {
    if (row._id.type !== "EXPENSE") continue;
    const cat = EXPENSE_ACCOUNT_CATEGORY[row._id.code] ?? "OPERATING";
    // Exclude interest and NEA accrual from operating expenses
    if (cat === "OPERATING") {
      operatingExpensesPaisa += row.debitPaisa - row.creditPaisa;
    }
  }

  const currentRevenuePaisa = currentSummary.totals.totalRevenuePaisa ?? 0;
  const noiPaisa = currentRevenuePaisa - operatingExpensesPaisa;

  // ── 5. YoY deltas ────────────────────────────────────────────────────────
  const yoyDeltas = prevSummary ? {
    revenue: {
      currentPaisa: currentSummary.totals.totalRevenuePaisa,
      prevPaisa: prevSummary.totals.totalRevenuePaisa,
      pct: pctChange(prevSummary.totals.totalRevenue, currentSummary.totals.totalRevenue),
    },
    expenses: {
      currentPaisa: currentSummary.totals.totalExpensePaisa,
      prevPaisa: prevSummary.totals.totalExpensePaisa,
      pct: pctChange(prevSummary.totals.totalExpenses, currentSummary.totals.totalExpenses),
    },
    netCashFlow: {
      currentPaisa: currentSummary.totals.netCashFlowPaisa,
      prevPaisa: prevSummary.totals.netCashFlowPaisa,
      pct: pctChange(prevSummary.totals.netCashFlow, currentSummary.totals.netCashFlow),
    },
  } : null;

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
      noiMarginPct: currentRevenuePaisa > 0
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
 * Per-month revenue/expense/liability for chart display.
 * Now reads from LedgerEntry grouped by nepaliYear/nepaliMonth + account type.
 *
 * Note: paymentMethod filter is no longer supported here (payment method is
 * encoded in which bank account was debited, not a field on LedgerEntry).
 * Use getRevenueBreakdownSummary/getExpenseBreakdownSummary for method-filtered detail.
 */
export async function getMonthlyChartData({
  quarter, fiscalYear, allYear = false, entityId = null,
  paymentMethod = null, // deprecated in ledger mode — ignored
} = {}) {
  let months;
  if (allYear) {
    months = getFiscalYearMonths(fiscalYear ?? new NepaliDate().getYear());
  } else if (quarter) {
    months = getQuarterMonths(Number(quarter), fiscalYear);
  } else {
    months = getLastNMonths(5);
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const { startDate: rangeStart } = bsMonthToDateRange(firstMonth.year, firstMonth.month0);
  const { endDate: rangeEnd } = bsMonthToDateRange(lastMonth.year, lastMonth.month0);

  const ledgerMatch = buildLedgerMatch(rangeStart, rangeEnd, entityId);

  // Single aggregation: group by (nepaliYear, nepaliMonth, accountType)
  const monthTypeAgg = await LedgerEntry.aggregate([
    { $match: ledgerMatch },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "acct",
      },
    },
    { $unwind: "$acct" },
    { $match: { "acct.type": { $in: ["REVENUE", "EXPENSE", "LIABILITY"] } } },
    {
      $group: {
        _id: {
          year: "$nepaliYear",
          month: "$nepaliMonth",
          type: "$acct.type",
        },
        creditPaisa: { $sum: "$creditAmountPaisa" },
        debitPaisa: { $sum: "$debitAmountPaisa" },
      },
    },
  ]);

  // Index by "YYYY-MM" → { revenue, expenses, liabilities } in paisa
  const byKey = new Map();
  for (const row of monthTypeAgg) {
    if (!row._id.year || !row._id.month) continue;
    const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
    if (!byKey.has(key)) byKey.set(key, { revPaisa: 0, expPaisa: 0, liabPaisa: 0 });
    const entry = byKey.get(key);
    if (row._id.type === "REVENUE") entry.revPaisa += row.creditPaisa - row.debitPaisa;
    if (row._id.type === "EXPENSE") entry.expPaisa += row.debitPaisa - row.creditPaisa;
    if (row._id.type === "LIABILITY") entry.liabPaisa += row.creditPaisa - row.debitPaisa;
  }

  return months.map(({ year, month0 }) => {
    const nepaliMonth = month0 + 1;
    const key = `${year}-${String(nepaliMonth).padStart(2, "0")}`;
    const d = byKey.get(key) ?? { revPaisa: 0, expPaisa: 0, liabPaisa: 0 };
    return {
      key,
      label: NEPALI_MONTH_NAMES[month0],
      revenue: paisaToRupees(d.revPaisa),
      expenses: paisaToRupees(d.expPaisa),
      liabilities: paisaToRupees(d.liabPaisa),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. REVENUE BREAKDOWN SUMMARY ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detailed revenue breakdown for the RevenueBreakDown page.
 * Still reads from Revenue domain collection for payer names, payment methods,
 * and transaction-level detail not available on LedgerEntry.
 */
export async function getRevenueBreakdownSummary({
  startDate, endDate, quarter, fiscalYear, month, entityId = null, paymentMethod = null,
} = {}) {
  const { resolvedStart, resolvedEnd } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });

  const dateFilter = buildDateFilter(resolvedStart, resolvedEnd);
  const entityFilter = buildEntityFilter(entityId);

  const match = { ...entityFilter };
  if (dateFilter) match.englishDate = dateFilter;
  if (paymentMethod) match.paymentMethod = paymentMethod;

  const revenues = await Revenue.aggregate([
    { $match: match },
    {
      $lookup: {
        from: RevenueSource.collection.name,
        localField: "source", foreignField: "_id", as: "source",
      },
    },
    { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "tenants", localField: "tenant", foreignField: "_id", as: "tenant" } },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    { $sort: { englishDate: -1 } },
  ]);

  if (!revenues.length) {
    return {
      totals: { total: 0, count: 0, avg: 0, momPct: null },
      streams: [], trend: [], payerSplit: [], paymentMethodSplit: [],
      refTypes: [], topTenants: [], statusMap: {}, transactions: [],
    };
  }

  const totalPaisa = revenues.reduce((s, r) => s + (r.amountPaisa || 0), 0);
  const total = paisaToRupees(totalPaisa);
  const count = revenues.length;
  const avg = count ? total / count : 0;

  const srcMap = new Map();
  revenues.forEach((r) => {
    const id = String(r.source?._id ?? "unknown");
    if (!srcMap.has(id)) {
      srcMap.set(id, { code: r.source?.code ?? "?", name: r.source?.name ?? "Unknown", amountPaisa: 0, count: 0 });
    }
    const e = srcMap.get(id);
    e.amountPaisa += r.amountPaisa || 0;
    e.count += 1;
  });

  const streams = [...srcMap.values()]
    .map((s) => ({
      code: s.code, name: s.name, amount: paisaToRupees(s.amountPaisa), count: s.count,
      pct: total > 0 ? +((paisaToRupees(s.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const trendMap = new Map();
  revenues.forEach((r) => addRevenueTrendBucket(r, trendMap));
  const trend = [...trendMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8)
    .map((m) => ({ ...m, revenue: paisaToRupees(m.amountPaisa), amountPaisa: undefined }));

  const momPct = trend.length >= 2
    ? pctChange(trend[trend.length - 2].revenue, trend[trend.length - 1].revenue)
    : null;

  let tenantPaisa = 0, externalPaisa = 0;
  revenues.forEach((r) => {
    if (r.payerType === "TENANT") tenantPaisa += r.amountPaisa || 0;
    else externalPaisa += r.amountPaisa || 0;
  });
  const payerSplit = [
    { name: "Tenant", amount: paisaToRupees(tenantPaisa), pct: total > 0 ? +((paisaToRupees(tenantPaisa) / total) * 100).toFixed(1) : 0 },
    { name: "External", amount: paisaToRupees(externalPaisa), pct: total > 0 ? +((paisaToRupees(externalPaisa) / total) * 100).toFixed(1) : 0 },
  ].filter((p) => p.amount > 0);

  const methodMap = new Map();
  revenues.forEach((r) => {
    const method = r.paymentMethod ?? "unknown";
    if (!methodMap.has(method)) methodMap.set(method, { method, amountPaisa: 0, count: 0 });
    const e = methodMap.get(method);
    e.amountPaisa += r.amountPaisa || 0;
    e.count += 1;
  });
  const paymentMethodSplit = [...methodMap.values()]
    .map((m) => ({
      method: m.method, amount: paisaToRupees(m.amountPaisa), count: m.count,
      pct: total > 0 ? +((paisaToRupees(m.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const refMap = new Map();
  revenues.forEach((r) => {
    const t = r.referenceType ?? "MANUAL";
    if (!refMap.has(t)) refMap.set(t, { type: t, amountPaisa: 0, count: 0 });
    const e = refMap.get(t);
    e.amountPaisa += r.amountPaisa || 0;
    e.count += 1;
  });
  const refTypes = [...refMap.values()]
    .map((r) => ({
      type: r.type, amount: paisaToRupees(r.amountPaisa), count: r.count,
      pct: total > 0 ? +((paisaToRupees(r.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const tenantMap = new Map();
  revenues.filter((r) => r.payerType === "TENANT").forEach((r) => {
    const id = String(r.tenant?._id ?? "unknown");
    if (!tenantMap.has(id)) {
      tenantMap.set(id, { id, name: r.tenant?.name ?? "Unknown Tenant", amountPaisa: 0, count: 0, sources: new Set() });
    }
    const e = tenantMap.get(id);
    e.amountPaisa += r.amountPaisa || 0;
    e.count += 1;
    if (r.source?.name) e.sources.add(r.source.name);
  });
  const topTenants = [...tenantMap.values()]
    .map((t) => ({
      id: t.id, name: t.name, amount: paisaToRupees(t.amountPaisa), count: t.count,
      pctOfTotal: total > 0 ? +((paisaToRupees(t.amountPaisa) / total) * 100).toFixed(1) : 0,
      sources: [...t.sources].join(", "),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const statusMap = {};
  revenues.forEach((r) => { const s = r.status ?? "RECORDED"; statusMap[s] = (statusMap[s] || 0) + 1; });

  const transactions = revenues.map((r) => ({
    id: String(r._id),
    payer: r.payerType === "TENANT" ? (r.tenant?.name ?? "Tenant") : (r.externalPayer?.name ?? "External"),
    source: r.source?.name ?? "—",
    refType: r.referenceType ?? "MANUAL",
    payerType: r.payerType,
    amount: paisaToRupees(r.amountPaisa || 0),
    bsDate: revenueTransactionBsDate(r),
    status: r.status ?? "RECORDED",
    paymentMethod: r.paymentMethod ?? null,
  }));

  return { totals: { total, count, avg, momPct }, streams, trend, payerSplit, paymentMethodSplit, refTypes, topTenants, statusMap, transactions };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 4. EXPENSE BREAKDOWN SUMMARY ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function getExpenseBreakdownSummary({
  startDate, endDate, quarter, fiscalYear, month, entityId = null, paymentMethod = null,
} = {}) {
  const { resolvedStart, resolvedEnd } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });
  const entityFilter = buildEntityFilter(entityId);

  let match = { ...entityFilter };
  if (!startDate && !endDate) {
    if (month) {
      match.nepaliMonth = Number(month);
      if (fiscalYear) match.nepaliYear = Number(fiscalYear);
    } else if (quarter && quarter !== "custom") {
      const nepaliMonths = FISCAL_QUARTER_MONTHS[Number(quarter)].map((m0) => m0 + 1);
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
  if (paymentMethod) match.paymentMethod = paymentMethod;

  const expenses = await Expense.aggregate([
    { $match: match },
    {
      $lookup: {
        from: ExpenseSource.collection.name,
        localField: "source", foreignField: "_id", as: "source",
      },
    },
    { $unwind: { path: "$source", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "tenants", localField: "tenant", foreignField: "_id", as: "tenant" } },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    { $sort: { englishDate: -1 } },
  ]);

  if (!expenses.length) {
    return {
      totals: { total: 0, count: 0, avg: 0, momPct: null },
      categories: [], trend: [], payeeSplit: [], paymentMethodSplit: [],
      refTypes: [], operatingAmt: 0, nonOpAmt: 0, statusMap: {}, transactions: [],
    };
  }

  const totalPaisa = expenses.reduce((s, e) => s + (e.amountPaisa || 0), 0);
  const total = paisaToRupees(totalPaisa);
  const count = expenses.length;
  const avg = count ? total / count : 0;

  const catMap = new Map();
  expenses.forEach((e) => {
    const isLoanInterest = e.referenceType === "LOAN_INTEREST";
    const src = e.source && e.source._id ? e.source : null;
    const id = src ? String(src._id) : isLoanInterest ? "__LOAN_INTEREST__" : `orphan_${e._id}`;
    if (!catMap.has(id)) {
      catMap.set(id, {
        code: src?.code ?? (isLoanInterest ? "INTEREST" : "?"),
        name: src?.name ?? (isLoanInterest ? INTEREST_EXPENSE_LABEL : "Unknown"),
        amountPaisa: 0, count: 0,
      });
    }
    const entry = catMap.get(id);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });

  const categories = [...catMap.values()]
    .map((c) => ({
      code: c.code, name: c.name, amount: paisaToRupees(c.amountPaisa), count: c.count,
      pct: total > 0 ? +((paisaToRupees(c.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const trendMap = new Map();
  expenses.forEach((e) => {
    if (!e.nepaliYear || !e.nepaliMonth) return;
    const month0 = (e.nepaliMonth - 1) % 12;
    const key = `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}`;
    if (!trendMap.has(key)) trendMap.set(key, { key, label: NEPALI_MONTH_NAMES[month0], amountPaisa: 0, count: 0 });
    const entry = trendMap.get(key);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });

  const trend = [...trendMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8)
    .map((m) => ({ key: m.key, label: m.label, expenses: paisaToRupees(m.amountPaisa), count: m.count }));

  const momPct = trend.length >= 2
    ? pctChange(trend[trend.length - 2].expenses, trend[trend.length - 1].expenses)
    : null;

  let extPaisa = 0, tenPaisa = 0;
  expenses.forEach((e) => {
    if (e.payeeType === "EXTERNAL") extPaisa += e.amountPaisa || 0;
    else tenPaisa += e.amountPaisa || 0;
  });
  const payeeSplit = [
    { name: "External", amount: paisaToRupees(extPaisa), pct: total > 0 ? +((paisaToRupees(extPaisa) / total) * 100).toFixed(1) : 0 },
    { name: "Tenant", amount: paisaToRupees(tenPaisa), pct: total > 0 ? +((paisaToRupees(tenPaisa) / total) * 100).toFixed(1) : 0 },
  ].filter((p) => p.amount > 0);

  const methodMap = new Map();
  expenses.forEach((e) => {
    const method = e.paymentMethod ?? "unknown";
    if (!methodMap.has(method)) methodMap.set(method, { method, amountPaisa: 0, count: 0 });
    const entry = methodMap.get(method);
    entry.amountPaisa += e.amountPaisa || 0;
    entry.count += 1;
  });
  const paymentMethodSplit = [...methodMap.values()]
    .map((m) => ({
      method: m.method, amount: paisaToRupees(m.amountPaisa), count: m.count,
      pct: total > 0 ? +((paisaToRupees(m.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

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
      type: r.type, amount: paisaToRupees(r.amountPaisa), count: r.count,
      pct: total > 0 ? +((paisaToRupees(r.amountPaisa) / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  let operatingPaisa = 0, nonOpPaisa = 0;
  expenses.forEach((e) => {
    if (OPERATING_REF_TYPES.has(e.referenceType)) operatingPaisa += e.amountPaisa || 0;
    else nonOpPaisa += e.amountPaisa || 0;
  });

  const statusMap = {};
  expenses.forEach((e) => { const s = e.status ?? "RECORDED"; statusMap[s] = (statusMap[s] || 0) + 1; });

  const transactions = expenses.map((e) => ({
    id: String(e._id),
    source: e.source?.name ?? (e.referenceType === "LOAN_INTEREST" ? INTEREST_EXPENSE_LABEL : "—"),
    refType: e.referenceType ?? "MANUAL",
    payeeType: e.payeeType,
    amount: paisaToRupees(e.amountPaisa || 0),
    bsDate: e.nepaliYear && e.nepaliMonth
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
    categories, trend, payeeSplit, paymentMethodSplit, refTypes,
    operatingAmt: paisaToRupees(operatingPaisa),
    nonOpAmt: paisaToRupees(nonOpPaisa),
    statusMap, transactions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 5. PROFIT & LOSS STATEMENT ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * P&L now fully derived from LedgerEntry.
 * Expense breakdown by category uses EXPENSE_ACCOUNT_CATEGORY mapping since
 * the ledger stores expenses by account code (5000, 5100, 5610), not by
 * referenceType. When more granular expense account codes are added (e.g.
 * 5010 = Maintenance, 5020 = Utility), this breakdown will automatically
 * become more detailed.
 */
export async function getProfitLossStatement({
  startDate,
  endDate,
  quarter,
  month,
  fiscalYear,
  entityId = null,
}) {
  const { resolvedStart, resolvedEnd } = resolveDateRange({
    startDate,
    endDate,
    month,
    quarter,
    fiscalYear,
  });

  const ledgerMatch = buildLedgerMatch(
    resolvedStart,
    resolvedEnd,
    entityId
  );

  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;

  const [accountRows, prevSummary, monthlyTrend] = await Promise.all([
    aggregateLedgerByAccount(ledgerMatch),

    prevFiscalYear !== null
      ? getAccountingSummary({
        quarter,
        month,
        fiscalYear: prevFiscalYear,
        entityId,
      })
      : Promise.resolve(null),

    fiscalYear
      ? getMonthlyChartData({
        fiscalYear,
        allYear: true,
        entityId,
      })
      : getMonthlyChartData({
        quarter,
        entityId,
      }),
  ]);

  const {
    totalRevenuePaisa,
    totalExpensePaisa,
    revenueByCode,
    expenseByCode,
  } = processAccountTotals(accountRows);

  // ─────────────────────────────────────────────────────────────
  // EXPENSE CLASSIFICATION
  // ─────────────────────────────────────────────────────────────

  let operatingExpPaisa = 0;

  let interestPaisa = 0;

  let electricityPaisa = 0;

  let maintenancePaisa = 0;

  let utilityPaisa = 0;

  let salaryPaisa = 0;

  let manualPaisa = 0;

  for (const [code, { netPaisa }] of expenseByCode) {
    const cat = EXPENSE_ACCOUNT_CATEGORY[code] ?? "OPERATING";

    switch (cat) {
      case "LOAN_INTEREST": {
        interestPaisa += netPaisa;
        break;
      }

      case "ELECTRICITY_NEA": {
        electricityPaisa += netPaisa;
        utilityPaisa += netPaisa;
        operatingExpPaisa += netPaisa;
        break;
      }

      case "MAINTENANCE": {
        maintenancePaisa += netPaisa;
        operatingExpPaisa += netPaisa;
        break;
      }

      case "SALARY": {
        salaryPaisa += netPaisa;
        operatingExpPaisa += netPaisa;
        break;
      }

      case "UTILITY": {
        utilityPaisa += netPaisa;
        operatingExpPaisa += netPaisa;
        break;
      }

      default: {
        manualPaisa += netPaisa;
        operatingExpPaisa += netPaisa;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PROFIT CALCULATIONS
  // ─────────────────────────────────────────────────────────────

  const grossRevenuePaisa = totalRevenuePaisa;

  const ebitPaisa =
    grossRevenuePaisa - operatingExpPaisa;

  const netIncomePaisa =
    ebitPaisa - interestPaisa;

  const totalCashExpPaisa =
    operatingExpPaisa + interestPaisa;

  const ebitMarginPct =
    grossRevenuePaisa > 0
      ? +(
        (ebitPaisa / grossRevenuePaisa) *
        100
      ).toFixed(1)
      : 0;

  const netMarginPct =
    grossRevenuePaisa > 0
      ? +(
        (netIncomePaisa / grossRevenuePaisa) *
        100
      ).toFixed(1)
      : 0;

  const expenseRatioPct =
    grossRevenuePaisa > 0
      ? +(
        (totalCashExpPaisa / grossRevenuePaisa) *
        100
      ).toFixed(1)
      : 0;

  // ─────────────────────────────────────────────────────────────
  // REVENUE BREAKDOWN
  // ─────────────────────────────────────────────────────────────

  const revenueBreakdown = [
    ...revenueByCode.entries(),
  ].map(([code, { name, netPaisa }]) => ({
    code: REVENUE_ACCOUNT_STREAM[code] ?? code,
    name,
    amount: paisaToRupees(netPaisa),
  }));

  // ─────────────────────────────────────────────────────────────
  // EXPENSE BREAKDOWN
  // ─────────────────────────────────────────────────────────────

  const expensesBreakdown = [
    ...expenseByCode.entries(),
  ].map(([code, { name, netPaisa }]) => ({
    code,
    category:
      EXPENSE_ACCOUNT_CATEGORY[code] ?? "OPERATING",
    name,
    amount: paisaToRupees(netPaisa),
  }));

  // ─────────────────────────────────────────────────────────────
  // YOY COMPARISON
  // ─────────────────────────────────────────────────────────────

  let comparison = null;

  if (prevSummary) {
    const prevRevPaisa =
      prevSummary.totals.totalRevenuePaisa ?? 0;

    const prevExpPaisa =
      prevSummary.totals.totalExpensePaisa ?? 0;

    const prevNetPaisa =
      prevSummary.totals.netCashFlowPaisa ?? 0;

    comparison = {
      prevFiscalYear,

      prevRevenuePaisa: prevRevPaisa,

      prevExpensesPaisa: prevExpPaisa,

      prevNetIncomePaisa: prevNetPaisa,

      revenuePct: pctChange(
        paisaToRupees(prevRevPaisa),
        paisaToRupees(grossRevenuePaisa)
      ),

      expensesPct: pctChange(
        paisaToRupees(prevExpPaisa),
        paisaToRupees(totalExpensePaisa)
      ),

      netPct: pctChange(
        paisaToRupees(prevNetPaisa),
        paisaToRupees(netIncomePaisa)
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RESPONSE
  // ─────────────────────────────────────────────────────────────

  return {
    period: {
      fiscalYear,
      quarter,
      month,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    },

    revenue: {
      totalPaisa: grossRevenuePaisa,

      totalRupees:
        paisaToRupees(grossRevenuePaisa),

      breakdown: revenueBreakdown,
    },

    expenses: {
      totalCashPaisa: totalCashExpPaisa,

      totalCashRupees:
        paisaToRupees(totalCashExpPaisa),

      operatingPaisa: operatingExpPaisa,

      operatingRupees:
        paisaToRupees(operatingExpPaisa),

      interestPaisa,

      interestRupees:
        paisaToRupees(interestPaisa),

      electricityPaisa,

      electricityRupees:
        paisaToRupees(electricityPaisa),

      maintenancePaisa,

      maintenanceRupees:
        paisaToRupees(maintenancePaisa),

      utilityPaisa,

      utilityRupees:
        paisaToRupees(utilityPaisa),

      salaryPaisa,

      salaryRupees:
        paisaToRupees(salaryPaisa),

      manualPaisa,

      manualRupees:
        paisaToRupees(manualPaisa),

      breakdown: expensesBreakdown,
    },

    ebit: {
      paisa: ebitPaisa,

      rupees:
        paisaToRupees(ebitPaisa),

      marginPct: ebitMarginPct,
    },

    netIncome: {
      paisa: netIncomePaisa,

      rupees:
        paisaToRupees(netIncomePaisa),

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

export async function getFinancialRatios({
  startDate, endDate, quarter, month, fiscalYear, entityId = null,
}) {
  const prevFiscalYear = fiscalYear ? fiscalYear - 1 : null;
  const { resolvedStart, resolvedEnd } = resolveDateRange({ startDate, endDate, month, quarter, fiscalYear });
  const dsLedgerMatch = buildLedgerMatch(resolvedStart, resolvedEnd, entityId);

  const [currentSummary, prevSummary, health, debtServiceAgg] = await Promise.all([
    getAccountingSummary({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    prevFiscalYear !== null
      ? getAccountingSummary({ quarter, month, fiscalYear: prevFiscalYear, entityId })
      : Promise.resolve(null),
    getPortfolioHealth({ startDate, endDate, quarter, month, fiscalYear, entityId }),
    // DSCR: total debt service = interest (5100 DR) + principal repaid (2200 DR)
    LedgerEntry.aggregate([
      { $match: dsLedgerMatch },
      { $lookup: { from: "accounts", localField: "account", foreignField: "_id", as: "acct" } },
      { $unwind: "$acct" },
      { $match: { "acct.code": { $in: ["5100", "2200"] } } },
      { $group: { _id: null, debtServicePaisa: { $sum: "$debitAmountPaisa" } } },
    ]),
  ]);

  // Use paisa variants directly — no × 100 fragility
  const revPaisa = currentSummary.totals.totalRevenuePaisa ?? 0;
  const expPaisa = currentSummary.totals.totalExpensePaisa ?? 0;
  const netPaisa = currentSummary.totals.netCashFlowPaisa ?? 0;
  const liabPaisa = currentSummary.totals.totalLiabilityPaisa ?? 0;

  const netMarginPct = revPaisa > 0 ? +((netPaisa / revPaisa) * 100).toFixed(2) : 0;
  const operatingMarginPct = health.noi.noiMarginPct;
  const expenseRatioPct = revPaisa > 0 ? +((expPaisa / revPaisa) * 100).toFixed(2) : 0;
  const grossProfitPct = revPaisa > 0 ? +((health.noi.noiPaisa / revPaisa) * 100).toFixed(2) : 0;

  let prevRatios = null;
  if (prevSummary) {
    const pRev = prevSummary.totals.totalRevenuePaisa ?? 0;
    const pExp = prevSummary.totals.totalExpensePaisa ?? 0;
    const pNet = prevSummary.totals.netCashFlowPaisa ?? 0;
    prevRatios = {
      netMarginPct: pRev > 0 ? +((pNet / pRev) * 100).toFixed(2) : 0,
      expenseRatioPct: pRev > 0 ? +((pExp / pRev) * 100).toFixed(2) : 0,
      revenuePaisa: pRev,
      expensesPaisa: pExp,
    };
  }

  const debtToRevenuePct = revPaisa > 0 ? +((liabPaisa / revPaisa) * 100).toFixed(2) : 0;
  const annualDebtServicePaisa = debtServiceAgg[0]?.debtServicePaisa ?? 0;
  // DSCR = NOI / Debt Service. > 1.25 = healthy, 1.0-1.25 = watch, < 1.0 = distress
  const dscr = annualDebtServicePaisa > 0
    ? +((health.noi.noiPaisa / annualDebtServicePaisa)).toFixed(2)
    : null;

  const monthlyData = fiscalYear
    ? await getMonthlyChartData({ fiscalYear, allYear: true, entityId })
    : await getMonthlyChartData({ quarter, entityId });

  const ratioTrend = monthlyData.map((m) => {
    const rev = m.revenue ?? 0;
    const exp = m.expenses ?? 0;
    const net = rev - exp;
    return {
      key: m.key,
      label: m.label,
      revenue: rev,
      expenses: exp,
      netMarginPct: rev > 0 ? +((net / rev) * 100).toFixed(1) : 0,
      expenseRatioPct: rev > 0 ? +((exp / rev) * 100).toFixed(1) : 0,
    };
  });

  return {
    profitability: { netMarginPct, operatingMarginPct, expenseRatioPct, grossProfitPct, prev: prevRatios },
    efficiency: {
      collectionRatePct: health.collection.ratePct,
      outstandingRatioPct: health.collection.totalExpectedNetPaisa > 0
        ? +((health.collection.outstandingPaisa / health.collection.totalExpectedNetPaisa) * 100).toFixed(1)
        : 0,
      outstandingPaisa: health.collection.outstandingPaisa,
      paidCount: health.collection.paidCount,
      totalRents: health.collection.totalRents,
      arrearsAging: health.arrearsAging,
    },
    leverage: {
      debtToRevenuePct,
      totalLiabilitiesPaisa: liabPaisa,
      totalLiabilitiesRupees: paisaToRupees(liabPaisa),
      annualDebtServicePaisa,
      annualDebtServiceRupees: paisaToRupees(annualDebtServicePaisa),
      dscr, // null = no debt; > 1.25 healthy; 1.0-1.25 watch; < 1.0 distress
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

function linearRegression(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function rSquared(values, slope, intercept) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const ssTot = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = values.reduce((s, v, i) => s + (v - (slope * i + intercept)) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

export async function getProjections({ fiscalYear, entityId = null }) {
  const currentFY = fiscalYear ?? new NepaliDate().getYear();
  const prevFY = currentFY - 1;

  const [currentYearData, prevYearData] = await Promise.all([
    getMonthlyChartData({ fiscalYear: currentFY, allYear: true, entityId }),
    getMonthlyChartData({ fiscalYear: prevFY, allYear: true, entityId }),
  ]);

  const historicalRaw = [...prevYearData, ...currentYearData];
  const firstActivity = historicalRaw.findIndex((m) => (m.revenue ?? 0) > 0 || (m.expenses ?? 0) > 0);
  const historical = firstActivity >= 0 ? historicalRaw.slice(firstActivity) : historicalRaw;
  const last12 = historical.slice(-12);

  const revValues = last12.map((m) => m.revenue ?? 0);
  const expValues = last12.map((m) => m.expenses ?? 0);

  const revModel = linearRegression(revValues);
  const expModel = linearRegression(expValues);
  const revR2 = rSquared(revValues, revModel.slope, revModel.intercept);
  const expR2 = rSquared(expValues, expModel.slope, expModel.intercept);

  const lastActual = last12[last12.length - 1];
  const [lastYear, lastMonthStr] = (lastActual?.key ?? `${currentFY}-03`).split("-");
  let projYear = Number(lastYear);
  let projMonth = Number(lastMonthStr);

  const projected = [];
  for (let i = 0; i < 6; i++) {
    projMonth += 1;
    if (projMonth > 12) { projMonth = 1; projYear += 1; }
    const idx = last12.length + i;
    const baseRev = Math.max(0, revModel.slope * idx + revModel.intercept);
    const baseExp = Math.max(0, expModel.slope * idx + expModel.intercept);
    const key = `${projYear}-${String(projMonth).padStart(2, "0")}`;
    const label = NEPALI_MONTH_NAMES[(projMonth - 1) % 12];
    projected.push({
      key, label, isProjected: true,
      base: { revenue: +baseRev.toFixed(2), expenses: +baseExp.toFixed(2), net: +(baseRev - baseExp).toFixed(2) },
      optimistic: { revenue: +(baseRev * 1.15).toFixed(2), expenses: +(baseExp * 0.92).toFixed(2), net: +(baseRev * 1.15 - baseExp * 0.92).toFixed(2) },
      pessimistic: { revenue: +(baseRev * 0.85).toFixed(2), expenses: +(baseExp * 1.08).toFixed(2), net: +(baseRev * 0.85 - baseExp * 1.08).toFixed(2) },
    });
  }

  const avgMonthlyRev = revValues.length > 0 ? revValues.reduce((s, v) => s + v, 0) / revValues.length : 0;
  const avgMonthlyExp = expValues.length > 0 ? expValues.reduce((s, v) => s + v, 0) / expValues.length : 0;
  const revenueGrowthPct = revValues.length >= 2 && revValues[0] > 0
    ? pctChange(revValues[0], revValues[revValues.length - 1])
    : null;

  return {
    historical: last12,
    projected,
    model: {
      revenue: { slope: +revModel.slope.toFixed(2), intercept: +revModel.intercept.toFixed(2), r2: +revR2.toFixed(3) },
      expenses: { slope: +expModel.slope.toFixed(2), intercept: +expModel.intercept.toFixed(2), r2: +expR2.toFixed(3) },
      dataPoints: last12.length,
    },
    stats: {
      avgMonthlyRevenue: +avgMonthlyRev.toFixed(2),
      avgMonthlyExpenses: +avgMonthlyExp.toFixed(2),
      avgMonthlyNet: +(avgMonthlyRev - avgMonthlyExp).toFixed(2),
      projectedAnnualRev: +(projected.reduce((s, m) => s + m.base.revenue, 0) * 2).toFixed(2),
      revenueGrowthPct,
    },
  };
}
