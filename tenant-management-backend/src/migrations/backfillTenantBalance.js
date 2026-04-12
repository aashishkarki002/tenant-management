/**
 * scripts/backfill-tenant-balances.js
 *
 * One-time script to seed TenantBalance for all existing tenants.
 * Run ONCE after deploying the new model.
 *
 * Usage:
 *   node scripts/backfill-tenant-balances.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Import after dotenv so MONGO_URI is set
import { rebuildAllTenantBalances } from "../modules/tenantBalance/tenantBalance.service.js";
import { connectDB } from "../config/db.js";
async function run() {
  await connectDB();
  console.log("Connected to MongoDB");

  const result = await rebuildAllTenantBalances();
  console.log(`Done: ${result.processed} synced, ${result.errors} errors`);

  await mongoose.disconnect();
  process.exit(result.errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
