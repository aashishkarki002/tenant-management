import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for manual revenue received (DR Cash/Bank, CR Revenue).
 * @param {Object} revenue - Revenue document with _id
 * @param {Object} options - amount, paymentDate, nepaliDate, description, createdBy; optional nepaliMonth, nepaliYear, tenantName or tenant (for description)
 * @param {string} [cashBankAccountCode] - Account code for DR (default CASH_BANK 1000)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildRevenueReceivedJournal(
  revenue,
  options,
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK
) {
  const {
    amount,
    paymentDate,
    nepaliDate,
    description,
    createdBy,
    nepaliMonth: optNepaliMonth,
    nepaliYear: optNepaliYear,
    tenantName,
    tenant,
  } = options;
  const transactionDate = paymentDate || new Date();
  const npDate = nepaliDate || transactionDate;
  const d = new Date(npDate);
  const nepaliMonth = optNepaliMonth ?? d.getMonth() + 1;
  const nepaliYear = optNepaliYear ?? d.getFullYear();
  const name = tenantName ?? tenant?.name;
  const desc = description || "Manual revenue received";
  const fullDescription = name ? `${desc} from ${name}` : desc;

  return {
    transactionType: "REVENUE_STREAM",
    referenceType: "Revenue",
    referenceId: revenue._id,
    transactionDate,
    nepaliDate: npDate,
    nepaliMonth,
    nepaliYear,
    description: fullDescription,
    createdBy,
    totalAmount: amount,
    entries: [
      {
        accountCode: cashBankAccountCode,
        debitAmount: amount,
        creditAmount: 0,
        description: fullDescription,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmount: 0,
        creditAmount: amount,
        description: fullDescription,
      },
    ],
  };
}
