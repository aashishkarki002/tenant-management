/**
 * rentDeferral.service.js
 *
 * Orchestrates the upfront-billing + accrual deferral accounting cycle:
 *
 *   createOnboardingSchedule()  — called at tenant onboarding (or admin action)
 *   recognizePeriod()           — called by month-end cron for each pending period
 *   terminateSchedule()         — called on early lease termination
 *   getScheduleForTenant()      — read-only helper
 *   computeLeaseSchedule()      — exported pure utility (deterministic, no DB)
 *
 * Idempotency:
 *   - createOnboardingSchedule: rejects if active schedule already exists for tenant
 *   - Journal posting: inherited from postJournalEntry's Transaction guard
 *   - recognizePeriod: period.status === "processed" guard + journal idempotency
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { RentDeferralSchedule } from "./RentDeferralSchedule.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildOnboardingJournal,
  buildInitialDeferralJournal,
  buildDeferralRecognitionJournal,
} from "../ledger/journal-builders/rentDeferral.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// PRORATION UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute prorated monthly schedule for a lease using Bikram Sambat calendar.
 *
 * Pure function — no DB calls, deterministic, safe to call multiple times.
 *
 * @param {Date}   leaseStartDate      AD Date (day tenant occupies space)
 * @param {Date}   leaseEndDate        AD Date (last day of lease)
 * @param {number} monthlyRentPaisa    Integer
 * @param {number} [monthlyCamPaisa]   Integer, default 0
 * @returns {Array<{
 *   nepaliYear, nepaliMonth, daysInMonth, daysOccupied,
 *   earnedRentPaisa, earnedCamPaisa
 * }>}  One entry per BS month within the lease
 */
