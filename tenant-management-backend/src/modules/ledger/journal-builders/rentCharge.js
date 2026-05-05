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
import { getFiscalQuarterFromMonth } from "../../../config/fiscalCalendar.js";
import NepaliDate from "nepali-datetime";

/**
 * Resolve a BS date string from either an existing string, a Date, or fall back
 * to converting transactionDate via NepaliDate.
 * @param {string|Date|undefined} raw
 * @param {Date} fallback
 * @returns {string}  "YYYY-MM-DD" BS
 */

/**
 * @param {Object} rent  - Rent document (Mongoose doc or plain object)
 *   Must have:  _id, tenant, property, nepaliMonth, nepaliYear,
 *               grossRentAmountPaisa (integer), rentFrequency
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
  const rentAmountPaisa = getRawPaisa(rent, "grossRentAmountPaisa");

  // ── 3. Metadata ──────────────────────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = rent;

  // M5 FIX: use first day of billing period as transactionDate, not createdAt.
  // This ensures accrual entries land in the correct period for date-range queries.
  const transactionDate = new NepaliDate(nepaliYear, nepaliMonth - 1, 1).getDateObject();

  const nepaliDate =
    typeof rent.nepaliDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rent.nepaliDate)
      ? rent.nepaliDate.slice(0, 10)
      : formatNepaliISO(new NepaliDate(transactionDate));

  const tenantName = rent.tenantName ?? rent.tenant?.name ?? "Tenant";

  const billingFrequency = rent.rentFrequency ?? "monthly";
  // C2 FIX: use fiscal quarter lookup instead of Math.ceil(month/3) which gives calendar quarters.
  const quarter =
    billingFrequency === "quarterly" && typeof nepaliMonth === "number"
      ? getFiscalQuarterFromMonth(nepaliMonth)
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
