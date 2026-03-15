/**
 * seedLoanAccounts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the chart-of-accounts entries and LiabilitySource required by the
 * Loan module. Must be run ONCE per OwnershipEntity before any loan is created.
 *
 * Usage:
 *   ENTITY_ID=<ObjectId> node src/seeds/seedLoanAccounts.js
 *
 * Or from another seed script:
 *   import { seedLoanAccountsForEntity } from "./seedLoanAccounts.js";
 *   await seedLoanAccountsForEntity(entityId, session);
 *
 * Accounts created (per entity):
 *   2200  Loan Principal Liability  (LIABILITY) — balance sheet: what we owe
 *   5100  Loan Interest Expense     (EXPENSE)   — P&L: cost of borrowing
 *   5400  Bank Charges & Finance    (EXPENSE)   — P&L: fees (optional, reserved)
 *
 * LiabilitySource created (global, once):
 *   code: "LOAN", name: "Bank Loan / Lender"
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 */

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { LiabilitySource } from "../modules/liabilities/LiabilitesSource.Model.js";

/**
 * Seed loan accounts for a specific entity.
 * Called from Loan.service.js on first loan creation, or manually.
 *
 * @param {string|ObjectId} entityId
 * @param {mongoose.ClientSession|null} [session]
 */
export async function seedLoanAccountsForEntity(entityId, session = null) {
  if (!entityId)
    throw new Error("seedLoanAccountsForEntity: entityId required");

  const entityObjId =
    entityId instanceof mongoose.Types.ObjectId
      ? entityId
      : new mongoose.Types.ObjectId(String(entityId));

  const LOAN_ACCOUNTS = [
    {
      code: "2200",
      name: "Loan Principal Liability",
      type: "LIABILITY",
      description:
        "Outstanding principal owed to banks and lenders. " +
        "Increases on disbursement (CR), decreases on principal repayment (DR).",
    },
    {
      code: "5100",
      name: "Loan Interest Expense",
      type: "EXPENSE",
      description:
        "Interest charged on outstanding loan balances. " +
        "Increases on each EMI (DR). Flows to P&L as a finance cost.",
    },
    {
      code: "5400",
      name: "Bank Charges & Finance Fees",
      type: "EXPENSE",
      description:
        "Processing fees, annual maintenance charges, and other bank fees. " +
        "Reserved for future use.",
    },
  ];

  const results = [];

  for (const acct of LOAN_ACCOUNTS) {
    const existing = await Account.findOne({
      code: acct.code,
      entityId: entityObjId,
    }).session(session);

    if (existing) {
      results.push({ ...acct, action: "skipped — already exists" });
      continue;
    }

    const opts = session ? { session } : {};
    const created = await Account.create(
      session
        ? [
            {
              ...acct,
              entityId: entityObjId,
              currentBalancePaisa: 0,
              isActive: true,
            },
          ]
        : {
            ...acct,
            entityId: entityObjId,
            currentBalancePaisa: 0,
            isActive: true,
          },
      opts,
    );
    const doc = Array.isArray(created) ? created[0] : created;
    results.push({ ...acct, action: "created", _id: doc._id });
  }

  return results;
}

/**
 * Seed the global LiabilitySource for loans (code: "LOAN").
 * This is NOT per-entity — LiabilitySource is a shared lookup table.
 * Safe to call multiple times (idempotent).
 */
export async function seedLoanLiabilitySource() {
  const existing = await LiabilitySource.findOne({ code: "LOAN" });
  if (existing)
    return { action: "skipped — already exists", _id: existing._id };

  const doc = await LiabilitySource.create({
    name: "Bank Loan / Lender",
    code: "LOAN",
    category: "NON_OPERATING",
    description:
      "Long-term and short-term loans from banks and financial institutions.",
    isActive: true,
  });

  return { action: "created", _id: doc._id };
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith("seedLoanAccounts.js")) {
  const entityId = process.env.ENTITY_ID;
  if (!entityId) {
    console.error("Error: ENTITY_ID env var is required.");
    console.error(
      "Usage: ENTITY_ID=<ObjectId> node src/seeds/seedLoanAccounts.js",
    );
    process.exit(1);
  }

  const { connectDB } = await import("../config/db.js");
  await connectDB();

  console.log("Seeding LiabilitySource...");
  const srcResult = await seedLoanLiabilitySource();
  console.log("LiabilitySource:", srcResult);

  console.log(`Seeding loan accounts for entity ${entityId}...`);
  const acctResults = await seedLoanAccountsForEntity(entityId);
  for (const r of acctResults) {
    console.log(`  [${r.action}] ${r.code} — ${r.name}`);
  }

  console.log("Done.");
  process.exit(0);
}
