/**
 * migration.service.js
 *
 * Handles block-level ownership migration: Private → Company (or any entity swap).
 *
 * KEY DESIGN DECISIONS (from spec):
 *   - Preflight WARNS on outstanding balances — never hard-blocks.
 *   - Money follows the charge: payments for pre-migration charges post to
 *     the originating entity. New charges post to the new entity.
 *   - No historical ledger backfill — entries with entityId: null are
 *     implicitly private and are included in merged view.
 *   - Rollback window: 48 hours after migration completes.
 */

import mongoose from "mongoose";
import { Block } from "../blocks/Block.Model.js";
import { MigrationSnapshot } from "./MigrationSnapshot.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { ChequeDraft } from "../chequeDrafts/ChequeDraft.Model.js";

// ─────────────────────────────────────────────────────────────────────────────
// PREFLIGHT CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run pre-migration checks for a block.
 *
 * @param {string|ObjectId} blockId
 * @returns {{ canMigrate: boolean, issues: string[], warnings: string[] }}
 */
export const preflightCheck = async (blockId) => {
  const issues = []; // hard blockers — migration cannot proceed
  const warnings = []; // soft warnings — migration proceeds with acknowledgment

  const block = await Block.findById(blockId).lean();
  if (!block) {
    issues.push("Block not found.");
    return { canMigrate: false, issues, warnings };
  }

  // ── HARD BLOCK 1: open migration already in progress ─────────────────────
  const openMigration = await MigrationSnapshot.findOne({
    blockId,
    status: "pending",
  }).lean();

  if (openMigration) {
    issues.push(
      `A migration is already in progress for this block (snapshot: ${openMigration._id}). ` +
        `Complete or roll back the existing migration first.`,
    );
  }

  // ── HARD BLOCK 2: pending cheque payments for this entity ─────────────────
  const pendingCheques = await ChequeDraft.countDocuments({
    entityId: block.ownershipEntityId,
    status: "PENDING",
    direction: "RECEIVED", // incoming cheques still in transit
  });

  if (pendingCheques > 0) {
    issues.push(
      `${pendingCheques} cheque payment(s) are still pending clearance for this block's entity. ` +
        `Wait for all cheques to clear (DEPOSITED/BOUNCED) before migrating.`,
    );
  }

  // ── WARNING: outstanding rent balances ────────────────────────────────────
  // Per spec Decision 2: outstanding balances stay in originating entity's books
  // until paid. Migration is not blocked, but owner should be informed.
  const tenantsInBlock = await Tenant.find({ block: blockId, status: "active" })
    .select("_id name")
    .lean();

  if (tenantsInBlock.length > 0) {
    const tenantIds = tenantsInBlock.map((t) => t._id);

    const outstandingRents = await Rent.find({
      tenant: { $in: tenantIds },
      status: { $in: ["pending", "partially_paid", "overdue"] },
    })
      .select(
        "tenant grossRentAmountPaisa tdsAmountPaisa paidAmountPaisa lateFeePaisa latePaidAmountPaisa",
      )
      .lean();

    if (outstandingRents.length > 0) {
      let totalOutstandingPaisa = 0;
      for (const r of outstandingRents) {
        const netRent = r.grossRentAmountPaisa - (r.tdsAmountPaisa || 0);
        const rentDue = netRent - (r.paidAmountPaisa || 0);
        const lateFeeDue = (r.lateFeePaisa || 0) - (r.latePaidAmountPaisa || 0);
        totalOutstandingPaisa += Math.max(0, rentDue) + Math.max(0, lateFeeDue);
      }

      const outstandingRs = (totalOutstandingPaisa / 100).toLocaleString(
        "en-IN",
      );
      warnings.push(
        `${outstandingRents.length} rent record(s) for ${tenantsInBlock.length} tenant(s) ` +
          `have outstanding balances totalling Rs. ${outstandingRs}. ` +
          `These will remain in the current entity's ledger until paid. ` +
          `New charges after migration will post to the target entity.`,
      );
    }

    // ── WARNING: partial/pending rents for current month ──────────────────
    const partialCurrentMonth = outstandingRents.filter(
      (r) => r.status === "partially_paid",
    );
    if (partialCurrentMonth.length > 0) {
      warnings.push(
        `${partialCurrentMonth.length} rent(s) are partially paid. ` +
          `The remaining balance will stay in the current entity until fully settled.`,
      );
    }
  }

  return { canMigrate: issues.length === 0, issues, warnings };
};

// ─────────────────────────────────────────────────────────────────────────────
// TAKE SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a MigrationSnapshot before executing the switch.
 *
 * @param {string|ObjectId} blockId
 * @param {string|ObjectId} fromEntityId
 * @param {string|ObjectId} toEntityId
 * @param {string|ObjectId} userId
 * @returns {Promise<MigrationSnapshot>}
 */
