/**
 * paymentReceived.js  (FIXED)
 *
 * Builds the journal payload for a rent payment received.
 *
 * Correct double-entry:
 *   DR  Cash / Bank Account   (ASSET ↑ — money received)
 *   CR  Accounts Receivable   (ASSET ↓ — tenant owes less)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  resolveNepaliPeriod,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} payment  - Payment document
 *   Must have:  _id, amountPaisa (integer), paymentMethod
 *   Optional:   paymentDate, nepaliDate, createdBy / receivedBy
 *
 * @param {Object} rent     - Rent document (for context)
 *   Must have:  nepaliMonth, nepaliYear
 *   Optional:   tenant, property
 *
 * @param {string} [bankAccountCode]
 *
 * @returns {Object} Canonical journal payload
 */
export function buildPaymentReceivedJournal(payment, rent, bankAccountCode) {
  // ── 1. Validate ───────────────────────────────────────────────────────────
  assertValidPaymentMethod(payment.paymentMethod);
  assertIntegerPaisa(payment.amountPaisa, "payment.amountPaisa");

  // ── 2. Dates ──────────────────────────────────────────────────────────────
  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    payment.nepaliDate,
    transactionDate,
  );

  // ── 3. Resolve Nepali period ──────────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = resolveNepaliPeriod({
    nepaliMonth: rent?.nepaliMonth,
    nepaliYear: rent?.nepaliYear,
    fallbackDate: transactionDate,
  });

  // ── 4. Determine DR account ───────────────────────────────────────────────
  const drAccountCode = getDebitAccountForPayment(
    payment.paymentMethod,
    bankAccountCode,
  );

  const tenantName = rent?.tenant?.name ?? "";
  const description =
    `Rent payment received for ${nepaliMonth}/${nepaliYear}` +
    (tenantName ? ` — ${tenantName}` : "");

  // ── 5. Build canonical payload ───────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "RENT_PAYMENT_RECEIVED",
    referenceType: "RentPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? payment.receivedBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    tenant: rent?.tenant,
    property: rent?.property,
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: payment.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.amountPaisa,
        description,
      },
    ],
  });
}
