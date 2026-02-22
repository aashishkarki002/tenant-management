/**
 * RENT ESCALATION SERVICE (Nepali Calendar-Aware)
 *
 * Anchor date: tenant.leaseStartDate (converted to Nepali calendar).
 * The first escalation fires at leaseStartDate + intervalMonths.
 * Each subsequent escalation advances from the previous nextEscalationNepaliDate
 * by intervalMonths — preserving the original day-of-month throughout.
 *
 * Helpers used:
 *  - addNepaliMonths      → advance dates in Nepali calendar (day-clamping built-in)
 *  - formatNepaliISO      → NepaliDate → "YYYY-MM-DD" string for DB/display
 *  - parseNepaliISO       → "YYYY-MM-DD" string → NepaliDate
 *  - getNepaliMonthDates  → current Nepali month context for history entries
 *  - getQuarterFromMonth  → derive quarter number from a 1-based Nepali month
 *  - getCurrentQuarterInfo→ today's quarter context for bulk cron logging
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { Tenant } from "../Tenant.Model.js";
import { paisaToRupees } from "../../../utils/moneyUtil.js";
import { calculateUnitLease } from "../domain/rent.calculator.service.js";
import {
  addNepaliMonths,
  formatNepaliISO,
  getNepaliMonthDates,
  parseNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import {
  getQuarterFromMonth,
  getCurrentQuarterInfo,
} from "../../../utils/quarterlyRentHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Round a paisa amount by a percentage (whole-paisa result).
 * @param {number} paisaAmount
 * @param {number} pct  e.g. 5 means 5%
 * @returns {number}
 */
function applyPercentage(paisaAmount, pct) {
  return Math.round(paisaAmount * (1 + pct / 100));
}

/**
 * Convert any JS Date | ISO string → NepaliDate.
 * @param {Date|string} input
 * @returns {NepaliDate}
 */
function toNepaliDate(input) {
  if (input instanceof NepaliDate) return input;
  return new NepaliDate(new Date(input));
}

/**
 * Compute the next escalation NepaliDate by adding intervalMonths to a base date.
 *
 * Delegates entirely to addNepaliMonths (nepaliDateHelper), which already handles:
 *   - year rollover
 *   - day-of-month clamping when the target month is shorter
 *
 * This means the original day-of-month from leaseStartDate is preserved
 * across every escalation automatically — no manual snapping needed.
 *
 * @param {NepaliDate} baseNpDate
 * @param {number}     intervalMonths
 * @returns {NepaliDate}
 */
function computeNextEscalationDate(baseNpDate, intervalMonths) {
  return addNepaliMonths(baseNpDate, intervalMonths);
}

/**
 * Recalculate all financial fields after applying `pct` percent escalation.
 * Honours appliesTo: "rent_only" | "cam_only" | "both".
 *
 * Returns paisa values for DB storage and rupee values for API responses.
 * Does NOT touch the database.
 *
 * @param {Object} tenant   Mongoose Tenant document
 * @param {number} pct      Percentage to apply, e.g. 5
 * @returns {Object}
 */
