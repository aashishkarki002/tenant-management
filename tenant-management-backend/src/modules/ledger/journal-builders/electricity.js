import { ACCOUNT_CODES } from "../config/accounts.js";

/**
 * Build journal payload for an electricity charge (DR Accounts Receivable, CR Utility Revenue).
 * @param {Object} electricity - Electricity document with _id, readingDate, nepaliDate, nepaliMonth, nepaliYear, consumption, ratePerUnit, totalAmount, createdBy, tenant, property
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildElectricityChargeJournal(electricity) {
  const electricityId = electricity._id;
  const transactionDate = electricity.readingDate || new Date();
  const nepaliDate = electricity.nepaliDate || transactionDate;
  const tenantName = electricity?.tenant?.name;
  const description = `Electricity charge for ${electricity.nepaliMonth}/${electricity.nepaliYear} - ${electricity.consumption} units${tenantName ? ` from ${tenantName}` : ""}`;
  const lineDescription = `Electricity receivable - ${electricity.consumption} units @ Rs.${electricity.ratePerUnit}`;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  return {
    transactionType: "ELECTRICITY_CHARGE",
    referenceType: "Electricity",
    referenceId: electricityId,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmount: electricity.totalAmount,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: electricity.totalAmount,
        creditAmount: 0,
        description: lineDescription,
      },
      {
        accountCode: ACCOUNT_CODES.UTILITY_REVENUE,
        debitAmount: 0,
        creditAmount: electricity.totalAmount,
        description: `Electricity revenue - ${electricity.consumption} units @ Rs.${electricity.ratePerUnit}`,
      },
    ],
  };
}

/**
 * Build journal payload for an electricity payment received (DR Cash/Bank, CR Accounts Receivable).
 * @param {Object} paymentData - { electricityId, amount, paymentDate, nepaliDate, createdBy }
 * @param {Object} electricity - Electricity document with tenant, property, nepaliMonth, nepaliYear
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildElectricityPaymentJournal(paymentData, electricity) {
  const transactionDate = paymentData.paymentDate || new Date();
  const nepaliDate = paymentData.nepaliDate || transactionDate;
  const nepaliMonth = electricity.nepaliMonth;
  const nepaliYear = electricity.nepaliYear;
  const tenantName = electricity?.tenant?.name;
  const description = `Electricity payment - ${nepaliMonth}/${nepaliYear}${tenantName ? ` from ${tenantName}` : ""}`;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  return {
    transactionType: "ELECTRICITY_PAYMENT",
    referenceType: "Electricity",
    referenceId: paymentData.electricityId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: paymentData.createdBy,
    totalAmount: paymentData.amount,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.CASH_BANK,
        debitAmount: paymentData.amount,
        creditAmount: 0,
        description: "Electricity payment received",
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: 0,
        creditAmount: paymentData.amount,
        description: "Electricity payment received",
      },
    ],
  };
}
