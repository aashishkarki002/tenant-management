/**
 * camPaymentReceived.js  (FIXED)
 *
 * Builds the journal payload for a CAM payment received.
 *   DR  Cash / Bank           (ASSET ↑ — money received)
 *   CR  Accounts Receivable   (ASSET ↓ — tenant owes less)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getDebitAccountForPayment } from "../../../utils/paymentAccountUtils.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} payment - Payment document
 *   Must have:  _id, amountPaisa (integer), paymentMethod
 *   Optional:   paymentDate, nepaliDate, createdBy / receivedBy
 *
 * @param {Object} cam - Cam document with tenant, property, nepaliMonth, nepaliYear
 * @param {string} [bankAccountCode]
 *
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildCamPaymentReceivedJournal(payment, cam, bankAccountCode) {
  if (!payment.amountPaisa || !Number.isInteger(payment.amountPaisa)) {
    throw new Error(
      `payment.amountPaisa must be an integer, got: ${payment.amountPaisa}`,
    );
  }

  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  const nepaliMonth =
    cam?.nepaliMonth ?? new Date(transactionDate).getMonth() + 1;
  const nepaliYear = cam?.nepaliYear ?? new Date(transactionDate).getFullYear();

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    payment.nepaliDate,
    transactionDate,
  );

  const drAccountCode = getDebitAccountForPayment(
    payment.paymentMethod,
    bankAccountCode,
  );

  const description =
    `CAM payment received for ${nepaliMonth}/${nepaliYear}` +
    (cam?.tenant?.name ? ` — ${cam.tenant.name}` : "");

  return buildJournalPayload({
    transactionType: "CAM_PAYMENT_RECEIVED",
    referenceType: "CamPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? payment.receivedBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    tenant: cam?.tenant,
    property: cam?.property,
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
