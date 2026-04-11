/**
 * seedChequeClearingAccount.js
 *
 * One-time migration: seeds the "Cheques in Transit" account (code "1020")
 * for every active OwnershipEntity that is missing it.
 *
 * This account is required by paymentAccountUtils.js when paymentMethod === "cheque".
 * Without it, any cheque revenue/payment creation throws:
 *   "Account 'undefined' not found for entity <id>"
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
import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";
import { fileURLToPath } from "url";

const CHEQUE_CLEARING_ACCOUNT = {
  code: ACCOUNT_CODES.CHEQUE_CLEARING, // "1020"
  name: "Cheques in Transit",
  type: "ASSET",
  description:
    "Cheques issued or received that have not yet been processed by the bank. " +
    "First leg of every cheque journal posts here. Second leg (deposit) moves " +
    "the balance to the actual bank sub-account. Net balance = sum of pending cheques.",
};

async function run() {
  await connectDB();

  const entities = await OwnershipEntity.find({ isActive: true }).lean();
  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    process.exit(0);
  }

  console.log(
    `\nSeeding "Cheques in Transit" (${ACCOUNT_CODES.CHEQUE_CLEARING}) for ${entities.length} entity/entities...\n`,
  );

  let created = 0;
  let skipped = 0;

  for (const entity of entities) {
    const existing = await Account.findOne({
      code: ACCOUNT_CODES.CHEQUE_CLEARING,
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

    console.log(`  ✓ [${entity.name}] Created: 1020 — Cheques in Transit`);
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
