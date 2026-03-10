/**
 * securityDeposit.js  (FIXED)
 *
 * Build journal payload for security deposit received
 * (DR Cash/Bank, CR Security Deposit Liability).
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} sd - Security deposit document with _id, amountPaisa, paidDate, tenant, property
 * @param {Object} options - { createdBy, nepaliMonth, nepaliYear, tenantName }
 * @param {string} [cashBankAccountCode]
 *
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildSecurityDepositJournal(
  sd,
  options = {},
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK,
) {
  const {
    createdBy,
    nepaliMonth: optNepaliMonth,
    nepaliYear: optNepaliYear,
    tenantName: optTenantName,
  } = options;

  const transactionDate = sd.paidDate || new Date();

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(sd.nepaliDate, transactionDate);

  // Nepali month/year: prefer explicitly passed values; derive via NepaliDate
  // as fallback (never raw getMonth/getFullYear which would give Gregorian values).
  let nepaliMonth = optNepaliMonth;
  let nepaliYear = optNepaliYear;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear = nepaliYear ?? nd.getYear();
  }

  const tenantName =
    optTenantName ?? sd?.tenant?.name ?? (sd?.tenant ? "Tenant" : "Unknown");
  const description = `Security deposit received from ${tenantName} for ${nepaliMonth}/${nepaliYear}`;

  const amountPaisa =
    sd.amountPaisa !== undefined
      ? sd.amountPaisa
      : sd.amount
        ? rupeesToPaisa(sd.amount)
        : 0;

  return {
    transactionType: "SECURITY_DEPOSIT",
    referenceType: "SecurityDeposit",
    referenceId: sd._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmountPaisa: amountPaisa,
    tenant: sd.tenant,
    property: sd.property,
    entries: [
      {
        accountCode: cashBankAccountCode,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description,
      },
    ],
  };
}
