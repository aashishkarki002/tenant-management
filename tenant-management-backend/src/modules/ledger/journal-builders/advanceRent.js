/**
 * advanceRent.js
 *
 * Two-step journal for advance (prepaid) rent from tenants.
 *
 * Step 1 — Receipt of advance:
 *   cash:          DR 1000 Cash              / CR 2300 Deferred Rent
 *   bank_transfer: DR 1010-xxx Bank          / CR 2300 Deferred Rent
 *   cheque:        DR 1150 Cheques In Hand   / CR 2300 Deferred Rent
 *   (cheque deposit journal is posted separately by ChequeDraft lifecycle)
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
    paymentMethod === "cash"    ? ACCOUNT_CODES.CASH :
    paymentMethod === "cheque"  ? ACCOUNT_CODES.CHEQUES_IN_HAND :
    bankAccountCode ?? (() => { throw new Error("bankAccountCode required for bank_transfer"); })();

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
 * Journal when advance rent is applied to an existing rent invoice.
 *
 * Revenue was already posted when the rent was charged (DR 1200, CR 4000).
 * This entry only clears the receivable — never DR 2300 / CR 4000 here.
 *
 * Step 3 — Allocation against an existing invoice (rent / CAM / electricity):
 *   DR  2300 Deferred Rent Rev  amountPaisa  (LIABILITY ↓ — advance consumed)
 *   CR  1200 Accounts Receivable OR          (ASSET ↓ — AR cleared)
 *       1210 CAM Receivable
 *
 * invoiceType determines the CR account:
 *   "RENT" | "ELECTRICITY" → 1200  ACCOUNTS_RECEIVABLE
 *   "CAM"                  → 1210  CAM_RECEIVABLE
 *
 * @param {Object} p
 * @param {string|ObjectId} p.advanceRentId
 * @param {string}          p.invoiceType     "RENT" | "CAM" | "ELECTRICITY"
 * @param {string|ObjectId} p.tenantId
 * @param {string}          p.tenantName
 * @param {string|ObjectId} p.entityId
 * @param {number}          p.amountPaisa
 * @param {number}          p.nepaliMonth
 * @param {number}          p.nepaliYear
 * @param {Date}            [p.allocationDate]
 * @param {string|ObjectId} [p.createdBy]
 */
export function buildAdvanceRentAllocationJournal({
  advanceRentId, invoiceType = "RENT", tenantId, tenantName, entityId,
  amountPaisa, nepaliMonth, nepaliYear, allocationDate, createdBy,
}) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0)
    throw new Error(`amountPaisa must be a positive integer`);

  const { txDate, nepaliDate } = resolveDate(allocationDate);
  const name = tenantName ?? "Tenant";
  const arCode = invoiceType === "CAM"
    ? ACCOUNT_CODES.CAM_RECEIVABLE
    : ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;
  const label = invoiceType === "CAM" ? "CAM" : invoiceType === "ELECTRICITY" ? "electricity" : "rent";

  return {
    transactionType:  "ADVANCE_RENT_ALLOCATION",
    referenceType:    "AdvanceRent",
    referenceId:      advanceRentId,
    transactionDate:  txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description:      `Advance applied to ${label} — ${name} — ${nepaliMonth}/${nepaliYear}`,
    createdBy:        createdBy ?? null,
    totalAmountPaisa: amountPaisa,
    tenant:           tenantId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
        debitAmountPaisa:  amountPaisa,
        creditAmountPaisa: 0,
        description:       `Advance consumed — ${name}`,
      },
      {
        accountCode:       arCode,
        debitAmountPaisa:  0,
        creditAmountPaisa: amountPaisa,
        description:       `${label} AR cleared via advance — ${name} — ${nepaliMonth}/${nepaliYear}`,
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
