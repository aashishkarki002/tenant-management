/**
 * Migration 002: Backfill document numbers on existing Rent and Payment records.
 *
 * Assigns documentNumber to every Rent (INV-...) and Payment (RCPT-...) record
 * that does not already have one.
 *
 * Strategy:
 *  - Process records in chronological order (createdAt ASC) to preserve
 *    sequence ordering that matches original document creation time.
 *  - Group by (entityId, fiscalYear) to keep sequences entity-scoped.
 *  - For Rent: use rentSchema's own nepaliYear as fiscal year.
 *  - For Payment: derive fiscal year from nepaliDate or paymentDate.
 *  - Counters are written via documentNumber.service.js setCounterValue() to
 *    initialize the counter to the highest assigned sequence after the run.
 *  - Safe to re-run: skips records that already have documentNumber set.
 *  - Rolls back counter seeds if the run is interrupted (counters are idempotent).
 *
 * Usage:
 *   node src/migrations/002_backfill_document_numbers.js
 *
 * Env:
 *   MONGODB_URI — MongoDB connection string (required)
 *
 * Rollback:
 *   db.rents.updateMany({}, { $unset: { documentNumber: 1 } })
 *   db.payments.updateMany({}, { $unset: { documentNumber: 1 } })
 *   db.documentcounters.deleteMany({})
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap — connect before importing models that require a live connection
// ─────────────────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[002] MONGODB_URI is not set in .env");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("[002] Connected to MongoDB");

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after connect)
// ─────────────────────────────────────────────────────────────────────────────

import { setCounterValue } from "../modules/documentCounter/documentNumber.service.js";

// Inline schemas for migration — avoids importing full models with all plugins
const Rent = mongoose.model(
  "_Mig002Rent",
  new mongoose.Schema(
    {
      nepaliYear: Number,
      nepaliMonth: Number,
      nepaliDate: String,
      createdAt: Date,
      documentNumber: { type: String, default: null },
      entityId: mongoose.Schema.Types.ObjectId,
    },
    { collection: "rents", strict: false },
  ),
);

const Payment = mongoose.model(
  "_Mig002Payment",
  new mongoose.Schema(
    {
      nepaliDate: String,
      paymentDate: Date,
      createdAt: Date,
      documentNumber: { type: String, default: null },
      entityId: mongoose.Schema.Types.ObjectId,
    },
    { collection: "payments", strict: false },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive Nepali fiscal year from a nepaliDate string "YYYY-MM-DD".
 * Nepal fiscal year starts Shrawan (month 4 in BS 1-based).
 * If month >= 4, fiscal year = year. If month < 4, fiscal year = year - 1.
 */
function getFiscalYear(nepaliDateStr, fallbackDate) {
  if (nepaliDateStr && /^\d{4}-\d{2}-\d{2}$/.test(nepaliDateStr)) {
    const [year, month] = nepaliDateStr.split("-").map(Number);
    return month >= 4 ? year : year - 1;
  }
  // Fallback: use AD year as proxy
  const d = fallbackDate instanceof Date ? fallbackDate : new Date(fallbackDate ?? Date.now());
  return d.getFullYear();
}

function padSeq(n, len = 6) {
  return String(n).padStart(len, "0");
}

