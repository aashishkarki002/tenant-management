/**
 * camCharge.js
 *
 * Journal payload for a CAM charge:
 *   DR  CAM Receivable  (1210) — tenant owes CAM
 *   CR  CAM Revenue     (4050) — income earned
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { getRawPaisa } from "../../../utils/moneyUtil.js";
import {
  assertNepaliFields,
  formatNepaliISO,
  NEPALI_MONTH_NAMES,
} from "../../../utils/nepaliDateHelper.js";
import { getFiscalQuarterFromMonth, FISCAL_QUARTERS } from "../../../config/fiscalCalendar.js";
import NepaliDate from "nepali-datetime";

/**
 * Returns the BS month name for a 1-based nepaliMonth (1=Baisakh … 12=Chaitra).
 */
function bsMonthName(month1Based) {
  return NEPALI_MONTH_NAMES[month1Based - 1] ?? String(month1Based);
}

/**
 * @param {Object} cam  Cam document (Mongoose doc or plain object)
 *   Required: _id, tenant, property, nepaliMonth, nepaliYear, amountPaisa
 *   Optional: createdAt, createdBy, nepaliDate, camFrequency, nepaliMonthEnd, nepaliYearEnd
 *
 * @param {Object} [options]
 *   @param {*} [options.createdBy]
 */
export function buildCamChargeJournal(cam, options = {}) {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  assertNepaliFields({ nepaliYear: cam.nepaliYear, nepaliMonth: cam.nepaliMonth });

  // ── 2. Amount ────────────────────────────────────────────────────────────
  const amountPaisa = getRawPaisa(cam, "amountPaisa");

  // ── 3. Dates — no AD round-trip ──────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = cam;
  // Keep billingPeriodBS as the NepaliDate instance so formatNepaliISO never
  // round-trips through UTC (which shifts Baisakh 1 → Chaitra 30 on UTC+5:45).
  const billingPeriodBS = new NepaliDate(nepaliYear, nepaliMonth - 1, 1);
  const transactionDate = billingPeriodBS.getDateObject();

  const nepaliDate =
    typeof cam.nepaliDate === "string" && cam.nepaliDate.length > 0
      ? cam.nepaliDate
      : formatNepaliISO(billingPeriodBS); // same instance — no round-trip

  // ── 4. Narration ─────────────────────────────────────────────────────────
  const tenantName       = cam.tenant?.name ?? "Tenant";
  const createdBy        = options.createdBy ?? cam.createdBy ?? null;
  const billingFrequency = cam.camFrequency ?? "monthly";

  let description;
  let entryPeriodLabel;

  if (billingFrequency === "quarterly") {
    const quarter = getFiscalQuarterFromMonth(nepaliMonth);
    const qMeta   = FISCAL_QUARTERS.find((q) => q.quarter === quarter);
    const [startMonth, , endMonth] = qMeta.nepaliMonths;
    description      = `CAM charge – Q${quarter} FY${nepaliYear} (${startMonth}–${endMonth}) – ${tenantName}`;
    entryPeriodLabel = `Q${quarter} FY${nepaliYear} (${startMonth}–${endMonth})`;
  } else {
    const monthName  = bsMonthName(nepaliMonth);
    description      = `CAM charge – ${monthName} ${nepaliYear} – ${tenantName}`;
    entryPeriodLabel = `${monthName} ${nepaliYear}`;
  }

  // ── 5. Payload (direct — no buildJournalPayload, which silently drops BS string) ──
  return {
    transactionType:  "CAM_CHARGE",
    referenceType:    "Cam",
    referenceId:      cam._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmountPaisa: amountPaisa,
    tenant:           cam.tenant ?? null,
    property:         cam.property ?? null,
    billingFrequency,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.CAM_RECEIVABLE,
        debitAmountPaisa:  amountPaisa,
        creditAmountPaisa: 0,
        description:       `CAM receivable – ${entryPeriodLabel} – ${tenantName}`,
      },
      {
        accountCode:       ACCOUNT_CODES.CAM_REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: amountPaisa,
        description:       `CAM income – ${entryPeriodLabel} – ${tenantName}`,
      },
    ],
  };
}
