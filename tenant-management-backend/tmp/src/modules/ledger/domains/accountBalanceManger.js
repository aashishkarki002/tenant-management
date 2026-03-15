/**
 * accountBalanceManager.js — v2 (multi-entity)
 *
 * BREAKING CHANGE from v1:
 *   Account.findOne({ code }) is no longer valid.
 *   Every account lookup now requires (code, entityId) pair.
 *
 * All public functions accept an `entityId` parameter.
 * The journal builder must always pass the entity the journal belongs to.
 *
 * T-ACCOUNT RULES (standard double-entry):
 *   ASSET    & EXPENSE  → debit increases (+), credit decreases (-)
 *   LIABILITY, REVENUE,
 *   EQUITY             → credit increases (+), debit decreases (-)
 */

import mongoose from "mongoose";
import { Account } from "../accounts/Account.Model.js";
import { LedgerEntry } from "../Ledger.Model.js";
import { paisaToRupees, formatMoney } from "../../../utils/moneyUtil.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const NORMAL_SIDE = {
  ASSET: true,
  EXPENSE: true,
  LIABILITY: false,
  REVENUE: false,
  EQUITY: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the signed paisa change on an account given a debit/credit posting.
 *
 * @param {"ASSET"|"LIABILITY"|"REVENUE"|"EXPENSE"|"EQUITY"} accountType
 * @param {number} debitPaisa   integer
 * @param {number} creditPaisa  integer
 * @returns {number} signed paisa change (positive = balance increases)
 */
export function computeBalanceChange(accountType, debitPaisa, creditPaisa) {
  if (!Number.isInteger(debitPaisa) || !Number.isInteger(creditPaisa)) {
    throw new Error(
      `computeBalanceChange: amounts must be integers. ` +
        `Got debit=${debitPaisa}, credit=${creditPaisa}`,
    );
  }
  const isDebitNormal = NORMAL_SIDE[accountType] ?? true;
  const net = debitPaisa - creditPaisa;
  return isDebitNormal ? net : -net;
}

