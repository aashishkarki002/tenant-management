/**
 * seedYearEndAccounts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the chart-of-accounts entries required for year-end close and
 * vacate settlement features. Must be run ONCE per OwnershipEntity.
 *
 * Usage:
 *   ENTITY_ID=<ObjectId> node src/seeds/seedYearEndAccounts.js
 *
 * Or from another script:
 *   import { seedYearEndAccountsForEntity } from "./seedYearEndAccounts.js";
 *   await seedYearEndAccountsForEntity(entityId, session);
 *
 * Accounts created (per entity):
 *   3500  Income Summary             (EQUITY)  — temporary FY-close clearing account
 *   5700  Bad Debt Expense           (EXPENSE) — uncollectable AR write-off on vacate
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../config/db.js";

const NEW_ACCOUNTS = [
  {
    code: "3500",
    name: "Income Summary",
    type: "EQUITY",
    description:
      "Temporary clearing account used ONLY during year-end close. " +
      "Receives all revenue and expense balances, then transfers net income " +
      "to Retained Earnings (3100). Must be zero after all three closing passes.",
  },
  {
    code: "5700",
    name: "Bad Debt Expense",
    type: "EXPENSE",
    description:
      "Uncollectable Accounts Receivable written off at tenant vacate settlement. " +
      "Posted when AR remains after applying the security deposit and the " +
      "landlord determines the balance is unrecoverable.",
  },
];

/**
 * Seed year-end accounts for a specific entity.
 * Idempotent — skips accounts that already exist.
 *
 * @param {string|ObjectId}              entityId
 * @param {mongoose.ClientSession|null}  [session]
 * @returns {Promise<Array>}  Results per account (action + code)
 */
export async function seedYearEndAccountsForEntity(entityId, session = null) {
  if (!entityId) throw new Error("seedYearEndAccountsForEntity: entityId required");

  const entityObjId =
    entityId instanceof mongoose.Types.ObjectId
      ? entityId
      : new mongoose.Types.ObjectId(String(entityId));

  const results = [];

  for (const acct of NEW_ACCOUNTS) {
    const existing = await Account.findOne({
      code: acct.code,
      entityId: entityObjId,
    }).session(session ?? null);

    if (existing) {
      results.push({ code: acct.code, action: "skipped — already exists" });
      continue;
    }

    const docData = {
      ...acct,
      entityId: entityObjId,
      currentBalancePaisa: 0,
      isActive: true,
    };

    let doc;
    if (session) {
      const [created] = await Account.create([docData], { session });
      doc = created;
    } else {
      doc = await Account.create(docData);
    }
    results.push({ code: acct.code, action: "created", _id: doc._id });
  }

  return results;
}

/**
 * Seed for ALL entities in the database.
 * Useful for applying the new accounts to existing installations.
 */
export async function seedAllEntities() {
  const { OwnershipEntity } = await import(
    "../modules/ownership/OwnershipEntity.Model.js"
  );
  const entities = await OwnershipEntity.find({ isActive: true }).select("_id name").lean();

  if (!entities.length) {
    console.log("No active entities found.");
    return;
  }

  for (const entity of entities) {
    console.log(`\nSeeding for entity: ${entity.name} (${entity._id})`);
    const results = await seedYearEndAccountsForEntity(entity._id);
    for (const r of results) {
      console.log(`  [${r.action}] ${r.code}`);
    }
  }
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith("seedYearEndAccounts.js")) {
  const entityId = process.env.ENTITY_ID;

  const { connectDB } = await import("../config/db.js");
  await connectDB();

  if (entityId) {
    console.log(`Seeding year-end accounts for entity ${entityId}...`);
    const results = await seedYearEndAccountsForEntity(entityId);
    for (const r of results) {
      console.log(`  [${r.action}] ${r.code}`);
    }
  } else {
    console.log("No ENTITY_ID provided — seeding ALL entities...");
    await seedAllEntities();
  }

  console.log("\nDone.");
  process.exit(0);
}
