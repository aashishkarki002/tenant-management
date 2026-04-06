/**
 * tdsPaidToGovernment.js
 *
 * Builds the journal entry when tenant's TDS payment to government is verified.
 *
 * Background:
 *   After TDS is withheld (see tdsWithheld.js), the amount sits in "TDS Recoverable"
 *   until the tenant actually pays the government. This entry moves the verified
 *   amount from "unverified recoverable" to "verified paid" for proper tracking.
 *
 * Non-cash journal entry (verification only, no bank movement):
 *   DR  TDS Verified Paid (1100)   ASSET ↑  — confirmed paid, ready for tax claim
 *   CR  TDS Recoverable (1300)     ASSET ↓  — clears unverified amount
 *
 * This allows the balance sheet to distinguish:
 *   - TDS withheld but not yet verified as paid (1300)
 *   - TDS verified as paid to government (1100)
 *
 * @param {Object} rent  Rent document (Mongoose doc or plain object)
 *   Required: _id, nepaliMonth, nepaliYear, tdsAmountPaisa (integer > 0),
 *             tdsPaidDate, nepaliTdsPaidDate, tdsPaidVerifiedBy, tenant
 *   Optional: tdsPaidNotes
 *
 * @returns {Object} Canonical journal payload for ledgerService.postJournalEntry()
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import {
  assertNepaliFields,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

export function buildTdsPaidToGovernmentJournal(rent) {
  // ── 1. Validate ─────────────────────────────────────────────────────────────
  assertNepaliFields({
    nepaliYear: rent.nepaliYear,
    nepaliMonth: rent.nepaliMonth,
  });

  const tdsAmountPaisa = getRawPaisa(rent, "tdsAmountPaisa");

  if (tdsAmountPaisa <= 0) {
    throw new Error(
      `buildTdsPaidToGovernmentJournal: tdsAmountPaisa must be > 0, got ${tdsAmountPaisa}`,
    );
  }

  if (!rent.tdsPaidToGovernment) {
    throw new Error(
      "buildTdsPaidToGovernmentJournal: tdsPaidToGovernment must be true",
    );
  }

  if (!rent.tdsPaidDate) {
    throw new Error(
      "buildTdsPaidToGovernmentJournal: tdsPaidDate is required",
    );
  }

  // ── 2. Dates ─────────────────────────────────────────────────────────────────
  const transactionDate =
    rent.tdsPaidDate instanceof Date
      ? rent.tdsPaidDate
      : new Date(rent.tdsPaidDate);

  const nepaliDate =
    typeof rent.nepaliTdsPaidDate === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(rent.nepaliTdsPaidDate)
      ? rent.nepaliTdsPaidDate.slice(0, 10)
      : formatNepaliISO(new NepaliDate(transactionDate));

  // ── 3. Description ───────────────────────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = rent;
  const tenantName = rent.tenant?.name ?? "Tenant";

  const description = `TDS verified paid to govt — ${tenantName} — ${nepaliMonth}/${nepaliYear}`;

  // ── 4. Canonical payload ─────────────────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "TDS_PAID_TO_GOVT",
    referenceType: "Rent",
    referenceId: rent._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: rent.tdsPaidVerifiedBy ?? null,
    totalAmountPaisa: tdsAmountPaisa,
    tenant: rent.tenant,
    property: rent.property,
    entries: [
      {
        // Asset ↑ — TDS verified as paid, ready for tax credit claim
        accountCode: ACCOUNT_CODES.TDS_VERIFIED_PAID,
        debitAmountPaisa: tdsAmountPaisa,
        creditAmountPaisa: 0,
        description: `TDS verified paid — ${tenantName} — ${nepaliMonth}/${nepaliYear}`,
      },
      {
        // Asset ↓ — clears the unverified TDS recoverable balance
        accountCode: ACCOUNT_CODES.TDS_RECOVERABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: tdsAmountPaisa,
        description: `Clears unverified TDS — ${tenantName} — ${nepaliMonth}/${nepaliYear}`,
      },
    ],
    meta: {
      isTdsEntry: true,
      nonCash: true,
      tdsPaidNotes: rent.tdsPaidNotes || null,
    },
  });
}
