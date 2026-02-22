/**
 * SYSTEM SETTINGS SEED
 *
 * Run once to populate initial defaults in SystemConfig.
 * Safe to re-run — uses upsert so it won't create duplicates.
 *
 * Usage:
 *   node src/modules/systemConfig/systemSettingSeed.js
 *
 * Or call seedSystemSettings() from your db.js after connecting:
 *   import { seedSystemSettings } from "./systemSettingSeed.js";
 *   await seedSystemSettings();
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
      enabled: false, // Admin must explicitly enable
      percentageIncrease: 5, // 5% yearly increase — industry standard for Nepal commercial
      intervalMonths: 12, // Annual
      appliesTo: "rent_only", // Rent only by default; CAM kept separate
    },
  },
  {
    key: "lateFeePolicy",
    value: {
      enabled: false, // Admin must explicitly enable
      gracePeriodDays: 5, // 5-day grace period after due date
      type: "percentage", // Charge a % of overdue rent
      amount: 2, // 2% of overdue amount
      appliesTo: "rent", // Apply to rent only
      compounding: false, // Flat fee, not daily compounding
      maxLateFeeAmount: 5000, // Cap at Rs. 5,000 per occurrence
    },
  },
];

export async function seedSystemSettings() {
  let connected = false;

  try {
    // Connect only if running as standalone script
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
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    throw error;
  } finally {
    if (connected) {
      await mongoose.disconnect();
    }
  }
}

// Run as standalone script
if (process.argv[1].endsWith("systemSettingSeed.js")) {
  seedSystemSettings().catch(() => process.exit(1));
}
