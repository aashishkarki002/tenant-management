/**
 * rentDeferral.cron.js
 *
 * Month-end deferral recognition job.
 *
 * Runs on Day 1 of each Nepali month, processing the PREVIOUS month's
 * pending periods for all active RentDeferralSchedules.
 *
 * Idempotency guarantees:
 *   1. period.status === "processed" guard — skips already-processed periods
 *   2. postJournalEntry Transaction idempotency guard — prevents duplicate journals
 *      even if the cron runs twice (duplicate = true is logged, not thrown)
 *
 * Backfill support:
 *   Processes ALL pending periods up to (and including) targetNepaliYear/Month.
 *   If the cron missed 3 months, it catches up on next run.
 *
 * @param {Object}             options
 * @param {number}             options.targetNepaliYear   Period to recognize (BS)
 * @param {number}             options.targetNepaliMonth  Period to recognize (BS, 1-12)
 * @param {string|ObjectId}    [options.entityId]         Scope to one entity; omit = all
 * @param {string|ObjectId}    [options.createdBy]        Admin ID for audit trail
 *
 * @returns {Promise<{
 *   processed: number,
 *   skipped:   number,
 *   duplicates:number,
 *   failed:    number,
 *   errors:    Array<{scheduleId, tenantId, periodId, error}>,
 *   schedulesCompleted: number,
 * }>}
 */

import mongoose from "mongoose";
import { RentDeferralSchedule } from "../../modules/rentDeferral/RentDeferralSchedule.Model.js";
import { recognizePeriod } from "../../modules/rentDeferral/rentDeferral.service.js";

export async function runRentDeferralCron({
  targetNepaliYear,
  targetNepaliMonth,
  entityId = null,
  createdBy = null,
} = {}) {
  if (!targetNepaliYear || !targetNepaliMonth)
    throw new Error("runRentDeferralCron: targetNepaliYear and targetNepaliMonth are required");
  if (targetNepaliMonth < 1 || targetNepaliMonth > 12)
    throw new Error("runRentDeferralCron: targetNepaliMonth must be 1–12");

  const recognitionDate = new Date();

  // Load all active schedules (with embedded periods)
  const filter = { status: "active" };
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));

  const schedules = await RentDeferralSchedule.find(filter).lean();

  let processed    = 0;
  let skipped      = 0;
  let duplicates   = 0;
  let failed       = 0;
  const errors     = [];
  let schedulesCompleted = 0;

  for (const scheduleData of schedules) {
    // Find all PENDING periods that are on or before the target period
    const pendingPeriodsToProcess = scheduleData.periods.filter((p) => {
      if (p.status !== "pending") return false;
      // Include if period is <= target
      return (
        p.nepaliYear < targetNepaliYear ||
        (p.nepaliYear === targetNepaliYear && p.nepaliMonth <= targetNepaliMonth)
      );
    });

    if (!pendingPeriodsToProcess.length) continue;

    for (const period of pendingPeriodsToProcess) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Re-fetch the schedule inside the session so updates are visible
        const schedule = await RentDeferralSchedule.findById(scheduleData._id).session(session);

        // Re-locate the period in the live document
        const livePeriod = schedule.periods.id(period._id);
        if (!livePeriod || livePeriod.status !== "pending") {
          // Already processed by a concurrent run
          await session.abortTransaction();
          skipped++;
          continue;
        }

        const result = await recognizePeriod(
          schedule,
          livePeriod,
          recognitionDate,
          createdBy,
          session,
        );

        await session.commitTransaction();

        if (result.skipped) {
          skipped++;
        } else if (result.duplicate) {
          duplicates++;
        } else {
          processed++;
        }
      } catch (err) {
        await session.abortTransaction();
        failed++;
        errors.push({
          scheduleId: String(scheduleData._id),
          tenantId:   String(scheduleData.tenantId),
          periodId:   String(period._id),
          period:     `${period.nepaliYear}/${String(period.nepaliMonth).padStart(2, "0")}`,
          error:      err.message,
        });
      } finally {
        session.endSession();
      }
    }

    // Mark schedule "completed" if all periods are now processed/skipped
    const refreshed = await RentDeferralSchedule.findById(scheduleData._id).lean();
    const allDone = refreshed?.periods.every(
      (p) => p.status === "processed" || p.status === "skipped",
    );
    if (allDone && refreshed?.status === "active") {
      await RentDeferralSchedule.findByIdAndUpdate(scheduleData._id, {
        $set: { status: "completed" },
      });
      schedulesCompleted++;
    }
  }

  return {
    processed,
    skipped,
    duplicates,
    failed,
    errors,
    schedulesCompleted,
    targetPeriod: `${targetNepaliYear}/${String(targetNepaliMonth).padStart(2, "0")}`,
  };
}
