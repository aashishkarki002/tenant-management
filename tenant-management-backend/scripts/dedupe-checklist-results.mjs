/**
 * One-time (or occasional) cleanup: duplicate ChecklistResult documents for the
 * same template + Nepali calendar day. Run BEFORE creating the unique index in
 * production if duplicates already exist.
 *
 * Usage (from repo root):
 *   Set MONGODB_URI in .env, then:
 *   node scripts/dedupe-checklist-results.mjs
 *
 * Dry run (no deletes):
 *   DRY_RUN=1 node scripts/dedupe-checklist-results.mjs
 */

import "dotenv/config";
import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { ChecklistResult } from "../src/modules/dailyChecks/checkListResult.model.js";
import {
  formatNepaliISO,
  getNepalCivilUtcMidnightForInstant,
} from "../src/utils/nepaliDateHelper.js";

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function canonicalNepaliKey(doc) {
  const tpl = doc.template?.toString?.() ?? String(doc.template);
  if (
    typeof doc.nepaliDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(doc.nepaliDate)
  ) {
    return `${tpl}|${doc.nepaliDate}`;
  }
  try {
    const mid = getNepalCivilUtcMidnightForInstant(doc.checkDate);
    const np = new NepaliDate(mid);
    return `${tpl}|${formatNepaliISO(np)}`;
  } catch {
    return `${tpl}|invalid`;
  }
}

function keeperScore(doc) {
  const order = { COMPLETED: 4, INCOMPLETE: 3, IN_PROGRESS: 2, PENDING: 1 };
  return order[doc.status] ?? 0;
}

function pickKeeper(docs) {
  return [...docs].sort((a, b) => {
    const s = keeperScore(b) - keeperScore(a);
    if (s !== 0) return s;
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri?.trim()) {
    console.error("MONGODB_URI or MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected. DRY_RUN=", DRY_RUN);

  const all = await ChecklistResult.find({})
    .select("_id template checkDate nepaliDate nepaliMonth nepaliYear status createdAt")
    .lean();

  const groups = new Map();
  for (const doc of all) {
    const key = canonicalNepaliKey(doc);
    if (key.endsWith("|invalid")) {
      console.warn("Skip row with unusable checkDate:", doc._id);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  let duplicateGroups = 0;
  let deleted = 0;

  for (const [key, docs] of groups) {
    if (docs.length < 2) continue;
    duplicateGroups++;
    const keeper = pickKeeper(docs);
    const remove = docs.filter((d) => String(d._id) !== String(keeper._id));

    console.log(
      `Group ${key}: keep ${keeper._id} (${keeper.status}), remove ${remove.length}`,
    );

    for (const row of remove) {
      if (DRY_RUN) {
        console.log("  [dry-run] would delete", row._id);
      } else {
        await ChecklistResult.deleteOne({ _id: row._id });
        deleted++;
      }
    }
  }

  console.log(
    DRY_RUN
      ? `Done (dry run). ${duplicateGroups} duplicate group(s).`
      : `Done. ${duplicateGroups} duplicate group(s), deleted ${deleted} document(s).`,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
