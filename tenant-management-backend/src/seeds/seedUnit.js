/**
 * seedUnits.js
 * Seeds 25 units per InnerBlock (100 units total) across all 4 blocks.
 *
 * Property:   6970f5a7464f3514eb16051c  (sallyan house)
 *
 * Block 1:  6970f5a7464f3514eb16051e  (Birendra sadhan)
 *   InnerBlock A:  6970f5a7464f3514eb160522  (Sagar block)
 *   InnerBlock B:  6970f5a7464f3514eb160524  (Jyoti block)
 *
 * Block 2:  6970f5a7464f3514eb160520  (Narendra sadhan)
 *   InnerBlock C:  6970f5a7464f3514eb160526  (Umanga block)
 *   InnerBlock D:  6970f5a7464f3514eb160528  (Saurya block)
 *
 * Run: node seedUnits.js
 * (Ensure MONGODB_URI is set in your environment or .env is loaded before running)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import { Unit } from "../modules/units/Unit.Model.js"; // ← adjust path if needed
import { connectDB } from "../config/db.js"; // ← adjust path if needed

// ─── IDs from live DB ────────────────────────────────────────────────────────
const PROPERTY_ID = "6970f5a7464f3514eb16051c";

const BLOCK_BIRENDRA = "6970f5a7464f3514eb16051e";
const BLOCK_NARENDRA = "6970f5a7464f3514eb160520";

const IB_SAGAR = "6970f5a7464f3514eb160522"; // Birendra → Sagar
const IB_JYOTI = "6970f5a7464f3514eb160524"; // Birendra → Jyoti
const IB_UMANGA = "6970f5a7464f3514eb160526"; // Narendra → Umanga
const IB_SAURYA = "6970f5a7464f3514eb160528"; // Narendra → Saurya

// ─── Helper ──────────────────────────────────────────────────────────────────
/**
 * Builds `count` unit documents for a given block + innerBlock.
 * @param {string} prefix     Short prefix for unit names, e.g. "SG" → "SG-01"
 * @param {string} blockId
 * @param {string} innerBlockId
 * @param {number} count
 * @param {number} floorStart  Floor number for first unit (increments every 5 units)
 */
function buildUnits(prefix, blockId, innerBlockId, count = 25, floorStart = 1) {
  const units = [];
  for (let i = 1; i <= count; i++) {
    const unitNumber = String(i).padStart(2, "0");
    const floor = floorStart + Math.floor((i - 1) / 5);
    units.push({
      name: `${prefix}-${unitNumber}`,
      property: PROPERTY_ID,
      block: blockId,
      innerBlock: innerBlockId,
      floorNumber: floor,
      actualSquareFeet: 400 + (i % 5) * 50, // varied sqft: 400–600
      isOccupied: false,
      isDeleted: false,
    });
  }
  return units;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
// 25 units per InnerBlock = 50 per Block = 100 total
const allUnits = [
  ...buildUnits("SG", BLOCK_BIRENDRA, IB_SAGAR, 25, 1), // Sagar block   → SG-01 … SG-25
  ...buildUnits("JY", BLOCK_BIRENDRA, IB_JYOTI, 25, 1), // Jyoti block   → JY-01 … JY-25
  ...buildUnits("UM", BLOCK_NARENDRA, IB_UMANGA, 25, 1), // Umanga block  → UM-01 … UM-25
  ...buildUnits("SA", BLOCK_NARENDRA, IB_SAURYA, 25, 1), // Saurya block  → SA-01 … SA-25
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await connectDB(); // or: await mongoose.connect(process.env.MONGODB_URI)

  // Avoid duplicates: wipe existing seed units by prefix pattern
  const prefixes = ["SG-", "JY-", "UM-", "SA-"];
  const deleteResult = await Unit.deleteMany({
    name: { $in: allUnits.map((u) => u.name) },
  });
  if (deleteResult.deletedCount > 0) {
    console.log(
      `Removed ${deleteResult.deletedCount} existing seed units before re-seeding.`,
    );
  }

  const created = await Unit.insertMany(allUnits, { ordered: false });

  console.log(`\n✅  Seeded ${created.length} units across 4 inner blocks:\n`);
  console.log(`  Sagar block   (SG-01 … SG-25) — Block: Birendra sadhan`);
  console.log(`  Jyoti block   (JY-01 … JY-25) — Block: Birendra sadhan`);
  console.log(`  Umanga block  (UM-01 … UM-25) — Block: Narendra sadhan`);
  console.log(`  Saurya block  (SA-01 … SA-25) — Block: Narendra sadhan`);
  console.log(`\n  Total: ${created.length} units\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
