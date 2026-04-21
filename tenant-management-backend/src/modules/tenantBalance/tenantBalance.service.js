/**
 * tenant-balance.service.js
 *
 * Two public exports:
 *
 *   syncTenantBalance(tenantId, session?)
 *     Called inside every service that mutates money (payment, cron charge).
 *     Runs two aggregations against Rent + CAM and upserts one document.
 *     Must receive the active Mongoose session so the snapshot stays
 *     consistent with the mutation that triggered it.
 *
 *   rebuildAllTenantBalances()
 *     Sessionless batch rebuild. Run once after deployment, or nightly
 *     as a reconciliation guard. Safe to call at any time.
 *
 * ── Why aggregation instead of loading documents ─────────────────────────────
 *
 *   A tenant with 24 months of partial payments would require loading 24 Rent
 *   + 24 CAM documents just to compute one number. The aggregation pipeline
 *   does the arithmetic on the server and returns a single row — O(1) network
 *   traffic regardless of history length.
 */

import mongoose from "mongoose";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";
import { TenantBalance } from "./tenantBalance.model.js";

const OPEN_STATUSES = ["pending", "partially_paid", "overdue"];

// ── Aggregation helpers ───────────────────────────────────────────────────────

/**
 * Returns { rentDuePaisa, lateFeeDuePaisa, oldestYear, oldestMonth }
 * for a single tenant across ALL their open Rent documents.
 */
