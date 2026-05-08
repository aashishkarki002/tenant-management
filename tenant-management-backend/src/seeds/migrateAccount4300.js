/**
 * migrateAccount4300.js
 *
 * ONE-TIME migration: seeds "Maintenance Revenue" (code 4300) for all entities.
 *
 * This account was missing from the original seedAccount.js but is referenced by
 * ACCOUNT_CODES.MAINTENANCE_REVENUE = "4300" in vacate settlement SD maintenance
 * deductions. Missing document causes a runtime throw on vacate settlement.
 *
 * Safe to re-run — idempotent.
 *
 * Usage:
 *   node src/seeds/migrateAccount4300.js
 *   node src/seeds/migrateAccount4300.js --entityId=<ObjectId>
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

  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    return;
  }

  console.log(`\nSeeding account 4300 for ${entities.length} entity/entities...\n`);

  for (const entity of entities) {
    const existing = await Account.findOne({
      code: ACCOUNT_CODES.MAINTENANCE_REVENUE,
      entityId: entity._id,
    }).lean();

    if (existing) {
      console.log(`  [${entity.name}] 4300 already exists — skip`);
    } else {
      await Account.create({
        code: ACCOUNT_CODES.MAINTENANCE_REVENUE,
        name: "Maintenance Revenue",
        type: "REVENUE",
        description:
          "Revenue from maintenance deductions withheld from the security deposit at vacate " +
          "settlement. Posted when SD settlement includes a MAINTENANCE_ADJUSTMENT deduction.",
        entityId: entity._id,
        currentBalancePaisa: 0,
        isActive: true,
      });
      console.log(`  [${entity.name}] ✓ 4300 created: 'Maintenance Revenue'`);
    }
  }

  console.log("\n✓ Migration complete.");
}

const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (currentFile === runFile || import.meta.url.includes(runFile)) {
  const entityIdArg = process.argv
    .find((a) => a.startsWith("--entityId="))
    ?.split("=")[1];

  run(entityIdArg ?? null)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    });
}

export { run as migrateAccount4300 };
