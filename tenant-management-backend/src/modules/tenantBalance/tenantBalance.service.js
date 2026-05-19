/**
 * tenant-balance.service.js
 *
 * Two public exports:
 *
 *   syncTenantBalance(tenantId, session?)
 *     Called inside every service that mutates money (payment, cron charge,
 *     advance rent receipt/recognition).
 *     Runs aggregations against Rent, CAM, and AdvanceRent and upserts one
 *     document.  Must receive the active Mongoose session so the snapshot
 *     stays consistent with the mutation that triggered it.
 *
 *   rebuildAllTenantBalances()
 *     Sessionless batch rebuild.  Run once after deployment, or nightly as a
 *     reconciliation guard.  Safe to call at any time.
 *
 * ── advancePaisa semantics ────────────────────────────────────────────────────
 *
 *   advancePaisa = sum of (amountPaisa - recognizedAmountPaisa) across all
 *   ACTIVE AdvanceRent documents for the tenant.
 *
 *   totalDuePaisa = max(0, rentDue + camDue + lateFeeDue - advancePaisa)
 *
 *   A tenant who paid advance equal to or greater than their outstanding dues
 *   will show totalDuePaisa = 0 (never negative).
 */

import mongoose from "mongoose";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";
import { AdvanceRent } from "../advanceRent/AdvanceRent.Model.js";
import { Electricity } from "../electricity/Electricity.Model.js";
import { TenantBalance } from "./tenantBalance.model.js";

const OPEN_STATUSES = ["pending", "partially_paid", "overdue"];

// ── Aggregation helpers ───────────────────────────────────────────────────────

function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(String(id));
}

/**
 * Returns { rentDuePaisa, lateFeeDuePaisa, oldestYear, oldestMonth }
 */
async function aggregateRent(tenantId, session) {
  const [row] = await Rent.aggregate([
    { $match: { tenant: toObjectId(tenantId), status: { $in: OPEN_STATUSES } } },
    {
      $group: {
        _id: null,
        rentDuePaisa: {
          $sum: {
            $subtract: [
              {
                $subtract: [
                  "$grossRentAmountPaisa",
                  { $ifNull: ["$tdsAmountPaisa", 0] },
                ],
              },
              "$paidAmountPaisa",
            ],
          },
        },
        lateFeeDuePaisa: {
          $sum: {
            $subtract: [
              { $ifNull: ["$lateFeePaisa", 0] },
              { $ifNull: ["$latePaidAmountPaisa", 0] },
            ],
          },
        },
        oldestYear: { $min: "$nepaliYear" },
        oldestMonth: { $min: "$nepaliMonth" },
      },
    },
  ]).session(session ?? null);

  return {
    rentDuePaisa: Math.max(0, Math.round(row?.rentDuePaisa ?? 0)),
    lateFeeDuePaisa: Math.max(0, Math.round(row?.lateFeeDuePaisa ?? 0)),
    oldestYear: row?.oldestYear ?? null,
    oldestMonth: row?.oldestMonth ?? null,
  };
}

/**
 * Returns { camDuePaisa }
 */
async function aggregateCam(tenantId, session) {
  const [row] = await Cam.aggregate([
    { $match: { tenant: toObjectId(tenantId), status: { $in: OPEN_STATUSES } } },
    {
      $group: {
        _id: null,
        camDuePaisa: {
          $sum: { $subtract: ["$amountPaisa", "$paidAmountPaisa"] },
        },
      },
    },
  ]).session(session ?? null);

  return { camDuePaisa: Math.max(0, Math.round(row?.camDuePaisa ?? 0)) };
}

/**
 * Returns { advancePaisa }
 *
 * Sums unrecognized advance from all ACTIVE AdvanceRent documents:
 *   unrecognized = amountPaisa - recognizedAmountPaisa
 */
async function aggregateAdvance(tenantId, session) {
  const [row] = await AdvanceRent.aggregate([
    {
      $match: {
        tenant: toObjectId(tenantId),
        status: "ACTIVE",
      },
    },
    {
      $group: {
        _id: null,
        advancePaisa: {
          $sum: { $subtract: ["$amountPaisa", "$recognizedAmountPaisa"] },
        },
      },
    },
  ]).session(session ?? null);

  return { advancePaisa: Math.max(0, Math.round(row?.advancePaisa ?? 0)) };
}

/**
 * Returns { electricityDuePaisa }
 */
