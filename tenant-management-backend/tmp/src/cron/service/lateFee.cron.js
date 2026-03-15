/**
 * lateFee.cron.js
 *
 * Applies / recalculates late fees on overdue rents according to the
 * active lateFeePolicy in SystemConfig.
 *
 * ─── When does this run? ────────────────────────────────────────────────────
 *
 *   Called from master-cron.js as step [3b], which runs every day at 00:00 NPT.
 *   The master cron calls this unconditionally — this module decides internally
 *   what to do based on the policy and each rent's state.
 *
 * ─── Flat fee (compounding: false) ─────────────────────────────────────────
 *
 *   Fee is calculated once on the first day past the grace period.
 *   lateFeeApplied is set to true → all subsequent runs skip this rent.
 *   The amount is fixed for the entire overdue period.
 *
 * ─── Compounding fee (compounding: true) ───────────────────────────────────
 *
 *   Fee is RECALCULATED on every daily run using:
 *     lateFeePaisa = overdueBalance × ((1 + dailyRate)^effectiveDaysLate − 1)
 *
 *   lateFeeApplied stays TRUE even for compounding (we use it as "first charge
 *   has been applied"), but the amount grows each day.
 *
 *   A separate flag lateFeeCompounding: true is set so downstream queries can
 *   distinguish "fixed charged" vs "daily growing".
 *
 *   Compounding stops once the rent is paid (status !== "overdue").
 *
 * ─── Idempotency ────────────────────────────────────────────────────────────
 *
 *   Flat:        lateFeeApplied = true → skip on re-run ✓
 *   Compounding: re-run recalculates (grows) — idempotent within same day
 *                because the formula is deterministic given daysLate.
 *
 * ─── Nepali date ────────────────────────────────────────────────────────────
 *
 *   All due date calculations use nepaliDueDate via diffNepaliDays().
 *   No English date arithmetic anywhere in this file.
 *
 * ─── Atomicity ──────────────────────────────────────────────────────────────
 *
 *   Each rent is processed in its own Mongoose session.
 *   A failure on one rent never rolls back others.
 *
 * ─── Double-entry journals ──────────────────────────────────────────────────
 *
 *   Initial charge:  DR Accounts Receivable / CR Late Fee Revenue
 *   Compounding update: same pair, with the DELTA amount (new − old)
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { Rent } from "../../modules/rents/rent.Model.js";
import { addLateFeeCharge } from "../../modules/rents/rent.domain.js";
import { SystemConfig } from "../../modules/systemConfig/SystemConfig.Model.js";
import { ledgerService } from "../../modules/ledger/ledger.service.js";
import { buildLateFeeJournal } from "../../modules/ledger/journal-builders/lateFee.js";
import { CronLog } from "../model/CronLog.js";
import {
  diffNepaliDays,
  getNepaliMonthDates,
  parseNepaliISO,
} from "../../utils/nepaliDateHelper.js";
// ─── Policy loader ────────────────────────────────────────────────────────────

async function loadLateFeePolicy() {
  const doc = await SystemConfig.findOne({ key: "lateFeePolicy" }).lean();

  if (!doc?.value?.enabled) {
    console.log("[lateFee.cron] lateFeePolicy disabled or missing — skipping");
    return null;
  }

  const {
    gracePeriodDays,
    type,
    amount,
    compounding,
    maxLateFeeAmount,
    appliesTo,
  } = doc.value;

  // Supported types:
  //   - "fixed"         → flat rupee amount
  //   - "percentage"    → one-time percentage of overdue balance
  //   - "simple_daily"  → percentage per day (linear growth)
  if (!["percentage", "fixed", "simple_daily"].includes(type)) {
    console.error(`[lateFee.cron] Unknown type "${type}" — skipping`);
    return null;
  }
  if (!amount || amount <= 0) {
    console.error(`[lateFee.cron] Invalid amount "${amount}" — skipping`);
    return null;
  }

  return {
    gracePeriodDays: Number(gracePeriodDays ?? 5),
    type,
    amount: Number(amount),
    compounding: Boolean(compounding),
    maxLateFeeAmount: Number(maxLateFeeAmount ?? 0),
    appliesTo: appliesTo ?? "rent",
  };
}

// ─── Days overdue (Nepali calendar) ──────────────────────────────────────────

/**
 * Calculate effective days late using the Nepali due date.
 * Grace period is subtracted so this returns 0 if still within grace.
 *
 * @param {Date|string} nepaliDueDate   — stored on the Rent document
 * @param {number}      gracePeriodDays
 * @returns {number}    effective days late (0 if within grace, never negative)
 * @throws {Error}      if nepaliDueDate is invalid or out of range for nepali-datetime
 */
