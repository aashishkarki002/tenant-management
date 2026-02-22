/**
 * Migration: Add text indexes for global search
 *
 * Run once with:  node src/migrations/add-search-indexes.js
 *
 * Safe to re-run — MongoDB ignores duplicate index creation.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
console.log("MONGODB_URI", process.env.MONGODB_URI);
const MONGO_URI = process.env.MONGODB_URI;

// ── Result tracker ────────────────────────────────────────────────────────────
const results = [];
const log = (collection, status, detail = "") => {
  const icon = status === "ok" ? "✅" : status === "skip" ? "⏭️ " : "❌";
  const msg = `${icon}  ${collection.padEnd(16)} ${detail}`;
  console.log(msg);
  results.push({ collection, status, detail });
};

async function run() {
  console.log("\n🔍  Search Index Migration\n" + "─".repeat(40));

  if (!MONGO_URI) {
    console.error("❌  MONGODB_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("📦  Connected to MongoDB\n");

  const db = mongoose.connection.db;

  // ── Index definitions ─────────────────────────────────────────────────────
  // Each entry: { collection, fields, weights, name }
  const indexes = [
    {
      collection: "tenants",
      fields: { name: "text", email: "text", phone: "text" },
      weights: { name: 10, email: 5, phone: 3 },
      name: "tenant_text_search",
    },
    {
      collection: "rents",
      // nepaliMonth is stored as a Number in your schema (1–12),
      // so text index won't match it. We index description/status strings instead.
      // Numeric searches (year, amount) are handled in the service via $or.
      fields: { status: "text" },
      weights: { status: 1 },
      name: "rent_text_search",
    },
    {
      collection: "ledgerentries",
      fields: { description: "text" },
      weights: { description: 1 },
      name: "ledger_text_search",
    },
  ];

  // ── Create each index ─────────────────────────────────────────────────────
  for (const def of indexes) {
    try {
      const col = db.collection(def.collection);

      // Check if a text index already exists on this collection
      const existing = await col.indexes();
      const hasTextIndex = existing.some((idx) =>
        Object.values(idx.key ?? {}).includes("text"),
      );

      if (hasTextIndex) {
        // Find its name so we can report it clearly
        const existingText = existing.find((idx) =>
          Object.values(idx.key ?? {}).includes("text"),
        );
        if (existingText?.name === def.name) {
          log(def.collection, "skip", `"${def.name}" already exists`);
          continue;
        }

        // Different text index exists — drop it first (M0: only 1 text index allowed)
        console.log(
          `  ⚠️   ${def.collection}: dropping old text index "${existingText?.name}"…`,
        );
        await col.dropIndex(existingText.name);
      }

      // Create the new text index
      await col.createIndex(def.fields, {
        weights: def.weights,
        name: def.name,
        background: true, // non-blocking for existing data
      });

      log(def.collection, "ok", `"${def.name}" created`);
    } catch (err) {
      log(def.collection, "error", err.message);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(40));
  const ok = results.filter((r) => r.status === "ok").length;
  const skip = results.filter((r) => r.status === "skip").length;
  const error = results.filter((r) => r.status === "error").length;
  console.log(
    `\n📊  Summary: ${ok} created · ${skip} skipped · ${error} failed\n`,
  );

  if (error > 0) {
    console.error("⚠️   Some indexes failed. Check errors above.");
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("✅  Done. You can now use global search.\n");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
