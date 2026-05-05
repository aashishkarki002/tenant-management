/**
 * openingBalance.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builder for posting opening balances when onboarding an
 * existing property into the system.
 *
 * m5 FIX: Previously there was no mechanism to post opening balances with an
 * audit trail. Direct DB seeding leaves no journal record and bypasses period
 * close guards, balance checks, and account resolution validation.
 *
 * OPENING_BALANCE transactions are single-sided by nature (they establish the
 * starting state). To keep the ledger balanced, every opening balance journal
 * must net to zero: assets/expenses offset by liabilities/equity/revenue.
 *
 * Typical opening journal for an existing property:
 *   DR  1200  Outstanding AR          — tenants who owe rent
 *   DR  Bank  Cash on hand / in bank
 *   CR  2100  Security deposits held  — tenant liabilities
 *   CR  2200  Outstanding loan        — bank liabilities
 *   CR  3000  Owner's capital         — balancing equity entry
 *
 * ALL entries must be passed in a single call so the DR=CR check enforces
 * balance. The builder validates this before returning.
 *
 * @param {Object} options
 *   Required:
 *     entityId        {string|ObjectId}
 *     asOfDate        {Date}    — Gregorian date the opening balances are effective
 *     entries         {Array}   — array of { accountCode, debitAmountPaisa, creditAmountPaisa, description }
 *   Optional:
 *     nepaliDate      {string}  — BS date "YYYY-MM-DD"; derived from asOfDate if absent
 *     nepaliMonth     {number}
 *     nepaliYear      {number}
 *     createdBy       {ObjectId}
 *     note            {string}
 *
 * @returns {Object} Journal payload for ledgerService.postJournalEntry()
 */

import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

export function buildOpeningBalanceJournal(options) {
  const {
    entityId,
    asOfDate,
    entries,
    nepaliDate: rawNepaliDate,
    createdBy,
    note,
  } = options;

  if (!entityId) {
    throw new Error("buildOpeningBalanceJournal: entityId is required");
  }
  if (!asOfDate) {
    throw new Error("buildOpeningBalanceJournal: asOfDate is required");
  }
  if (!entries?.length) {
    throw new Error("buildOpeningBalanceJournal: entries must be a non-empty array");
  }

  // Validate all amounts are non-negative integers
  for (const e of entries) {
    if (!Number.isInteger(e.debitAmountPaisa ?? 0) || (e.debitAmountPaisa ?? 0) < 0) {
      throw new Error(`buildOpeningBalanceJournal: debitAmountPaisa must be a non-negative integer for account ${e.accountCode}`);
    }
    if (!Number.isInteger(e.creditAmountPaisa ?? 0) || (e.creditAmountPaisa ?? 0) < 0) {
      throw new Error(`buildOpeningBalanceJournal: creditAmountPaisa must be a non-negative integer for account ${e.accountCode}`);
    }
  }

  // Enforce DR = CR balance
  const totalDebit  = entries.reduce((s, e) => s + (e.debitAmountPaisa  || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.creditAmountPaisa || 0), 0);
  if (totalDebit !== totalCredit) {
    throw new Error(
      `buildOpeningBalanceJournal: entries do not balance — DR ${totalDebit} vs CR ${totalCredit} paisa. ` +
        `Add a balancing entry (e.g. Owner's Capital 3000) to make DR = CR.`,
    );
  }

  const transactionDate =
    asOfDate instanceof Date ? asOfDate : new Date(asOfDate);

  const nepaliDate = resolveNepaliDateString(rawNepaliDate, transactionDate);

  let { nepaliMonth, nepaliYear } = options;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear  = nepaliYear  ?? nd.getYear();
  }

  const description = note
    ? `Opening balance — ${nepaliMonth}/${nepaliYear} — ${note}`
    : `Opening balance as of ${nepaliMonth}/${nepaliYear}`;

  return {
    transactionType: "OPENING_BALANCE",
    referenceType: "OpeningBalance",
    // Use entityId as referenceId so the idempotency guard prevents double-posting
    // opening balances for the same entity. If you need multiple opening balance
    // batches, pass a unique referenceId per batch.
    referenceId: options.referenceId ?? entityId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: createdBy ?? null,
    totalAmountPaisa: totalDebit,
    entityId,
    entries: entries.map((e) => ({
      accountCode: e.accountCode,
      debitAmountPaisa: e.debitAmountPaisa || 0,
      creditAmountPaisa: e.creditAmountPaisa || 0,
      description: e.description ?? description,
    })),
  };
}
