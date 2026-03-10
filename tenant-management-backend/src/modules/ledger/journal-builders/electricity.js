/**
 * electricity.js  (FIXED)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa, paisaToRupees } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * Build journal payload for an electricity charge
 * (DR Accounts Receivable, CR Utility Revenue).
 *
 * @param {Object} electricity - Electricity document with _id, readingDate,
 *   nepaliDate, nepaliMonth, nepaliYear, consumption, ratePerUnitPaisa,
 *   totalAmountPaisa, createdBy, tenant, property
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildElectricityChargeJournal(electricity) {
  const transactionDate = electricity.readingDate || new Date();

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    electricity.nepaliDate,
    transactionDate,
  );

  const tenantName = electricity?.tenant?.name;

  const totalAmountPaisa =
    electricity.totalAmountPaisa !== undefined
      ? electricity.totalAmountPaisa
      : electricity.totalAmount
        ? rupeesToPaisa(electricity.totalAmount)
        : 0;

  const ratePerUnitPaisa =
    electricity.ratePerUnitPaisa !== undefined
      ? electricity.ratePerUnitPaisa
      : electricity.ratePerUnit
        ? rupeesToPaisa(electricity.ratePerUnit)
        : 0;

  const description = `Electricity charge for ${electricity.nepaliMonth}/${electricity.nepaliYear} - ${electricity.consumption} units${tenantName ? ` from ${tenantName}` : ""}`;
  const lineDescription = `Electricity receivable - ${electricity.consumption} units @ Rs.${paisaToRupees(ratePerUnitPaisa)}`;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  return {
    transactionType: "ELECTRICITY_CHARGE",
    referenceType: "Electricity",
    referenceId: electricity._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmountPaisa,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: totalAmountPaisa,
        creditAmountPaisa: 0,
        description: lineDescription,
      },
      {
        accountCode: ACCOUNT_CODES.UTILITY_REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: totalAmountPaisa,
        description: `Electricity revenue - ${electricity.consumption} units @ Rs.${paisaToRupees(ratePerUnitPaisa)}`,
      },
    ],
  };
}

/**
 * Build journal payload for an electricity payment received
 * (DR Cash/Bank, CR Accounts Receivable).
 *
 * @param {Object} paymentData - { electricityId, amountPaisa, paymentDate, nepaliDate, createdBy }
 * @param {Object} electricity - Electricity document with tenant, property, nepaliMonth, nepaliYear
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildElectricityPaymentJournal(paymentData, electricity) {
  const transactionDate = paymentData.paymentDate || new Date();

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    paymentData.nepaliDate,
    transactionDate,
  );

  const nepaliMonth = electricity.nepaliMonth;
  const nepaliYear = electricity.nepaliYear;
  const tenantName = electricity?.tenant?.name;
  const description = `Electricity payment - ${nepaliMonth}/${nepaliYear}${tenantName ? ` from ${tenantName}` : ""}`;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  const amountPaisa =
    paymentData.amountPaisa !== undefined
      ? paymentData.amountPaisa
      : paymentData.amount
        ? rupeesToPaisa(paymentData.amount)
        : 0;

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
    totalAmountPaisa: amountPaisa,
    tenant: tenantId,
    property: propertyId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.CASH_BANK,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description: "Electricity payment received",
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description: "Electricity payment received",
      },
    ],
  };
}