function getEffectiveDaysLate(nepaliDueDate, gracePeriodDays) {
  if (nepaliDueDate == null) {
    throw new Error("nepaliDueDate is required");
  }

  // Parse the Nepali date string correctly
  const dueDateNp = new NepaliDate(nepaliDueDate);

  // Get today's Nepali date
  const todayNp = new NepaliDate();

  // Use your diffNepaliDays function
  const totalDaysLate = diffNepaliDays(dueDateNp, todayNp);

  console.log("dueDateNp", dueDateNp.toString());
  console.log("todayNp", todayNp.toString());
  console.log("totalDaysLate", totalDaysLate);

  if (totalDaysLate <= 0) return 0;
  return Math.max(0, totalDaysLate - gracePeriodDays);
}
// ─── Fee calculator (pure) ────────────────────────────────────────────────────

/**
 * Compute the total late fee for a given overdue balance and days late.
 * Pure function — no DB calls, easy to unit-test.
 *
 * Supported policy types:
 *
 *   "fixed"        — flat rupee amount charged once, never changes
 *                    e.g. amount=500 → Rs 500 always
 *
 *   "percentage"   — one-time percentage of the overdue balance, charged once
 *                    e.g. amount=2, balance=Rs1000 → Rs 20 always
 *
 *   "simple_daily" — percentage × days (simple interest, grows linearly)
 *                    e.g. amount=2, balance=Rs1000, day10 → Rs1000 × 2% × 10 = Rs200
 *                    Recalculated on every cron run, delta posted to journal
 *
 *   "compounding"  — daily compound interest (exponential growth)
 *   (percentage    e.g. amount=2, balance=Rs1000, day10 → Rs1000×((1.02)^10−1) = Rs219
 *    + compounding Recalculated on every cron run, delta posted to journal
 *    flag=true)
 *
 * @param {number} overdueAmountPaisa  — tenant's remaining rent balance
 * @param {number} effectiveDaysLate   — days past due AFTER grace period
 * @param {Object} policy              — from loadLateFeePolicy()
 * @returns {number}                   — total late fee in paisa (integer, >= 0)
 */
export function computeLateFee(overdueAmountPaisa, effectiveDaysLate, policy) {
  if (effectiveDaysLate <= 0 || overdueAmountPaisa <= 0) return 0;

  let feeInPaisa = 0;

  if (policy.type === "fixed") {
    // Flat rupee charge → paisa, once regardless of how many days late
    feeInPaisa = Math.round(policy.amount * 100);
  } else if (policy.type === "simple_daily") {
    // Simple interest: balance × dailyRate × effectiveDays
    // e.g. Rs 1,000 × 2% × 10 days = Rs 200
    feeInPaisa = Math.round(
      overdueAmountPaisa * (policy.amount / 100) * effectiveDaysLate,
    );
  } else if (policy.type === "percentage" && policy.compounding) {
    // Daily compound interest: P × ((1 + r)^d − 1)
    // e.g. Rs 1,000 × ((1.02)^10 − 1) = Rs 218.99
    const r = policy.amount / 100;
    feeInPaisa = Math.round(
      overdueAmountPaisa * (Math.pow(1 + r, effectiveDaysLate) - 1),
    );
  } else {
    // "percentage" flat — one-time charge, never grows
    // e.g. Rs 1,000 × 2% = Rs 20, charged once on day 1 past grace
    feeInPaisa = Math.round(overdueAmountPaisa * (policy.amount / 100));
  }

  // Apply rupee cap if configured (0 = no cap)
  if (policy.maxLateFeeAmount > 0) {
    feeInPaisa = Math.min(
      feeInPaisa,
      Math.round(policy.maxLateFeeAmount * 100),
    );
  }

  return Math.max(0, feeInPaisa);
}

/**
 * Returns true for policy types that grow over time and must be
 * recalculated on every daily cron run.
 *
 * @param {Object} policy
 * @returns {boolean}
 */
function isDailyGrowingPolicy(policy) {
  return (
    policy.type === "simple_daily" ||
    (policy.type === "percentage" && policy.compounding === true)
  );
}

// ─── Per-rent processor ───────────────────────────────────────────────────────

