import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for a rent charge (DR Accounts Receivable, CR Revenue).
 * @param {Object} rent - Rent document (plain or populated) with _id, tenant, property, nepaliMonth, nepaliYear, nepaliDate, createdAt, createdBy, rentAmount
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildRentChargeJournal(rent) {
  const rentId = rent._id;
  const transactionDate = rent.createdAt || new Date();
  const nepaliDate = rent.nepaliDate || transactionDate;
  const nepaliMonth = rent.nepaliMonth;
  const nepaliYear = rent.nepaliYear;
  const description = `Rent charge for ${nepaliMonth} ${nepaliYear} from ${rent?.tenant?.name}`;

  return {
    transactionType: "RENT_CHARGE",
    referenceType: "Rent",
    referenceId: rentId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: rent.createdBy,
    totalAmount: rent.rentAmount,
    tenant: rent.tenant,
    property: rent.property,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: rent.rentAmount,
        creditAmount: 0,
        description: `Rent receivable for ${nepaliMonth} ${nepaliYear}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmount: 0,
        creditAmount: rent.rentAmount,
        description: `Rental income for ${nepaliMonth} ${nepaliYear}`,
      },
    ],
  };
}
