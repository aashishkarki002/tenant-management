/**
 * systemSettingSeed.js
 *
 * Seeds initial defaults into SystemConfig.
 * Safe to re-run — skips keys that already exist.
 *
 * Late fee default: simple_daily at 2%/day
 *   Rs 1,000 overdue × 2% × 1 day  = Rs  20
 *   Rs 1,000 overdue × 2% × 5 days = Rs 100
 *   Rs 1,000 overdue × 2% × 10 days = Rs 200
 *   (capped at Rs 5,000 per occurrence)
 */

import mongoose from "mongoose";
import { SystemConfig } from "./SystemConfig.Model.js";
import dotenv from "dotenv";
import { connectDB } from "../../config/db.js";
dotenv.config();

const INITIAL_SETTINGS = [
  {
    key: "rentEscalationDefaults",
    value: {
      enabled: false,
      percentageIncrease: 5, // 5% yearly increase
      intervalMonths: 12, // annual
      appliesTo: "rent_only",
    },
  },
  {
    key: "lateFeePolicy",
    value: {
      enabled: false, // admin must explicitly enable
      gracePeriodDays: 5, // 5 Nepali days grace after due date
      type: "simple_daily", // linear daily growth ← recommended
      amount: 2, // 2% per day of overdue balance
      appliesTo: "rent",
      compounding: false, // only applies when type="percentage"
      maxLateFeeAmount: 5000, // cap at Rs 5,000 per overdue period
    },
  },
];

export async function seedSystemSettings() {
  let connected = false;

  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
      connected = true;
      console.log("✅ Connected to MongoDB");
    }

    for (const setting of INITIAL_SETTINGS) {
      const existing = await SystemConfig.findOne({ key: setting.key });
      if (existing) {
        console.log(`⏭️  Skipped "${setting.key}" — already exists`);
        continue;
      }
      await SystemConfig.create(setting);
      console.log(`✅ Seeded "${setting.key}"`);
    }

    console.log("\n🌱 System settings seed complete");
    console.log("\nLate fee type reference:");
    console.log("  simple_daily  — Rs 1000 × 2% × days (linear, recommended)");
    console.log("  percentage    — Rs 1000 × 2% once (flat, one-time)");
    console.log(
      "  percentage    — Rs 1000 × ((1.02)^days − 1) (exponential, if compounding=true)",
    );
    console.log("  fixed         — Rs 500 flat once");
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    throw error;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

if (process.argv[1].endsWith("systemSettingSeed.js")) {
  seedSystemSettings().catch(() => process.exit(1));
}
