/**
 * revenueReceived.js  (FIXED)
 *
 * Build journal payload for manual revenue received
 * (DR Cash/Bank, CR Revenue).
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
 * @param {Object} revenue - Revenue document with _id
 * @param {Object} options - amountPaisa or amount, paymentDate, nepaliDate,
 *   description, createdBy; optional nepaliMonth, nepaliYear, tenantName, tenant
 * @param {string} [cashBankAccountCode]
 *
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildRevenueReceivedJournal(
  revenue,
  options,
  cashBankAccountCode = ACCOUNT_CODES.CASH_BANK,
) {
  const {
    amountPaisa,
    amount,
    paymentDate,
    nepaliDate: rawNepaliDate,
    description,
    createdBy,
    nepaliMonth: optNepaliMonth,
    nepaliYear: optNepaliYear,
    tenantName,
    tenant,
  } = options;

  const finalAmountPaisa =
    amountPaisa !== undefined
      ? amountPaisa
      : amount
        ? rupeesToPaisa(amount)
        : 0;

  const transactionDate = paymentDate || new Date();

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(rawNepaliDate, transactionDate);

  // Nepali month/year: prefer explicitly passed values; fall back to deriving
  // from transactionDate via NepaliDate (not raw getMonth/getFullYear which
  // would return Gregorian values stored as if they were Nepali).
  let nepaliMonth = optNepaliMonth;
  let nepaliYear = optNepaliYear;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear = nepaliYear ?? nd.getYear();
  }

  const name = tenantName ?? tenant?.name;
  const desc = description || "Manual revenue received";
  const fullDescription = name ? `${desc} from ${name}` : desc;

  return {
    transactionType: "REVENUE_STREAM",
    referenceType: "Revenue",
    referenceId: revenue._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: fullDescription,
    createdBy,
    totalAmountPaisa: finalAmountPaisa,
    entries: [
      {
        accountCode: cashBankAccountCode,
        debitAmountPaisa: finalAmountPaisa,
        creditAmountPaisa: 0,
        description: fullDescription,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: finalAmountPaisa,
        description: fullDescription,
      },
    ],
  };
}
