/**
 * neaPayment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builder for clearing the NEA Payable when the owner pays
 * the NEA electricity bill.
 *
 * M2 FIX: buildElectricityNeaCostJournal (electricity.js) correctly CRs
 * NEA_PAYABLE (2050) when a charge is raised. Without this builder, account
 * 2050 grows unbounded and is never cleared. This builder discharges that
 * liability when the NEA bill is actually paid.
 *
 * Double-entry:
 *   DR  NEA Payable (2050)      neaCostPaisa  — liability cleared
 *   CR  Bank / Cash             neaCostPaisa  — cash exits
 *
 * Usage:
 *   const payload = buildNeaPaymentJournal(neaPayment, options);
 *   await ledgerService.postJournalEntry(payload, session, entityId);
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getCreditAccountForPayment,
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
 * @param {Object} payment
 *   Required:
 *     amountPaisa     {number}   — integer paisa paid to NEA
 *     paymentMethod   {string}   — "cash" | "bank_transfer" | "cheque" | "mobile_wallet"
 *     paymentDate     {Date}     — date payment was made
 *     referenceId     {ObjectId} — source document _id (e.g. NEABill or Electricity _id)
 *   Optional:
 *     bankAccountCode {string}   — required for bank_transfer / cheque
 *     nepaliDate      {string}   — BS date string "YYYY-MM-DD"
 *     nepaliMonth     {number}   — 1–12; derived from paymentDate if absent
 *     nepaliYear      {number}   — BS year; derived from paymentDate if absent
 *     createdBy       {ObjectId}
 *     property        {ObjectId}
 *     note            {string}
 *
 * @param {string|ObjectId} entityId — OwnershipEntity (required)
 *
 * @returns {Object} Journal payload for ledgerService.postJournalEntry()
 */
export function buildNeaPaymentJournal(payment, entityId) {
  if (!entityId) {
    throw new Error("buildNeaPaymentJournal: entityId is required");
  }

  assertValidPaymentMethod(payment.paymentMethod);
  assertIntegerPaisa(payment.amountPaisa, "payment.amountPaisa");

  if (payment.amountPaisa <= 0) {
    throw new Error(
      `buildNeaPaymentJournal: amountPaisa must be > 0, got ${payment.amountPaisa}`,
    );
  }

  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  const nepaliDate = resolveNepaliDateString(payment.nepaliDate, transactionDate);

  let { nepaliMonth, nepaliYear } = payment;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear  = nepaliYear  ?? nd.getYear();
  }

  const crAccountCode = getCreditAccountForPayment(
    payment.paymentMethod,
    payment.bankAccountCode,
  );

  const description =
    `NEA electricity payment — ${nepaliMonth}/${nepaliYear}` +
    (payment.note ? ` — ${payment.note}` : "");

  return {
    transactionType: "NEA_PAYMENT",
    referenceType: "NeaPayment",
    referenceId: payment.referenceId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    entityId,
    property: payment.property ?? null,
    entries: [
      {
        // DR NEA Payable — clears what we owe NEA
        accountCode: ACCOUNT_CODES.NEA_PAYABLE,
        debitAmountPaisa: payment.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        // CR Bank/Cash — money leaves
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.amountPaisa,
        description,
      },
    ],
  };
}
