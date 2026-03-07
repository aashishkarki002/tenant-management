/**
 * camCharge.js
 *
 * Builds the journal payload for a CAM charge:
 *   DR  Accounts Receivable  (ASSET ↑ — tenant owes CAM)
 *   CR  Revenue              (REVENUE ↑ — CAM income earned)
 *
 * Aligned with rentCharge.js:
 *   - Uses getRawPaisa() to safely extract the integer paisa value.
 *   - Uses buildJournalPayload() for a validated, canonical output.
 *   - Uses assertNepaliFields() to catch wrong calendar fields early.
 *   - Includes tenant name in all descriptions (matches security-deposit pattern).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import { assertNepaliFields } from "../../../utils/nepaliDateHelper.js";

/**
 * @param {Object} cam  - Cam document (Mongoose doc or plain object)
 *   Must have:  _id, tenant, property, nepaliMonth, nepaliYear, amountPaisa
 *   Optional:   createdAt, createdBy, nepaliDate, tenant.name
 *
 * @param {Object} options
 *   @param {*}      options.createdBy  - Admin ObjectId (overrides cam.createdBy)
 *
 * @returns {Object} Canonical journal payload for postJournalEntry
 */
export function buildCamChargeJournal(cam, options = {}) {
  // ── 1. Nepali calendar validation ────────────────────────────────────────
  assertNepaliFields({
    nepaliYear: cam.nepaliYear,
    nepaliMonth: cam.nepaliMonth,
  });

  // ── 2. Extract raw paisa — no guessing, no coercion ──────────────────────
  const amountPaisa = getRawPaisa(cam, "amountPaisa");

  // ── 3. Metadata ──────────────────────────────────────────────────────────
  const transactionDate =
    cam.createdAt instanceof Date
      ? cam.createdAt
      : new Date(cam.createdAt ?? Date.now());
  const nepaliDate =
    cam.nepaliDate instanceof Date ? cam.nepaliDate : transactionDate;
  const { nepaliMonth, nepaliYear } = cam;
  const tenantName = cam.tenant?.name ?? "Tenant";
  const createdBy = options.createdBy ?? cam.createdBy ?? null;

  // ── 4. Descriptions — include tenant name so ledger entries are
  //       unambiguous when scanning across multiple tenants (matches
  //       security-deposit and rent-charge patterns).
  const description = `CAM charge for ${nepaliMonth}/${nepaliYear} from ${tenantName}`;

  // ── 5. Build canonical payload ───────────────────────────────────────────
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
