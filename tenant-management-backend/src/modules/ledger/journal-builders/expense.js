import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for an expense (DR Expense account, CR Cash/Bank).
 * @param {Object} expense - Expense document with _id, amount, expenseCode, nepaliMonth, nepaliYear, EnglishDate, nepaliDate, createdBy, tenant, property
 * @param {string} [cashBankAccountCode] - Account code for CR (default CASH_BANK 1000)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildExpenseJournal(
  expense,
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK
) {
  const expenseAccountCode = expense.expenseCode ?? ACCOUNT_CODES.EXPENSE_OTHER;
  const transactionDate = expense.EnglishDate || new Date();
  const nepaliDate = expense.nepaliDate || transactionDate;
  const tenantName = expense?.tenant?.name;
  const description = `Expense recorded - ${expense.amount}${tenantName ? ` from ${tenantName}` : ""}`;

  return {
    transactionType: "EXPENSE",
    referenceType: "Expense",
    referenceId: expense._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: expense.nepaliMonth,
    nepaliYear: expense.nepaliYear,
    description,
    createdBy: expense.createdBy,
    totalAmount: expense.amount,
    tenant: expense.tenant,
    property: expense.property,
    entries: [
      {
        accountCode: expenseAccountCode,
        debitAmount: expense.amount,
        creditAmount: 0,
        description,
      },
      {
        accountCode: cashBankAccountCode,
        debitAmount: 0,
        creditAmount: expense.amount,
        description,
      },
    ],
  };
}
