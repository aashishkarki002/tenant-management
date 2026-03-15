/**
 * camCharge.js  (FIXED)
 *
 * Builds the journal payload for a CAM charge:
 *   DR  Accounts Receivable  (ASSET ↑ — tenant owes CAM)
 *   CR  Revenue              (REVENUE ↑ — CAM income earned)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import {
  assertNepaliFields,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} cam  - Cam document (Mongoose doc or plain object)
 *   Must have:  _id, tenant, property, nepaliMonth, nepaliYear, amountPaisa
 *   Optional:   createdAt, createdBy, nepaliDate, tenant.name
 *
 * @param {Object} options
 *   @param {*} options.createdBy  - Admin ObjectId
 *
 * @returns {Object} Canonical journal payload for postJournalEntry
 */
export function buildCamChargeJournal(cam, options = {}) {
  // ── 1. Validate ───────────────────────────────────────────────────────────
  assertNepaliFields({
    nepaliYear: cam.nepaliYear,
    nepaliMonth: cam.nepaliMonth,
  });

  // ── 2. Extract raw paisa ──────────────────────────────────────────────────
  const amountPaisa = getRawPaisa(cam, "amountPaisa");

  // ── 3. Metadata ───────────────────────────────────────────────────────────
  const transactionDate =
    cam.createdAt instanceof Date
      ? cam.createdAt
      : new Date(cam.createdAt ?? Date.now());

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(cam.nepaliDate, transactionDate);

  const { nepaliMonth, nepaliYear } = cam;
  const tenantName = cam.tenant?.name ?? "Tenant";
  const createdBy = options.createdBy ?? cam.createdBy ?? null;
  const description = `CAM charge for ${nepaliMonth}/${nepaliYear} from ${tenantName}`;

  // ── 4. Build canonical payload ────────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "CAM_CHARGE",
    referenceType: "Cam",
    referenceId: cam._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmountPaisa: amountPaisa,
    tenant: cam.tenant,
    property: cam.property,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description: `CAM receivable for ${nepaliMonth}/${nepaliYear} from ${tenantName}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description: `CAM income for ${nepaliMonth}/${nepaliYear} from ${tenantName}`,
      },
    ],
  });
}
