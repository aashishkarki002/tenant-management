import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for a CAM charge (DR Accounts Receivable, CR Revenue).
 * @param {Object} cam - Cam document with _id, tenant, property, nepaliMonth, nepaliYear, nepaliDate, amount, createdAt
 * @param {Object} options - { createdBy } (Cam model may not have createdBy; pass from caller)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildCamChargeJournal(cam, options = {}) {
  const { createdBy } = options;
  const transactionDate = cam.createdAt || new Date();
  const nepaliDate = cam.nepaliDate || transactionDate;
  const nepaliMonth = cam.nepaliMonth;
  const nepaliYear = cam.nepaliYear;
  const description = `CAM charge for ${nepaliMonth}/${nepaliYear} from ${cam?.tenant?.name}`;

  return {
    transactionType: "CAM_CHARGE",
    referenceType: "Cam",
    referenceId: cam._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: createdBy || cam.createdBy,
    totalAmount: cam.amount,
    tenant: cam.tenant,
    property: cam.property,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: cam.amount,
        creditAmount: 0,
        description: `CAM receivable for ${nepaliMonth}/${nepaliYear}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmount: 0,
        creditAmount: cam.amount,
        description: `CAM income for ${nepaliMonth}/${nepaliYear}`,
      },
    ],
  };
}
