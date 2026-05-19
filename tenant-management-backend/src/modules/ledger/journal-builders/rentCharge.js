/**
 * rentCharge.js
 *
 * Journal payload for a rent charge:
 *   DR  Rent Receivable  (1200) — tenant owes more
 *   CR  Rental Income    (4000) — income earned
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
 * @param {Object} rent  Rent document (Mongoose doc or plain object)
 *   Required: _id, tenant, property, nepaliMonth, nepaliYear, grossRentAmountPaisa, rentFrequency
 *   Optional: createdAt, createdBy, nepaliDate, tenantName, quarter
 */
export function buildRentChargeJournal(rent) {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  assertNepaliFields({ nepaliYear: rent.nepaliYear, nepaliMonth: rent.nepaliMonth });

  // ── 2. Amount ────────────────────────────────────────────────────────────
  const rentAmountPaisa = getRawPaisa(rent, "grossRentAmountPaisa");

  // ── 3. Dates — no AD round-trip ──────────────────────────────────────────
  const { nepaliMonth, nepaliYear } = rent;
  // Keep billingPeriodBS as the NepaliDate instance so formatNepaliISO never
  // round-trips through UTC (which shifts Baisakh 1 → Chaitra 30 on UTC+5:45).
  const billingPeriodBS = new NepaliDate(nepaliYear, nepaliMonth - 1, 1);
  const transactionDate = billingPeriodBS.getDateObject();

  const nepaliDate =
    typeof rent.nepaliDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rent.nepaliDate)
      ? rent.nepaliDate.slice(0, 10)
      : formatNepaliISO(billingPeriodBS); // same instance — no round-trip

  // ── 4. Narration ─────────────────────────────────────────────────────────
  const tenantName = rent.tenantName ?? rent.tenant?.name ?? "Tenant";
  const billingFrequency = rent.rentFrequency ?? "monthly";

  let description;
  let entryPeriodLabel;

  if (billingFrequency === "quarterly") {
    const quarter = getFiscalQuarterFromMonth(nepaliMonth);
    const qMeta   = FISCAL_QUARTERS.find((q) => q.quarter === quarter);
    const [startMonth, , endMonth] = qMeta.nepaliMonths;
    description      = `Rent charge – Q${quarter} FY${nepaliYear} (${startMonth}–${endMonth}) – ${tenantName}`;
    entryPeriodLabel = `Q${quarter} FY${nepaliYear} (${startMonth}–${endMonth})`;
  } else {
    const monthName  = bsMonthName(nepaliMonth);
    description      = `Rent charge – ${monthName} ${nepaliYear} – ${tenantName}`;
    entryPeriodLabel = `${monthName} ${nepaliYear}`;
  }

  // ── 5. Payload (direct — no buildJournalPayload, which silently drops BS string) ──
  return {
    transactionType:  "RENT_CHARGE",
    referenceType:    "Rent",
    referenceId:      rent._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy:        rent.createdBy ?? null,
    totalAmountPaisa: rentAmountPaisa,
    tenant:           rent.tenant ?? null,
    property:         rent.property ?? null,
    billingFrequency,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa:  rentAmountPaisa,
        creditAmountPaisa: 0,
        description:       `Rent receivable – ${entryPeriodLabel} – ${tenantName}`,
      },
      {
        accountCode:       ACCOUNT_CODES.REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: rentAmountPaisa,
        description:       `Rental income – ${entryPeriodLabel} – ${tenantName}`,
      },
    ],
  };
}
