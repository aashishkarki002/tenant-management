/**
 * seedChequeClearingAccount.js
 *
 * One-time migration: seeds the "Cheques in Transit" account (code "1020")
 * for every active OwnershipEntity that is missing it.
 *
 * NOTE: Code "1020" is now a legacy account. New cheque journals post directly
 * to the bank account. This seed is kept so existing entities retain the account
 * for historical ledger entry resolution.
 *
 * Usage:
 *   node src/migrations/seedChequeClearingAccount.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { fileURLToPath } from "url";

const CHEQUE_CLEARING_CODE = "1020";

const CHEQUE_CLEARING_ACCOUNT = {
  code: CHEQUE_CLEARING_CODE,
  name: "Cheques in Transit (Legacy)",
  type: "ASSET",
  description:
    "Legacy clearing account for cheque payments. No longer used for new journals. " +
    "Retained so historical ledger entries remain resolvable.",
};

async function run() {
  await connectDB();

  const entities = await OwnershipEntity.find({ isActive: true }).lean();
  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    process.exit(0);
  }

  console.log(
    `\nSeeding "Cheques in Transit" (${CHEQUE_CLEARING_CODE}) for ${entities.length} entity/entities...\n`,
  );

  let created = 0;
  let skipped = 0;

  for (const entity of entities) {
    const existing = await Account.findOne({
      code: CHEQUE_CLEARING_CODE,
      entityId: entity._id,
    });

    if (existing) {
      console.log(`  - [${entity.name}] Already exists — skipped.`);
      skipped++;
      continue;
    }

    await Account.create({
      ...CHEQUE_CLEARING_ACCOUNT,
      entityId: entity._id,
      currentBalancePaisa: 0,
      isActive: true,
    });

    console.log(`  ✓ [${entity.name}] Created: 1020 — Cheques in Transit (Legacy)`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

// ── CLI runner ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (currentFile === runFile || import.meta.url.includes(runFile)) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    });
}

export { run as seedChequeClearingAccount };
