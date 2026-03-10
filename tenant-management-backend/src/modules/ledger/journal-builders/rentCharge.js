/**
 * rentCharge.js  (FIXED)
 *
 * Builds the journal payload for a rent charge:
 *   DR  Accounts Receivable  (ASSET ↑ — tenant owes more)
 *   CR  Rent Revenue         (REVENUE ↑ — income earned)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object (which would be silently dropped
 *      by the `typeof nepaliDate === "string"` guard in postJournalEntry).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import {
  assertNepaliFields,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * Resolve a BS date string from either an existing string, a Date, or fall back
 * to converting transactionDate via NepaliDate.
 * @param {string|Date|undefined} raw
 * @param {Date} fallback
 * @returns {string}  "YYYY-MM-DD" BS
 */
function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

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

  // ── 2. Extract raw paisa ─────────────────────────────────────────────────
  const rentAmountPaisa = getRawPaisa(rent, "rentAmountPaisa");

  // ── 3. Metadata ──────────────────────────────────────────────────────────
  const transactionDate =
    rent.createdAt instanceof Date
      ? rent.createdAt
      : new Date(rent.createdAt ?? Date.now());

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(rent.nepaliDate, transactionDate);

  const { nepaliMonth, nepaliYear } = rent;
  const tenantName = rent.tenant?.name ?? "Tenant";

  const billingFrequency = rent.rentFrequency ?? "monthly";
  const quarter =
    billingFrequency === "quarterly" && typeof nepaliMonth === "number"
      ? Math.ceil(nepaliMonth / 3)
      : undefined;

  const description =
    billingFrequency === "quarterly"
      ? `Rent charge (Q${quarter} ${nepaliYear}) from ${tenantName}`
      : `Rent charge for ${nepaliMonth}/${nepaliYear} from ${tenantName}`;

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
        description: `Rent receivable for ${nepaliMonth}/${nepaliYear} from ${tenantName}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: rentAmountPaisa,
        description: `Rental income for ${nepaliMonth}/${nepaliYear} from ${tenantName}`,
      },
    ],
    meta: { billingFrequency, quarter },
  });
}