async function aggregateRent(tenantId, session) {
  const tenantObjId =
    tenantId instanceof mongoose.Types.ObjectId
      ? tenantId
      : new mongoose.Types.ObjectId(tenantId);

  const [row] = await Rent.aggregate([
    {
      $match: {
        tenant: tenantObjId,
        status: { $in: OPEN_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        // (gross - tds) - paid  =  net rent still owed
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
        // late fee still owed
        lateFeeDuePaisa: {
          $sum: {
            $subtract: [
              { $ifNull: ["$lateFeePaisa", 0] },
              { $ifNull: ["$latePaidAmountPaisa", 0] },
            ],
          },
        },
        // oldest unpaid month for the "overdue since" badge
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
 * Returns { camDuePaisa } for a single tenant.
 */
async function aggregateCam(tenantId, session) {
  const tenantObjId =
    tenantId instanceof mongoose.Types.ObjectId
      ? tenantId
      : new mongoose.Types.ObjectId(tenantId);

  const [row] = await Cam.aggregate([
    {
      $match: {
        tenant: tenantObjId,
        status: { $in: OPEN_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        camDuePaisa: {
          $sum: { $subtract: ["$amountPaisa", "$paidAmountPaisa"] },
        },
      },
    },
  ]).session(session ?? null);

  return {
    camDuePaisa: Math.max(0, Math.round(row?.camDuePaisa ?? 0)),
  };
}

/**
 * Count how many consecutive months (walking backwards from the most recent
 * open month) the tenant has at least one open-status Rent document.
 */
async function computeConsecutiveUnpaidMonths(tenantId, session) {
  const tenantObjId =
    tenantId instanceof mongoose.Types.ObjectId
      ? tenantId
      : new mongoose.Types.ObjectId(tenantId);

  const openMonths = await Rent.aggregate([
    { $match: { tenant: tenantObjId, status: { $in: OPEN_STATUSES } } },
    { $group: { _id: { year: "$nepaliYear", month: "$nepaliMonth" } } },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
  ]).session(session ?? null);

  if (openMonths.length === 0) return 0;

  const monthSet = new Set(
    openMonths.map(({ _id }) => _id.year * 12 + _id.month),
  );

  let count = 0;
  let y = openMonths[0]._id.year;
  let m = openMonths[0]._id.month;

  while (monthSet.has(y * 12 + m)) {
    count++;
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }

  return count;
}

// ── Public: single-tenant sync ────────────────────────────────────────────────

/**
 * Recompute and upsert the TenantBalance snapshot for one tenant.
 *
 * Call this at the END of every service that mutates money, BEFORE
 * committing the session:
 *
 *   await syncTenantBalance(rent.tenant, session);
 *   await session.commitTransaction();
 *
 * @param {string|ObjectId} tenantId
 * @param {mongoose.ClientSession|null} [session]
 */
export async function syncTenantBalance(tenantId, session = null) {
  const [rentData, camData, consecutiveUnpaidMonths] = await Promise.all([
    aggregateRent(tenantId, session),
    aggregateCam(tenantId, session),
    computeConsecutiveUnpaidMonths(tenantId, session),
  ]);

  const { rentDuePaisa, lateFeeDuePaisa, oldestYear, oldestMonth } = rentData;
  const { camDuePaisa } = camData;
  const totalDuePaisa = rentDuePaisa + camDuePaisa + lateFeeDuePaisa;

  await TenantBalance.findOneAndUpdate(
    { tenant: tenantId },
    {
      $set: {
        rentDuePaisa,
        camDuePaisa,
        lateFeeDuePaisa,
        totalDuePaisa,
        consecutiveUnpaidMonths,
        oldestOverdueNepaliYear: oldestYear,
        oldestOverdueNepaliMonth: oldestMonth,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true, new: true, session: session ?? undefined },
  );

  return { rentDuePaisa, camDuePaisa, lateFeeDuePaisa, totalDuePaisa };
}

// ── Public: batch rebuild (no session — used by cron / backfill) ──────────────

/**
 * Rebuild TenantBalance for ALL tenants that have at least one open
 * Rent or CAM document.
 *
 * Runs as a reconciliation step at the end of the master cron's Day-1
 * block so the snapshot stays consistent after bulk insertMany operations
 * (which bypass per-document session hooks).
 *
 * @returns {{ processed: number, errors: number }}
 */
export async function rebuildAllTenantBalances() {
  console.log("[tenantBalance] Starting full rebuild...");

  // Collect every tenant that has any open document
  const [rentTenants, camTenants] = await Promise.all([
    Rent.distinct("tenant", { status: { $in: OPEN_STATUSES } }),
    Cam.distinct("tenant", { status: { $in: OPEN_STATUSES } }),
  ]);

  // Deduplicate across collections
  const tenantIdSet = new Set([
    ...rentTenants.map((id) => id.toString()),
    ...camTenants.map((id) => id.toString()),
  ]);

  const tenantIds = [...tenantIdSet];
  let processed = 0;
  let errors = 0;

  // Process in batches of 50 to avoid overwhelming the DB
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
          console.error(
            `[tenantBalance] rebuild failed for ${tenantId}:`,
            err.message,
          );
        }
      }),
    );
  }

  // Zero out balances for tenants who no longer have open documents
  // (e.g. all their rents were paid this month)
  await TenantBalance.updateMany(
    {
      tenant: { $nin: rentTenants.concat(camTenants) },
      totalDuePaisa: { $gt: 0 },
    },
    {
      $set: {
        rentDuePaisa: 0,
        camDuePaisa: 0,
        lateFeeDuePaisa: 0,
        totalDuePaisa: 0,
        oldestOverdueNepaliYear: null,
        oldestOverdueNepaliMonth: null,
        lastSyncedAt: new Date(),
      },
    },
  );

  console.log(
    `[tenantBalance] Rebuild done: ${processed} synced, ${errors} errors`,
  );
  return { processed, errors };
}

// ── Public: single-tenant read ────────────────────────────────────────────────

/**
 * Fast balance read for a single tenant — O(1), no aggregation.
 * Used by payment form to show "current balance" before recording payment.
 *
 * @param {string|ObjectId} tenantId
 * @returns {Promise<TenantBalanceDocument|null>}
 */
export async function getTenantBalance(tenantId) {
  return TenantBalance.findOne({ tenant: tenantId }).lean();
}
