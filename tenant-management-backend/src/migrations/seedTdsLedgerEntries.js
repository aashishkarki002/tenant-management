/**
 * seedTdsLedgerEntries.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backfills missing TDS_WITHHELD journal entries for existing Rent records.
 *
 * WHY:
 *   The monthly cron (handleMonthlyRents) calls recordTdsLedgerEntry() to post:
 *     DR  1300  TDS Recoverable     (ASSET ↑)  — government tax credit
 *     CR  1200  Accounts Receivable (ASSET ↓)  — reduces tenant's net obligation
 *
 *   Rents created before this logic existed (or via older code paths) have
 *   tdsAmountPaisa > 0 but tdsRecordedInLedger !== true. Their AR balances are
 *   overstated by the TDS amount. This migration posts the missing entries.
 *
 *   NOTE: "TDS_WITHHELD" was also missing from the Transaction.type enum —
 *   that has been added to Transaction.Model.js before running this migration.
 *
 * IDEMPOTENCY:
 *   - recordTdsLedgerEntry() skips if tdsRecordedInLedger === true
 *   - ledgerService.postJournalEntry() skips if a Transaction with the same
 *     (referenceType, referenceId, entityId) already exists
 *   - Safe to run multiple times
 *
 * RUN:
 *   DRY_RUN=true node src/migrations/seedTdsLedgerEntries.js   # preview only
 *   node src/migrations/seedTdsLedgerEntries.js                # apply
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Rent } from "../modules/rents/rent.Model.js";
import { recordTdsLedgerEntry } from "../modules/rents/rent.service.js";
import { buildTdsWithheldJournal } from "../modules/ledger/journal-builders/tdsWithheld.js";
import { buildEntityMapForBlocks } from "../helper/resolveEntity.js";

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === "true";

function fmt(paisa) {
  return `Rs. ${(paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  console.log(DRY_RUN ? "🔍 DRY-RUN MODE — no data will be changed\n" : "⚡ LIVE MODE — changes will be committed\n");

  // ── Step 1: find rents that need TDS journaling ───────────────────────────
  const rents = await Rent.find({
    tdsAmountPaisa: { $gt: 0 },
    $or: [
      { tdsRecordedInLedger: false },
      { tdsRecordedInLedger: { $exists: false } },
    ],
  })
    .populate("tenant", "name")
    .lean();

  console.log(`Found ${rents.length} rent(s) with unrecorded TDS.\n`);

  if (rents.length === 0) {
    console.log("✅ Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // ── Step 2: batch-resolve entityId for all blocks (single DB query) ───────
  const entityByBlock = await buildEntityMapForBlocks(rents.map((r) => r.block));

  // ── Step 3: process each rent ─────────────────────────────────────────────
  const stats = { posted: 0, skipped: 0, nullEntity: 0, errors: 0 };

  for (const rentPlain of rents) {
    const entityId = entityByBlock.get(rentPlain.block?.toString()) ?? null;

    if (!entityId) {
      console.warn(
        `  ⚠️  Rent ${rentPlain._id} — could not resolve entityId for block ${rentPlain.block}. Skipping.`,
      );
      stats.nullEntity++;
      continue;
    }

    const tenantName = rentPlain.tenant?.name ?? "(unknown)";
    const label = `Rent ${rentPlain._id} [${tenantName} — ${rentPlain.nepaliMonth}/${rentPlain.nepaliYear}] ${fmt(rentPlain.tdsAmountPaisa)}`;

    if (DRY_RUN) {
      // Preview the journal that would be posted — validates builder too
      try {
        const payload = buildTdsWithheldJournal(rentPlain);
        console.log(`  ✔  [DRY] Would post: ${payload.transactionType} — ${label}`);
        console.log(`       DR 1300 TDS Recoverable  ${fmt(rentPlain.tdsAmountPaisa)}`);
        console.log(`       CR 1200 Accounts Receivable  ${fmt(rentPlain.tdsAmountPaisa)}`);
        stats.posted++;
      } catch (err) {
        console.error(`  ✖  [DRY] Builder error for ${label}: ${err.message}`);
        stats.errors++;
      }
      continue;
    }

    // Live: use a Mongoose document so recordTdsLedgerEntry can call .tdsRecordedInLedger
    const rent = await Rent.findById(rentPlain._id).populate("tenant", "name");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await recordTdsLedgerEntry(rent, session, entityId);

      if (result.skipped) {
        await session.abortTransaction();
        console.log(`  ⏭  Skipped (${result.reason}): ${label}`);
        stats.skipped++;
      } else {
        await session.commitTransaction();
        console.log(`  ✔  Posted: ${label}`);
        stats.posted++;
      }
    } catch (err) {
      await session.abortTransaction();
      console.error(`  ✖  Error for ${label}: ${err.message}`);
      stats.errors++;
    } finally {
      session.endSession();
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log(`Rents found       : ${rents.length}`);
  console.log(`Posted            : ${stats.posted}`);
  console.log(`Skipped           : ${stats.skipped}`);
  console.log(`Null entity (skip): ${stats.nullEntity}`);
  console.log(`Errors            : ${stats.errors}`);

  if (DRY_RUN) {
    console.log("\n🔍 DRY-RUN complete — run without DRY_RUN=true to apply.");
  } else {
    console.log("\n✅ Migration complete.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