export const takeSnapshot = async (
  blockId,
  fromEntityId,
  toEntityId,
  userId,
) => {
  const block = await Block.findById(blockId).lean();
  if (!block) throw new Error(`Block not found: ${blockId}`);

  const tenantCount = await Tenant.countDocuments({
    block: blockId,
    status: "active",
  });

  const tenantIds = await Tenant.find({ block: blockId, status: "active" })
    .select("_id")
    .lean()
    .then((ts) => ts.map((t) => t._id));

  const rentCount = await Rent.countDocuments({
    tenant: { $in: tenantIds },
    status: { $in: ["pending", "partially_paid", "overdue"] },
  });

  let outstandingPaisa = 0;
  const openRents = await Rent.find({
    tenant: { $in: tenantIds },
    status: { $in: ["pending", "partially_paid", "overdue"] },
  })
    .select(
      "grossRentAmountPaisa tdsAmountPaisa paidAmountPaisa lateFeePaisa latePaidAmountPaisa",
    )
    .lean();

  for (const r of openRents) {
    const netRent = r.grossRentAmountPaisa - (r.tdsAmountPaisa || 0);
    outstandingPaisa +=
      Math.max(0, netRent - (r.paidAmountPaisa || 0)) +
      Math.max(0, (r.lateFeePaisa || 0) - (r.latePaidAmountPaisa || 0));
  }

  return MigrationSnapshot.create({
    blockId,
    fromEntityId,
    toEntityId,
    status: "pending",
    snapshotData: {
      blockName: block.name,
      tenantCount,
      rentCount,
      outstandingPaisa,
    },
    migratedBy: userId,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE SWITCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically re-point a block to a new entity.
 *
 * Future charges (rent, CAM, late fee) will post to toEntityId.
 * Pre-migration outstanding balances stay in fromEntityId until paid.
 *
 * @param {string|ObjectId} blockId
 * @param {string|ObjectId} toEntityId
 * @param {string|ObjectId} snapshotId
 * @param {string|ObjectId} userId
 */
export const executeSwitch = async (
  blockId,
  toEntityId,
  snapshotId,
  userId,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const snapshot = await MigrationSnapshot.findById(snapshotId)
      .session(session)
      .lean();
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);
    if (snapshot.status !== "pending") {
      throw new Error(
        `Snapshot is already ${snapshot.status}. Cannot re-execute.`,
      );
    }

    // Re-point block to new entity + record migration history
    await Block.findByIdAndUpdate(
      blockId,
      {
        $set: { ownershipEntityId: toEntityId },
        $push: {
          migrationHistory: {
            fromEntityId: snapshot.fromEntityId,
            toEntityId,
            migratedAt: new Date(),
            migratedBy: userId,
          },
        },
      },
      { session },
    );

    const completedAt = new Date();
    const rollbackEligibleUntil = new Date(
      completedAt.getTime() + 48 * 60 * 60 * 1000,
    );

    await MigrationSnapshot.findByIdAndUpdate(
      snapshotId,
      {
        $set: {
          status: "completed",
          completedAt,
          rollbackEligibleUntil,
        },
      },
      { session },
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revert a migration within the 48-hour rollback window.
 *
 * @param {string|ObjectId} snapshotId
 * @param {string|ObjectId} userId
 */
export const rollbackMigration = async (snapshotId, userId) => {
  const snapshot = await MigrationSnapshot.findById(snapshotId).lean();
  if (!snapshot) throw new Error("Snapshot not found");
  if (snapshot.status !== "completed") {
    throw new Error(
      `Cannot roll back a migration with status: ${snapshot.status}`,
    );
  }
  if (snapshot.rollbackEligibleUntil < new Date()) {
    throw new Error("Rollback window has expired (48 hours after migration)");
  }

  await Block.findByIdAndUpdate(snapshot.blockId, {
    $set: { ownershipEntityId: snapshot.fromEntityId },
    $push: {
      migrationHistory: {
        fromEntityId: snapshot.toEntityId,
        toEntityId: snapshot.fromEntityId,
        migratedAt: new Date(),
        migratedBy: userId,
        notes: `Rollback of snapshot ${snapshotId}`,
      },
    },
  });

  await MigrationSnapshot.findByIdAndUpdate(snapshotId, {
    $set: {
      status: "rolled_back",
      rollbackedAt: new Date(),
      rollbackedBy: userId,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current migration status for a block.
 *
 * @param {string|ObjectId} blockId
 */
export const getMigrationStatus = async (blockId) => {
  const block = await Block.findById(blockId)
    .populate("ownershipEntityId", "name type chartOfAccountsPrefix")
    .lean();

  if (!block) throw new Error(`Block not found: ${blockId}`);

  const latestSnapshot = await MigrationSnapshot.findOne({ blockId })
    .sort({ createdAt: -1 })
    .populate("fromEntityId", "name type")
    .populate("toEntityId", "name type")
    .lean();

  const rollbackEligible =
    latestSnapshot?.status === "completed" &&
    latestSnapshot.rollbackEligibleUntil > new Date();

  return {
    blockId: block._id,
    blockName: block.name,
    currentEntity: block.ownershipEntityId,
    migrationHistory: block.migrationHistory ?? [],
    latestSnapshot,
    rollbackEligible,
    rollbackEligibleUntil: rollbackEligible
      ? latestSnapshot.rollbackEligibleUntil
      : null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all migration snapshots across all blocks, newest first.
 */
export const getAuditLog = async () => {
  return MigrationSnapshot.find()
    .sort({ createdAt: -1 })
    .populate("blockId", "name property")
    .populate("fromEntityId", "name type")
    .populate("toEntityId", "name type")
    .populate("migratedBy", "name email")
    .lean();
};
