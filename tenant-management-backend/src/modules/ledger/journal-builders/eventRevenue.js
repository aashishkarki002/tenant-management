/**
 * eventRevenue.js
 *
 * Builds the journal payload for a kiosk revenue payment (Sallyan House events).
 *
 * Journal: kiosk lessee pays us for their space
 *   DR  Cash/Bank              amountPaisa   (ASSET ↑  — money arrives)
 *   CR  4400 EVENT_STALL_REVENUE amountPaisa (REVENUE ↑ — income recognised)
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : new Date(raw ?? Date.now());
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} revenue  - EventRevenue document (plain object or Mongoose doc)
 *   Must have:  _id, amountPaisa (integer), paymentMethod, nepaliMonth, nepaliYear
 *   Optional:   paymentDate, nepaliDate, recordedBy, property
 *
 * @param {string} bankAccountCode   - required when paymentMethod !== "cash"
 * @param {string} revenueAccountCode - defaults to EVENT_STALL_REVENUE ("4400")
 * @param {string} kioskLabel        - e.g. "Kiosk B3 — Ram Bahadur"
 *
 * @returns {Object} Canonical journal payload
 */
export function buildEventRevenueJournal(
  revenue,
  bankAccountCode,
  revenueAccountCode,
  kioskLabel = "Kiosk",
) {
  assertValidPaymentMethod(revenue.paymentMethod);
  assertIntegerPaisa(revenue.amountPaisa, "revenue.amountPaisa");

  const { nepaliMonth, nepaliYear } = revenue;
  if (!nepaliMonth || !nepaliYear) {
    throw new Error("eventRevenue journal: nepaliMonth and nepaliYear are required");
  }

  const transactionDate =
    revenue.paymentDate instanceof Date
      ? revenue.paymentDate
      : new Date(revenue.paymentDate ?? Date.now());

  const nepaliDate = resolveNepaliDateString(revenue.nepaliDate, transactionDate);
  const amountNPR = revenue.amountPaisa / 100;
  const description = `Event kiosk revenue — ${kioskLabel} — ${amountNPR} NPR`;

  const drAccountCode = getDebitAccountForPayment(revenue.paymentMethod, bankAccountCode);
  const crAccountCode = revenueAccountCode ?? ACCOUNT_CODES.EVENT_STALL_REVENUE;

  return buildJournalPayload({
    transactionType: "EVENT_REVENUE",
    referenceType: "EventRevenue",
    referenceId: revenue._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: revenue.recordedBy ?? null,
    totalAmountPaisa: revenue.amountPaisa,
    property: revenue.property ?? null,
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: revenue.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: revenue.amountPaisa,
        description,
      },
    ],
  });
}
