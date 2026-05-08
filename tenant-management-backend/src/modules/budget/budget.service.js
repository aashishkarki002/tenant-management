import mongoose from "mongoose";
import { Budget } from "./Budget.Model.js";
import { LedgerEntry } from "../ledger/Ledger.Model.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { formatMoney } from "../../utils/moneyUtil.js";
import { resolveFiscalGregorianRange } from "../../config/fiscalCalendar.js";

/** Upsert a single budget line. */
export async function upsertBudgetLine({ entityId, fiscalYear, accountCode, budgetedAmountPaisa, notes, createdBy }) {
  if (!entityId || !fiscalYear || !accountCode)
    throw new Error("entityId, fiscalYear, and accountCode are required");
  if (!Number.isInteger(budgetedAmountPaisa) || budgetedAmountPaisa < 0)
    throw new Error("budgetedAmountPaisa must be a non-negative integer");

  // Look up account name + type
  const account = await Account.findOne({ code: accountCode, entityId: new mongoose.Types.ObjectId(String(entityId)) }).lean();
  if (!account) throw new Error(`Account "${accountCode}" not found for entity ${entityId}`);

  return Budget.findOneAndUpdate(
    { entityId, fiscalYear: Number(fiscalYear), accountCode },
    { $set: { budgetedAmountPaisa, accountName: account.name, accountType: account.type, notes: notes ?? null, createdBy: createdBy ?? null } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/** Delete a budget line. */
export async function deleteBudgetLine({ entityId, fiscalYear, accountCode }) {
  return Budget.findOneAndDelete({ entityId, fiscalYear: Number(fiscalYear), accountCode });
}

/** List all budget lines for a fiscal year. */
export async function getBudgetLines({ entityId, fiscalYear }) {
  const filter = { fiscalYear: Number(fiscalYear) };
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
  return Budget.find(filter).sort({ accountCode: 1 }).lean();
}

/**
 * Budget vs Actual report.
 * Returns per-account comparison of budgeted vs actual ledger movements for the fiscal year.
 */
export async function getBudgetVsActual({ entityId, fiscalYear }) {
  const lines = await getBudgetLines({ entityId, fiscalYear });
  if (!lines.length) return { lines: [], summary: null };

  const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({ fiscalYear: String(fiscalYear) });

  const matchStage = {};
  if (entityId) matchStage.entityId = new mongoose.Types.ObjectId(String(entityId));
  if (resolvedStart || resolvedEnd) {
    matchStage.transactionDate = {};
    if (resolvedStart) matchStage.transactionDate.$gte = new Date(resolvedStart);
    if (resolvedEnd) { const e = new Date(resolvedEnd); e.setHours(23,59,59,999); matchStage.transactionDate.$lte = e; }
  }

  // Aggregate actual amounts from ledger, per account code
  const actuals = await LedgerEntry.aggregate([
    { $match: matchStage },
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
        _id: "$acct.code",
        accountType: { $first: "$acct.type" },
        totalDebit:  { $sum: "$debitAmountPaisa" },
        totalCredit: { $sum: "$creditAmountPaisa" },
      },
    },
  ]);

  const actualMap = {};
  for (const a of actuals) {
    // Net movement in "natural" direction for account type
    const isDebitNormal = ["ASSET","EXPENSE"].includes(a.accountType);
    actualMap[a._id] = isDebitNormal ? a.totalDebit - a.totalCredit : a.totalCredit - a.totalDebit;
  }

  const fmt = (p) => ({ paisa: p, rupees: p / 100, formatted: formatMoney(p) });

  const result = lines.map((l) => {
    const actualPaisa    = actualMap[l.accountCode] ?? 0;
    const variancePaisa  = l.budgetedAmountPaisa - actualPaisa;
    const pct            = l.budgetedAmountPaisa > 0 ? Math.round((actualPaisa / l.budgetedAmountPaisa) * 100) : null;
    return {
      accountCode:     l.accountCode,
      accountName:     l.accountName,
      accountType:     l.accountType,
      budgeted:        fmt(l.budgetedAmountPaisa),
      actual:          fmt(Math.max(0, actualPaisa)),
      variance:        fmt(variancePaisa),
      variancePct:     pct,
      overBudget:      actualPaisa > l.budgetedAmountPaisa,
    };
  });

  const totalBudgeted = lines.reduce((s, l) => s + l.budgetedAmountPaisa, 0);
  const totalActual   = result.reduce((s, r) => s + r.actual.paisa, 0);

  return {
    fiscalYear,
    lines: result,
    summary: {
      totalBudgeted: fmt(totalBudgeted),
      totalActual:   fmt(totalActual),
      totalVariance: fmt(totalBudgeted - totalActual),
    },
  };
}
