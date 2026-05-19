/**
 * badDebtWriteoff.js
 *
 * Builds the journal payload for writing off uncollectable Accounts Receivable
 * as bad debt expense.
 *
 * Used in vacate settlement when AR remains after applying the security deposit
 * and the landlord decides the balance is uncollectable.
 *
 * Split AR write-off (rent AR 1200 + CAM AR 1210):
 *   DR  Bad Debt Expense       (5700)  totalWriteOffPaisa           (EXPENSE ↑)
 *   CR  Accounts Receivable    (1200)  rentWriteOffAmountPaisa      (ASSET ↓)
 *   CR  CAM Receivable         (1210)  camWriteOffAmountPaisa       (ASSET ↓, if > 0)
 *
 * Legacy single-amount call (camWriteOffAmountPaisa omitted or 0):
 *   DR  Bad Debt Expense       (5700)  writeOffAmountPaisa   (EXPENSE ↑)
 *   CR  Accounts Receivable    (1200)  writeOffAmountPaisa   (ASSET ↓)
 *
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * @param {Object} params
 * @param {string|ObjectId} params.vacateSettlementId    VacateSettlement._id
 * @param {string|ObjectId} params.tenantId
 * @param {string}          params.tenantName
 * @param {string|ObjectId} params.propertyId
 * @param {number}          params.writeOffAmountPaisa   Rent AR (1200) write-off (positive integer)
 * @param {number}          [params.camWriteOffAmountPaisa] CAM AR (1210) write-off (0 or omit if none)
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
  camWriteOffAmountPaisa = 0,
  nepaliMonth,
  nepaliYear,
  writeOffDate,
  reason,
  createdBy,
  entityId,
}) {
  const rentPaisa = Math.round(writeOffAmountPaisa ?? 0);
  const camPaisa  = Math.round(camWriteOffAmountPaisa ?? 0);
  const totalPaisa = rentPaisa + camPaisa;

  if (totalPaisa <= 0) {
    throw new Error(
      `buildBadDebtWriteoffJournal: total write-off must be > 0, got rentPaisa=${rentPaisa} camPaisa=${camPaisa}`,
    );
  }

  const txDate     = writeOffDate instanceof Date ? writeOffDate : new Date(writeOffDate ?? Date.now());
  const nepaliDate = formatNepaliISO(new NepaliDate(txDate));
  const name       = tenantName ?? "Tenant";
  const reasonText = reason ? ` — ${reason}` : "";

  const crEntries = [];

  if (rentPaisa > 0) {
    crEntries.push({
      accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, // 1200 — rent AR
      debitAmountPaisa:  0,
      creditAmountPaisa: rentPaisa,
      description: `Clear rent AR for ${name} — written off as bad debt${reasonText}`,
    });
  }

  if (camPaisa > 0) {
    crEntries.push({
      accountCode:       ACCOUNT_CODES.CAM_RECEIVABLE, // 1210 — CAM AR
      debitAmountPaisa:  0,
      creditAmountPaisa: camPaisa,
      description: `Clear CAM AR for ${name} — written off as bad debt${reasonText}`,
    });
  }

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
    totalAmountPaisa: totalPaisa,
    tenant:   tenantId,
    property: propertyId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.BAD_DEBT_EXPENSE, // 5700
        debitAmountPaisa:  totalPaisa,
        creditAmountPaisa: 0,
        description: `Bad debt expense — ${name} uncollectable AR${reasonText}`,
      },
      ...crEntries,
    ],
  };
}
