/**
 * seedCamReceivableAccount.js
 *
 * One-time migration: seeds account 1210 (CAM Receivable) for every active
 * OwnershipEntity that is missing it.
 *
 * Background:
 *   Before this migration, CAM AR was commingled with Rent AR on account 1200
 *   (Accounts Receivable). Splitting them gives separate trial-balance lines for
 *   rent and CAM, enabling proper per-component reporting.
 *
 *   After this migration:
 *     1200  Accounts Receivable — rent, electricity, late fees
 *     1210  CAM Receivable      — CAM charges only
 *
 *   All new CAM_CHARGE, CAM_PAYMENT_RECEIVED, and PRO-RATED CAM journals now
 *   DR/CR 1210. Historic entries (pre-migration) remain on 1200 — they are
 *   kept as-is since retroactive re-posting would risk double-counting.
 *
 * Usage:
 *   node src/migrations/seedCamReceivableAccount.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";
import { fileURLToPath } from "url";

const CAM_RECEIVABLE_ACCOUNT = {
  code: ACCOUNT_CODES.CAM_RECEIVABLE, // "1210"
  name: "CAM Receivable",
  type: "ASSET",
  description:
    "Common Area Maintenance amounts owed by tenants. " +
    "DR on CAM charge (CAM_CHARGE / CAM_CHARGE_PRORATED). " +
    "CR on CAM payment received (CAM_PAYMENT_RECEIVED). " +
    "Separate from Rent AR (1200) to allow isolated reporting.",
};

async function run() {
  await connectDB();

  const entities = await OwnershipEntity.find({ isActive: true }).lean();
  if (!entities.length) {
    console.warn("No active OwnershipEntities found.");
    process.exit(0);
  }

  console.log(
    `\nSeeding CAM Receivable (1210) for ${entities.length} entity/entities...\n`,
  );

  let created = 0;
  let skipped = 0;

  for (const entity of entities) {
    const existing = await Account.findOne({
      code: CAM_RECEIVABLE_ACCOUNT.code,
      entityId: entity._id,
    });

    if (existing) {
      console.log(
        `  - [${entity.name}] Already exists: ${CAM_RECEIVABLE_ACCOUNT.code} — ${CAM_RECEIVABLE_ACCOUNT.name}`,
      );
      skipped++;
      continue;
    }

    await Account.create({
      ...CAM_RECEIVABLE_ACCOUNT,
      entityId: entity._id,
      currentBalancePaisa: 0,
      isActive: true,
    });

    console.log(
      `  ✓ [${entity.name}] Created: ${CAM_RECEIVABLE_ACCOUNT.code} — ${CAM_RECEIVABLE_ACCOUNT.name}`,
    );
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  console.log(
    "\nNOTE: Historic CAM ledger entries (pre-migration) remain on 1200.",
    "\nRun a balance rebuild (rebuildAccountBalance) for both 1200 and 1210",
    "\nafter confirming the seeded accounts are correct.",
  );
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

export { run as seedCamReceivableAccount };
