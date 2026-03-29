/**
 * revenueReceived.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builder for manual / non-rent revenue received.
 *
 * Double-entry:
 *   DR  Cash / Bank sub-account   (ASSET ↑  — money in)
 *   CR  Revenue                   (REVENUE ↑ — income earned)
 *
 * FIX (this commit):
 *   Previously the 3rd parameter defaulted to ACCOUNT_CODES.CASH_BANK ("1000"),
 *   meaning any caller that forgot to pass bankAccountCode silently posted
 *   to the cash control account instead of the actual bank.
 *
 *   Now:
 *   - paymentMethod is a required field in options
 *   - bankAccountCode is a required 3rd argument for bank/cheque payments
 *   - Both are validated via assertValidPaymentMethod / getDebitAccountForPayment
 *   - There is NO default — missing values throw immediately
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

/** AD "YYYY-MM-DD" must become a JS Date before NepaliDate — the library parses bare strings as BS. */
function toJsDateForNepaliConversion(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
  }
  return value;
}

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(toJsDateForNepaliConversion(base)));
}

/**
 * @param {Object} revenue    - Revenue document with _id
 *
 * @param {Object} options
 *   Required:
 *     paymentMethod {string}   - "cash" | "bank_transfer" | "cheque" | "mobile_wallet"
 *     amountPaisa  {number}    - integer paisa  OR
 *     amount       {number}    - rupees (converted internally)
 *   Optional:
 *     paymentDate  {Date}
 *     nepaliDate   {string}    - BS "YYYY-MM-DD"; derived from paymentDate if omitted
 *     nepaliMonth  {number}
 *     nepaliYear   {number}
 *     description  {string}
 *     createdBy    {ObjectId}
 *     tenant       {Object}    - for name display
 *     tenantName   {string}    - overrides tenant.name
 *
 * @param {string} [bankAccountCode]
 *   Chart-of-accounts code for the receiving bank (e.g. "1010-SANIMA").
 *   Required when paymentMethod is "bank_transfer" or "cheque".
 *   Omit for "cash" or "mobile_wallet".
 *
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildRevenueReceivedJournal(revenue, options, bankAccountCode) {
  const {
    paymentMethod,
    amountPaisa,
    amount,
    paymentDate,
    nepaliDate: rawNepaliDate,
    description,
    createdBy,
    nepaliMonth: optNepaliMonth,
    nepaliYear: optNepaliYear,
    tenantName,
    tenant,
  } = options;

  // ── 1. Validate ─────────────────────────────────────────────────────────
  assertValidPaymentMethod(paymentMethod);

  // Resolve bankAccountCode: explicit 3rd arg wins, then options field
  const resolvedBankCode = bankAccountCode ?? options.bankAccountCode;

  // Routes to correct sub-account; throws if bank code missing for bank_transfer
  const drAccountCode = getDebitAccountForPayment(
    paymentMethod,
    resolvedBankCode,
  );

  // ── 2. Amount ────────────────────────────────────────────────────────────
  const finalAmountPaisa =
    amountPaisa !== undefined
      ? amountPaisa
      : amount !== undefined
        ? rupeesToPaisa(amount)
        : 0;

  // ── 3. Dates ─────────────────────────────────────────────────────────────
  const transactionDate = paymentDate || new Date();
  const nepaliDate = resolveNepaliDateString(rawNepaliDate, transactionDate);

  let nepaliMonth = optNepaliMonth;
  let nepaliYear = optNepaliYear;
  if (!nepaliMonth || !nepaliYear) {
    if (typeof rawNepaliDate === "string" && rawNepaliDate.length > 0) {
      const [y, m] = rawNepaliDate.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) {
        nepaliYear = nepaliYear ?? y;
        nepaliMonth = nepaliMonth ?? m;
      }
    }
    if (!nepaliMonth || !nepaliYear) {
      const nd = new NepaliDate(toJsDateForNepaliConversion(transactionDate));
      nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
      nepaliYear = nepaliYear ?? nd.getYear();
    }
  }

  // ── 4. Description ───────────────────────────────────────────────────────
  const name = tenantName ?? tenant?.name;
  const baseDesc = description || "Manual revenue received";
  const fullDescription = name ? `${baseDesc} from ${name}` : baseDesc;

  // ── 5. Payload ───────────────────────────────────────────────────────────
  return {
    transactionType: "REVENUE_STREAM",
    referenceType: "Revenue",
    referenceId: revenue._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: fullDescription,
    createdBy,
    totalAmountPaisa: finalAmountPaisa,
    entries: [
      {
        accountCode: drAccountCode, // ← specific bank or CASH, never hard-coded
        debitAmountPaisa: finalAmountPaisa,
        creditAmountPaisa: 0,
        description: fullDescription,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: finalAmountPaisa,
        description: fullDescription,
      },
    ],
  };
}
