/**
 * Migration 001: Rename date fields for consistency
 *
 * Revenue:
 *   date     → englishDate
 *   npYear   → nepaliYear
 *   npMonth  → nepaliMonth
 *   (adds nepaliDate string if missing — derived from englishDate)
 *
 * Expense:
 *   EnglishDate → englishDate
 *
 * Liability:
 *   date    → englishDate
 *   npYear  → nepaliYear
 *   npMonth → nepaliMonth
 *
 * Safe to re-run — each step only touches documents that still have the old field.
 *
 * Usage:
 *   node src/migrations/001_rename_date_fields.js
 *
 * Env:
 *   MONGODB_URI — MongoDB connection string (required)
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const BATCH_SIZE = 500;

function toNepaliFields(jsDate) {
  const nd = new NepaliDate(jsDate instanceof Date ? jsDate : new Date(jsDate));
  const year = nd.getYear();
  const month = nd.getMonth() + 1; // 0-based → 1-based
  const day = nd.getDate();
  const nepaliDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { nepaliYear: year, nepaliMonth: month, nepaliDate };
}

async function renameFields(collection, { oldField, newField, batchSize = BATCH_SIZE }) {
  const filter = { [oldField]: { $exists: true } };
  const total = await collection.countDocuments(filter);
  console.log(`  [${collection.collectionName}] ${oldField} → ${newField}: ${total} docs`);
  if (total === 0) return;

  await collection.updateMany(filter, [
    { $set: { [newField]: `$${oldField}` } },
    { $unset: oldField },
  ]);
  console.log(`  [${collection.collectionName}] Done.`);
}

async function migrate() {
  if (!MONGO_URI) {
    console.error("MONGODB_URI env variable is not set.");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const revenues = db.collection("revenues");
  const expenses = db.collection("expenses");
  const liabilities = db.collection("liabilities");

  // ── Revenue ───────────────────────────────────────────────────────────────
  console.log("\n[Revenue] Renaming date → englishDate");
  await renameFields(revenues, { oldField: "date", newField: "englishDate" });

  console.log("[Revenue] Renaming npYear → nepaliYear");
  await renameFields(revenues, { oldField: "npYear", newField: "nepaliYear" });

  console.log("[Revenue] Renaming npMonth → nepaliMonth");
  await renameFields(revenues, { oldField: "npMonth", newField: "nepaliMonth" });

  // Backfill nepaliDate where missing
  const revMissingDate = await revenues.countDocuments({ nepaliDate: { $exists: false }, englishDate: { $exists: true } });
  console.log(`[Revenue] Backfilling nepaliDate on ${revMissingDate} docs`);
  if (revMissingDate > 0) {
    const cursor = revenues.find({ nepaliDate: { $exists: false }, englishDate: { $exists: true } });
    let batch = [];
    for await (const doc of cursor) {
      try {
        const { nepaliDate } = toNepaliFields(doc.englishDate);
        batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { nepaliDate } } } });
        if (batch.length >= BATCH_SIZE) {
          await revenues.bulkWrite(batch, { ordered: false });
          batch = [];
        }
      } catch (e) {
        console.warn(`  Skipping ${doc._id}: ${e.message}`);
      }
    }
    if (batch.length) await revenues.bulkWrite(batch, { ordered: false });
    console.log("[Revenue] nepaliDate backfill done.");
  }

  // ── Expense ───────────────────────────────────────────────────────────────
  console.log("\n[Expense] Renaming EnglishDate → englishDate");
  await renameFields(expenses, { oldField: "EnglishDate", newField: "englishDate" });

  // ── Liability ─────────────────────────────────────────────────────────────
  console.log("\n[Liability] Renaming date → englishDate");
  await renameFields(liabilities, { oldField: "date", newField: "englishDate" });

  console.log("[Liability] Renaming npYear → nepaliYear");
  await renameFields(liabilities, { oldField: "npYear", newField: "nepaliYear" });

  console.log("[Liability] Renaming npMonth → nepaliMonth");
  await renameFields(liabilities, { oldField: "npMonth", newField: "nepaliMonth" });

  // Backfill nepaliDate on liabilities where missing
  const liabMissingDate = await liabilities.countDocuments({ nepaliDate: { $exists: false }, englishDate: { $exists: true } });
  console.log(`[Liability] Backfilling nepaliDate on ${liabMissingDate} docs`);
  if (liabMissingDate > 0) {
    const cursor = liabilities.find({ nepaliDate: { $exists: false }, englishDate: { $exists: true } });
    let batch = [];
    for await (const doc of cursor) {
      try {
        const { nepaliDate } = toNepaliFields(doc.englishDate);
        batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { nepaliDate } } } });
        if (batch.length >= BATCH_SIZE) {
          await liabilities.bulkWrite(batch, { ordered: false });
          batch = [];
        }
      } catch (e) {
        console.warn(`  Skipping ${doc._id}: ${e.message}`);
      }
    }
    if (batch.length) await liabilities.bulkWrite(batch, { ordered: false });
    console.log("[Liability] nepaliDate backfill done.");
  }

  console.log("\nMigration 001 complete.");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
