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
function computeEscalatedValues(tenant, step) {
  // Per-step appliesTo overrides the tenant-level setting
  const appliesTo =
    step.appliesTo ?? tenant.rentEscalation?.appliesTo ?? "rent_only";
  const sqft = tenant.leasedSquareFeet;

  let newPricePerSqftPaisa = tenant.pricePerSqftPaisa;
  let newCamRatePerSqftPaisa = tenant.camRatePerSqftPaisa;

  switch (step.type) {
    // ── PERCENTAGE ──────────────────────────────────────────────────────────
    // value = 5 → +5%, value = 0 → freeze, value = -10 → discount
    case "percentage": {
      if (appliesTo !== "cam_only") {
        newPricePerSqftPaisa = Math.round(
          tenant.pricePerSqftPaisa * (1 + step.value / 100),
        );
      }
      if (appliesTo !== "rent_only") {
        newCamRatePerSqftPaisa = Math.round(
          tenant.camRatePerSqftPaisa * (1 + step.value / 100),
        );
      }
      break;
    }

    // ── FIXED AMOUNT ────────────────────────────────────────────────────────
    // value = rupees added to total rent per month e.g. 5000 = +Rs. 5,000/mo
    // We back-derive the new pricePerSqft so the formula stays consistent.
    // CAM is never touched by fixed_amount (you're fixing the rent, not the rate).
    case "fixed_amount": {
      if (appliesTo === "cam_only") {
        // Fixed amount on CAM → distribute across sqft
        const camIncreasePaisa = Math.round(step.value * 100); // rupees → paisa
        const camIncreasePerSqftPaisa = Math.round(camIncreasePaisa / sqft);
        newCamRatePerSqftPaisa =
          tenant.camRatePerSqftPaisa + camIncreasePerSqftPaisa;
        break;
      }
      // Default: applies to rent component
      const rentIncreasePaisa = Math.round(step.value * 100); // rupees → paisa
      const rentIncreasePerSqftPaisa = Math.round(rentIncreasePaisa / sqft);
      newPricePerSqftPaisa =
        tenant.pricePerSqftPaisa + rentIncreasePerSqftPaisa;

      if (appliesTo === "both") {
        // Same absolute rupee amount added to CAM too
        const camIncreasePaisa = Math.round(step.value * 100);
        const camIncreasePerSqftPaisa = Math.round(camIncreasePaisa / sqft);
        newCamRatePerSqftPaisa =
          tenant.camRatePerSqftPaisa + camIncreasePerSqftPaisa;
      }
      break;
    }

    // ── FIXED PER SQFT ──────────────────────────────────────────────────────
    // value = rupees per sqft to add e.g. 2 = +Rs. 2/sqft
    // Most natural for Nepal commercial leases — rate cards are per-sqft.
    case "fixed_per_sqft": {
      const increasePerSqftPaisa = Math.round(step.value * 100); // rupees → paisa
      if (appliesTo !== "cam_only") {
        newPricePerSqftPaisa = tenant.pricePerSqftPaisa + increasePerSqftPaisa;
      }
      if (appliesTo !== "rent_only") {
        newCamRatePerSqftPaisa =
          tenant.camRatePerSqftPaisa + increasePerSqftPaisa;
      }
      break;
    }

    // ── ABSOLUTE ─────────────────────────────────────────────────────────────
    // value = the exact new total rent in RUPEES (not paisa, for admin sanity).
    // Back-derives pricePerSqft from the target amount so everything stays consistent.
    // CAM is unchanged — absolute targets the rent component only.
    case "absolute": {
      const targetTotalRentPaisa = Math.round(step.value * 100);
      // Back-derive: totalRent = pricePerSqft * sqft * (1 - tdsRate)
      // So: pricePerSqft = targetTotalRent / (sqft * (1 - tdsRate))
      const tdsRate = (tenant.tdsPercentage ?? 10) / 100;
      newPricePerSqftPaisa = Math.round(
        targetTotalRentPaisa / (sqft * (1 - tdsRate)),
      );
      // CAM untouched for absolute — admin explicitly set the rent number
      break;
    }

    default:
      throw new Error(`Unknown escalation type: ${step.type}`);
  }

  // ── Re-run full rent formula ────────────────────────────────────────────────
  const calc = calculateUnitLease({
    sqft,
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    tdsPercentage: tenant.tdsPercentage ?? 10,
    securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
  });

  const totalRentPaisa = Math.round(calc.rentMonthly * 100);

  return {
    // ── Paisa values (DB) ───────────────────────────────────────────────────
    pricePerSqftPaisa: newPricePerSqftPaisa,
    camRatePerSqftPaisa: newCamRatePerSqftPaisa,
    grossAmountPaisa: Math.round(calc.grossMonthly * 100),
    tdsPaisa: Math.round(calc.totalTds * 100),
    rentalRatePaisa: totalRentPaisa,
    totalRentPaisa,
    camChargesPaisa: Math.round(calc.camMonthly * 100),
    netAmountPaisa: Math.round(calc.netMonthly * 100),
    quarterlyRentAmountPaisa: totalRentPaisa * 3,

    // ── Rupee values (API response / preview) ───────────────────────────────
    pricePerSqft: paisaToRupees(newPricePerSqftPaisa),
    camRatePerSqft: paisaToRupees(newCamRatePerSqftPaisa),
    grossAmount: calc.grossMonthly,
    tds: calc.totalTds,
    totalRent: calc.rentMonthly,
    camCharges: calc.camMonthly,
    netAmount: calc.netMonthly,
    quarterlyRentAmount: calc.rentMonthly * 3,

    // ── Escalation metadata ─────────────────────────────────────────────────
    escalationType: step.type,
    escalationValue: step.value,
    appliesTo,
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
  const schedule = tenant.rentEscalation.schedule ?? [];
  const stepIndex = Math.min(
    tenant.rentEscalation.currentStepIndex ?? 0,
    schedule.length - 1,
  );
  const currentStep = schedule[stepIndex];

  const effectiveStep =
    overridePercentage != null
      ? { ...currentStep, type: "percentage", value: overridePercentage }
      : currentStep;

  const newValues = computeEscalatedValues(tenant, effectiveStep);

  // getNepaliMonthDates() gives today's full Nepali context in one call
  const { nepaliToday, npYear, npMonth, nepaliMonthName } =
    getNepaliMonthDates();

  const nextNpDate = tenant.rentEscalation.nextEscalationNepaliDate
    ? parseNepaliISO(tenant.rentEscalation.nextEscalationNepaliDate)
    : null;

  return {
    ...newValues,
    stepInfo: {
      index: stepIndex,
      label: currentStep.label,
      type: effectiveStep.type,
      value: effectiveStep.value,
      totalSteps: schedule.length,
      isLastStep: stepIndex === schedule.length - 1,
      repeatingAfterExhaustion: stepIndex === schedule.length - 1,
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

  const queryOptions = session ? { session } : {};
  const tenant = await Tenant.findById(tenantId, null, queryOptions);
  if (!tenant)
    return { success: false, message: "Tenant not found", statusCode: 404 };
  if (!tenant.rentEscalation?.enabled) {
    return {
      success: false,
      message: "Escalation not enabled",
      statusCode: 400,
    };
  }

  const escalation = tenant.rentEscalation;
  const schedule = escalation.schedule ?? [];

  if (schedule.length === 0) {
    return {
      success: false,
      message: "No escalation schedule defined",
      statusCode: 400,
    };
  }

  // ── Pick current step (clamp to last if exhausted) ───────────────────
  const stepIndex = Math.min(
    escalation.currentStepIndex ?? 0,
    schedule.length - 1,
  );
  const currentStep = schedule[stepIndex];
  const effectiveStep =
    overridePercentage != null
      ? { ...currentStep, type: "percentage", value: overridePercentage }
      : currentStep;

  const newValues = computeEscalatedValues(tenant, effectiveStep);

  // ── Advance step index (stays at last step after exhaustion) ─────────
  const nextStepIndex = Math.min(stepIndex + 1, schedule.length - 1);
  const nextStep = schedule[nextStepIndex];

  // ── Compute NEXT escalation date from the CURRENT fire date ──────────
  // Current nextEscalationNepaliDate is TODAY (the date that just fired).
  // We advance by nextStep.intervalMonths from it.
  const currentFireNpDate = escalation.nextEscalationNepaliDate
    ? parseNepaliISO(escalation.nextEscalationNepaliDate)
    : toNepaliDate(tenant.leaseStartDate);

  const nextEscNpDate = computeNextEscalationDate(
    currentFireNpDate,
    nextStep.intervalMonths,
  );
  const nextEscISO = formatNepaliISO(nextEscNpDate);
  const nextEscEnglish = nextEscNpDate.getDateObject();

  // ── Build history entry ───────────────────────────────────────────────
  const { nepaliToday, npYear, npMonth } = getNepaliMonthDates();
  const historyEntry = {
    escalatedAt: new Date(),
    escalatedNepaliDate: formatNepaliISO(nepaliToday),
    nepaliYear: npYear,
    nepaliMonth: npMonth,
    quarter: getQuarterFromMonth(npMonth),
    escalatedBy: adminId ? new mongoose.Types.ObjectId(adminId) : undefined,
    previousPricePerSqftPaisa: tenant.pricePerSqftPaisa,
    previousCamRatePerSqftPaisa: tenant.camRatePerSqftPaisa,
    previousGrossAmountPaisa: tenant.grossAmountPaisa,
    previousTotalRentPaisa: tenant.totalRentPaisa,
    previousCamChargesPaisa: tenant.camChargesPaisa,
    newPricePerSqftPaisa: newValues.pricePerSqftPaisa,
    newCamRatePerSqftPaisa: newValues.camRatePerSqftPaisa,
    newGrossAmountPaisa: newValues.grossAmountPaisa,
    newTotalRentPaisa: newValues.totalRentPaisa,
    newCamChargesPaisa: newValues.camChargesPaisa,
    percentageApplied: effectiveStep.value,
    note: note || currentStep.label || "",
  };

  // ── Write to DB ───────────────────────────────────────────────────────
  Object.assign(tenant, {
    pricePerSqftPaisa: newValues.pricePerSqftPaisa,
    camRatePerSqftPaisa: newValues.camRatePerSqftPaisa,
    grossAmountPaisa: newValues.grossAmountPaisa,
    tdsPaisa: newValues.tdsPaisa,
    rentalRatePaisa: newValues.rentalRatePaisa,
    totalRentPaisa: newValues.totalRentPaisa,
    camChargesPaisa: newValues.camChargesPaisa,
    netAmountPaisa: newValues.netAmountPaisa,
    quarterlyRentAmountPaisa: newValues.quarterlyRentAmountPaisa,
  });

  tenant.rentEscalation.currentStepIndex = nextStepIndex;
  tenant.rentEscalation.nextEscalationDate = nextEscEnglish;
  tenant.rentEscalation.nextEscalationNepaliDate = nextEscISO;
  tenant.rentEscalation.lastEscalatedAt = new Date();
  tenant.rentEscalation.lastEscalatedNepaliDate = formatNepaliISO(nepaliToday);
  tenant.rentEscalation.history.push(historyEntry);

  await tenant.save(queryOptions);

  return {
    success: true,
    message: `Escalation applied: ${pct}% (Step ${stepIndex + 1} of ${schedule.length})`,
    stepApplied: { index: stepIndex, label: currentStep.label, pct },
    nextStep: {
      index: nextStepIndex,
      label: nextStep.label,
      pct: nextStep.percentageIncrease,
      nepaliDate: nextEscISO,
    },
    newValues,
    tenant,
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
  if (!tenant)
    return { success: false, message: "Tenant not found", statusCode: 404 };

  const { schedule, appliesTo = "rent_only", startNepaliDate } = settings;

  // ── Backward compat: single-step input → normalize to schedule array ──
  // Allows: { percentageIncrease: 5, intervalMonths: 12 }
  // to work exactly as before without breaking existing callers
  let resolvedSchedule = schedule;
  if (!resolvedSchedule || resolvedSchedule.length === 0) {
    const pct = settings.percentageIncrease;
    const interval = settings.intervalMonths ?? 12;
    if (!pct || pct < 0) {
      return {
        success: false,
        message: "schedule or percentageIncrease required",
        statusCode: 400,
      };
    }
    resolvedSchedule = [
      { intervalMonths: interval, percentageIncrease: pct, label: "Default" },
    ];
  }

  // ── Validate schedule ─────────────────────────────────────────────────
  for (const [i, step] of resolvedSchedule.entries()) {
    if (!step.intervalMonths || step.intervalMonths < 1) {
      return {
        success: false,
        message: `Step ${i}: intervalMonths must be >= 1`,
        statusCode: 400,
      };
    }
    if (step.percentageIncrease == null || step.percentageIncrease < 0) {
      return {
        success: false,
        message: `Step ${i}: percentageIncrease must be >= 0 (0 = freeze)`,
        statusCode: 400,
      };
    }
  }

  // ── Compute first escalation date from step[0].intervalMonths ────────
  const anchorNpDate = startNepaliDate
    ? parseNepaliISO(startNepaliDate)
    : toNepaliDate(tenant.leaseStartDate);

  const firstNpDate = computeNextEscalationDate(
    anchorNpDate,
    resolvedSchedule[0].intervalMonths,
  );
  const firstISO = formatNepaliISO(firstNpDate);
  const firstEnglish = firstNpDate.getDateObject();

  const existing =
    tenant.rentEscalation?.toObject?.() ?? tenant.rentEscalation ?? {};

  tenant.rentEscalation = {
    ...existing,
    enabled: true,
    schedule: resolvedSchedule,
    currentStepIndex: 0, // always reset to step 0 on (re-)enable
    appliesTo,
    nextEscalationDate: firstEnglish,
    nextEscalationNepaliDate: firstISO,
    history: existing.history ?? [],
    lastEscalatedAt: existing.lastEscalatedAt ?? null,
    lastEscalatedNepaliDate: existing.lastEscalatedNepaliDate ?? null,
  };

  await tenant.save();
  return {
    success: true,
    message: "Rent escalation enabled",
    tenant,
    escalationSchedule: resolvedSchedule.map((step, i) => ({
      step: i + 1,
      label: step.label || `Step ${i + 1}`,
      intervalMonths: step.intervalMonths,
      percentageIncrease: step.percentageIncrease,
    })),
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
    { returnDocument: "after" },
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
