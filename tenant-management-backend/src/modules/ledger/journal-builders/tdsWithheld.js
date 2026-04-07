/**
 * tdsWithheld.js
 *
 * Builds the non-cash journal entry for TDS withheld by the tenant.
 *
 * Background:
 *   In Nepal (and similar regimes), commercial tenants deduct TDS at source
 *   and remit it directly to the government on behalf of the landlord.
 *   The landlord never receives that cash — but is entitled to claim it as
 *   a tax credit against their income tax liability.
 *
 * Correct double-entry (non-cash — zero net effect on bank/cash accounts):
 *   DR  TDS Recoverable (1300)    ASSET ↑  — credit claimable from govt
 *   CR  Accounts Receivable (1200) ASSET ↓  — tenant's net obligation reduced
 *
 * Net AR impact:
 *   After rent charge:   AR = grossRentAmountPaisa
 *   After TDS entry:     AR = grossRentAmountPaisa − tdsAmountPaisa (= netRentAmountPaisa)
 *   After payment:       AR = 0
 *
 * This entry is posted once per rent document, guarded by rent.tdsRecordedInLedger.
 *
 * @param {Object} rent  Rent document (Mongoose doc or plain object)
 *   Required: _id, nepaliMonth, nepaliYear, tdsAmountPaisa (integer > 0)
 *   Optional: createdAt, createdBy, nepaliDate, tenant, property, rentFrequency
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

export function buildTdsWithheldJournal(rent) {
  // ── 1. Validate ─────────────────────────────────────────────────────────────
  assertNepaliFields({
    nepaliYear: rent.nepaliYear,
    nepaliMonth: rent.nepaliMonth,
  });

  const tdsAmountPaisa = getRawPaisa(rent, "tdsAmountPaisa");

  if (tdsAmountPaisa <= 0) {
    throw new Error(
      `buildTdsWithheldJournal: tdsAmountPaisa must be > 0, got ${tdsAmountPaisa}`,
    );
  }

  // ── 2. Dates ─────────────────────────────────────────────────────────────────
  const transactionDate =
    rent.createdAt instanceof Date
      ? rent.createdAt
      : new Date(rent.createdAt ?? Date.now());

  const nepaliDate =
    typeof rent.nepaliDate === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(rent.nepaliDate)
      ? rent.nepaliDate.slice(0, 10)
      : formatNepaliISO(new NepaliDate(transactionDate));

  // ── 3. Description ───────────────────────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = rent;
  const tenantName = rent.tenant?.name ?? "Tenant";

  const description = `TDS withheld for ${nepaliMonth}/${nepaliYear} — ${tenantName}`;

  // ── 4. Canonical payload ─────────────────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "TDS_WITHHELD",
    referenceType: "Rent",
    referenceId: rent._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: rent.createdBy ?? null,
    totalAmountPaisa: tdsAmountPaisa,
    tenant: rent.tenant,
    property: rent.property,
    entries: [
      {
        // Asset ↑ — tax credit recoverable from the government
        accountCode: ACCOUNT_CODES.TDS_RECOVERABLE,
        debitAmountPaisa: tdsAmountPaisa,
        creditAmountPaisa: 0,
        description: `TDS recoverable from govt — ${nepaliMonth}/${nepaliYear} — ${tenantName}`,
      },
      {
        // Asset ↓ — tenant's net obligation to the landlord is reduced
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: tdsAmountPaisa,
        description: `TDS offset on AR — ${nepaliMonth}/${nepaliYear} — ${tenantName}`,
      },
    ],
    meta: { isTdsEntry: true, nonCash: true },
  });
}
