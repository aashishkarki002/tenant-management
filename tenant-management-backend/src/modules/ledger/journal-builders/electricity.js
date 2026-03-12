/**
 * electricity.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builders for electricity charges and payments.
 *
 * buildElectricityChargeJournal   — charge raised against tenant
 *   DR  Accounts Receivable    (ASSET ↑  — tenant owes)
 *   CR  Utility Revenue        (REVENUE ↑ — income earned)
 *
 * buildElectricityPaymentJournal  — payment received from tenant
 *   DR  Cash / Bank sub-account  (ASSET ↑  — money in, routed to correct account)
 *   CR  Accounts Receivable      (ASSET ↓  — tenant owes less)
 *
 * FIX (this commit):
 *   buildElectricityPaymentJournal previously hardcoded ACCOUNT_CODES.CASH_BANK
 *   ("1000") as the DR account and had no bankAccountCode parameter. It now
 *   accepts paymentMethod + bankAccountCode and routes through
 *   getDebitAccountForPayment(), matching the pattern in paymentReceived.js,
 *   camPaymentReceived.js, and lateFee.js.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa, paisaToRupees } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

function resolvePaisa(doc, paisaKey, rupeesKey) {
  if (doc[paisaKey] !== undefined) return doc[paisaKey];
  if (doc[rupeesKey] !== undefined) return rupeesToPaisa(doc[rupeesKey]);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Charge journal  (no bank side)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} electricity
 *   Must have:  _id, readingDate, nepaliDate, nepaliMonth, nepaliYear,
 *               consumption, totalAmountPaisa (or totalAmount), createdBy,
 *               tenant, property
 *   Optional:   ratePerUnitPaisa (or ratePerUnit)
 * @returns {Object} Journal payload
 */
export function buildElectricityChargeJournal(electricity) {
  const transactionDate = electricity.readingDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    electricity.nepaliDate,
    transactionDate,
  );
  const totalAmountPaisa = resolvePaisa(
    electricity,
    "totalAmountPaisa",
    "totalAmount",
  );
  const ratePerUnitPaisa = resolvePaisa(
    electricity,
    "ratePerUnitPaisa",
    "ratePerUnit",
  );
  const rateDisplay = paisaToRupees(ratePerUnitPaisa);

  const tenantName = electricity?.tenant?.name;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  const description = [
    `Electricity charge for ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
    `${electricity.consumption} units`,
    tenantName ? `from ${tenantName}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    transactionType: "ELECTRICITY_CHARGE",
    referenceType: "Electricity",
    referenceId: electricity._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmountPaisa,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: totalAmountPaisa,
        creditAmountPaisa: 0,
        description: `Electricity receivable — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
      {
        accountCode: ACCOUNT_CODES.UTILITY_REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: totalAmountPaisa,
        description: `Electricity revenue — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment journal  (has bank side — fixed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} paymentData
 *   Must have:  electricityId, amountPaisa (or amount), paymentDate,
 *               nepaliDate, createdBy, paymentMethod
 *   Optional:   bankAccountCode — required when paymentMethod is
 *               "bank_transfer" or "cheque"; omit for "cash"
 *
 * @param {Object} electricity
 *   Must have:  tenant, property, nepaliMonth, nepaliYear
 *
 * @param {string} [bankAccountCode]
 *   Chart-of-accounts code for the destination bank (e.g. "1010-SANIMA").
 *   Can be passed as the 3rd argument OR embedded in paymentData for
 *   convenience — the 3rd argument takes precedence.
 *
 * @returns {Object} Journal payload
 */
export function buildElectricityPaymentJournal(
  paymentData,
  electricity,
  bankAccountCode,
) {
  // Resolve bankAccountCode: explicit 3rd arg wins, then paymentData field
  const resolvedBankCode = bankAccountCode ?? paymentData.bankAccountCode;

  // Validate early — throws on unknown paymentMethod before any DB work
  assertValidPaymentMethod(paymentData.paymentMethod);

  // Routes to the correct sub-account; throws if bank code is missing
  const drAccountCode = getDebitAccountForPayment(
    paymentData.paymentMethod,
    resolvedBankCode,
  );

  const transactionDate = paymentData.paymentDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    paymentData.nepaliDate,
    transactionDate,
  );
  const amountPaisa = resolvePaisa(paymentData, "amountPaisa", "amount");

  const nepaliMonth = electricity.nepaliMonth;
  const nepaliYear = electricity.nepaliYear;
  const tenantName = electricity?.tenant?.name;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  const description = [
    `Electricity payment — ${nepaliMonth}/${nepaliYear}`,
    tenantName ? `from ${tenantName}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    transactionType: "ELECTRICITY_PAYMENT",
    referenceType: "Electricity",
    referenceId: paymentData.electricityId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: paymentData.createdBy,
    totalAmountPaisa: amountPaisa,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: drAccountCode, // ← specific bank or CASH, never "1000" default
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
  };
}
