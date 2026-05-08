/**
 * migrateAccount5700.js
 *
 * ONE-TIME migration: fixes the 5700 account code collision.
 *
 * The original seedAccount.js put "Salaries & Wages" at code "5700".
 * ACCOUNT_CODES.BAD_DEBT_EXPENSE = "5700", so every vacate-settlement
 * bad-debt write-off silently debited the Salaries account.
 *
 * This script (per entity):
 *   1. Renames the existing "5700" account → "Bad Debt Expense"
 *   2. Creates a new "5750" account → "Salaries & Wages" (if not already there)
 *
 * Safe to re-run — idempotent.
 *
 * Usage:
 *   node src/seeds/migrateAccount5700.js
 *   node src/seeds/migrateAccount5700.js --entityId=<ObjectId>
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { connectDB } from "../config/db.js";
import { fileURLToPath } from "url";

async function migrateEntity(entity) {
  const entityId = entity._id;
  const log = (msg) => console.log(`  [${entity.name}] ${msg}`);

  // Step 1: Fix code 5700 — rename if it's "Salaries & Wages"
  const acct5700 = await Account.findOne({ code: "5700", entityId }).lean();

  if (!acct5700) {
    log("5700 not found — run seedAccount.js first");
    return;
  }

  if (acct5700.name === "Bad Debt Expense") {
    log("5700 already correctly named 'Bad Debt Expense' — skip rename");
  } else {
    await Account.findByIdAndUpdate(acct5700._id, {
      $set: {
        name: "Bad Debt Expense",
        description:
          "Uncollectable Accounts Receivable written off at tenant vacate settlement. " +
          "Posted when AR remains after applying the security deposit and the " +
          "landlord determines the balance is unrecoverable.",
      },
    });
    log(`✓ 5700 renamed: "${acct5700.name}" → "Bad Debt Expense"`);
  }

  // Step 2: Create 5750 "Salaries & Wages" if missing
  const acct5750 = await Account.findOne({ code: "5750", entityId }).lean();

  if (acct5750) {
    log("5750 already exists — skip create");
  } else {
    await Account.create({
      code: "5750",
      name: "Salaries & Wages",
      type: "EXPENSE",
      description: "Staff salaries, wages, and performance bonuses.",
      entityId,
      currentBalancePaisa: 0,
      isActive: true,
    });
    log("✓ 5750 created: 'Salaries & Wages'");
  }
}

async function run(targetEntityId = null) {
  await connectDB();

  const filter = { isActive: true };
  if (targetEntityId) filter._id = new mongoose.Types.ObjectId(targetEntityId);

  const entities = await OwnershipEntity.find(filter).lean();

  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    return;
  }

  console.log(`\nMigrating account 5700 for ${entities.length} entity/entities...\n`);

  for (const entity of entities) {
    await migrateEntity(entity);
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

export { run as migrateAccount5700 };
