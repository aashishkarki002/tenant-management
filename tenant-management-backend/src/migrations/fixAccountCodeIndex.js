/**
 * Migration: Fix Account collection indexes for multi-entity CoA.
 *
 * Problem: An old unique index on `code` alone (code_1) prevents seeding
 * the same account codes for different entities (e.g. head_office).
 *
 * Fix: Drop the legacy code_1 unique index if present. The schema already
 * defines the compound unique index (code, entityId).
 *
 * Run once: node src/migrations/fixAccountCodeIndex.js
 */

import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";

async function fixAccountCodeIndex() {
  await connectDB();

  const indexes = await Account.collection.indexes();
  const codeOnly = indexes.find((i) => i.name === "code_1");

  if (codeOnly && codeOnly.unique) {
    console.log("Dropping legacy unique index 'code_1' on accounts...");
    await Account.collection.dropIndex("code_1");
    console.log("  ✓ Dropped code_1");
  } else if (codeOnly) {
    console.log("Index code_1 exists but is not unique; leaving as-is.");
  } else {
    console.log("No legacy code_1 index found.");
  }

  // Ensure compound unique index exists (Mongoose may have created it as code_1_entityId_1)
  const compound = indexes.find(
    (i) => i.key && i.key.code === 1 && i.key.entityId === 1 && i.unique
  );
  if (!compound) {
    console.log("Creating compound unique index (code, entityId)...");
    await Account.collection.createIndex(
      { code: 1, entityId: 1 },
      { unique: true }
    );
    console.log("  ✓ Created code_1_entityId_1 unique");
  }

  console.log("\nDone. You can now run: node src/seeds/seedAccount.js --entityId=<head_office_entity_id>");
  process.exit(0);
}

fixAccountCodeIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
