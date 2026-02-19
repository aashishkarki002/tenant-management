/**
 * RENT ESCALATION SERVICE (Nepali Calendar-Aware)
 *
 * All date logic uses nepaliDateHelper.js and quarterlyRentHelper.js.
 * Paisa is the internal currency unit throughout.
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
 * Round a paisa amount up by a percentage.
 * Math.round keeps us in whole-paisa territory.
 */
function applyPercentage(paisaAmount, pct) {
  return Math.round(paisaAmount * (1 + pct / 100));
}

/**
 * Given a NepaliDate and an interval in months, return the NEXT
 * escalation NepaliDate (always snapped to the 1st of that month).
 *
 * @param {NepaliDate} baseNpDate
 * @param {number}     intervalMonths
 * @returns {NepaliDate}
 */
function computeNextEscalationNpDate(baseNpDate, intervalMonths) {
  const next = addNepaliMonths(baseNpDate, intervalMonths);
  // Always snap to 1st of the target month
  return new NepaliDate(next.getYear(), next.getMonth(), 1);
}

/**
 * Convert a JS Date → NepaliDate safely.
 * Accepts Date | string | NepaliDate.
 */
function toNepaliDate(input) {
  if (input instanceof NepaliDate) return input;
  return new NepaliDate(new Date(input));
}

/**
 * Core financial recalculation after applying `pct` percent to
 * whichever rates `appliesTo` specifies.
 *
 * Returns both the new paisa values AND a human-readable rupee preview.
 * Does NOT touch the database.
 */
