/**
 * seedAccount.js — v2 (multi-entity)
 *
 * BREAKING CHANGE: Account uniqueness is now (code, entityId).
 * Each OwnershipEntity gets its own full Chart of Accounts.
 *
 * Usage:
 *   # Seed CoA for ALL active entities:
 *   node seedAccount.js
 *
 *   # Seed CoA for ONE entity by _id:
 *   node seedAccount.js --entityId=<ObjectId>
 *
 * Migration note for existing data:
 *   Run migrateExistingAccounts() once to assign entityId to all
 *   Account documents that currently have entityId = null.
 *   You need to nominate a "default" entity for those.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { connectDB } from "../config/db.js";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS TEMPLATE
// Same structure for all entity types.
// For "company" entities you may want to add VAT payable (2200), etc.
// ─────────────────────────────────────────────────────────────────────────────

function getChartOfAccounts() {
  return [
    // ── ASSETS ──────────────────────────────────────────────────────────────
    {
      code: "1000",
      name: "Bank Account",
      type: "ASSET",
      description: "Bank accounts (bank transfer & cheque)",
    },
    {
      code: "1100",
      name: "Cash in Hand",
      type: "ASSET",
      description: "Cash in hand for daily transactions",
    },
    {
      code: "1200",
      name: "Accounts Receivable - Tenants",
      type: "ASSET",
      description: "Money owed by tenants for rent",
    },

    // ── LIABILITIES ──────────────────────────────────────────────────────────
    {
      code: "2000",
      name: "Accounts Payable",
      type: "LIABILITY",
      description: "Money owed to vendors and suppliers",
    },
    {
      code: "2100",
      name: "Security Deposits",
      type: "LIABILITY",
      description: "Tenant security deposits held",
    },

    // ── EQUITY ───────────────────────────────────────────────────────────────
    {
      code: "3000",
      name: "Owner's Equity",
      type: "EQUITY",
      description: "Owner's investment in the business",
    },
    {
      code: "3100",
      name: "Retained Earnings",
      type: "EQUITY",
      description: "Accumulated profits",
    },

    // ── REVENUE ──────────────────────────────────────────────────────────────
    {
      code: "4000",
      name: "Rental Income",
      type: "REVENUE",
      description: "Income from property rentals",
    },
    {
      code: "4100",
      name: "Other Income",
      type: "REVENUE",
      description: "Additional revenue streams (parking, amenities, etc.)",
    },
    {
      code: "4200",
      name: "Late Fee Income",
      type: "REVENUE",
      description: "Income from late payment fees",
    },

    // ── EXPENSES ─────────────────────────────────────────────────────────────
    {
      code: "5000",
      name: "Maintenance & Repairs",
      type: "EXPENSE",
      description: "Property maintenance and repair costs",
    },
    {
      code: "5100",
      name: "Salaries & Wages",
      type: "EXPENSE",
      description: "Staff salaries, wages, and advances",
    },
    {
      code: "5200",
      name: "Property Management Fees",
      type: "EXPENSE",
      description: "Fees paid for property management",
    },
    {
      code: "5300",
      name: "Insurance",
      type: "EXPENSE",
      description: "Property insurance expenses",
    },
    {
      code: "5400",
      name: "Property Tax",
      type: "EXPENSE",
      description: "Property tax expenses",
    },
    {
      code: "5500",
      name: "Administrative Expenses",
      type: "EXPENSE",
      description: "General administrative costs",
    },
    {
      code: "5600",
      name: "Utilities",
      type: "EXPENSE",
      description: "Water, electricity, gas expenses",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED FOR ONE ENTITY
// ─────────────────────────────────────────────────────────────────────────────

export async function seedAccountsForEntity(entity) {
  const accounts = getChartOfAccounts();
  const results = { created: 0, skipped: 0, errors: [] };

  for (const accountData of accounts) {
    try {
      const existing = await Account.findOne({
        code: accountData.code,
        entityId: entity._id,
      });

      if (!existing) {
        await Account.create({
          ...accountData,
          entityId: entity._id,
          currentBalancePaisa: 0,
          isActive: true,
        });
        console.log(
          `  ✓ [${entity.name}] Created: ${accountData.code} - ${accountData.name}`,
        );
        results.created++;
      } else {
        console.log(
          `  - [${entity.name}] Exists:  ${accountData.code} - ${accountData.name}`,
        );
        results.skipped++;
      }
    } catch (err) {
      console.error(
        `  ✗ [${entity.name}] Failed: ${accountData.code} — ${err.message}`,
      );
      results.errors.push({ code: accountData.code, error: err.message });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED ALL ENTITIES
// ─────────────────────────────────────────────────────────────────────────────

export async function seedAccounts(targetEntityId = null) {
  try {
    await connectDB();

    const entityFilter = { isActive: true };
    if (targetEntityId)
      entityFilter._id = new mongoose.Types.ObjectId(targetEntityId);

    const entities = await OwnershipEntity.find(entityFilter).lean();

    if (!entities.length) {
      console.warn("No active OwnershipEntities found. Create entities first.");
      return { success: false, message: "No entities found" };
    }

    console.log(
      `\nSeeding Chart of Accounts for ${entities.length} entity/entities...\n`,
    );

    const totals = { created: 0, skipped: 0, errors: [] };

    for (const entity of entities) {
      console.log(`\n[${entity.type.toUpperCase()}] ${entity.name}`);
      const result = await seedAccountsForEntity(entity);
      totals.created += result.created;
      totals.skipped += result.skipped;
      totals.errors.push(...result.errors);
    }

    console.log(
      `\n✓ Done. Created: ${totals.created}, Skipped: ${totals.skipped}`,
    );
    if (totals.errors.length) {
      console.error(`  Errors: ${totals.errors.length}`);
    }

    return {
      success: true,
      message: "Accounts seeded successfully",
      totals,
    };
  } catch (error) {
    console.error("Error seeding accounts:", error);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION: assign entityId to existing entityId=null accounts
// Run this ONCE when upgrading from v1 (single-entity) to v2 (multi-entity).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign all Account documents that have no entityId to a default entity.
 * After running, also seeds fresh CoA for all other entities.
 *
 * @param {string} defaultEntityId — the entity that "owns" the legacy accounts
 */
export async function migrateExistingAccounts(defaultEntityId) {
  if (!defaultEntityId) {
    throw new Error("defaultEntityId is required for migration");
  }

  await connectDB();

  const nullAccounts = await Account.find({ entityId: null });
  console.log(
    `\nMigrating ${nullAccounts.length} unscoped accounts → entity ${defaultEntityId}...`,
  );

  let migrated = 0;
  for (const acc of nullAccounts) {
    // Use updateOne to bypass the unique index check — safe because we're
    // assigning to a specific entity that doesn't have this code yet.
    await Account.updateOne(
      { _id: acc._id },
      { $set: { entityId: new mongoose.Types.ObjectId(defaultEntityId) } },
    );
    migrated++;
  }

  console.log(`✓ Migrated ${migrated} accounts to entity ${defaultEntityId}`);

  return { migrated };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI RUNNER
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (currentFile === runFile || import.meta.url.includes(runFile)) {
  const entityIdArg = process.argv
    .find((a) => a.startsWith("--entityId="))
    ?.split("=")[1];

  (async () => {
    try {
      await seedAccounts(entityIdArg ?? null);
      process.exit(0);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  })();
}
