/**
 * vendorPayment.js
 *
 * Builds the journal payload for a vendor payment (both directions).
 *
 * paymentDirection = "outflow"  — we pay a service vendor (expense settlement):
 *   DR  expenseAccountCode    amountPaisa   (EXPENSE ↑ — cost recorded)
 *   CR  Cash/Bank             amountPaisa   (ASSET ↓  — money leaves)
 *
 * paymentDirection = "inflow"  — stall vendor pays us (revenue receipt):
 *   DR  Cash/Bank             amountPaisa   (ASSET ↑  — money arrives)
 *   CR  revenueAccountCode    amountPaisa   (REVENUE ↑ — income recognised)
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  getDebitAccountForPayment,
  getCreditAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import {
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base instanceof Date ? base : new Date(base)));
}

/**
 * @param {Object} payment  - VendorPayment document (plain object or Mongoose doc)
 *   Must have:  _id, amountPaisa (integer), paymentMethod, paymentDirection,
 *               nepaliMonth, nepaliYear
 *   Optional:   paymentDate, nepaliDate, recordedBy
 *
 * @param {string} bankAccountCode   - chart-of-accounts code of the bank account
 *                                     (required when paymentMethod !== "cash")
 * @param {string} expenseAccountCode - account to DR on outflow (from VendorContract)
 * @param {string} revenueAccountCode - account to CR on inflow (from VendorContract)
 * @param {string} vendorName
 *
 * @returns {Object} Canonical journal payload for postJournalEntry
 */
export function buildVendorPaymentJournal(
  payment,
  bankAccountCode,
  expenseAccountCode,
  revenueAccountCode,
  vendorName = "Vendor",
) {
  assertValidPaymentMethod(payment.paymentMethod);
  assertIntegerPaisa(payment.amountPaisa, "payment.amountPaisa");

  const isOutflow = payment.paymentDirection === "outflow";

  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  const nepaliDate = resolveNepaliDateString(payment.nepaliDate, transactionDate);

  const { nepaliMonth, nepaliYear } = payment;

  if (!nepaliMonth || !nepaliYear) {
    throw new Error("vendorPayment journal: nepaliMonth and nepaliYear are required");
  }

  const amountNPR = payment.amountPaisa / 100;
  const direction = isOutflow ? "Payment to" : "Receipt from";
  const description = `${direction} ${vendorName} — ${amountNPR} NPR`;

  let entries;

  if (isOutflow) {
    // We pay the vendor — DR expense / CR cash/bank
    const drAccountCode = expenseAccountCode ?? ACCOUNT_CODES.EXPENSE_OTHER;
    const crAccountCode = getCreditAccountForPayment(payment.paymentMethod, bankAccountCode);

    entries = [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: payment.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.amountPaisa,
        description,
      },
    ];
  } else {
    // Vendor pays us (stall lease) — DR cash/bank / CR revenue
    const drAccountCode = getDebitAccountForPayment(payment.paymentMethod, bankAccountCode);
    const crAccountCode = revenueAccountCode ?? ACCOUNT_CODES.EVENT_STALL_REVENUE;

    entries = [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: payment.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.amountPaisa,
        description,
      },
    ];
  }

  return buildJournalPayload({
    transactionType: isOutflow ? "VENDOR_PAYMENT_OUTFLOW" : "VENDOR_PAYMENT_INFLOW",
    referenceType: "VendorPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.recordedBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    property: payment.property ?? null,
    entries,
  });
}
