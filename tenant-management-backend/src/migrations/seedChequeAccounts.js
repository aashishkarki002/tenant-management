/**
 * seedChequeAccounts.js
 *
 * One-time migration: seeds the two cheque clearing accounts for every active
 * OwnershipEntity that is missing them.
 *
 *   1150  Cheques In Hand   (ASSET)     — received cheques not yet deposited
 *   2150  Cheques Payable   (LIABILITY) — issued cheques not yet cleared
 *
 * These accounts are required for the two-step cheque lifecycle:
 *   RECEIVED: DR 1150 / CR Revenue → DR Bank / CR 1150
 *   ISSUED:   DR Expense / CR 2150 → DR 2150 / CR Bank
 *
 * Usage:
 *   node src/migrations/seedChequeAccounts.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";
import { fileURLToPath } from "url";

const CHEQUE_ACCOUNTS = [
  {
    code: ACCOUNT_CODES.CHEQUES_IN_HAND,
    name: "Cheques In Hand",
    type: "ASSET",
    description:
      "Cheques received but not yet deposited to the bank. " +
      "DR on receipt (paired with CR to Revenue). " +
      "CR on deposit or bounce reversal.",
  },
  {
    code: ACCOUNT_CODES.CHEQUES_PAYABLE,
    name: "Cheques Payable",
    type: "LIABILITY",
    description:
      "Cheques issued but not yet cleared by the bank. " +
      "CR on issue (paired with DR to Expense). " +
      "DR on clearance or bounce reversal.",
  },
];

async function run() {
  await connectDB();

  const entities = await OwnershipEntity.find({ isActive: true }).lean();
  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    process.exit(0);
  }

  console.log(
    `\nSeeding cheque clearing accounts for ${entities.length} entity/entities...\n`,
  );

  let created = 0;
  let skipped = 0;

  for (const entity of entities) {
    for (const acct of CHEQUE_ACCOUNTS) {
      const existing = await Account.findOne({
        code: acct.code,
        entityId: entity._id,
      });

      if (existing) {
        console.log(`  - [${entity.name}] Already exists: ${acct.code} — ${acct.name}`);
        skipped++;
        continue;
      }

      await Account.create({
        ...acct,
        entityId: entity._id,
        currentBalancePaisa: 0,
        isActive: true,
      });

      console.log(`  ✓ [${entity.name}] Created: ${acct.code} — ${acct.name}`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

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

export { run as seedChequeAccounts };