function formatBalance(paisa) {
  return {
    paisa,
    rupees: paisaToRupees(paisa),
    formatted: formatMoney(paisa),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve accounts by (code, entityId) pairs — the new primary key.
 *
 * Handles the case where one journal touches the same code for the same
 * entity multiple times by deduplicating before the DB query.
 *
 * @param {Array<{accountCode: string}>} entries
 * @param {string|ObjectId} entityId
 * @param {mongoose.ClientSession|null} session
 * @returns {Promise<Map<string, Account>>} keyed by accountCode
 */
export async function resolveAccountsByEntity(
  entries,
  entityId,
  session = null,
) {
  if (!entityId) {
    throw new Error(
      "resolveAccountsByEntity: entityId is required. " +
        "Every journal must belong to an OwnershipEntity.",
    );
  }

  const codes = [...new Set(entries.map((e) => e.accountCode))];
  const entityObjId =
    entityId instanceof mongoose.Types.ObjectId
      ? entityId
      : new mongoose.Types.ObjectId(String(entityId));

  const accounts = await Account.find({
    code: { $in: codes },
    entityId: entityObjId,
    isActive: true,
  })
    .session(session)
    .lean();

  const byCode = Object.fromEntries(accounts.map((a) => [a.code, a]));

  // Validate all codes resolved
  for (const code of codes) {
    if (!byCode[code]) {
      throw new Error(
        `Account "${code}" not found for entity ${entityId}. ` +
          `Ensure the chart of accounts has been seeded for this entity.`,
      );
    }
  }

  return byCode;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. applyBalanceChange — single account, atomic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically $inc a single account's running balance.
 *
 * Low-level primitive — prefer applyJournalBalances() for full journals.
 *
 * @param {string|ObjectId} accountId   — _id of the Account document
 * @param {"ASSET"|"LIABILITY"|"REVENUE"|"EXPENSE"|"EQUITY"} accountType
 * @param {number} debitPaisa
 * @param {number} creditPaisa
 * @param {mongoose.ClientSession|null} session
 */
export async function applyBalanceChange(
  accountId,
  accountType,
  debitPaisa,
  creditPaisa,
  session = null,
) {
  const changePaisa = computeBalanceChange(
    accountType,
    debitPaisa,
    creditPaisa,
  );

  const updated = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { currentBalancePaisa: changePaisa } },
    { returnDocument: "after", session },
  ).lean();

  if (!updated) throw new Error(`Account ${accountId} not found`);

  return {
    accountId: updated._id,
    accountCode: updated.code,
    accountName: updated.name,
    accountType: updated.type,
    entityId: updated.entityId,
    changePaisa,
    previousBalancePaisa: updated.currentBalancePaisa - changePaisa,
    newBalancePaisa: updated.currentBalancePaisa,
    change: formatBalance(changePaisa),
    newBalance: formatBalance(updated.currentBalancePaisa),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. applyJournalBalances — entire journal, entity-scoped, one session
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply balance changes for every line in a posted journal.
 *
 * CHANGED from v1: requires `entityId` to resolve accounts.
 * All accounts must exist under (code, entityId) — no cross-entity lookups.
 *
 * @param {Array<{accountCode: string, debitAmountPaisa: number, creditAmountPaisa: number}>} entries
 * @param {string|ObjectId} entityId
 * @param {mongoose.ClientSession|null} session
 * @returns {Promise<Array<BalanceChangeResult>>}
 */
export async function applyJournalBalances(entries, entityId, session = null) {
  if (!entries?.length) throw new Error("entries array is required");
  if (!entityId)
    throw new Error(
      "applyJournalBalances: entityId is required for entity-scoped balance updates",
    );

  // Validate all amounts are integers
  for (const e of entries) {
    if (!Number.isInteger(e.debitAmountPaisa || 0))
      throw new Error(
        `debitAmountPaisa must be integer, got: ${e.debitAmountPaisa}`,
      );
    if (!Number.isInteger(e.creditAmountPaisa || 0))
      throw new Error(
        `creditAmountPaisa must be integer, got: ${e.creditAmountPaisa}`,
      );
  }

  // Resolve all accounts scoped to this entity
  const byCode = await resolveAccountsByEntity(entries, entityId, session);

  // Aggregate changes per account (same account may appear twice in one journal)
  const changeMap = {}; // accountId(string) → changePaisa
  for (const entry of entries) {
    const account = byCode[entry.accountCode];
    const change = computeBalanceChange(
      account.type,
      entry.debitAmountPaisa || 0,
      entry.creditAmountPaisa || 0,
    );
    const key = String(account._id);
    changeMap[key] = (changeMap[key] ?? 0) + change;
  }

  // Bulk $inc — one findByIdAndUpdate per unique account
  const updatePromises = Object.entries(changeMap).map(([accountId, change]) =>
    Account.findByIdAndUpdate(
      accountId,
      { $inc: { currentBalancePaisa: change } },
      { returnDocument: "after", session },
    ).lean(),
  );

  const updatedAccounts = await Promise.all(updatePromises);

  return updatedAccounts.map((acc) => {
    const change = changeMap[String(acc._id)];
    return {
      accountId: acc._id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      entityId: acc.entityId,
      changePaisa: change,
      previousBalancePaisa: acc.currentBalancePaisa - change,
      newBalancePaisa: acc.currentBalancePaisa,
      change: formatBalance(change),
      newBalance: formatBalance(acc.currentBalancePaisa),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getAccountBalance — point-in-time, entity-scoped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current (or as-of-date) balance for an account within an entity.
 *
 * @param {string} accountCode
 * @param {string|ObjectId} entityId
 * @param {Object} [options]
 * @param {Date}   [options.asOfDate]
 * @param {string} [options.tenantId]
 * @param {string} [options.propertyId]
 */
export async function getAccountBalance(accountCode, entityId, options = {}) {
  if (!entityId) throw new Error("getAccountBalance: entityId is required");

  const { asOfDate, tenantId, propertyId } = options;

  const account = await Account.findOne({
    code: accountCode,
    entityId: new mongoose.Types.ObjectId(String(entityId)),
  }).lean();

  if (!account)
    throw new Error(
      `Account "${accountCode}" not found for entity ${entityId}`,
    );

  // Fast path: live balance with no scope filters
  if (!asOfDate && !tenantId && !propertyId) {
    return {
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      entityId: account.entityId,
      asOf: null,
      balance: formatBalance(account.currentBalancePaisa),
    };
  }

  // Historical/scoped path: compute from ledger
  const matchStage = {
    account: account._id,
    entityId: account.entityId,
  };

  if (asOfDate) {
    const end = new Date(asOfDate);
    end.setHours(23, 59, 59, 999);
    matchStage.transactionDate = { $lte: end };
  }
  if (tenantId) matchStage.tenant = new mongoose.Types.ObjectId(tenantId);
  if (propertyId) matchStage.property = new mongoose.Types.ObjectId(propertyId);

  const [result] = await LedgerEntry.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDebitPaisa: { $sum: "$debitAmountPaisa" },
        totalCreditPaisa: { $sum: "$creditAmountPaisa" },
        entryCount: { $sum: 1 },
      },
    },
  ]);

  const totalDebit = result?.totalDebitPaisa ?? 0;
  const totalCredit = result?.totalCreditPaisa ?? 0;
  const isDebitNormal = NORMAL_SIDE[account.type] ?? true;
  const balancePaisa = isDebitNormal
    ? totalDebit - totalCredit
    : totalCredit - totalDebit;

  return {
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    entityId: account.entityId,
    asOf: asOfDate ?? null,
    scope: { tenantId: tenantId ?? null, propertyId: propertyId ?? null },
    balance: formatBalance(balancePaisa),
    components: {
      totalDebit: formatBalance(totalDebit),
      totalCredit: formatBalance(totalCredit),
      entryCount: result?.entryCount ?? 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. rebuildAccountBalance — admin repair, entity-scoped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recompute and overwrite an account's currentBalancePaisa from full ledger history.
 * Run this to fix drift from partial failures or direct DB edits.
 *
 * @param {string} accountCode
 * @param {string|ObjectId} entityId
 * @param {mongoose.ClientSession|null} session
 */
export async function rebuildAccountBalance(
  accountCode,
  entityId,
  session = null,
) {
  if (!entityId) throw new Error("rebuildAccountBalance: entityId is required");

  const account = await Account.findOne({
    code: accountCode,
    entityId: new mongoose.Types.ObjectId(String(entityId)),
  })
    .session(session)
    .lean();

  if (!account)
    throw new Error(
      `Account "${accountCode}" not found for entity ${entityId}`,
    );

  const [result] = await LedgerEntry.aggregate([
    { $match: { account: account._id, entityId: account.entityId } },
    {
      $group: {
        _id: null,
        totalDebitPaisa: { $sum: "$debitAmountPaisa" },
        totalCreditPaisa: { $sum: "$creditAmountPaisa" },
      },
    },
  ]).session(session);

  const totalDebit = result?.totalDebitPaisa ?? 0;
  const totalCredit = result?.totalCreditPaisa ?? 0;
  const isDebitNormal = NORMAL_SIDE[account.type] ?? true;
  const correctBalancePaisa = isDebitNormal
    ? totalDebit - totalCredit
    : totalCredit - totalDebit;

  const oldBalancePaisa = account.currentBalancePaisa;
  const drift = correctBalancePaisa - oldBalancePaisa;

  await Account.findByIdAndUpdate(
    account._id,
    { $set: { currentBalancePaisa: correctBalancePaisa } },
    { session },
  );

  return {
    accountCode: account.code,
    accountName: account.name,
    entityId: account.entityId,
    oldBalancePaisa,
    newBalancePaisa: correctBalancePaisa,
    drift,
    driftFormatted: formatMoney(Math.abs(drift)),
    hadDrift: drift !== 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getBalanceSummary — Trial Balance per entity (or consolidated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot of all account balances for one entity (or all entities).
 *
 * @param {Object} options
 * @param {string|ObjectId} [options.entityId]   — scope to one entity; omit for consolidated
 * @param {string[]}         [options.types]      — e.g. ["ASSET", "LIABILITY"]
 * @param {string[]}         [options.codes]      — specific account codes
 * @param {boolean}          [options.nonZeroOnly]
 */
export async function getBalanceSummary(options = {}) {
  const { entityId, types, codes, nonZeroOnly = false } = options;

  const filter = { isActive: true };
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
  if (types?.length) filter.type = { $in: types };
  if (codes?.length) filter.code = { $in: codes };

  const accounts = await Account.find(filter)
    .populate("entityId", "name type")
    .sort({ code: 1 })
    .lean();

  const rows = accounts
    .filter((a) => !nonZeroOnly || a.currentBalancePaisa !== 0)
    .map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      entity: a.entityId,
      balance: formatBalance(a.currentBalancePaisa),
      balanceSide: getBalanceSide(a.type, a.currentBalancePaisa),
    }));

  // Group by type
  const grouped = {};
  for (const row of rows) {
    (grouped[row.type] = grouped[row.type] ?? []).push(row);
  }

  const subtotals = {};
  for (const [type, group] of Object.entries(grouped)) {
    const total = group.reduce((s, r) => s + r.balance.paisa, 0);
    subtotals[type] = formatBalance(total);
  }

  // Trial balance check from ledger (scoped to entity if provided)
  const matchStage = entityId
    ? { entityId: new mongoose.Types.ObjectId(String(entityId)) }
    : {};

  const [debitResult] = await LedgerEntry.aggregate([
    { $match: matchStage },
    { $group: { _id: null, total: { $sum: "$debitAmountPaisa" } } },
  ]);
  const [creditResult] = await LedgerEntry.aggregate([
    { $match: matchStage },
    { $group: { _id: null, total: { $sum: "$creditAmountPaisa" } } },
  ]);

  const totalDebitPaisa = debitResult?.total ?? 0;
  const totalCreditPaisa = creditResult?.total ?? 0;

  return {
    accounts: grouped,
    subtotals,
    trialBalance: {
      totalDebit: formatBalance(totalDebitPaisa),
      totalCredit: formatBalance(totalCreditPaisa),
      isBalanced: totalDebitPaisa === totalCreditPaisa,
      discrepancy: formatBalance(Math.abs(totalDebitPaisa - totalCreditPaisa)),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBalanceSide(accountType, balancePaisa) {
  const isDebitNormal = NORMAL_SIDE[accountType] ?? true;
  if (balancePaisa === 0) return "NIL";
  if (isDebitNormal) return balancePaisa > 0 ? "DR" : "CR (abnormal)";
  return balancePaisa > 0 ? "CR" : "DR (abnormal)";
}
