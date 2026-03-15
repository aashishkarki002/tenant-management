/**
 * camDateSetMissing.js
 *
 * One-shot migration: sets nepaliDueDate and englishDueDate on CAM records
 * that are missing either field.
 *
 * Defaults used:
 *   nepaliDueDate: 2083-02-01T00:00:00.000Z
 *   englishDueDate: 2026-05-16T00:00:00.000Z
 *
 * Run once:
 *   node src/migrations/camDateSetMissing.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Cam } from "../modules/cam/cam.model.js";

const NEPALI_DUE_DATE = new Date("2083-02-01T00:00:00.000Z");
const ENGLISH_DUE_DATE = new Date("2026-05-16T00:00:00.000Z");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB");

  // Find CAMs missing either nepaliDueDate or englishDueDate
  const result = await Cam.updateMany(
    {
      $or: [
        { nepaliDueDate: null },
        { nepaliDueDate: { $exists: false } },
        { englishDueDate: null },
        { englishDueDate: { $exists: false } },
      ],
    },
    {
      $set: {
        nepaliDueDate: NEPALI_DUE_DATE,
        englishDueDate: ENGLISH_DUE_DATE,
      },
    }
  );

  console.log(
    `✅ Matched ${result.matchedCount}, updated ${result.modifiedCount} CAM record(s)`
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
