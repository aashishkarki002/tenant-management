/**
 * vendorBill.js
 *
 * Two-journal AP workflow for vendor bills.
 *
 * Step 1 — Bill entry (DR Expense / CR Accounts Payable):
 *   DR  expenseAccountCode  amountPaisa   (EXPENSE ↑ — cost recognised)
 *   CR  2000 Accounts Payable amountPaisa (LIABILITY ↑ — we owe vendor)
 *
 * Step 2 — Bill payment (DR Accounts Payable / CR Cash/Bank):
 *   DR  2000 Accounts Payable amountNetPaisa (LIABILITY ↓ — obligation cleared)
 *   DR  5xxx TDS Expense       tdsDeductedPaisa  (if TDS withheld on vendor)
 *   CR  Cash/Bank              amountNetPaisa + any TDS handled separately
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
 * Journal when a vendor bill is entered into the system.
 *
 * @param {Object} p
 * @param {string|ObjectId} p.billId
 * @param {string|ObjectId} p.entityId
 * @param {number}          p.amountPaisa
 * @param {string}          p.expenseAccountCode  e.g. "5000", "5200"
 * @param {Date}            [p.billDate]
 * @param {number}          [p.nepaliMonth]
 * @param {number}          [p.nepaliYear]
 * @param {string}          [p.description]
 * @param {string|ObjectId} [p.createdBy]
 */
export function buildVendorBillEntryJournal({
  billId, entityId, amountPaisa, expenseAccountCode,
  billDate, nepaliMonth, nepaliYear, description, createdBy,
}) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0)
    throw new Error(`amountPaisa must be a positive integer, got ${amountPaisa}`);

  const { txDate, nepaliDate, bsMonth, bsYear } = resolveDate(billDate);
  const bm = nepaliMonth ?? bsMonth;
  const by = nepaliYear  ?? bsYear;
  const desc = description ?? `Vendor bill — ${bm}/${by}`;

  return {
    transactionType: "VENDOR_BILL",
    referenceType:   "VendorBill",
    referenceId:     billId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth:     bm,
    nepaliYear:      by,
    description:     desc,
    createdBy:       createdBy ?? null,
    totalAmountPaisa: amountPaisa,
    entityId,
    entries: [
      {
        accountCode:       expenseAccountCode,
        debitAmountPaisa:  amountPaisa,
        creditAmountPaisa: 0,
        description:       `Expense recognised — ${desc}`,
      },
      {
        accountCode:       ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        debitAmountPaisa:  0,
        creditAmountPaisa: amountPaisa,
        description:       `AP liability — ${desc}`,
      },
    ],
  };
}

/**
 * Journal when a vendor bill is paid (clears the AP liability).
 *
 * @param {Object} p
 * @param {string|ObjectId} p.billId
 * @param {string|ObjectId} p.entityId
 * @param {number}          p.amountPaisa         Net cash paid to vendor (after TDS if any)
 * @param {number}          [p.tdsDeductedPaisa]  TDS withheld at source (defaults to 0)
 * @param {string}          p.paymentMethod       "cash" | "bank_transfer" | "cheque"
 * @param {string}          [p.bankAccountCode]   Required when paymentMethod !== "cash"
 * @param {Date}            [p.paymentDate]
 * @param {number}          [p.nepaliMonth]
 * @param {number}          [p.nepaliYear]
 * @param {string}          [p.description]
 * @param {string|ObjectId} [p.createdBy]
 */
export function buildVendorBillPaymentJournal({
  billId, entityId, amountPaisa, tdsDeductedPaisa = 0,
  paymentMethod, bankAccountCode,
  paymentDate, nepaliMonth, nepaliYear, description, createdBy,
}) {
  const netCashPaisa  = amountPaisa;
  const totalApCleared = amountPaisa + tdsDeductedPaisa;

  if (!Number.isInteger(netCashPaisa) || netCashPaisa <= 0)
    throw new Error(`amountPaisa must be a positive integer`);
  if (!Number.isInteger(tdsDeductedPaisa) || tdsDeductedPaisa < 0)
    throw new Error(`tdsDeductedPaisa must be a non-negative integer`);

  const { txDate, nepaliDate, bsMonth, bsYear } = resolveDate(paymentDate);
  const bm = nepaliMonth ?? bsMonth;
  const by = nepaliYear  ?? bsYear;
  const desc = description ?? `Vendor bill payment — ${bm}/${by}`;

  const creditCode =
    paymentMethod === "cash"
      ? ACCOUNT_CODES.CASH
      : bankAccountCode ?? (() => { throw new Error("bankAccountCode required for non-cash payment"); })();

  const entries = [
    {
      accountCode:       ACCOUNT_CODES.ACCOUNTS_PAYABLE,
      debitAmountPaisa:  totalApCleared,
      creditAmountPaisa: 0,
      description:       `AP cleared — ${desc}`,
    },
    {
      accountCode:       creditCode,
      debitAmountPaisa:  0,
      creditAmountPaisa: netCashPaisa,
      description:       `Cash/bank payment — ${desc}`,
    },
  ];

  // If TDS was deducted: the cash difference goes to TDS payable (liability to govt)
  if (tdsDeductedPaisa > 0) {
    entries.push({
      accountCode:       ACCOUNT_CODES.ACCOUNTS_PAYABLE, // reuse as TDS-to-govt payable for now
      debitAmountPaisa:  0,
      creditAmountPaisa: tdsDeductedPaisa,
      description:       `TDS withheld on vendor payment — remit to govt`,
    });
  }

  return {
    transactionType:  "VENDOR_BILL_PAYMENT",
    referenceType:    "VendorBill",
    referenceId:      billId,
    transactionDate:  txDate,
    nepaliDate,
    nepaliMonth:      bm,
    nepaliYear:       by,
    description:      desc,
    createdBy:        createdBy ?? null,
    totalAmountPaisa: totalApCleared,
    entityId,
    entries,
  };
}