function computeEscalatedValues(tenant, pct) {
  const appliesTo = tenant.rentEscalation?.appliesTo ?? "rent_only";
  const sqft = tenant.leasedSquareFeet;

  // Only escalate the rates that appliesTo covers
  const newPricePerSqftPaisa =
    appliesTo === "cam_only"
      ? tenant.pricePerSqftPaisa
      : applyPercentage(tenant.pricePerSqftPaisa, pct);

  const newCamRatePerSqftPaisa =
    appliesTo === "rent_only"
      ? tenant.camRatePerSqftPaisa
      : applyPercentage(tenant.camRatePerSqftPaisa, pct);

  // Re-run the full rent formula (takes rupees, returns rupees)
  const calc = calculateUnitLease({
    sqft,
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    tdsPercentage: tenant.tdsPercentage ?? 10,
    securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
  });

  const totalRentPaisa = Math.round(calc.rentMonthly * 100);

  return {
    // ── Paisa values (stored in DB) ──────────────────────────────────────────
    pricePerSqftPaisa: newPricePerSqftPaisa,
    camRatePerSqftPaisa: newCamRatePerSqftPaisa,
    grossAmountPaisa: Math.round(calc.grossMonthly * 100),
    tdsPaisa: Math.round(calc.totalTds * 100),
    rentalRatePaisa: totalRentPaisa,
    totalRentPaisa,
    camChargesPaisa: Math.round(calc.camMonthly * 100),
    netAmountPaisa: Math.round(calc.netMonthly * 100),
    // Quarterly amount pre-computed so applyEscalation never diverges
    quarterlyRentAmountPaisa: totalRentPaisa * 3,

    // ── Rupee values (API response / preview only) ───────────────────────────
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    grossAmount: calc.grossMonthly,
    tds: calc.totalTds,
    totalRent: calc.rentMonthly,
    camCharges: calc.camMonthly,
    netAmount: calc.netMonthly,
    quarterlyRentAmount: calc.rentMonthly * 3,

    percentageApplied: pct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW  (dry-run, no DB writes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show what rent would become after escalation without saving anything.
 *
 * @param {string} tenantId
 * @param {number} [overridePercentage]  Use this instead of the stored value
 * @returns {Object}
 */
export async function previewEscalation(tenantId, overridePercentage) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.rentEscalation?.enabled) {
    throw new Error("Rent escalation is not enabled for this tenant");
  }

  const pct = overridePercentage ?? tenant.rentEscalation.percentageIncrease;
  const newValues = computeEscalatedValues(tenant, pct);

  // getNepaliMonthDates() gives today's full Nepali context in one call
  const { nepaliToday, npYear, npMonth, nepaliMonthName } =
    getNepaliMonthDates();

  const nextNpDate = tenant.rentEscalation.nextEscalationNepaliDate
    ? parseNepaliISO(tenant.rentEscalation.nextEscalationNepaliDate)
    : null;

  return {
    ...newValues,
    context: {
      today: {
        nepali: formatNepaliISO(nepaliToday),
        english: nepaliToday.getDateObject(),
        nepaliYear: npYear,
        nepaliMonth: npMonth, // 1-based
        nepaliMonthName,
        quarter: getQuarterFromMonth(npMonth),
      },
      nextEscalation: nextNpDate
        ? {
            nepali: formatNepaliISO(nextNpDate),
            english: nextNpDate.getDateObject(),
            nepaliMonth: nextNpDate.getMonth() + 1, // 1-based
            quarter: getQuarterFromMonth(nextNpDate.getMonth() + 1),
          }
        : null,
      intervalMonths: tenant.rentEscalation.intervalMonths,
      appliesTo: tenant.rentEscalation.appliesTo,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ESCALATION  (writes to DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a rent escalation to a single tenant.
 *
 * Steps:
 *  1. Recalculate all financial fields via computeEscalatedValues().
 *  2. Advance nextEscalationDate by intervalMonths from the CURRENT
 *     nextEscalationNepaliDate (falls back to leaseStartDate if not yet set —
 *     never "today", which would cause date drift).
 *  3. Push a before/after history entry with full Nepali date context.
 *  4. Save.
 *
 * @param {string} tenantId
 * @param {Object} options
 * @param {number} [options.overridePercentage]
 * @param {string} [options.note]
 * @param {string} [options.adminId]
 * @param {Object} [options.session]  Mongoose session (for transactions)
 * @returns {Object}
 */
export async function applyEscalation(tenantId, options = {}) {
  const { overridePercentage, note = "", adminId, session } = options;

  // Build query with optional session
  const query = Tenant.findById(tenantId);
  if (session) query.session(session);
  const tenant = await query;

  if (!tenant) {
    return { success: false, message: "Tenant not found", statusCode: 404 };
  }
  if (!tenant.rentEscalation?.enabled) {
    return {
      success: false,
      message: "Rent escalation is not enabled for this tenant",
      statusCode: 400,
    };
  }

  const pct = overridePercentage ?? tenant.rentEscalation.percentageIncrease;

  // ── Snapshot BEFORE values ────────────────────────────────────────────────
  const before = {
    pricePerSqftPaisa: tenant.pricePerSqftPaisa,
    camRatePerSqftPaisa: tenant.camRatePerSqftPaisa,
    grossAmountPaisa: tenant.grossAmountPaisa,
    totalRentPaisa: tenant.totalRentPaisa,
    camChargesPaisa: tenant.camChargesPaisa,
  };

  // ── Recalculate financials ────────────────────────────────────────────────
  const newValues = computeEscalatedValues(tenant, pct);

  // ── Today in Nepali calendar ──────────────────────────────────────────────
  // getNepaliMonthDates() returns npYear and npMonth (1-based) ready for DB storage
  const { nepaliToday, npYear, npMonth } = getNepaliMonthDates();
  const todayNpISO = formatNepaliISO(nepaliToday);

  // ── Compute NEXT escalation date ──────────────────────────────────────────
  // Base = stored nextEscalationNepaliDate  OR  leaseStartDate (never "today")
  // addNepaliMonths preserves the original day-of-month with built-in clamping
  const escalationBase = tenant.rentEscalation.nextEscalationNepaliDate
    ? parseNepaliISO(tenant.rentEscalation.nextEscalationNepaliDate)
    : toNepaliDate(tenant.leaseStartDate);

  const nextNpDate = computeNextEscalationDate(
    escalationBase,
    tenant.rentEscalation.intervalMonths,
  );
  const nextNpISO = formatNepaliISO(nextNpDate);
  const nextNpMonth1 = nextNpDate.getMonth() + 1; // 1-based for getQuarterFromMonth

  // ── Write new financial values ────────────────────────────────────────────
  tenant.pricePerSqftPaisa = newValues.pricePerSqftPaisa;
  tenant.pricePerSqft = paisaToRupees(newValues.pricePerSqftPaisa);
  tenant.camRatePerSqftPaisa = newValues.camRatePerSqftPaisa;
  tenant.camRatePerSqft = paisaToRupees(newValues.camRatePerSqftPaisa);
  tenant.grossAmountPaisa = newValues.grossAmountPaisa;
  tenant.totalRentPaisa = newValues.totalRentPaisa;
  tenant.tdsPaisa = newValues.tdsPaisa;
  tenant.rentalRatePaisa = newValues.rentalRatePaisa;
  tenant.camChargesPaisa = newValues.camChargesPaisa;
  tenant.netAmountPaisa = newValues.netAmountPaisa;

  if (tenant.rentPaymentFrequency === "quarterly") {
    tenant.quarterlyRentAmountPaisa = newValues.quarterlyRentAmountPaisa;
  }

  // ── Advance escalation schedule ───────────────────────────────────────────
  tenant.rentEscalation.lastEscalatedAt = new Date();
  tenant.rentEscalation.lastEscalatedNepaliDate = todayNpISO;
  tenant.rentEscalation.nextEscalationDate = nextNpDate.getDateObject(); // English Date for cron index
  tenant.rentEscalation.nextEscalationNepaliDate = nextNpISO;

  // ── Push history entry ────────────────────────────────────────────────────
  tenant.rentEscalation.history.push({
    escalatedAt: new Date(),
    escalatedNepaliDate: todayNpISO,
    nepaliYear: npYear,
    nepaliMonth: npMonth, // 1-based, from getNepaliMonthDates
    quarter: getQuarterFromMonth(npMonth), // derived via helper
    escalatedBy: adminId ? new mongoose.Types.ObjectId(adminId) : undefined,

    // Before snapshot
    previousPricePerSqftPaisa: before.pricePerSqftPaisa,
    previousCamRatePerSqftPaisa: before.camRatePerSqftPaisa,
    previousGrossAmountPaisa: before.grossAmountPaisa,
    previousTotalRentPaisa: before.totalRentPaisa,
    previousCamChargesPaisa: before.camChargesPaisa,

    // After snapshot
    newPricePerSqftPaisa: newValues.pricePerSqftPaisa,
    newCamRatePerSqftPaisa: newValues.camRatePerSqftPaisa,
    newGrossAmountPaisa: newValues.grossAmountPaisa,
    newTotalRentPaisa: newValues.totalRentPaisa,
    newCamChargesPaisa: newValues.camChargesPaisa,

    percentageApplied: pct,
    note,
  });

  // Correct Mongoose save() session syntax
  await tenant.save(session ? { session } : undefined);

  console.log(
    `✅ Escalation applied — Tenant: ${tenant.name} | ${pct}% | ` +
      `Nepali: ${todayNpISO} | Next due: ${nextNpISO}`,
  );

  return {
    success: true,
    message: `Rent escalated by ${pct}% successfully`,
    tenant,
    preview: newValues,
    nepaliDates: {
      appliedOn: todayNpISO,
      appliedQuarter: getQuarterFromMonth(npMonth),
      nextEscalationDue: nextNpISO,
      nextEscalationQuarter: getQuarterFromMonth(nextNpMonth1),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK PROCESSING  (cron job)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find every tenant whose escalation date is on or before `asOf` and apply it.
 * Designed to be called from a daily cron job.
 *
 * @param {Date} [asOf=new Date()]
 * @returns {Promise<{ processed: number, failed: number, details: Array }>}
 */
export async function processDueEscalations(asOf = new Date()) {
  console.log("Cron running at:", new Date());

  const tenants = await Tenant.findDueForEscalation();
  console.log("Tenants found:", tenants.length);
  const dueTenants = await Tenant.findDueForEscalation(asOf);

  if (dueTenants.length === 0) {
    console.log("[EscalationBulk] No escalations due.");
    return { processed: 0, failed: 0, details: [] };
  }

  // getCurrentQuarterInfo() + getNepaliMonthDates() for a well-formed cron log line
  const { year, quarter, quarterName } = getCurrentQuarterInfo();
  const { nepaliToday, npMonth } = getNepaliMonthDates();

  console.log(
    `[EscalationBulk] Running for ${formatNepaliISO(nepaliToday)} ` +
      `(${year} ${quarterName}/Q${quarter}, month ${npMonth}) — ` +
      `${dueTenants.length} tenant(s) due`,
  );

  const details = [];
  let processed = 0;
  let failed = 0;

  for (const tenant of dueTenants) {
    try {
      const result = await applyEscalation(tenant._id.toString(), {
        note: `Auto-applied by cron on ${formatNepaliISO(nepaliToday)} (Q${quarter})`,
      });

      if (result.success) {
        processed++;
        details.push({
          tenantId: tenant._id,
          name: tenant.name,
          status: "ok",
          nepaliDates: result.nepaliDates,
        });
      } else {
        failed++;
        details.push({
          tenantId: tenant._id,
          name: tenant.name,
          status: "failed",
          reason: result.message,
        });
      }
    } catch (err) {
      failed++;
      details.push({
        tenantId: tenant._id,
        name: tenant.name,
        status: "error",
        reason: err.message,
      });
    }
  }

  console.log(
    `[EscalationBulk] Done — processed: ${processed}, failed: ${failed}`,
  );
  return { processed, failed, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENABLE / DISABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enable (or reconfigure) escalation for a tenant.
 *
 * First escalation date = leaseStartDate (in Nepali) + intervalMonths.
 * The day-of-month from leaseStartDate is preserved via addNepaliMonths'
 * built-in day-clamping — no manual snapping to the 1st of month.
 *
 * An optional startNepaliDate override is accepted (e.g. for backdating),
 * but leaseStartDate is the correct default anchor.
 *
 * @param {string} tenantId
 * @param {Object} settings
 * @param {number}  settings.percentageIncrease   e.g. 5
 * @param {number}  [settings.intervalMonths=12]
 * @param {string}  [settings.appliesTo="rent_only"]  "rent_only"|"cam_only"|"both"
 * @param {string}  [settings.startNepaliDate]    Override anchor "YYYY-MM-DD"
 * @returns {Object}
 */
export async function enableEscalation(tenantId, settings) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return { success: false, message: "Tenant not found", statusCode: 404 };
  }

  const {
    percentageIncrease,
    intervalMonths = 12,
    appliesTo = "rent_only",
    startNepaliDate,
  } = settings;

  if (!percentageIncrease || percentageIncrease <= 0) {
    return {
      success: false,
      message: "percentageIncrease must be a positive number",
      statusCode: 400,
    };
  }

  // ── Anchor: explicit override → leaseStartDate ────────────────────────────
  const anchorNpDate = startNepaliDate
    ? parseNepaliISO(startNepaliDate)
    : toNepaliDate(tenant.leaseStartDate);

  // First escalation = anchor + intervalMonths
  // addNepaliMonths (via computeNextEscalationDate) clamps the day automatically
  const firstEscalationNpDate = computeNextEscalationDate(
    anchorNpDate,
    intervalMonths,
  );
  const firstEscalationISO = formatNepaliISO(firstEscalationNpDate);
  const firstEscalationEnglish = firstEscalationNpDate.getDateObject();
  const firstEscalationMonth1 = firstEscalationNpDate.getMonth() + 1; // 1-based

  // Preserve existing history and last-escalated info (safe toObject() for subdoc)
  const existing =
    tenant.rentEscalation?.toObject?.() ?? tenant.rentEscalation ?? {};

  tenant.rentEscalation = {
    ...existing,
    enabled: true,
    percentageIncrease,
    intervalMonths,
    appliesTo,
    nextEscalationDate: firstEscalationEnglish, // English Date → cron index
    nextEscalationNepaliDate: firstEscalationISO, // Human-readable display
    history: existing.history ?? [],
    lastEscalatedAt: existing.lastEscalatedAt ?? null,
    lastEscalatedNepaliDate: existing.lastEscalatedNepaliDate ?? null,
  };

  await tenant.save();

  return {
    success: true,
    message: "Rent escalation enabled",
    tenant,
    escalationSchedule: {
      anchorNepaliDate: formatNepaliISO(anchorNpDate),
      firstEscalationNepali: firstEscalationISO,
      firstEscalationEnglish,
      firstEscalationQuarter: getQuarterFromMonth(firstEscalationMonth1),
      intervalMonths,
      percentageIncrease,
      appliesTo,
    },
  };
}

/**
 * Disable escalation for a tenant (history is preserved).
 *
 * @param {string} tenantId
 * @returns {Object}
 */
export async function disableEscalation(tenantId) {
  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { $set: { "rentEscalation.enabled": false } },
    { new: true },
  );
  if (!tenant) {
    return { success: false, message: "Tenant not found", statusCode: 404 };
  }
  return { success: true, message: "Rent escalation disabled", tenant };
}

// ─────────────────────────────────────────────────────────────────────────────
// READ UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return escalation history with human-readable Nepali dates and rupee values.
 *
 * @param {string} tenantId
 * @returns {Array}
 */
export async function getEscalationHistory(tenantId) {
  const tenant = await Tenant.findById(tenantId).select("rentEscalation name");
  if (!tenant) throw new Error("Tenant not found");

  return (tenant.rentEscalation?.history ?? []).map((entry) => ({
    escalatedAt: entry.escalatedAt,
    escalatedNepaliDate: entry.escalatedNepaliDate,
    nepaliYear: entry.nepaliYear,
    nepaliMonth: entry.nepaliMonth,
    quarter: entry.quarter,
    escalatedBy: entry.escalatedBy,
    percentageApplied: entry.percentageApplied,
    note: entry.note,
    before: {
      pricePerSqft: paisaToRupees(entry.previousPricePerSqftPaisa),
      camRatePerSqft: paisaToRupees(entry.previousCamRatePerSqftPaisa),
      grossAmount: paisaToRupees(entry.previousGrossAmountPaisa),
      totalRent: paisaToRupees(entry.previousTotalRentPaisa),
      camCharges: paisaToRupees(entry.previousCamChargesPaisa),
    },
    after: {
      pricePerSqft: paisaToRupees(entry.newPricePerSqftPaisa),
      camRatePerSqft: paisaToRupees(entry.newCamRatePerSqftPaisa),
      grossAmount: paisaToRupees(entry.newGrossAmountPaisa),
      totalRent: paisaToRupees(entry.newTotalRentPaisa),
      camCharges: paisaToRupees(entry.newCamChargesPaisa),
    },
  }));
}

/**
 * Get full escalation configuration, schedule, and current financial values.
 *
 * @param {string} tenantId
 * @returns {Object}
 */
export async function getEscalationData(tenantId) {
  const tenant = await Tenant.findById(tenantId).select(
    "rentEscalation name pricePerSqftPaisa camRatePerSqftPaisa " +
      "grossAmountPaisa totalRentPaisa camChargesPaisa netAmountPaisa",
  );
  if (!tenant) throw new Error("Tenant not found");

  const escalation = tenant.rentEscalation ?? {};

  // getNepaliMonthDates() gives today's full Nepali context in one call
  const { nepaliToday, npYear, npMonth, nepaliMonthName } =
    getNepaliMonthDates();

  const nextNpDate = escalation.nextEscalationNepaliDate
    ? parseNepaliISO(escalation.nextEscalationNepaliDate)
    : null;

  return {
    enabled: escalation.enabled ?? false,
    configuration: {
      percentageIncrease: escalation.percentageIncrease ?? 0,
      intervalMonths: escalation.intervalMonths ?? 12,
      appliesTo: escalation.appliesTo ?? "rent_only",
    },
    schedule: {
      nextEscalationDate: escalation.nextEscalationDate ?? null,
      nextEscalationNepaliDate: escalation.nextEscalationNepaliDate ?? null,
      nextEscalationNepaliMonth: nextNpDate ? nextNpDate.getMonth() + 1 : null, // 1-based
      nextEscalationQuarter: nextNpDate
        ? getQuarterFromMonth(nextNpDate.getMonth() + 1)
        : null,
      lastEscalatedAt: escalation.lastEscalatedAt ?? null,
      lastEscalatedNepaliDate: escalation.lastEscalatedNepaliDate ?? null,
    },
    currentValues: {
      pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa),
      camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa),
      grossAmount: paisaToRupees(tenant.grossAmountPaisa),
      totalRent: paisaToRupees(tenant.totalRentPaisa),
      camCharges: paisaToRupees(tenant.camChargesPaisa),
      netAmount: paisaToRupees(tenant.netAmountPaisa),
    },
    context: {
      today: {
        nepali: formatNepaliISO(nepaliToday),
        english: nepaliToday.getDateObject(),
        nepaliYear: npYear,
        nepaliMonth: npMonth, // 1-based
        nepaliMonthName,
        quarter: getQuarterFromMonth(npMonth),
      },
      historyCount: escalation.history?.length ?? 0,
    },
  };
}
