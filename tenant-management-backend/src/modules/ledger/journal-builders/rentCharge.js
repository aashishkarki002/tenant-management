/**
 * rentCharge.js  (FIXED)
 *
 * Builds the journal payload for a rent charge:
 *   DR  Accounts Receivable  (ASSET ↑ — tenant owes more)
 *   CR  Rent Revenue         (REVENUE ↑ — income earned)
 *
 * Changes from original:
 *   - Removed the dangerous "> 100" paisa heuristic.
 *   - Uses getRawPaisa() to safely extract the integer paisa value.
 *   - Uses buildJournalPayload() for a validated, canonical output.
 *   - Uses assertNepaliFields() to catch wrong calendar fields early.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import { assertNepaliFields } from "../../../utils/nepaliDateHelper.js";

/**
 * @param {Object} rent  - Rent document (Mongoose doc or plain object)
 *   Must have:  _id, tenant, property, nepaliMonth, nepaliYear,
 *               rentAmountPaisa (integer), rentFrequency
 *   Optional:   createdAt, createdBy, nepaliDate
 *
 * @returns {Object} Canonical journal payload for postJournalEntry
 */
export function buildRentChargeJournal(rent) {
  // ── 1. Nepali calendar validation ────────────────────────────────────────
  assertNepaliFields({
    nepaliYear: rent.nepaliYear,
    nepaliMonth: rent.nepaliMonth,
  });

  // ── 2. Extract raw paisa — no guessing, no coercion ──────────────────────
  const rentAmountPaisa = getRawPaisa(rent, "rentAmountPaisa");

  // ── 3. Metadata ──────────────────────────────────────────────────────────
  const transactionDate =
    rent.createdAt instanceof Date
      ? rent.createdAt
      : new Date(rent.createdAt ?? Date.now());
  const nepaliDate =
    rent.nepaliDate instanceof Date ? rent.nepaliDate : transactionDate;
  const { nepaliMonth, nepaliYear } = rent;
  const tenantName = rent.tenant?.name ?? "Tenant";

  const billingFrequency = rent.rentFrequency ?? "monthly";
  const quarter =
    billingFrequency === "quarterly" && typeof nepaliMonth === "number"
      ? Math.ceil(nepaliMonth / 3)
      : undefined;

  const description = `Rent charge for ${nepaliMonth}/${nepaliYear} — ${tenantName}`;

  // ── 4. Build canonical payload ───────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "RENT_CHARGE",
    referenceType: "Rent",
    referenceId: rent._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: rent.createdBy ?? null,
    totalAmountPaisa: rentAmountPaisa,
    tenant: rent.tenant,
    property: rent.property,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: rentAmountPaisa,
        creditAmountPaisa: 0,
        description: `Rent receivable for ${nepaliMonth}/${nepaliYear}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: rentAmountPaisa,
        description: `Rental income for ${nepaliMonth}/${nepaliYear}`,
      },
    ],
    meta: { billingFrequency, quarter },
  });
}
