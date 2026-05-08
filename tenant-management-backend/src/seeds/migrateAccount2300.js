/**
 * migrateAccount2300.js
 *
 * ONE-TIME: seeds "Deferred Rent Revenue" (code 2300) for all entities.
 * Referenced by ACCOUNT_CODES.DEFERRED_RENT_REVENUE in advance-rent journals.
 *
 * Safe to re-run — idempotent.
 *
 * Usage:
 *   node src/seeds/migrateAccount2300.js
 *   node src/seeds/migrateAccount2300.js --entityId=<ObjectId>
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { connectDB } from "../config/db.js";
import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";
import { fileURLToPath } from "url";

async function run(targetEntityId = null) {
  await connectDB();
  const filter = { isActive: true };
  if (targetEntityId) filter._id = new mongoose.Types.ObjectId(targetEntityId);
  const entities = await OwnershipEntity.find(filter).lean();
  if (!entities.length) { console.warn("No active entities."); return; }

  console.log(`\nSeeding account 2300 for ${entities.length} entity/entities...\n`);

  for (const entity of entities) {
    const existing = await Account.findOne({ code: ACCOUNT_CODES.DEFERRED_RENT_REVENUE, entityId: entity._id }).lean();
    if (existing) {
      console.log(`  [${entity.name}] 2300 already exists — skip`);
    } else {
      await Account.create({
        code: ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
        name: "Deferred Rent Revenue",
        type: "LIABILITY",
        description: "Advance rent payments received from tenants before the rental period begins.",
        entityId: entity._id,
        currentBalancePaisa: 0,
        isActive: true,
      });
      console.log(`  [${entity.name}] ✓ 2300 created: 'Deferred Rent Revenue'`);
    }
  }
  console.log("\n✓ Done.");
}

const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (currentFile === runFile || import.meta.url.includes(runFile)) {
  const entityIdArg = process.argv.find((a) => a.startsWith("--entityId="))?.split("=")[1];
  run(entityIdArg ?? null).then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
}

export { run as migrateAccount2300 };
