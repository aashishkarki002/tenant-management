import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for a CAM payment received (DR Cash/Bank, CR Accounts Receivable).
 * @param {Object} payment - Payment document with _id, paymentDate, nepaliDate, createdBy/receivedBy
 * @param {Object} cam - Cam document with tenant, property, nepaliMonth, nepaliYear
 * @param {number} [amount] - Amount to record (defaults to payment.amount)
 * @param {string} [cashBankAccountCode] - Account code for DR (default CASH_BANK 1000)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildCamPaymentReceivedJournal(
  payment,
  cam,
  amount = undefined,
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK,
) {
  const recordedAmount = amount ?? payment.amount;
  const transactionDate = payment.paymentDate || new Date();
  const nepaliDate = payment.nepaliDate || transactionDate;
  const nepaliMonth =
    cam?.nepaliMonth ?? new Date(transactionDate).getMonth() + 1;
  const nepaliYear = cam?.nepaliYear ?? new Date(transactionDate).getFullYear();
  const description = `CAM payment received for ${nepaliMonth}/${nepaliYear} from ${cam?.tenant?.name}`;
  const createdBy = payment.createdBy ?? payment.receivedBy;

  return {
    transactionType: "CAM_PAYMENT_RECEIVED",
    referenceType: "CamPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmount: recordedAmount,
    tenant: cam?.tenant,
    property: cam?.property,
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
