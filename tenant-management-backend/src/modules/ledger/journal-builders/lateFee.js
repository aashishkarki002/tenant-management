/**
 * lateFee.js  (FIXED)
 *
 * Builds the journal payload for a late fee charge.
 *
 * Correct double-entry:
 *   DR  Accounts Receivable   (ASSET ↑   — tenant owes the late fee)
 *   CR  Late Fee Revenue      (REVENUE ↑ — income earned from penalty)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  assertNepaliFields,
  resolveNepaliPeriod,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import {
  assertValidPaymentMethod,
  getDebitAccountForPayment,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} lateFee
 *   Must have:  _id, amountPaisa (integer), nepaliMonth, nepaliYear
 *   Optional:   chargedAt / createdAt, nepaliDate, createdBy, tenant, property,
 *               daysOverdue, originalRentId
 *
 * @returns {Object} Canonical journal payload
 */
export function buildLateFeeJournal(lateFee) {
  // ── 1. Validate ───────────────────────────────────────────────────────────
  assertIntegerPaisa(lateFee.amountPaisa, "lateFee.amountPaisa");
  assertNepaliFields({
    nepaliYear: lateFee.nepaliYear,
    nepaliMonth: lateFee.nepaliMonth,
  });

  // ── 2. Metadata ───────────────────────────────────────────────────────────
  const transactionDate =
    lateFee.chargedAt instanceof Date
      ? lateFee.chargedAt
      : new Date(lateFee.chargedAt ?? lateFee.createdAt ?? Date.now());

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    lateFee.nepaliDate,
    transactionDate,
  );

  const tenantName = lateFee.tenant?.name ?? "Tenant";
  const daysInfo = lateFee.daysOverdue
    ? ` (${lateFee.daysOverdue} days overdue)`
    : "";
  const description = `Late fee for ${lateFee.nepaliMonth}/${lateFee.nepaliYear} — ${tenantName}${daysInfo}`;

  // ── 3. Canonical payload ──────────────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "LATE_FEE_CHARGE",
    referenceType: "LateFee",
    referenceId: lateFee._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: lateFee.nepaliMonth,
    nepaliYear: lateFee.nepaliYear,
    description,
    createdBy: lateFee.createdBy ?? null,
    totalAmountPaisa: lateFee.amountPaisa,
    tenant: lateFee.tenant,
    property: lateFee.property,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: lateFee.amountPaisa,
        creditAmountPaisa: 0,
        description: `Late fee receivable — ${tenantName}`,
      },
      {
        accountCode: ACCOUNT_CODES.LATE_FEE_REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: lateFee.amountPaisa,
        description: `Late fee income — ${lateFee.nepaliMonth}/${lateFee.nepaliYear}`,
      },
    ],
    meta: {
      originalRentId: lateFee.originalRentId ?? null,
    },
  });
}

/**
 * Builds the journal for when a late fee payment is actually received.
 *
 *   DR  Cash / Bank Account   (ASSET ↑ — money in)
 *   CR  Accounts Receivable   (ASSET ↓ — tenant owes less)
 *
 * @param {Object} payment      - Payment document (amountPaisa, paymentMethod, paymentDate)
 * @param {Object} lateFee      - LateFee document (for tenant/property/period context)
 * @param {string} [bankAccountCode]
 */
export function buildLateFeePaymentJournal(payment, lateFee, bankAccountCode) {
  assertValidPaymentMethod(payment.paymentMethod);
  assertIntegerPaisa(payment.amountPaisa, "payment.amountPaisa");

  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    payment.nepaliDate,
    transactionDate,
  );

  const { nepaliMonth, nepaliYear } = resolveNepaliPeriod({
    nepaliMonth: lateFee?.nepaliMonth,
    nepaliYear: lateFee?.nepaliYear,
    fallbackDate: transactionDate,
  });

  const drAccountCode = getDebitAccountForPayment(
    payment.paymentMethod,
    bankAccountCode,
  );
  const tenantName = lateFee?.tenant?.name ?? "";
  const description =
    `Late fee payment for ${nepaliMonth}/${nepaliYear}` +
    (tenantName ? ` — ${tenantName}` : "");

  return buildJournalPayload({
    transactionType: "LATE_FEE_PAYMENT_RECEIVED",
    referenceType: "LateFeePayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    tenant: lateFee?.tenant,
    property: lateFee?.property,
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