async function aggregateElectricity(tenantId, session) {
  const [row] = await Electricity.aggregate([
    {
      $match: {
        tenant: toObjectId(tenantId),
        billTo: "tenant",
        status: { $in: OPEN_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        electricityDuePaisa: {
          $sum: { $subtract: ["$totalAmountPaisa", "$paidAmountPaisa"] },
        },
      },
    },
  ]).session(session ?? null);

  return { electricityDuePaisa: Math.max(0, Math.round(row?.electricityDuePaisa ?? 0)) };
}

/**
 * Count consecutive unpaid months walking backwards from the most recent open month.
 */
async function computeConsecutiveUnpaidMonths(tenantId, session) {
  const openMonths = await Rent.aggregate([
    { $match: { tenant: toObjectId(tenantId), status: { $in: OPEN_STATUSES } } },
    { $group: { _id: { year: "$nepaliYear", month: "$nepaliMonth" } } },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
  ]).session(session ?? null);

  if (openMonths.length === 0) return 0;

  const monthSet = new Set(openMonths.map(({ _id }) => _id.year * 12 + _id.month));
  let count = 0;
  let y = openMonths[0]._id.year;
  let m = openMonths[0]._id.month;

  while (monthSet.has(y * 12 + m)) {
    count++;
    m--;
    if (m === 0) { m = 12; y--; }
  }

  return count;
}

// ── Public: single-tenant sync ────────────────────────────────────────────────

/**
 * Recompute and upsert the TenantBalance snapshot for one tenant.
 *
 * Call at the END of every service that mutates money, BEFORE committing:
 *
 *   await syncTenantBalance(tenantId, session);
 *   await session.commitTransaction();
 *
 * @param {string|mongoose.Types.ObjectId} tenantId
 * @param {mongoose.ClientSession|null} [session]
 */
export async function syncTenantBalance(tenantId, session = null) {
  const [rentData, camData, advanceData, electricityData, consecutiveUnpaidMonths] = await Promise.all([
    aggregateRent(tenantId, session),
    aggregateCam(tenantId, session),
    aggregateAdvance(tenantId, session),
    aggregateElectricity(tenantId, session),
    computeConsecutiveUnpaidMonths(tenantId, session),
  ]);

  const { rentDuePaisa, lateFeeDuePaisa, oldestYear, oldestMonth } = rentData;
  const { camDuePaisa } = camData;
  const { advancePaisa } = advanceData;
  const { electricityDuePaisa } = electricityData;

  const grossDuePaisa = rentDuePaisa + camDuePaisa + lateFeeDuePaisa + electricityDuePaisa;
  const totalDuePaisa = Math.max(0, grossDuePaisa - advancePaisa);

  await TenantBalance.findOneAndUpdate(
    { tenant: tenantId },
    {
      $set: {
        rentDuePaisa,
        camDuePaisa,
        lateFeeDuePaisa,
        electricityDuePaisa,
        advancePaisa,
        totalDuePaisa,
        consecutiveUnpaidMonths,
        oldestOverdueNepaliYear: oldestYear,
        oldestOverdueNepaliMonth: oldestMonth,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true, new: true, session: session ?? undefined },
  );

  return { rentDuePaisa, camDuePaisa, lateFeeDuePaisa, electricityDuePaisa, advancePaisa, totalDuePaisa };
}

// ── Public: batch rebuild (no session — used by cron / backfill) ──────────────

/**
 * Rebuild TenantBalance for ALL tenants that have at least one open
 * Rent, CAM, or ACTIVE AdvanceRent document.
 *
 * @returns {{ processed: number, errors: number }}
 */
export async function rebuildAllTenantBalances() {
  console.log("[tenantBalance] Starting full rebuild...");

  const [rentTenants, camTenants, advanceTenants, elecTenants] = await Promise.all([
    Rent.distinct("tenant", { status: { $in: OPEN_STATUSES } }),
    Cam.distinct("tenant", { status: { $in: OPEN_STATUSES } }),
    AdvanceRent.distinct("tenant", { status: "ACTIVE" }),
    Electricity.distinct("tenant", { billTo: "tenant", status: { $in: OPEN_STATUSES }, tenant: { $ne: null } }),
  ]);

  const tenantIdSet = new Set([
    ...rentTenants.map((id) => id.toString()),
    ...camTenants.map((id) => id.toString()),
    ...advanceTenants.map((id) => id.toString()),
    ...elecTenants.map((id) => id.toString()),
  ]);

  const tenantIds = [...tenantIdSet];
  let processed = 0;
  let errors = 0;

  const BATCH = 50;
  for (let i = 0; i < tenantIds.length; i += BATCH) {
    const batch = tenantIds.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (tenantId) => {
        try {
          await syncTenantBalance(tenantId, null);
          processed++;
        } catch (err) {
          errors++;
          console.error(`[tenantBalance] rebuild failed for ${tenantId}:`, err.message);
        }
      }),
    );
  }

  // Zero out balances for tenants who no longer have any open docs or active advance
  const allActiveTenants = [...rentTenants, ...camTenants, ...advanceTenants, ...elecTenants];

  await TenantBalance.updateMany(
    {
      tenant: { $nin: allActiveTenants },
      $or: [{ totalDuePaisa: { $gt: 0 } }, { advancePaisa: { $gt: 0 } }],
    },
    {
      $set: {
        rentDuePaisa: 0,
        camDuePaisa: 0,
        lateFeeDuePaisa: 0,
        electricityDuePaisa: 0,
        advancePaisa: 0,
        totalDuePaisa: 0,
        oldestOverdueNepaliYear: null,
        oldestOverdueNepaliMonth: null,
        lastSyncedAt: new Date(),
      },
    },
  );

  console.log(`[tenantBalance] Rebuild done: ${processed} synced, ${errors} errors`);
  return { processed, errors };
}

// ── Public: single-tenant read ────────────────────────────────────────────────

/**
 * O(1) fast read — no aggregation.
 * Used by payment form to show current balance before recording payment.
 *
 * @param {string|mongoose.Types.ObjectId} tenantId
 * @returns {Promise<Object|null>}
 */
export async function getTenantBalance(tenantId) {
  return TenantBalance.findOne({ tenant: tenantId }).lean();
}
