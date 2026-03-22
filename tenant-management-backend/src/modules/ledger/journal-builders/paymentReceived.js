/**
 * paymentReceived.js
 *
 * Builds the journal payload for a rent payment received.
 *
 * Signature updated to match rent.payment.service.js:
 *   buildPaymentReceivedJournal(rent, options)
 *
 *   options: {
 *     amountPaisa:      number   — integer paisa
 *     paymentMethod:    string
 *     bankAccountCode:  string | undefined
 *     paymentDate:      Date
 *     payment:          Payment document
 *   }
 *
 * Correct double-entry:
 *   DR  Cash / Bank Account   (ASSET ↑ — money received)
 *   CR  Accounts Receivable   (ASSET ↓ — tenant owes less)
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
 * @param {Object} rent      - Rent document
 *   Must have: nepaliMonth, nepaliYear
 *   Optional:  tenant, property, block
 *
 * @param {Object} options
 * @param {number}  options.amountPaisa       integer paisa
 * @param {string}  options.paymentMethod
 * @param {string}  [options.bankAccountCode]
 * @param {Date}    [options.paymentDate]
 * @param {Object}  options.payment           Payment document (_id, receivedBy, nepaliDate)
 *
 * @returns {Object} Canonical journal payload
 */
export function buildPaymentReceivedJournal(rent, options) {
  const {
    amountPaisa,
    paymentMethod,
    bankAccountCode,
    paymentDate = new Date(),
    payment,
  } = options;

  // ── 1. Validate ───────────────────────────────────────────────────────────
  assertValidPaymentMethod(paymentMethod);
  assertIntegerPaisa(amountPaisa, "amountPaisa");

  // ── 2. Dates ──────────────────────────────────────────────────────────────
  const transactionDate =
    paymentDate instanceof Date
      ? paymentDate
      : new Date(paymentDate ?? Date.now());

  // Always store BS date as "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    payment?.nepaliDate,
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
    paymentMethod,
    bankAccountCode,
  );

  const tenantName = rent?.tenant?.name ?? "";
  const description =
    `Rent payment received for ${nepaliMonth}/${nepaliYear}` +
    (tenantName ? ` — ${tenantName}` : "");

  // ── 5. Build canonical payload ────────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "RENT_PAYMENT_RECEIVED",
    referenceType: "RentPayment",
    referenceId: payment?._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment?.receivedBy ?? null,
    totalAmountPaisa: amountPaisa,
    tenant: rent?.tenant,
    property: rent?.property,
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description,
      },
    ],
  });
}
