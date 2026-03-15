/**
 * Migration: Backfill npYear + npMonth on Revenue documents
 *
 * Run once after deploying the Revenue model change.
 * Safe to re-run — skips docs that already have both fields.
 *
 * Usage:
 *   node migrate_revenue_nepali_dates.js
 *
 * Env:
 *   MONGO_URI  — MongoDB connection string (required)
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import dotenv from "dotenv";
dotenv.config();

console.log("🔄  Revenue migration script started.");

// ─── Config ──────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGODB_URI;
const BATCH_SIZE = 500; // docs per bulkWrite — tune to your RAM/network

// ─── Minimal schema (no need to load the full app) ───────────────────────────

const RevenueSchema = new mongoose.Schema(
  {
    date: Date,
    npYear: Number,
    npMonth: Number,
  },
  { strict: false }, // preserve all other fields
);

const Revenue = mongoose.model("Revenue", RevenueSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNepaliYearMonth(jsDate) {
  const nd = new NepaliDate(jsDate instanceof Date ? jsDate : new Date(jsDate));
  return { npYear: nd.getYear(), npMonth: nd.getMonth() + 1 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  if (!MONGO_URI) {
    console.error("❌  MONGO_URI env variable is not set.");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅  Connected to MongoDB");

  // Only target docs missing either field — safe for re-runs
  const filter = {
    $or: [{ npYear: { $exists: false } }, { npMonth: { $exists: false } }],
  };

  const total = await Revenue.countDocuments(filter);
  console.log(`📦  Documents to migrate: ${total}`);

  if (total === 0) {
    console.log("✅  Nothing to migrate. Exiting.");
    await mongoose.disconnect();
    return;
  }

  let processed = 0;
  let errors = 0;
  let cursor = Revenue.find(filter).select("date").lean().cursor();

  let batch = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    await Revenue.bulkWrite(batch, { ordered: false });
    processed += batch.length;
    console.log(`   migrated ${processed} / ${total}`);
    batch = [];
  };

  for await (const doc of cursor) {
    if (!doc.date) {
      // Shouldn't happen — date is required — but guard anyway
      console.warn(`⚠️   Skipping doc ${doc._id}: missing date field`);
      errors++;
      continue;
    }

    try {
      const { npYear, npMonth } = toNepaliYearMonth(doc.date);
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { npYear, npMonth } },
        },
      });

      if (batch.length >= BATCH_SIZE) await flushBatch();
    } catch (err) {
      console.warn(`⚠️   Skipping doc ${doc._id}: ${err.message}`);
      errors++;
    }
  }

  // Flush remaining
  await flushBatch();

  console.log("\n─────────────────────────────");
  console.log(`✅  Migration complete`);
  console.log(`   Updated : ${processed}`);
  console.log(`   Skipped : ${errors}`);
  console.log("─────────────────────────────");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
