/**
 * renameRentAmountPaisa.js
 *
 * One-time migration: rename `rentAmountPaisa` → `grossRentAmountPaisa`
 * on every Rent document, including the unitBreakdown sub-array.
 *
 * Run once after deploying the code that uses the new field names:
 *
 *   node src/migrations/renameRentAmountPaisa.js
 *
 * Safe to re-run: documents that already have `grossRentAmountPaisa` and
 * no `rentAmountPaisa` are skipped by the $match filter.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const Rent = mongoose.connection.collection("rents");

  // ── Step 1: Root-level rename ────────────────────────────────────────────
  // Add grossRentAmountPaisa from rentAmountPaisa, then unset old field.
  // Only touches documents that still have the old field.
  const rootResult = await Rent.updateMany(
    { rentAmountPaisa: { $exists: true } },
    [
      { $set: { grossRentAmountPaisa: "$rentAmountPaisa" } },
      { $unset: "rentAmountPaisa" },
    ],
  );
  console.log(
    `Root field renamed on ${rootResult.modifiedCount} documents.`,
  );

  // ── Step 2: unitBreakdown sub-document rename ────────────────────────────
  // $map copies rentAmountPaisa → grossRentAmountPaisa inside each element.
  // The old key is removed via $unset on the mapped object.
  const ubResult = await Rent.updateMany(
    {
      "unitBreakdown.rentAmountPaisa": { $exists: true },
    },
    [
      {
        $set: {
          unitBreakdown: {
            $map: {
              input: "$unitBreakdown",
              as: "u",
              in: {
                $mergeObjects: [
                  "$$u",
                  { grossRentAmountPaisa: "$$u.rentAmountPaisa" },
                ],
              },
            },
          },
        },
      },
    ],
  );
  console.log(
    `unitBreakdown.grossRentAmountPaisa added on ${ubResult.modifiedCount} documents.`,
  );

  // Step 2b: Remove the old rentAmountPaisa key from each unitBreakdown element.
  // MongoDB does not support $unset on array sub-fields via aggregation pipeline,
  // so we use $unset with dot-notation on a per-element basis via $[].
  const ubUnsetResult = await Rent.updateMany(
    { "unitBreakdown.rentAmountPaisa": { $exists: true } },
    { $unset: { "unitBreakdown.$[].rentAmountPaisa": "" } },
  );
  console.log(
    `unitBreakdown.rentAmountPaisa removed from ${ubUnsetResult.modifiedCount} documents.`,
  );

  await mongoose.disconnect();
  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
