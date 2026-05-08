/**
 * adjustment.js
 *
 * Builds journal payloads for accountant correction notes:
 *
 *  DEBIT_NOTE  — tenant owes more (e.g. missed billing, underbilling correction)
 *    DR  Accounts Receivable  (1200)  amountPaisa
 *    CR  Revenue account (caller-specified)  amountPaisa
 *
 *  CREDIT_NOTE — tenant owes less (e.g. billing error, goodwill reduction)
 *    DR  Revenue account (caller-specified)  amountPaisa
 *    CR  Accounts Receivable  (1200)  amountPaisa
 *
 *  MANUAL_JOURNAL — free-form double-entry correction
 *    DR/CR any accounts as specified
 *    Must balance: total DR = total CR
 *
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * @param {Object} params
 * @param {string|ObjectId} params.adjustmentId     Adjustment._id
 * @param {"DEBIT_NOTE"|"CREDIT_NOTE"|"MANUAL_JOURNAL"} params.type
 * @param {number}          params.amountPaisa       For DEBIT_NOTE and CREDIT_NOTE
 * @param {string}          [params.revenueAccountCode]  For DEBIT_NOTE/CREDIT_NOTE (default: 4000)
 * @param {Object[]}        [params.entries]         For MANUAL_JOURNAL — fully custom
 * @param {string|ObjectId} [params.tenantId]
 * @param {string|ObjectId} [params.propertyId]
 * @param {number}          params.nepaliMonth
 * @param {number}          params.nepaliYear
 * @param {Date}            params.transactionDate
 * @param {string}          params.description
 * @param {string|ObjectId} params.createdBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object} Journal payload
 */
export function buildAdjustmentJournal({
  adjustmentId,
  type,
  amountPaisa,
  revenueAccountCode,
  entries: customEntries,
  tenantId,
  propertyId,
  nepaliMonth,
  nepaliYear,
  transactionDate,
  description,
  createdBy,
  entityId,
}) {
  const txDate     = transactionDate instanceof Date ? transactionDate : new Date(transactionDate ?? Date.now());
  const nepaliDate = formatNepaliISO(new NepaliDate(txDate));
  const revCode    = revenueAccountCode ?? ACCOUNT_CODES.REVENUE;

  let entries;
  let txType;
  let totalPaisa;

  switch (type) {
    case "DEBIT_NOTE": {
      if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
        throw new Error(`DEBIT_NOTE: amountPaisa must be a positive integer, got ${amountPaisa}`);
      }
      txType    = "DEBIT_NOTE";
      totalPaisa = amountPaisa;
      entries   = [
        {
          accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          debitAmountPaisa:  amountPaisa,
          creditAmountPaisa: 0,
          description:       `Debit note: ${description}`,
        },
        {
          accountCode:       revCode,
          debitAmountPaisa:  0,
          creditAmountPaisa: amountPaisa,
          description:       `Debit note: ${description}`,
        },
      ];
      break;
    }

    case "CREDIT_NOTE": {
      if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
        throw new Error(`CREDIT_NOTE: amountPaisa must be a positive integer, got ${amountPaisa}`);
      }
      txType    = "CREDIT_NOTE";
      totalPaisa = amountPaisa;
      entries   = [
        {
          accountCode:       revCode,
          debitAmountPaisa:  amountPaisa,
          creditAmountPaisa: 0,
          description:       `Credit note: ${description}`,
        },
        {
          accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          debitAmountPaisa:  0,
          creditAmountPaisa: amountPaisa,
          description:       `Credit note: ${description}`,
        },
      ];
      break;
    }

    case "MANUAL_JOURNAL": {
      if (!Array.isArray(customEntries) || customEntries.length < 2) {
        throw new Error("MANUAL_JOURNAL: entries must be an array with at least 2 lines");
      }
      const totalDr = customEntries.reduce((s, e) => s + (e.debitAmountPaisa  || 0), 0);
      const totalCr = customEntries.reduce((s, e) => s + (e.creditAmountPaisa || 0), 0);
      if (totalDr !== totalCr) {
        throw new Error(
          `MANUAL_JOURNAL: entries do not balance. DR=${totalDr} CR=${totalCr} paisa`,
        );
      }
      txType     = "MANUAL_JOURNAL";
      totalPaisa = totalDr;
      entries    = customEntries;
      break;
    }

    default:
      throw new Error(`Unknown adjustment type: ${type}`);
  }

  return {
    transactionType: txType,
    referenceType:   "Adjustment",
    referenceId:     adjustmentId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmountPaisa: totalPaisa,
    tenant:   tenantId   ?? null,
    property: propertyId ?? null,
    entityId,
    entries,
  };
}
