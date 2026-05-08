/**
 * ownerDistribution.js
 *
 * Journal for distributing profits to the property owner (owner draw).
 *
 *   DR  3100  Retained Earnings   distributionAmountPaisa   (EQUITY ↓)
 *   CR  Cash/Bank                 distributionAmountPaisa   (ASSET  ↓)
 *
 * This is NOT an expense — it reduces equity, not P&L.
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * @param {Object} params
 * @param {string|ObjectId} params.distributionId       OwnerDistribution._id
 * @param {string|ObjectId} params.entityId
 * @param {number}          params.amountPaisa          Positive integer
 * @param {string}          params.paymentMethod        "cash" | "bank_transfer" | "cheque"
 * @param {string}          [params.bankAccountCode]    Required when paymentMethod !== "cash"
 * @param {Date}            params.distributionDate
 * @param {number}          params.nepaliMonth
 * @param {number}          params.nepaliYear
 * @param {string}          [params.description]
 * @param {string|ObjectId} params.createdBy
 */
export function buildOwnerDistributionJournal({
  distributionId,
  entityId,
  amountPaisa,
  paymentMethod,
  bankAccountCode,
  distributionDate,
  nepaliMonth,
  nepaliYear,
  description,
  createdBy,
}) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0)
    throw new Error(`amountPaisa must be a positive integer, got ${amountPaisa}`);
  if (!entityId) throw new Error("entityId is required");

  const txDate   = distributionDate instanceof Date ? distributionDate : new Date(distributionDate ?? Date.now());
  const nd       = new NepaliDate(txDate);
  const nepDate  = formatNepaliISO(nd);
  const bsMonth  = nepaliMonth ?? nd.getMonth() + 1;
  const bsYear   = nepaliYear  ?? nd.getYear();

  const creditCode =
    paymentMethod === "cash"
      ? ACCOUNT_CODES.CASH
      : bankAccountCode ?? (() => { throw new Error("bankAccountCode required for non-cash distribution"); })();

  const desc = description ?? `Owner distribution — ${bsMonth}/${bsYear}`;

  return {
    transactionType: "OWNER_DISTRIBUTION",
    referenceType:   "OwnerDistribution",
    referenceId:     distributionId,
    transactionDate: txDate,
    nepaliDate:      nepDate,
    nepaliMonth:     bsMonth,
    nepaliYear:      bsYear,
    description:     desc,
    createdBy,
    totalAmountPaisa: amountPaisa,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.RETAINED_EARNINGS,
        debitAmountPaisa:  amountPaisa,
        creditAmountPaisa: 0,
        description:       `Owner draw — reduces retained earnings`,
      },
      {
        accountCode:       creditCode,
        debitAmountPaisa:  0,
        creditAmountPaisa: amountPaisa,
        description:       `Cash/bank disbursement to owner`,
      },
    ],
  };
}