function _computeEscalatedValues(tenant, pct) {
  const appliesTo = tenant.rentEscalation?.appliesTo || "rent_only";
  const sqft = tenant.leasedSquareFeet;

  const newPricePerSqftPaisa =
    appliesTo === "cam_only"
      ? tenant.pricePerSqftPaisa
      : applyPercentage(tenant.pricePerSqftPaisa, pct);

  const newCamRatePerSqftPaisa =
    appliesTo === "rent_only"
      ? tenant.camRatePerSqftPaisa
      : applyPercentage(tenant.camRatePerSqftPaisa, pct);

  // Re-run the full rent formula (expects rupees, returns rupees)
  const calc = calculateUnitLease({
    sqft,
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    tdsPercentage: tenant.tdsPercentage || 10,
    securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
  });

  return {
    // Storage values (paisa)
    pricePerSqftPaisa: newPricePerSqftPaisa,
    camRatePerSqftPaisa: newCamRatePerSqftPaisa,
    grossAmountPaisa: Math.round(calc.grossMonthly * 100),
    tdsPaisa: Math.round(calc.totalTds * 100),
    rentalRatePaisa: Math.round(calc.rentMonthly * 100),
    totalRentPaisa: Math.round(calc.rentMonthly * 100),
    camChargesPaisa: Math.round(calc.camMonthly * 100),
    netAmountPaisa: Math.round(calc.netMonthly * 100),

    // Preview values (rupees — for API responses)
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    grossAmount: calc.grossMonthly,
    tds: calc.totalTds,
    totalRent: calc.rentMonthly,
    camCharges: calc.camMonthly,
    netAmount: calc.netMonthly,
    percentageApplied: pct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW (DRY RUN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show what the rent would become after escalation — without saving.
 * Includes Nepali calendar context (current date, next escalation date).
 *
 * @param {string} tenantId
 * @param {number} [overridePercentage]
 * @returns {Object}
 */
export async function previewEscalation(tenantId, overridePercentage) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.rentEscalation?.enabled) {
    throw new Error("Rent escalation is not enabled for this tenant");
  }

  const pct = overridePercentage ?? tenant.rentEscalation.percentageIncrease;
  const newValues = _computeEscalatedValues(tenant, pct);

  // Enrich preview with Nepali date context
  const todayNp = new NepaliDate();
  const nextNpDate = tenant.rentEscalation.nextEscalationNepaliDate
    ? parseNepaliISO(tenant.rentEscalation.nextEscalationNepaliDate)
    : null;

  return {
    ...newValues,
    context: {
      today: {
        nepali: formatNepaliISO(todayNp),
        english: todayNp.getDateObject(),
      },
      nextEscalation: nextNpDate
        ? {
            nepali: formatNepaliISO(nextNpDate),
            english: nextNpDate.getDateObject(),
            quarter: getQuarterFromMonth(nextNpDate.getMonth() + 1),
          }
        : null,
      intervalMonths: tenant.rentEscalation.intervalMonths,
      appliesTo: tenant.rentEscalation.appliesTo,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ESCALATION (writes to DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a rent escalation to a single tenant.
 *
 * 1. Recalculates all financial fields
 * 2. Advances nextEscalationDate by intervalMonths (Nepali calendar)
 * 3. Pushes a full before/after history entry with Nepali date stamps
 * 4. Saves the tenant document
 *
 * @param {string} tenantId
 * @param {Object} options
 * @param {number}  [options.overridePercentage]
 * @param {string}  [options.note]
 * @param {string}  [options.adminId]
 * @param {Object}  [options.session]  Mongoose session for transactions
 * @returns {Object}
 */
export async function applyEscalation(tenantId, options = {}) {
  const { overridePercentage, note = "", adminId, session } = options;

  const tenant = await Tenant.findById(tenantId).session(session || null);
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

  // ── Calculate new values ──────────────────────────────────────────────────
  const newValues = _computeEscalatedValues(tenant, pct);

  // ── Determine Nepali dates ────────────────────────────────────────────────
  const todayNp = new NepaliDate();
  const todayNpISO = formatNepaliISO(todayNp);

  // Parse the stored next escalation Nepali date (or fall back to today)
  const currentEscalationNpDate = tenant.rentEscalation.nextEscalationNepaliDate
    ? parseNepaliISO(tenant.rentEscalation.nextEscalationNepaliDate)
    : todayNp;

  const interval = tenant.rentEscalation.intervalMonths;
  const nextNpDate = computeNextEscalationNpDate(
    currentEscalationNpDate,
    interval,
  );
  const nextNpISO = formatNepaliISO(nextNpDate);

  // ── Apply new financial values ────────────────────────────────────────────
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
    tenant.quarterlyRentAmountPaisa = newValues.totalRentPaisa * 3;
  }

  // ── Advance escalation schedule ───────────────────────────────────────────
  tenant.rentEscalation.lastEscalatedAt = new Date();
  tenant.rentEscalation.lastEscalatedNepaliDate = todayNpISO;
  tenant.rentEscalation.nextEscalationDate = nextNpDate.getDateObject(); // English Date for cron index
  tenant.rentEscalation.nextEscalationNepaliDate = nextNpISO; // Human-readable

  // ── Record history entry ──────────────────────────────────────────────────
  const { npYear, npMonth } = getNepaliMonthDates(); // current Nepali month context
  tenant.rentEscalation.history.push({
    escalatedAt: new Date(),
    escalatedNepaliDate: todayNpISO,
    nepaliYear: todayNp.getYear(),
    nepaliMonth: todayNp.getMonth() + 1, // 1-based, matches DB convention
    quarter: getQuarterFromMonth(todayNp.getMonth() + 1),
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

  await tenant.save(session ? { session } : {});

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
      nextEscalationDue: nextNpISO,
      nextEscalationQuarter: getQuarterFromMonth(nextNpDate.getMonth() + 1),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK PROCESSING (for cron job)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find every tenant whose escalation date is on or before `asOf`
 * and apply it. Designed to be called from your daily cron job.
 *
 * @param {Date} [asOf=new Date()]
 * @returns {Object} { processed, failed, details }
 */
export async function processDueEscalations(asOf = new Date()) {
  const dueTenants = await Tenant.findDueForEscalation(asOf);

  if (dueTenants.length === 0) {
    console.log("[EscalationBulk] No escalations due.");
    return { processed: 0, failed: 0, details: [] };
  }

  // Log current Nepali date context for the run
  const todayNp = new NepaliDate();
  const { quarter } = getCurrentQuarterInfo();
  console.log(
    `[EscalationBulk] Running for ${formatNepaliISO(todayNp)} ` +
      `(Q${quarter}) — ${dueTenants.length} tenant(s) due`,
  );

  const details = [];
  let processed = 0;
  let failed = 0;

  for (const tenant of dueTenants) {
    try {
      const result = await applyEscalation(tenant._id.toString(), {
        note: `Auto-applied by cron job on ${formatNepaliISO(todayNp)}`,
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
// SETTINGS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enable (or reconfigure) escalation for a tenant.
 *
 * The first escalation date is computed in Nepali calendar:
 * leaseStartDate + intervalMonths, snapped to the 1st of that month.
 *
 * @param {string} tenantId
 * @param {Object} settings
 * @param {number}  settings.percentageIncrease   e.g. 5  (for 5%)
 * @param {number}  [settings.intervalMonths=12]  e.g. 12 (yearly)
 * @param {string}  [settings.appliesTo]          "rent_only" | "cam_only" | "both"
 * @param {string}  [settings.startNepaliDate]    Override in "YYYY-MM-DD" Nepali ISO
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

  // Determine base Nepali date for the first escalation
  const baseNpDate = startNepaliDate
    ? parseNepaliISO(startNepaliDate)
    : toNepaliDate(tenant.leaseStartDate);

  const firstEscalationNpDate = computeNextEscalationNpDate(
    baseNpDate,
    intervalMonths,
  );

  const firstEscalationISO = formatNepaliISO(firstEscalationNpDate);
  const firstEscalationEnglish = firstEscalationNpDate.getDateObject();

  tenant.rentEscalation = {
    ...(tenant.rentEscalation || {}),
    enabled: true,
    percentageIncrease,
    intervalMonths,
    appliesTo,
    // English Date — indexed by MongoDB for fast cron queries
    nextEscalationDate: firstEscalationEnglish,
    // Human-readable Nepali date — for display & history
    nextEscalationNepaliDate: firstEscalationISO,
    history: tenant.rentEscalation?.history || [],
    lastEscalatedAt: tenant.rentEscalation?.lastEscalatedAt || null,
    lastEscalatedNepaliDate:
      tenant.rentEscalation?.lastEscalatedNepaliDate || null,
  };

  await tenant.save();

  return {
    success: true,
    message: "Rent escalation enabled",
    tenant,
    escalationSchedule: {
      firstEscalationNepali: firstEscalationISO,
      firstEscalationEnglish,
      quarter: getQuarterFromMonth(firstEscalationNpDate.getMonth() + 1),
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

/**
 * Return the escalation history with human-readable Nepali dates and rupee values.
 *
 * @param {string} tenantId
 * @returns {Array}
 */
export async function getEscalationHistory(tenantId) {
  const tenant = await Tenant.findById(tenantId).select("rentEscalation name");
  if (!tenant) throw new Error("Tenant not found");

  return (tenant.rentEscalation?.history || []).map((entry) => ({
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
 * Get complete escalation data for a tenant including configuration, status, and current values.
 *
 * @param {string} tenantId
 * @returns {Object}
 */
export async function getEscalationData(tenantId) {
  const tenant = await Tenant.findById(tenantId).select(
    "rentEscalation name pricePerSqftPaisa camRatePerSqftPaisa grossAmountPaisa totalRentPaisa camChargesPaisa netAmountPaisa",
  );
  if (!tenant) throw new Error("Tenant not found");

  const escalation = tenant.rentEscalation || {};
  const todayNp = new NepaliDate();

  // Parse next escalation date if available
  const nextEscalationNpDate = escalation.nextEscalationNepaliDate
    ? parseNepaliISO(escalation.nextEscalationNepaliDate)
    : null;

  // Parse last escalated date if available
  const lastEscalatedNpDate = escalation.lastEscalatedNepaliDate
    ? parseNepaliISO(escalation.lastEscalatedNepaliDate)
    : null;

  return {
    enabled: escalation.enabled || false,
    configuration: {
      percentageIncrease: escalation.percentageIncrease || 0,
      intervalMonths: escalation.intervalMonths || 12,
      appliesTo: escalation.appliesTo || "rent_only",
    },
    schedule: {
      nextEscalationDate: escalation.nextEscalationDate || null,
      nextEscalationNepaliDate: escalation.nextEscalationNepaliDate || null,
      nextEscalationQuarter: nextEscalationNpDate
        ? getQuarterFromMonth(nextEscalationNpDate.getMonth() + 1)
        : null,
      lastEscalatedAt: escalation.lastEscalatedAt || null,
      lastEscalatedNepaliDate: escalation.lastEscalatedNepaliDate || null,
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
        nepali: formatNepaliISO(todayNp),
        english: todayNp.getDateObject(),
      },
      historyCount: escalation.history?.length || 0,
    },
  };
}
