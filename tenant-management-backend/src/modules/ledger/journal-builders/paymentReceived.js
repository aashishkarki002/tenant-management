import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for a rent payment received (DR Cash/Bank, CR Accounts Receivable).
 * Uses CASH_BANK (1000) for all payment methods; override to CASH (1100) for cash if needed.
 * @param {Object} payment - Payment document with _id, paymentDate, nepaliDate, amount, createdBy/receivedBy
 * @param {Object} rent - Rent document with tenant, property, nepaliMonth, nepaliYear
 * @param {number} [amount] - Amount to record (defaults to payment.amount)
 * @param {string} [cashBankAccountCode] - Account code for DR (default CASH_BANK 1000)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildPaymentReceivedJournal(
  payment,
  rent,
  amount = undefined,
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK,
) {
  const recordedAmount = amount ?? payment.amount;
  const transactionDate = payment.paymentDate || new Date();
  const nepaliDate = payment.nepaliDate || transactionDate;
  const nepaliMonth =
    rent?.nepaliMonth ?? new Date(transactionDate).getMonth() + 1;
  const nepaliYear =
    rent?.nepaliYear ?? new Date(transactionDate).getFullYear();
  const description = `Rent payment received for ${nepaliMonth} ${nepaliYear} from ${rent?.tenant?.name}`;
  const createdBy = payment.createdBy ?? payment.receivedBy;

  return {
    transactionType: "RENT_PAYMENT_RECEIVED",
    referenceType: "RentPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmount: recordedAmount,
    tenant: rent?.tenant,
    property: rent?.property,
    entries: [
      {
        accountCode: cashBankAccountCode,
        debitAmount: recordedAmount,
        creditAmount: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: 0,
        creditAmount: recordedAmount,
        description,
      },
    ],
  };
}