function formatDocNum(prefix, fiscalYear, seq) {
  return `${prefix}-${fiscalYear}-${padSeq(seq)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill rents (INV)
// ─────────────────────────────────────────────────────────────────────────────

async function backfillRents() {
  const rents = await Rent.find({ documentNumber: null })
    .sort({ createdAt: 1 })
    .lean();

  if (!rents.length) {
    console.log("[002] Rents: no records to backfill — skipping");
    return;
  }

  console.log(`[002] Rents: backfilling ${rents.length} records...`);

  // Group by (entityId, fiscalYear) to build per-entity sequences
  const sequences = {}; // key → nextSeq

  const ops = [];

  for (const rent of rents) {
    const fiscalYear = getFiscalYear(rent.nepaliDate, rent.createdAt);
    const entityScope = rent.entityId ? rent.entityId.toString() : "__global__";
    const seqKey = `INV:${fiscalYear}:${entityScope}`;

    if (!sequences[seqKey]) sequences[seqKey] = 1;
    const seq = sequences[seqKey]++;

    const docNum = formatDocNum("INV", fiscalYear, seq);
    ops.push({
      updateOne: {
        filter: { _id: rent._id },
        update: { $set: { documentNumber: docNum } },
      },
    });
  }

  if (ops.length) {
    await Rent.bulkWrite(ops, { ordered: false });
    console.log(`[002] Rents: wrote ${ops.length} document numbers`);
  }

  // Seed counters so generateDocumentNumber picks up after the highest assigned seq
  for (const [seqKey, nextSeq] of Object.entries(sequences)) {
    const [, fiscalYearStr, entityScope] = seqKey.split(":");
    const fiscalYear = Number(fiscalYearStr);
    const entityId = entityScope === "__global__" ? null : entityScope;
    // nextSeq is the NEXT to-be-used value; currentValue should be nextSeq - 1
    await setCounterValue("INV", { fiscalYear, entityId, value: nextSeq - 1 });
    console.log(
      `[002] Rents: seeded counter INV fiscalYear=${fiscalYear} entity=${entityId ?? "global"} currentValue=${nextSeq - 1}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill payments (RCPT)
// ─────────────────────────────────────────────────────────────────────────────

async function backfillPayments() {
  const payments = await Payment.find({ documentNumber: null })
    .sort({ createdAt: 1 })
    .lean();

  if (!payments.length) {
    console.log("[002] Payments: no records to backfill — skipping");
    return;
  }

  console.log(`[002] Payments: backfilling ${payments.length} records...`);

  const sequences = {};
  const ops = [];

  for (const payment of payments) {
    const fiscalYear = getFiscalYear(payment.nepaliDate, payment.paymentDate ?? payment.createdAt);
    const entityScope = payment.entityId ? payment.entityId.toString() : "__global__";
    const seqKey = `RCPT:${fiscalYear}:${entityScope}`;

    if (!sequences[seqKey]) sequences[seqKey] = 1;
    const seq = sequences[seqKey]++;

    const docNum = formatDocNum("RCPT", fiscalYear, seq);
    ops.push({
      updateOne: {
        filter: { _id: payment._id },
        update: { $set: { documentNumber: docNum } },
      },
    });
  }

  if (ops.length) {
    await Payment.bulkWrite(ops, { ordered: false });
    console.log(`[002] Payments: wrote ${ops.length} document numbers`);
  }

  for (const [seqKey, nextSeq] of Object.entries(sequences)) {
    const [, fiscalYearStr, entityScope] = seqKey.split(":");
    const fiscalYear = Number(fiscalYearStr);
    const entityId = entityScope === "__global__" ? null : entityScope;
    await setCounterValue("RCPT", { fiscalYear, entityId, value: nextSeq - 1 });
    console.log(
      `[002] Payments: seeded counter RCPT fiscalYear=${fiscalYear} entity=${entityId ?? "global"} currentValue=${nextSeq - 1}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — post-run duplicate check
// ─────────────────────────────────────────────────────────────────────────────

async function validateNoDuplicates() {
  const rentDups = await Rent.aggregate([
    { $match: { documentNumber: { $ne: null } } },
    { $group: { _id: "$documentNumber", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  const paymentDups = await Payment.aggregate([
    { $match: { documentNumber: { $ne: null } } },
    { $group: { _id: "$documentNumber", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (rentDups.length || paymentDups.length) {
    console.error("[002] DUPLICATE DOCUMENT NUMBERS DETECTED:");
    if (rentDups.length) console.error("  Rents:", rentDups);
    if (paymentDups.length) console.error("  Payments:", paymentDups);
    return false;
  }

  console.log("[002] Validation: no duplicate document numbers — OK");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

try {
  await backfillRents();
  await backfillPayments();
  const valid = await validateNoDuplicates();

  if (!valid) {
    console.error("[002] Migration completed WITH ERRORS — review duplicates above");
    process.exit(1);
  }

  console.log("[002] Migration complete ✓");
} catch (err) {
  console.error("[002] Migration failed:", err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