/**
 * Process a single overdue rent.
 *
 * ── Behaviour by policy type ────────────────────────────────────────────────
 *
 *  "fixed" / "percentage" (flat):
 *    Charged exactly ONCE on the first cron run past the grace period.
 *    lateFeeApplied = true after first charge → all subsequent runs skip.
 *    Fee never changes.
 *
 *  "simple_daily":
 *    Fee = balance × rate% × effectiveDays  (linear growth).
 *    Recalculated on EVERY daily run.
 *    Journal posts the DELTA (today's total − yesterday's total).
 *    Example: Rs 1,000 @ 2%/day → Rs 20 day1, Rs 40 day2, Rs 60 day3 …
 *
 *  "percentage" + compounding=true:
 *    Fee = balance × ((1+r)^d − 1)  (exponential growth).
 *    Recalculated on EVERY daily run.
 *    Journal posts the DELTA.
 *
 * @returns {{ skipped: boolean, reason?: string, deltaFeePaisa?: number }}
 */
async function processOneRent(rent, policy, adminId) {
  // ── Policy scope check ──────────────────────────────────────────────────
  if (policy.appliesTo === "cam") {
    return { skipped: true, reason: "policy appliesTo=cam" };
  }

  // ── Days late (Nepali calendar) ─────────────────────────────────────────
  const effectiveDaysLate = getEffectiveDaysLate(
    rent.nepaliDueDate,
    policy.gracePeriodDays,
  );
  if (effectiveDaysLate <= 0) {
    return {
      skipped: true,
      reason: `within grace period (grace=${policy.gracePeriodDays}d Nepali)`,
    };
  }

  // ── One-time fee types: skip if already charged ─────────────────────────
  // simple_daily and compounding grow daily → never skip after first charge.
  // fixed and flat percentage are charged once → skip on all subsequent runs.
  if (!isDailyGrowingPolicy(policy) && rent.lateFeeApplied) {
    return {
      skipped: true,
      reason: `${policy.type} fee already applied (one-time)`,
    };
  }

  // ── Outstanding rent balance ────────────────────────────────────────────
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const overdueAmountPaisa = Math.max(
    0,
    effectiveRentPaisa - rent.paidAmountPaisa,
  );

  if (overdueAmountPaisa === 0) {
    return { skipped: true, reason: "no outstanding rent balance" };
  }

  // ── Compute new TOTAL fee for this rent as of today ────────────────────
  const newTotalFeePaisa = computeLateFee(
    overdueAmountPaisa,
    effectiveDaysLate,
    policy,
  );
  if (newTotalFeePaisa <= 0) {
    return { skipped: true, reason: "computed fee is zero" };
  }

  const previousFeePaisa = rent.lateFeePaisa || 0;
  const deltaFeePaisa = newTotalFeePaisa - previousFeePaisa;

  // Daily-growing policies: skip same-day re-runs (delta would be 0)
  if (isDailyGrowingPolicy(policy) && deltaFeePaisa <= 0) {
    return {
      skipped: true,
      reason: "fee unchanged since last run (same day re-run)",
    };
  }

  // ── Journal amount ─────────────────────────────────────────────────────
  // One-time types  → journal the full amount (delta = newTotal since previous was 0)
  // Daily-growing   → journal only the delta to avoid double-booking
  const journalAmountPaisa = isDailyGrowingPolicy(policy)
    ? deltaFeePaisa
    : newTotalFeePaisa;

  const lateFeeDoc = {
    _id: new mongoose.Types.ObjectId(),
    amountPaisa: journalAmountPaisa,
    nepaliMonth: rent.nepaliMonth,
    nepaliYear: rent.nepaliYear,
    nepaliDate: new Date(),
    chargedAt: new Date(),
    createdBy: adminId ?? null,
    tenant: rent.tenant,
    property: rent.property,
    daysOverdue: effectiveDaysLate,
    originalRentId: rent._id,
  };

  const journalPayload = buildLateFeeJournal(lateFeeDoc);

  // ── Atomic: update rent + post journal ─────────────────────────────────
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // addLateFeeCharge accumulates — always pass the delta
    addLateFeeCharge(rent, deltaFeePaisa, new Date());

    // Tag so dashboards can distinguish daily-growing rents
    if (isDailyGrowingPolicy(policy)) {
      rent.lateFeeCompounding = true;
    }

    await rent.save({ session });
    await ledgerService.postJournalEntry(journalPayload, session);
    await session.commitTransaction();

    return { skipped: false, deltaFeePaisa, newTotalFeePaisa };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Apply / recalculate late fees on all eligible overdue rents.
 *
 * Called from master-cron.js step [3b] every day.
 *
 * @param {string} [adminId]
 * @returns {Promise<CronResult>}
 */
export async function applyLateFees(adminId) {
  const resolvedAdminId = adminId ?? process.env.SYSTEM_ADMIN_ID ?? null;
  const startedAt = new Date();

  console.log("\n  💸 [lateFee.cron] Starting late fee run...");

  // ── 1. Load policy ───────────────────────────────────────────────────────
  const policy = await loadLateFeePolicy();

  if (!policy) {
    return {
      success: true,
      message: "Late fee policy disabled — no fees applied",
      processed: 0,
      skipped: 0,
      failed: 0,
      totalDeltaFeePaisa: 0,
      errors: [],
    };
  }

  const policyLabel =
    policy.type === "simple_daily"
      ? `simple daily ${policy.amount}%/day`
      : policy.type === "percentage" && policy.compounding
        ? `compound ${policy.amount}%/day`
        : policy.type === "percentage"
          ? `flat ${policy.amount}% once`
          : /* fixed */ `fixed Rs${policy.amount}`;

  console.log(
    `       → Policy: ${policyLabel}` +
      `, grace=${policy.gracePeriodDays}d (Nepali)` +
      (policy.maxLateFeeAmount > 0 ? `, cap=Rs${policy.maxLateFeeAmount}` : ""),
  );

  // ── 2. Fetch eligible rents ──────────────────────────────────────────────
  //   Daily-growing (simple_daily / compounding):
  //     Query ALL overdue rents — recalculate every day regardless of lateFeeApplied.
  //   One-time (fixed / flat percentage):
  //     Query only rents where lateFeeApplied is not yet true.
  const growingPolicy = isDailyGrowingPolicy(policy);
  const query = growingPolicy
    ? { status: "overdue" }
    : { status: "overdue", lateFeeApplied: { $ne: true } };

  const overdueRents = await Rent.find(query)
    .populate("tenant", "name email")
    .populate("property", "name");

  if (!overdueRents.length) {
    console.log("       → No eligible overdue rents");
    return {
      success: true,
      message: "No overdue rents eligible for late fee",
      processed: 0,
      skipped: 0,
      failed: 0,
      totalDeltaFeePaisa: 0,
      errors: [],
    };
  }

  console.log(`       → ${overdueRents.length} overdue rent(s) found`);

  // ── 3. Process each rent ─────────────────────────────────────────────────
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalDeltaFeePaisa = 0;
  const errors = [];

  for (const rent of overdueRents) {
    try {
      const result = await processOneRent(rent, policy, resolvedAdminId);

      if (result.skipped) {
        skipped++;
        console.log(`       ↷ Skipped ${rent._id}: ${result.reason}`);
      } else {
        processed++;
        totalDeltaFeePaisa += result.deltaFeePaisa;
        console.log(
          `       ✓ ${rent.tenant?.name ?? rent._id} — ` +
            `delta Rs${(result.deltaFeePaisa / 100).toFixed(2)}, ` +
            `total fee Rs${(result.newTotalFeePaisa / 100).toFixed(2)}`,
        );
      }
    } catch (err) {
      failed++;
      errors.push({ rentId: rent._id.toString(), error: err.message });
      console.error(`       ✗ Failed ${rent._id}:`, err.message);
    }
  }

  // ── 4. Log to CronLog ────────────────────────────────────────────────────
  const message =
    `Late fees: ${processed} charged/updated ` +
    `(Rs${(totalDeltaFeePaisa / 100).toFixed(2)} delta), ` +
    `${skipped} skipped, ${failed} failed`;

  try {
    await CronLog.create({
      type: "LATE_FEE_APPLICATION",
      ranAt: startedAt,
      message,
      count: processed,
      success: failed === 0,
      error: errors.length
        ? errors.map((e) => `${e.rentId}: ${e.error}`).join(" | ")
        : null,
    });
  } catch (logErr) {
    console.error("[lateFee.cron] CronLog write failed:", logErr.message);
  }

  console.log(`       → ${message}`);

  return {
    success: true,
    message,
    processed,
    skipped,
    failed,
    totalDeltaFeePaisa,
    errors: errors.length ? errors : undefined,
  };
}
