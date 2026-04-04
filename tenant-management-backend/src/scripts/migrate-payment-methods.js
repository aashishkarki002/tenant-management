/**
 * migrate-payment-methods.js
 * ───────────────────────────────────────────────────────────────────────────────
 * Backfills paymentMethod field on existing Revenue and Liability records.
 *
 * USAGE:
 *   node src/scripts/migrate-payment-methods.js
 *
 * WHAT IT DOES:
 *   1. Updates all Revenue documents missing paymentMethod → defaults to "bank_transfer"
 *   2. Updates all Liability documents (where payeeType=EXTERNAL) missing paymentMethod → "bank_transfer"
 *   3. Reports statistics: how many records were updated
 *
 * SAFETY:
 *   - Only updates documents where paymentMethod field does not exist
 *   - Uses MongoDB updateMany with $exists: false filter
 *   - Safe to run multiple times (idempotent)
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import { Revenue } from "../modules/revenue/Revenue.Model.js";
import { Liability } from "../modules/liabilities/Liabilities.Model.js";

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/tenant-management";

async function migratePaymentMethods() {
  try {
    console.log("🔧 Starting payment method migration...\n");
    console.log(`📊 Connecting to MongoDB: ${MONGODB_URI}\n`);

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // ────────────────────────────────────────────────────────────────────────
    // 1. MIGRATE REVENUE DOCUMENTS
    // ────────────────────────────────────────────────────────────────────────
    console.log("──────────────────────────────────────────────────────");
    console.log("📝 Migrating Revenue documents...");
    console.log("──────────────────────────────────────────────────────\n");

    const revenueCountBefore = await Revenue.countDocuments({ paymentMethod: { $exists: false } });
    console.log(`Found ${revenueCountBefore} Revenue documents missing paymentMethod`);

    if (revenueCountBefore > 0) {
      const revenueResult = await Revenue.updateMany(
        { paymentMethod: { $exists: false } },
        { $set: { paymentMethod: "bank_transfer" } }
      );

      console.log(`✅ Updated ${revenueResult.modifiedCount} Revenue documents`);
      console.log(`   - Matched: ${revenueResult.matchedCount}`);
      console.log(`   - Modified: ${revenueResult.modifiedCount}\n`);
    } else {
      console.log("✅ No Revenue documents to migrate\n");
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. MIGRATE LIABILITY DOCUMENTS (EXTERNAL payees only)
    // ────────────────────────────────────────────────────────────────────────
    console.log("──────────────────────────────────────────────────────");
    console.log("📝 Migrating Liability documents (EXTERNAL payees)...");
    console.log("──────────────────────────────────────────────────────\n");

    const liabilityCountBefore = await Liability.countDocuments({
      payeeType: "EXTERNAL",
      paymentMethod: { $exists: false },
    });
    console.log(`Found ${liabilityCountBefore} Liability documents missing paymentMethod`);

    if (liabilityCountBefore > 0) {
      const liabilityResult = await Liability.updateMany(
        {
          payeeType: "EXTERNAL",
          paymentMethod: { $exists: false },
        },
        { $set: { paymentMethod: "bank_transfer" } }
      );

      console.log(`✅ Updated ${liabilityResult.modifiedCount} Liability documents`);
      console.log(`   - Matched: ${liabilityResult.matchedCount}`);
      console.log(`   - Modified: ${liabilityResult.modifiedCount}\n`);
    } else {
      console.log("✅ No Liability documents to migrate\n");
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. VERIFICATION
    // ────────────────────────────────────────────────────────────────────────
    console.log("──────────────────────────────────────────────────────");
    console.log("🔍 Verification...");
    console.log("──────────────────────────────────────────────────────\n");

    const revenueCountAfter = await Revenue.countDocuments({ paymentMethod: { $exists: false } });
    const liabilityCountAfter = await Liability.countDocuments({
      payeeType: "EXTERNAL",
      paymentMethod: { $exists: false },
    });

    console.log(`Revenue documents still missing paymentMethod: ${revenueCountAfter}`);
    console.log(`Liability documents still missing paymentMethod: ${liabilityCountAfter}\n`);

    if (revenueCountAfter === 0 && liabilityCountAfter === 0) {
      console.log("✅ ✅ ✅ MIGRATION SUCCESSFUL! All documents have paymentMethod field.\n");
    } else {
      console.warn("⚠️  Some documents still missing paymentMethod. Review logs above.\n");
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. SUMMARY
    // ────────────────────────────────────────────────────────────────────────
    console.log("══════════════════════════════════════════════════════");
    console.log("📊 MIGRATION SUMMARY");
    console.log("══════════════════════════════════════════════════════");
    console.log(`Revenue documents migrated:    ${revenueCountBefore} → ${revenueCountAfter} remaining`);
    console.log(`Liability documents migrated:  ${liabilityCountBefore} → ${liabilityCountAfter} remaining`);
    console.log(`Total migrated:                ${revenueCountBefore + liabilityCountBefore}`);
    console.log("══════════════════════════════════════════════════════\n");

    console.log("🎉 Migration complete!\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("📴 Disconnected from MongoDB\n");
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migratePaymentMethods()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { migratePaymentMethods };