export function computeLeaseSchedule(
  leaseStartDate,
  leaseEndDate,
  monthlyRentPaisa,
  monthlyCamPaisa = 0,
) {
  if (!Number.isInteger(monthlyRentPaisa) || monthlyRentPaisa <= 0)
    throw new Error("computeLeaseSchedule: monthlyRentPaisa must be a positive integer");
  if (!Number.isInteger(monthlyCamPaisa) || monthlyCamPaisa < 0)
    throw new Error("computeLeaseSchedule: monthlyCamPaisa must be a non-negative integer");

  const startBS = new NepaliDate(leaseStartDate);
  const endBS   = new NepaliDate(leaseEndDate);

  let curYear   = startBS.getYear();
  let curMonth0 = startBS.getMonth(); // 0-indexed (0=Baisakh, 11=Chaitra)
  const endYear   = endBS.getYear();
  const endMonth0 = endBS.getMonth();

  const periods = [];

  while (curYear < endYear || (curYear === endYear && curMonth0 <= endMonth0)) {
    const totalDays = NepaliDate.getDaysOfMonth(curYear, curMonth0);
    const isFirst   = curYear === startBS.getYear() && curMonth0 === startBS.getMonth();
    const isLast    = curYear === endYear && curMonth0 === endMonth0;

    const firstDay    = isFirst ? startBS.getDate() : 1;
    const lastDay     = isLast  ? endBS.getDate()   : totalDays;
    const daysOccupied = lastDay - firstDay + 1;

    periods.push({
      nepaliYear:      curYear,
      nepaliMonth:     curMonth0 + 1, // 1-indexed
      daysInMonth:     totalDays,
      daysOccupied,
      earnedRentPaisa: Math.round((daysOccupied / totalDays) * monthlyRentPaisa),
      earnedCamPaisa:  Math.round((daysOccupied / totalDays) * monthlyCamPaisa),
    });

    curMonth0++;
    if (curMonth0 >= 12) { curMonth0 = 0; curYear++; }
  }

  return periods;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a RentDeferralSchedule and post the two onboarding journals.
 *
 * Call this once when setting up deferral accounting for a tenant.
 * Throws if an active schedule already exists for this tenant.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.entityId
 * @param {string|ObjectId} params.tenantId
 * @param {Date}            params.postingDate   Admin-chosen accounting date (NOT createdAt)
 * @param {Date}            [params.leaseStartDate]  Defaults to tenant.leaseStartDate
 * @param {Date}            [params.leaseEndDate]    Defaults to tenant.leaseEndDate
 * @param {number}          [params.monthlyRentPaisa] Defaults to tenant.totalRentPaisa
 * @param {number}          [params.monthlyCamPaisa]  Defaults to tenant.camChargesPaisa
 * @param {string|ObjectId} [params.createdBy]
 *
 * @returns {Promise<{ schedule, onboardingTransaction, deferralTransaction|null }>}
 */
export async function createOnboardingSchedule({
  entityId,
  tenantId,
  postingDate,
  leaseStartDate,
  leaseEndDate,
  monthlyRentPaisa,
  monthlyCamPaisa,
  createdBy,
}) {
  if (!entityId)  throw new Error("createOnboardingSchedule: entityId is required");
  if (!tenantId)  throw new Error("createOnboardingSchedule: tenantId is required");
  if (!postingDate || !(postingDate instanceof Date))
    throw new Error("createOnboardingSchedule: postingDate must be a valid Date");

  // ── Guard: prevent duplicate active schedules ──────────────────────────────
  const existing = await RentDeferralSchedule.findOne({
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    status: "active",
  }).lean();

  if (existing) {
    throw new Error(
      `Tenant ${tenantId} already has an active RentDeferralSchedule (${existing._id}). ` +
      `Terminate the existing schedule before creating a new one.`,
    );
  }

  // ── Resolve tenant fields if not explicitly provided ──────────────────────
  const tenant = await Tenant.findById(tenantId)
    .select("name property leaseStartDate leaseEndDate totalRentPaisa camChargesPaisa")
    .lean();
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const resolvedLeaseStart   = leaseStartDate  ?? tenant.leaseStartDate;
  const resolvedLeaseEnd     = leaseEndDate    ?? tenant.leaseEndDate;
  const resolvedRentPaisa    = monthlyRentPaisa ?? tenant.totalRentPaisa;
  const resolvedCamPaisa     = monthlyCamPaisa  ?? tenant.camChargesPaisa ?? 0;

  if (!resolvedLeaseStart || !resolvedLeaseEnd)
    throw new Error("createOnboardingSchedule: leaseStartDate and leaseEndDate are required");
  if (resolvedLeaseEnd <= resolvedLeaseStart)
    throw new Error("createOnboardingSchedule: leaseEndDate must be after leaseStartDate");

  // ── Compute schedule ───────────────────────────────────────────────────────
  const periods = computeLeaseSchedule(
    resolvedLeaseStart,
    resolvedLeaseEnd,
    resolvedRentPaisa,
    resolvedCamPaisa,
  );

  if (!periods.length) throw new Error("Lease schedule produced zero periods — check lease dates");

  const totalLeaseRentPaisa = periods.reduce((s, p) => s + p.earnedRentPaisa, 0);
  const totalLeaseCamPaisa  = periods.reduce((s, p) => s + p.earnedCamPaisa,  0);

  // ── Determine "current" period at posting date ────────────────────────────
  const postingBS     = new NepaliDate(postingDate);
  const postingBSYear  = postingBS.getYear();
  const postingBSMonth = postingBS.getMonth() + 1; // 1-indexed

  // Mark past and current periods as "processed" (income is booked in onboarding journal).
  // Future periods stay "pending" — the cron recognizes them month by month.
  const now = new Date();
  for (const p of periods) {
    const isPastOrCurrent =
      p.nepaliYear < postingBSYear ||
      (p.nepaliYear === postingBSYear && p.nepaliMonth <= postingBSMonth);
    if (isPastOrCurrent) {
      p.status      = "processed";
      p.processedAt = now;
    }
  }

  // Unearned = all future (pending) periods
  const unearnedRentPaisa = periods
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.earnedRentPaisa, 0);
  const unearnedCamPaisa  = periods
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.earnedCamPaisa,  0);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── Create RentDeferralSchedule ──────────────────────────────────────────
    const [schedule] = await RentDeferralSchedule.create(
      [
        {
          entityId,
          tenantId,
          propertyId: tenant.property ?? null,
          leaseStartDate:   resolvedLeaseStart,
          leaseEndDate:     resolvedLeaseEnd,
          leaseStartNepali: formatNepaliISO(new NepaliDate(resolvedLeaseStart)),
          leaseEndNepali:   formatNepaliISO(new NepaliDate(resolvedLeaseEnd)),
          monthlyRentPaisa: resolvedRentPaisa,
          monthlyCamPaisa:  resolvedCamPaisa,
          totalLeaseRentPaisa,
          totalLeaseCamPaisa,
          postingDate,
          postingNepaliDate:  formatNepaliISO(postingBS),
          postingNepaliMonth: postingBSMonth,
          postingNepaliYear:  postingBSYear,
          status: "active",
          periods,
          createdBy: createdBy ?? null,
        },
      ],
      { session },
    );

    // ── Journal 1: Onboarding (full lease AR + revenue) ──────────────────────
    const onboardingPayload = buildOnboardingJournal({
      scheduleId:          schedule._id,
      tenantId,
      tenantName:          tenant.name,
      propertyId:          tenant.property,
      entityId,
      totalLeaseRentPaisa,
      totalLeaseCamPaisa,
      postingDate,
      nepaliMonth:         postingBSMonth,
      nepaliYear:          postingBSYear,
      createdBy,
    });

    const { transaction: onboardingTx } = await ledgerService.postJournalEntry(
      onboardingPayload,
      session,
      entityId,
    );

    let deferralTx = null;

    // ── Journal 2: Initial deferral (only if there are future periods) ───────
    if (unearnedRentPaisa + unearnedCamPaisa > 0) {
      const deferralPayload = buildInitialDeferralJournal({
        scheduleId:        schedule._id,
        tenantId,
        tenantName:        tenant.name,
        propertyId:        tenant.property,
        entityId,
        unearnedRentPaisa,
        unearnedCamPaisa,
        postingDate,
        nepaliMonth:       postingBSMonth,
        nepaliYear:        postingBSYear,
        createdBy,
      });

      const { transaction: defTx } = await ledgerService.postJournalEntry(
        deferralPayload,
        session,
        entityId,
      );
      deferralTx = defTx;
    }

    // ── Record transaction IDs on schedule ───────────────────────────────────
    await RentDeferralSchedule.findByIdAndUpdate(
      schedule._id,
      {
        $set: {
          onboardingTransactionId:     onboardingTx._id,
          initialDeferralTransactionId: deferralTx?._id ?? null,
        },
      },
      { session },
    );

    await session.commitTransaction();

    return {
      schedule:              schedule.toObject(),
      onboardingTransaction: onboardingTx,
      deferralTransaction:   deferralTx,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH-END RECOGNITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recognize earned revenue for a single period on a single schedule.
 *
 * Idempotent: returns early if period.status === "processed".
 * Also protected by postJournalEntry's Transaction guard on (type, referenceId).
 *
 * @param {Object}             schedule      RentDeferralSchedule document (Mongoose)
 * @param {Object}             period        Period subdoc from schedule.periods
 * @param {Date}               recognitionDate
 * @param {string|ObjectId}    createdBy
 * @param {mongoose.ClientSession} session
 *
 * @returns {Promise<{ skipped: boolean, transaction?: Transaction }>}
 */
export async function recognizePeriod(schedule, period, recognitionDate, createdBy, session) {
  if (period.status === "processed") return { skipped: true };
  if (period.status === "skipped")   return { skipped: true };

  const totalEarned = period.earnedRentPaisa + period.earnedCamPaisa;
  if (totalEarned <= 0) {
    // Zero-value period — skip silently
    await RentDeferralSchedule.updateOne(
      { _id: schedule._id, "periods._id": period._id },
      { $set: { "periods.$.status": "skipped", "periods.$.processedAt": new Date() } },
      { session },
    );
    return { skipped: true };
  }

  const tenant = await Tenant.findById(schedule.tenantId)
    .select("name property")
    .session(session)
    .lean();

  const payload = buildDeferralRecognitionJournal({
    periodId:        period._id,
    tenantId:        schedule.tenantId,
    tenantName:      tenant?.name,
    propertyId:      schedule.propertyId ?? tenant?.property,
    entityId:        schedule.entityId,
    earnedRentPaisa: period.earnedRentPaisa,
    earnedCamPaisa:  period.earnedCamPaisa,
    nepaliMonth:     period.nepaliMonth,
    nepaliYear:      period.nepaliYear,
    recognitionDate,
    createdBy,
  });

  const { transaction, duplicate } = await ledgerService.postJournalEntry(
    payload,
    session,
    schedule.entityId,
  );

  // Mark period processed (even on duplicate — state should reflect reality)
  await RentDeferralSchedule.updateOne(
    { _id: schedule._id, "periods._id": period._id },
    {
      $set: {
        "periods.$.status":             "processed",
        "periods.$.processedAt":        new Date(),
        "periods.$.rentTransactionId":  transaction._id,
      },
    },
    { session },
  );

  return { skipped: false, duplicate: duplicate ?? false, transaction };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE TERMINATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a schedule as terminated and skip all remaining pending periods.
 *
 * Does NOT post reversal journals — the caller is responsible for any
 * write-off or refund accounting (e.g. buildBadDebtWriteoffJournal).
 *
 * @param {string|ObjectId} scheduleId
 * @param {string|ObjectId} [terminatedBy]
 * @returns {Promise<RentDeferralSchedule>}
 */
export async function terminateSchedule(scheduleId, terminatedBy = null) {
  const schedule = await RentDeferralSchedule.findById(scheduleId);
  if (!schedule) throw new Error(`RentDeferralSchedule ${scheduleId} not found`);
  if (schedule.status !== "active")
    throw new Error(`Schedule ${scheduleId} is already ${schedule.status}`);

  const now = new Date();
  for (const p of schedule.periods) {
    if (p.status === "pending") {
      p.status      = "skipped";
      p.processedAt = now;
    }
  }
  schedule.status = "terminated";
  await schedule.save();
  return schedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the active deferral schedule for a tenant.
 *
 * @param {string|ObjectId} tenantId
 * @returns {Promise<RentDeferralSchedule|null>}
 */
export async function getScheduleForTenant(tenantId) {
  return RentDeferralSchedule.findOne({
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    status: "active",
  })
    .populate("tenantId", "name email")
    .lean();
}

/**
 * Get all active schedules for an entity (used by the cron to find who to process).
 *
 * @param {string|ObjectId} entityId
 * @returns {Promise<RentDeferralSchedule[]>}
 */
export async function getActiveSchedules(entityId) {
  const filter = { status: "active" };
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
  return RentDeferralSchedule.find(filter).lean();
}
