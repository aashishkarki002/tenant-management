/**
 * journalPayloadUtil.js
 *
 * Canonical journal payload builder and validator.
 * Every journal builder (rentCharge, paymentReceived, expense, etc.)
 * must call buildJournalPayload() as its last step so the shape is
 * always identical before it reaches ledgerService.postJournalEntry().
 *
 * Canonical payload shape:
 * {
 *   transactionType:   string,         // e.g. "RENT_CHARGE"
 *   referenceType:     string,         // e.g. "Rent"
 *   referenceId:       ObjectId,
 *   transactionDate:   Date,
 *   nepaliDate:        Date,
 *   nepaliMonth:       number,         // 1–12 (Nepali calendar)
 *   nepaliYear:        number,         // e.g. 2081
 *   description:       string,
 *   createdBy:         ObjectId|null,
 *   totalAmountPaisa:  number,         // positive integer
 *   tenant:            ObjectId|null,
 *   property:          ObjectId|null,
 *   entries: [
 *     {
 *       accountCode:        string,
 *       debitAmountPaisa:   number,    // integer ≥ 0
 *       creditAmountPaisa:  number,    // integer ≥ 0
 *       description:        string,
 *     }
 *   ]
 * }
 */

import { assertNepaliFields } from "./nepaliDateHelper.js";

/**
 * Validates a single journal entry line.
 * @param {Object} entry
 * @param {number} index  - position in entries array (for error messages)
 */
function validateEntry(entry, index) {
  const { accountCode, debitAmountPaisa, creditAmountPaisa } = entry;

  if (!accountCode || typeof accountCode !== "string") {
    throw new Error(`Entry[${index}]: accountCode must be a non-empty string`);
  }
  if (!Number.isInteger(debitAmountPaisa) || debitAmountPaisa < 0) {
    throw new Error(
      `Entry[${index}] (${accountCode}): debitAmountPaisa must be a non-negative integer, got ${debitAmountPaisa}`,
    );
  }
  if (!Number.isInteger(creditAmountPaisa) || creditAmountPaisa < 0) {
    throw new Error(
      `Entry[${index}] (${accountCode}): creditAmountPaisa must be a non-negative integer, got ${creditAmountPaisa}`,
    );
  }
  if (debitAmountPaisa > 0 && creditAmountPaisa > 0) {
    throw new Error(
      `Entry[${index}] (${accountCode}): an entry cannot have both debit and credit > 0`,
    );
  }
  if (debitAmountPaisa === 0 && creditAmountPaisa === 0) {
    throw new Error(
      `Entry[${index}] (${accountCode}): entry has both debit and credit = 0`,
    );
  }
}

/**
 * Build and validate a canonical journal payload.
 *
 * @param {Object} params
 * @param {string}   params.transactionType
 * @param {string}   params.referenceType
 * @param {*}        params.referenceId
 * @param {Date}     params.transactionDate
 * @param {Date}     [params.nepaliDate]      defaults to transactionDate
 * @param {number}   params.nepaliMonth
 * @param {number}   params.nepaliYear
 * @param {string}   params.description
 * @param {*}        [params.createdBy]
 * @param {number}   params.totalAmountPaisa  - must be a positive integer
 * @param {*}        [params.tenant]
 * @param {*}        [params.property]
 * @param {Object[]} params.entries
 * @param {Object}   [params.meta]            - optional extra fields (billingFrequency, quarter, etc.)
 *
 * @returns {Object} validated canonical payload
 */
export function buildJournalPayload({
  transactionType,
  referenceType,
  referenceId,
  transactionDate,
  nepaliDate,
  nepaliMonth,
  nepaliYear,
  description,
  createdBy,
  totalAmountPaisa,
  tenant,
  property,
  entries,
  meta = {},
}) {
  // ── 1. Required scalars ──────────────────────────────────────────────────
  if (!transactionType) throw new Error("transactionType is required");
  if (!referenceType) throw new Error("referenceType is required");
  if (!referenceId) throw new Error("referenceId is required");
  if (!description) throw new Error("description is required");

  if (!(transactionDate instanceof Date) || isNaN(transactionDate.getTime())) {
    throw new Error(
      `transactionDate must be a valid Date, got ${transactionDate}`,
    );
  }

  // ── 2. Nepali calendar fields ────────────────────────────────────────────
  assertNepaliFields({ nepaliYear, nepaliMonth });

  // ── 3. Total amount ──────────────────────────────────────────────────────
  if (!Number.isInteger(totalAmountPaisa) || totalAmountPaisa <= 0) {
    throw new Error(
      `totalAmountPaisa must be a positive integer, got ${totalAmountPaisa}`,
    );
  }

  // ── 4. Entries ───────────────────────────────────────────────────────────
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error("entries must be an array with at least 2 lines");
  }
  entries.forEach((e, i) => validateEntry(e, i));

  // ── 5. Double-entry balance check ────────────────────────────────────────
  const totalDebitPaisa = entries.reduce((s, e) => s + e.debitAmountPaisa, 0);
  const totalCreditPaisa = entries.reduce((s, e) => s + e.creditAmountPaisa, 0);
  if (totalDebitPaisa !== totalCreditPaisa) {
    throw new Error(
      `Journal does not balance for ${transactionType}: ` +
        `debits=${totalDebitPaisa} paisa, credits=${totalCreditPaisa} paisa`,
    );
  }

  // ── 6. Assemble canonical payload ────────────────────────────────────────
  return {
    transactionType,
    referenceType,
    referenceId,
    transactionDate,
    nepaliDate: nepaliDate instanceof Date ? nepaliDate : transactionDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: createdBy ?? null,
    totalAmountPaisa,
    tenant: tenant ?? null,
    property: property ?? null,
    entries: entries.map((e) => ({
      accountCode: e.accountCode,
      debitAmountPaisa: e.debitAmountPaisa,
      creditAmountPaisa: e.creditAmountPaisa,
      description: e.description ?? description,
    })),
    // Spread any extra metadata (billingFrequency, quarter, etc.)
    ...meta,
  };
}
