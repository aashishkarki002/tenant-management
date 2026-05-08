/**
 * badDebtWriteoff.js
 *
 * Builds the journal payload for writing off uncollectable Accounts Receivable
 * as bad debt expense.
 *
 * Used in vacate settlement when AR remains after applying the security deposit
 * and the landlord decides the balance is uncollectable.
 *
 *   DR  Bad Debt Expense       (5700)  writeOffAmountPaisa   (EXPENSE ↑)
 *   CR  Accounts Receivable    (1200)  writeOffAmountPaisa   (ASSET ↓ — debt forgiven)
 *
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * @param {Object} params
 * @param {string|ObjectId} params.vacateSettlementId  VacateSettlement._id
 * @param {string|ObjectId} params.tenantId
 * @param {string}          params.tenantName
 * @param {string|ObjectId} params.propertyId
 * @param {number}          params.writeOffAmountPaisa  Amount to write off (positive integer)
 * @param {number}          params.nepaliMonth
 * @param {number}          params.nepaliYear
 * @param {Date}            params.writeOffDate
 * @param {string}          [params.reason]
 * @param {string|ObjectId} params.createdBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object} Journal payload
 */
export function buildBadDebtWriteoffJournal({
  vacateSettlementId,
  tenantId,
  tenantName,
  propertyId,
  writeOffAmountPaisa,
  nepaliMonth,
  nepaliYear,
  writeOffDate,
  reason,
  createdBy,
  entityId,
}) {
  if (!Number.isInteger(writeOffAmountPaisa) || writeOffAmountPaisa <= 0) {
    throw new Error(
      `writeOffAmountPaisa must be a positive integer, got ${writeOffAmountPaisa}`,
    );
  }

  const txDate     = writeOffDate instanceof Date ? writeOffDate : new Date(writeOffDate ?? Date.now());
  const nepaliDate = formatNepaliISO(new NepaliDate(txDate));
  const name       = tenantName ?? "Tenant";
  const reasonText = reason ? ` — ${reason}` : "";

  return {
    transactionType: "BAD_DEBT_WRITEOFF",
    referenceType:   "VacateSettlement",
    referenceId:     vacateSettlementId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Bad debt write-off for ${name}${reasonText}`,
    createdBy,
    totalAmountPaisa: writeOffAmountPaisa,
    tenant:   tenantId,
    property: propertyId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.BAD_DEBT_EXPENSE, // 5700
        debitAmountPaisa:  writeOffAmountPaisa,
        creditAmountPaisa: 0,
        description: `Bad debt expense — ${name} uncollectable AR${reasonText}`,
      },
      {
        accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, // 1200
        debitAmountPaisa:  0,
        creditAmountPaisa: writeOffAmountPaisa,
        description: `Clear AR for ${name} — written off as bad debt${reasonText}`,
      },
    ],
  };
}
