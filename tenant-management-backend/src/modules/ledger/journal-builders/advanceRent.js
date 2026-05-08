/**
 * advanceRent.js
 *
 * Two-step journal for advance (prepaid) rent from tenants.
 *
 * Step 1 — Receipt of advance:
 *   DR  Cash/Bank               amountPaisa   (ASSET ↑ — money received)
 *   CR  2300 Deferred Rent Rev  amountPaisa   (LIABILITY ↑ — unearned income)
 *
 * Step 2 — Monthly recognition (per period):
 *   DR  2300 Deferred Rent Rev  periodAmountPaisa  (LIABILITY ↓ — income earned this period)
 *   CR  4000 Rental Income      periodAmountPaisa  (REVENUE ↑)
 *
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveDate(d) {
  const dt = d instanceof Date ? d : new Date(d ?? Date.now());
  const nd = new NepaliDate(dt);
  return { txDate: dt, nepaliDate: formatNepaliISO(nd), bsMonth: nd.getMonth() + 1, bsYear: nd.getYear() };
}

/**
 * Journal when advance rent is received from a tenant.
 *
 * @param {Object} p
 * @param {string|ObjectId} p.advanceRentId      AdvanceRent._id
 * @param {string|ObjectId} p.tenantId
 * @param {string}          p.tenantName
 * @param {string|ObjectId} p.entityId
 * @param {number}          p.amountPaisa
 * @param {string}          p.paymentMethod      "cash" | "bank_transfer" | "cheque"
 * @param {string}          [p.bankAccountCode]
 * @param {Date}            [p.receiptDate]
 * @param {number}          [p.nepaliMonth]
 * @param {number}          [p.nepaliYear]
 * @param {string|ObjectId} [p.createdBy]
 */
export function buildAdvanceRentReceiptJournal({
  advanceRentId, tenantId, tenantName, entityId,
  amountPaisa, paymentMethod, bankAccountCode,
  receiptDate, nepaliMonth, nepaliYear, createdBy,
}) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0)
    throw new Error(`amountPaisa must be a positive integer`);

  const { txDate, nepaliDate, bsMonth, bsYear } = resolveDate(receiptDate);
  const bm = nepaliMonth ?? bsMonth;
  const by = nepaliYear  ?? bsYear;

  const debitCode =
    paymentMethod === "cash"
      ? ACCOUNT_CODES.CASH
      : bankAccountCode ?? (() => { throw new Error("bankAccountCode required for non-cash advance"); })();

  const name = tenantName ?? "Tenant";

  return {
    transactionType:  "ADVANCE_RENT_RECEIPT",
    referenceType:    "AdvanceRent",
    referenceId:      advanceRentId,
    transactionDate:  txDate,
    nepaliDate,
    nepaliMonth:      bm,
    nepaliYear:       by,
    description:      `Advance rent received — ${name}`,
    createdBy:        createdBy ?? null,
    totalAmountPaisa: amountPaisa,
    tenant:           tenantId,
    entityId,
    entries: [
      {
        accountCode:       debitCode,
        debitAmountPaisa:  amountPaisa,
        creditAmountPaisa: 0,
        description:       `Cash/bank — advance rent from ${name}`,
      },
      {
        accountCode:       ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: amountPaisa,
        description:       `Deferred rent — unearned advance from ${name}`,
      },
    ],
  };
}

/**
 * Journal when advance rent is recognised as income for a specific period.
 *
 * @param {Object} p
 * @param {string|ObjectId} p.advanceRentId
 * @param {string|ObjectId} p.tenantId
 * @param {string}          p.tenantName
 * @param {string|ObjectId} p.entityId
 * @param {number}          p.periodAmountPaisa   Amount to recognise this period
 * @param {number}          p.nepaliMonth
 * @param {number}          p.nepaliYear
 * @param {Date}            [p.recognitionDate]
 * @param {string|ObjectId} [p.createdBy]
 */
export function buildAdvanceRentRecognitionJournal({
  advanceRentId, tenantId, tenantName, entityId,
  periodAmountPaisa, nepaliMonth, nepaliYear, recognitionDate, createdBy,
}) {
  if (!Number.isInteger(periodAmountPaisa) || periodAmountPaisa <= 0)
    throw new Error(`periodAmountPaisa must be a positive integer`);

  const { txDate, nepaliDate } = resolveDate(recognitionDate);
  const name = tenantName ?? "Tenant";

  return {
    transactionType:  "ADVANCE_RENT_RECOGNITION",
    referenceType:    "AdvanceRent",
    referenceId:      advanceRentId,
    transactionDate:  txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description:      `Advance rent recognised — ${name} — ${nepaliMonth}/${nepaliYear}`,
    createdBy:        createdBy ?? null,
    totalAmountPaisa: periodAmountPaisa,
    tenant:           tenantId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
        debitAmountPaisa:  periodAmountPaisa,
        creditAmountPaisa: 0,
        description:       `Deferred rent earned — ${nepaliMonth}/${nepaliYear}`,
      },
      {
        accountCode:       ACCOUNT_CODES.REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: periodAmountPaisa,
        description:       `Rental income recognised — ${name} — ${nepaliMonth}/${nepaliYear}`,
      },
    ],
  };
}
