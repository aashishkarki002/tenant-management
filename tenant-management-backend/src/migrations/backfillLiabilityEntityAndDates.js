/**
 * Migration: Backfill entityId, blockId, nepaliYear, nepaliMonth, nepaliDate
 *            on Liability documents for SECURITY_DEPOSIT and LOAN types.
 *
 * Why this is needed:
 *   - createSd() received entityId as a param but never forwarded it (or the SD's
 *     nepali date fields / blockId) to createLiability(). Fixed in sd.service.js.
 *   - createLoan() had entityId in scope but dropped it from Liability.create().
 *     Fixed in Loan.service.js.
 *   This script patches all existing records that were created before the fix.
 *
 * Safe to re-run — skips documents that already have entityId set.
 *
 * Usage:
 *   node src/migrations/backfillLiabilityEntityAndDates.js
 *
 * Env:
 *   MONGODB_URI — MongoDB connection string (required)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const BATCH_SIZE = 200;

// ─── Minimal schemas (strict: false preserves all other fields) ───────────────

const LiabilitySchema = new mongoose.Schema({}, { strict: false });
const SdSchema = new mongoose.Schema({}, { strict: false });
const BlockSchema = new mongoose.Schema({}, { strict: false });
const LoanSchema = new mongoose.Schema({}, { strict: false });

const Liability = mongoose.model("Liability", LiabilitySchema);
const Sd = mongoose.model("Sd", SdSchema);
const Block = mongoose.model("Block", BlockSchema);
const Loan = mongoose.model("Loan", LoanSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function bulkFlush(ops, label) {
  if (!ops.length) return 0;
  const result = await Liability.bulkWrite(ops, { ordered: false });
  console.log(`   [${label}] flushed ${ops.length} ops — modified: ${result.modifiedCount}`);
  return result.modifiedCount;
}

// ─── Part 1: SECURITY_DEPOSIT liabilities ────────────────────────────────────

async function migrateSecurityDeposits() {
  console.log("\n── SECURITY_DEPOSIT liabilities ─────────────────────────────");

  const filter = {
    referenceType: "SECURITY_DEPOSIT",
    $or: [{ entityId: null }, { entityId: { $exists: false } }],
  };

  const total = await Liability.countDocuments(filter);
  console.log(`   Documents to patch: ${total}`);
  if (total === 0) {
    console.log("   Nothing to do.");
    return { updated: 0, skipped: 0 };
  }

  // Build a lookup map: sdId → { nepaliYear, nepaliMonth, nepaliDate, blockId, entityId }
  // We do this in one pass: load all matching liabilities, then batch-fetch SDs and Blocks.

  const liabilities = await Liability.find(filter)
    .select("referenceId")
    .lean();

  const sdIds = liabilities.map((l) => l.referenceId).filter(Boolean);

  // Fetch all relevant SDs
  const sds = await Sd.find({ _id: { $in: sdIds } })
    .select("_id nepaliYear nepaliMonth nepaliDate block")
    .lean();

  const sdMap = new Map(sds.map((s) => [String(s._id), s]));

  // Fetch all relevant Blocks to get ownershipEntityId
  const blockIds = [...new Set(sds.map((s) => s.block).filter(Boolean))];
  const blocks = await Block.find({ _id: { $in: blockIds } })
    .select("_id ownershipEntityId")
    .lean();

  const blockMap = new Map(blocks.map((b) => [String(b._id), b]));

  let ops = [];
  let updated = 0;
  let skipped = 0;

  for (const liability of liabilities) {
    const sd = sdMap.get(String(liability.referenceId));
    if (!sd) {
      console.warn(`   WARN: SD not found for liability ${liability._id} (referenceId: ${liability.referenceId})`);
      skipped++;
      continue;
    }

    const block = blockMap.get(String(sd.block));
    const entityId = block?.ownershipEntityId ?? null;

    if (!entityId) {
      console.warn(`   WARN: Block ${sd.block} has no ownershipEntityId — liability ${liability._id} skipped`);
      skipped++;
      continue;
    }

    const patch = {
      entityId,
      blockId: sd.block ?? null,
    };
    if (sd.nepaliYear != null) patch.nepaliYear = sd.nepaliYear;
    if (sd.nepaliMonth != null) patch.nepaliMonth = sd.nepaliMonth;
    if (sd.nepaliDate != null) patch.nepaliDate = sd.nepaliDate;

    ops.push({
      updateOne: {
        filter: { _id: liability._id },
        update: { $set: patch },
      },
    });

    if (ops.length >= BATCH_SIZE) {
      updated += await bulkFlush(ops, "SD");
      ops = [];
    }
  }

  updated += await bulkFlush(ops, "SD");

  return { updated, skipped };
}

// ─── Part 2: LOAN liabilities ─────────────────────────────────────────────────

async function migrateLoanLiabilities() {
  console.log("\n── LOAN liabilities ──────────────────────────────────────────");

  const filter = {
    referenceType: "LOAN",
    $or: [{ entityId: null }, { entityId: { $exists: false } }],
  };

  const total = await Liability.countDocuments(filter);
  console.log(`   Documents to patch: ${total}`);
  if (total === 0) {
    console.log("   Nothing to do.");
    return { updated: 0, skipped: 0 };
  }

  const liabilities = await Liability.find(filter)
    .select("referenceId")
    .lean();

  const loanIds = liabilities.map((l) => l.referenceId).filter(Boolean);

  const loans = await Loan.find({ _id: { $in: loanIds } })
    .select("_id entityId")
    .lean();

  const loanMap = new Map(loans.map((l) => [String(l._id), l]));

  let ops = [];
  let updated = 0;
  let skipped = 0;

  for (const liability of liabilities) {
    const loan = loanMap.get(String(liability.referenceId));
    if (!loan) {
      console.warn(`   WARN: Loan not found for liability ${liability._id} (referenceId: ${liability.referenceId})`);
      skipped++;
      continue;
    }

    if (!loan.entityId) {
      console.warn(`   WARN: Loan ${loan._id} has no entityId — liability ${liability._id} skipped`);
      skipped++;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { _id: liability._id },
        update: { $set: { entityId: loan.entityId } },
      },
    });

    if (ops.length >= BATCH_SIZE) {
      updated += await bulkFlush(ops, "LOAN");
      ops = [];
    }
  }

  updated += await bulkFlush(ops, "LOAN");

  return { updated, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  if (!MONGO_URI) {
    console.error("MONGODB_URI env variable is not set.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const sdResult = await migrateSecurityDeposits();
  const loanResult = await migrateLoanLiabilities();

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("Migration complete");
  console.log(`  SECURITY_DEPOSIT — updated: ${sdResult.updated}, skipped: ${sdResult.skipped}`);
  console.log(`  LOAN             — updated: ${loanResult.updated}, skipped: ${loanResult.skipped}`);
  console.log("─────────────────────────────────────────────────────────────");

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
