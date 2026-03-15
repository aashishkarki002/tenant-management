/**
 * loan.js  (journal builder)
 * ─────────────────────────────────────────────────────────────────────────────
 * Produces canonical journal payloads for:
 *   1. Loan disbursement  (money arrives in bank)
 *   2. EMI payment        (principal + interest leave bank)
 *
 * Pass output directly to: ledgerService.postJournalEntry(payload, session, entityId)
 *
 * Account codes used:
 *   LOAN_LIABILITY        "2200"  — principal owed to lender       (LIABILITY)
 *   LOAN_INTEREST_EXPENSE "5100"  — finance charges                (EXPENSE)
 *   bankAccountCode              — dynamic bank sub-account        (ASSET)
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DISBURSEMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Records the loan being received into the bank account.
 *
 *   DR  Bank Account (bankAccountCode)  ← asset increases
 *   CR  Loan Liability (2200)           ← liability increases
 *
 * @param {Object} loan         - Loan document (must be saved, has _id)
 * @param {Object} options
 *   @param {string|ObjectId} options.createdBy
 *   @param {number}  [options.nepaliMonth]
 *   @param {number}  [options.nepaliYear]
 */
export function buildLoanDisbursementJournal(loan, options = {}) {
  const transactionDate = loan.disbursedDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    loan.nepaliDisbursedDate,
    transactionDate,
  );

  let { nepaliMonth, nepaliYear } = options;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear = nepaliYear ?? nd.getYear();
  }

  const description = `Loan disbursed by ${loan.lender} — ${loan.loanType} (${nepaliMonth}/${nepaliYear})`;

  return {
    transactionType: "LOAN_DISBURSEMENT",
    referenceType: "Loan",
    referenceId: loan._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: options.createdBy,
    totalAmountPaisa: loan.principalPaisa,
    entityId: loan.entityId,
    property: loan.property ?? null,
    entries: [
      {
        accountCode: loan.bankAccountCode,
        debitAmountPaisa: loan.principalPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.LOAN_LIABILITY,
        debitAmountPaisa: 0,
        creditAmountPaisa: loan.principalPaisa,
        description,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMI PAYMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Records a single EMI payment, split into principal reduction + interest cost.
 *
 *   DR  Loan Liability (2200)          principalPaisa  ← reduces what we owe
 *   DR  Loan Interest Expense (5100)   interestPaisa   ← cost of borrowing
 *   CR  Bank Account (bankAccountCode) totalPaisa      ← cash exits
 *
 * @param {Object} payment      - LoanPayment document (must be saved, has _id)
 * @param {Object} loan         - Parent Loan document (for description)
 * @param {Object} options
 *   @param {string|ObjectId} options.createdBy
 */
export function buildLoanPaymentJournal(payment, loan, options = {}) {
  const transactionDate = payment.paymentDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    payment.nepaliDate,
    transactionDate,
  );

  let { nepaliMonth, nepaliYear } = payment;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear = nepaliYear ?? nd.getYear();
  }

  const description =
    `Loan EMI #${payment.installmentNumber} — ${loan.lender} ` +
    `(Principal: ${payment.principalPaisa} p, Interest: ${payment.interestPaisa} p)`;

  return {
    transactionType: "LOAN_PAYMENT",
    referenceType: "LoanPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: options.createdBy ?? payment.createdBy,
    totalAmountPaisa: payment.totalPaisa,
    entityId: payment.entityId,
    property: loan.property ?? null,
    entries: [
      {
        accountCode: ACCOUNT_CODES.LOAN_LIABILITY,
        debitAmountPaisa: payment.principalPaisa,
        creditAmountPaisa: 0,
        description: `Principal repayment — ${loan.lender} EMI #${payment.installmentNumber}`,
      },
      {
        accountCode: ACCOUNT_CODES.LOAN_INTEREST_EXPENSE,
        debitAmountPaisa: payment.interestPaisa,
        creditAmountPaisa: 0,
        description: `Interest expense — ${loan.lender} EMI #${payment.installmentNumber}`,
      },
      {
        accountCode: payment.bankAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.totalPaisa,
        description,
      },
    ],
  };
}
