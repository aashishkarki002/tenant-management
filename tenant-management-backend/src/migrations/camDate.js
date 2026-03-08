/**
 * fix_cam_englishDueDate.js
 *
 * One-shot migration: copies nepaliDueDate → englishDueDate on every CAM
 * record where englishDueDate is null but nepaliDueDate is set.
 *
 * Both fields are stored as JS Date (English calendar) in this codebase —
 * the field is just misnamed "nepaliDueDate". So the copy is a direct
 * value assignment, no calendar conversion needed.
 *
 * Run once:
 *   node fix_cam_englishDueDate.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Cam } from "../modules/cam/cam.model.js";

async function run() {
  await connectDB();
  console.log("Connected to MongoDB");

  // Find all CAMs where englishDueDate is null but nepaliDueDate has a value
  const result = await Cam.updateMany(
    {
      englishDueDate: null,
      nepaliDueDate: { $ne: null },
    },
    [
      {
        $set: {
          englishDueDate: "$nepaliDueDate",
        },
      },
    ],
    { updatePipeline: true }
  );

  console.log(`✅ Updated ${result.modifiedCount} CAM records`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
