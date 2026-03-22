/**
 * seedAccount.js — v2 (multi-entity)  [FIXED]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUGS FIXED IN THIS VERSION:
 *
 * BUG 1 — Code collision: "1000" seeded as "Bank Account" (ASSET)
 *   ORIGINAL: code "1000" → "Bank Account" (used for bank transfers/cheques)
 *   PROBLEM:  ACCOUNT_CODES.CASH = "1000" means "Cash in Hand" (physical cash).
 *             The journal builder posts cash payments to "1000", expecting it to
 *             be CASH. Naming it "Bank Account" is misleading and wrong —
 *             actual bank sub-accounts are dynamic codes like "1010-NABIL".
 *             Any paymentMethod === "cash" would DR "Bank Account" instead of
 *             "Cash in Hand", silently corrupting the cash balance.
 *   FIX:      Rename code "1000" → "Cash in Hand" (physical cash only).
 *             Code "1100" (was "Cash in Hand") is now "Petty Cash / Cash Float"
 *             since "1000" owns the canonical CASH meaning.
 *
 * BUG 2 — Code collision: "5100" seeded as "Salaries & Wages"
 *   ORIGINAL: code "5100" → "Salaries & Wages"
 *   PROBLEM:  ACCOUNT_CODES.LOAN_INTEREST_EXPENSE = "5100".
 *             When any EMI payment is recorded, the journal builder posts:
 *               DR 5100  interestPaisa   (expecting "Loan Interest Expense")
 *             But "5100" in the DB is "Salaries & Wages" — a completely
 *             different account. Every loan interest posting would silently
 *             inflate the Salaries account. The P&L would show wrong salary
 *             figures and zero loan interest.
 *   FIX:      Move "Salaries & Wages" to code "5700" (free slot).
 *             Code "5100" is reserved exclusively for LOAN_INTEREST_EXPENSE,
 *             and is now seeded via ACCOUNT_CODES.LOAN_INTEREST_EXPENSE.
 *
 * BUG 3 — Code collision: "5400" seeded as "Property Tax"
 *   ORIGINAL: code "5400" → "Property Tax"
 *   PROBLEM:  accounts.js defines BANK_CHARGES = "5400" (reserved).
 *             More critically, the OLD (pre-fix) accounts.js had
 *             LOAN_INTEREST_EXPENSE = "5400". If anyone ran the old
 *             seedAccount.js and the old accounts.js together, loan interest
 *             would post to "Property Tax". Even after the accounts.js fix,
 *             having "5400" as "Property Tax" is a landmine for BANK_CHARGES.
 *   FIX:      Move "Property Tax" to code "5800" (free slot).
 *             Code "5400" is reserved for BANK_CHARGES per accounts.js.
 *
 * BUG 4 — LOAN_LIABILITY and LOAN_INTEREST_EXPENSE appended at the end
 *         without checking for conflicts with the codes above them
 *   ORIGINAL: The two loan accounts were appended as a patch at the end of
 *             getChartOfAccounts() using ACCOUNT_CODES references. This is
 *             fine structurally but the codes they resolve to ("2200", "5100")
 *             were already occupied in the array above — "5100" by Salaries.
 *             Mongoose would throw a duplicate-key error on the (code, entityId)
 *             unique index when trying to create both "5100" entries.
 *   FIX:      Inline LOAN_LIABILITY (2200) and LOAN_INTEREST_EXPENSE (5100)
 *             in their correct numeric position within the array. The array
 *             is now ordered by code, making conflicts visible at a glance.
 *             Removed the separately appended patch entries at the bottom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   # Seed CoA for ALL active entities:
 *   node seedAccount.js
 *
 *   # Seed CoA for ONE entity by _id:
 *   node seedAccount.js --entityId=<ObjectId>
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { connectDB } from "../config/db.js";
import { fileURLToPath } from "url";
import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";

// ─────────────────────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS TEMPLATE
// Ordered by account code. Same structure for all entity types.
//
// RESERVED / DYNAMIC codes (NOT seeded here — created elsewhere):
//   1010–1099  Bank sub-accounts       (created when BankAccount doc is added)
//   1050       Mobile wallet float     (seed manually before first wallet payment)
//   5400       Bank charges & fees     (reserved in accounts.js — not yet in use)
// ─────────────────────────────────────────────────────────────────────────────

function getChartOfAccounts() {
  return [
    // ── ASSETS ──────────────────────────────────────────────────────────────
    {
      code: "1000",
      // FIX BUG 1: was "Bank Account" — but 1000 = ACCOUNT_CODES.CASH = physical cash.
      // Bank sub-accounts are dynamic codes (1010-NABIL, etc.), never hardcoded here.
      name: "Cash in Hand",
      type: "ASSET",
      description:
        "Physical cash on hand. Journal builders post here when paymentMethod === 'cash'. " +
        "Do NOT use for bank transfers — those go to dynamic 1010-xxx sub-accounts.",
    },
    {
      code: "1100",
      // FIX BUG 1 (cont): was "Cash in Hand" at 1100. Renamed to Petty Cash since
      // "Cash in Hand" is now correctly at 1000.
      name: "Petty Cash / Cash Float",
      type: "ASSET",
      description: "Small cash held for day-to-day operational expenses.",
    },
    {
      code: "1200",
      name: "Accounts Receivable - Tenants",
      type: "ASSET",
      description:
        "Amounts owed by tenants: rent, CAM, electricity, late fees. " +
        "DR on charge, CR on payment received.",
    },

    // ── LIABILITIES ──────────────────────────────────────────────────────────
    {
      code: "2000",
      name: "Accounts Payable",
      type: "LIABILITY",
      description: "Amounts owed to vendors and suppliers.",
    },
    {
      code: "2050",
      name: "NEA Electricity Payable",
      type: "LIABILITY",
      description:
        "Amount owed to Nepal Electricity Authority (NEA) for electricity consumed " +
        "but not yet paid. CR when an NEA bill is posted via buildElectricityNeaCostJournal; " +
        "DR when the NEA invoice is settled (owner pays NEA). " +
        "String key referenced in journal builder as 'NEA_PAYABLE'.",
    },
    {
      code: "2100",
      name: "Security Deposits Held",
      type: "LIABILITY",
      description:
        "Tenant security deposits held in trust. Liability because the amount " +
        "is owed back to the tenant on vacancy.",
    },
    {
      // LOAN_LIABILITY = "2200"
      code: ACCOUNT_CODES.LOAN_LIABILITY,
      name: "Loan Principal Liability",
      type: "LIABILITY",
      description:
        "Outstanding principal owed to banks and lenders. " +
        "CR on disbursement (money received), DR on each EMI principal repayment.",
    },

    // ── EQUITY ───────────────────────────────────────────────────────────────
    {
      code: "3000",
      name: "Owner's Equity",
      type: "EQUITY",
      description: "Owner's capital investment in the property business.",
    },
    {
      code: "3100",
      name: "Retained Earnings",
      type: "EQUITY",
      description: "Accumulated net profits carried forward.",
    },

    // ── REVENUE ──────────────────────────────────────────────────────────────
    {
      code: "4000",
      name: "Rental Income",
      type: "REVENUE",
      description: "Income from occupied unit rent charges.",
    },
    {
      code: "4100",
      name: "Other Income",
      type: "REVENUE",
      description:
        "Additional revenue: parking, amenities, utility billing to tenants, etc.",
    },
    {
      code: "4200",
      name: "Late Fee Income",
      type: "REVENUE",
      description: "Penalty income from late rent payments.",
    },

    // ── EXPENSES ─────────────────────────────────────────────────────────────
    {
      code: "5000",
      name: "Maintenance & Repairs",
      type: "EXPENSE",
      description: "Property maintenance, repairs, and upkeep costs.",
    },
    {
      // LOAN_INTEREST_EXPENSE = "5100"
      // FIX BUG 2: was "Salaries & Wages" at 5100. Salaries moved to 5700.
      // 5100 must be Loan Interest Expense because ACCOUNT_CODES.LOAN_INTEREST_EXPENSE = "5100".
      // Having Salaries at 5100 meant every EMI interest posting silently debited
      // the Salaries account instead, corrupting both salary figures and loan P&L.
      code: ACCOUNT_CODES.LOAN_INTEREST_EXPENSE,
      name: "Loan Interest Expense",
      type: "EXPENSE",
      description:
        "Finance charges — interest portion of each EMI payment. " +
        "This is a P&L expense, NOT a reduction of the loan liability. " +
        "DR here on each EMI; the principal portion DRs Loan Liability (2200).",
    },
    {
      code: "5200",
      name: "Property Management Fees",
      type: "EXPENSE",
      description: "Fees paid for third-party property management services.",
    },
    {
      code: "5300",
      name: "Insurance",
      type: "EXPENSE",
      description: "Property insurance premiums.",
    },
    {
      // FIX BUG 3: was "Property Tax" at 5400.
      // 5400 = ACCOUNT_CODES.BANK_CHARGES (reserved in accounts.js).
      // Property Tax moved to 5800.
      code: "5500",
      name: "Administrative Expenses",
      type: "EXPENSE",
      description: "General administrative and office costs.",
    },
    {
      code: "5600",
      name: "Utilities",
      type: "EXPENSE",
      description: "Water, electricity, gas — costs borne by the owner.",
    },
    {
      code: "5610",
      name: "NEA Electricity Expense",
      type: "EXPENSE",
      description:
        "Electricity cost billed by Nepal Electricity Authority (NEA) for common areas " +
        "and owner-borne meters. DR when an NEA bill is posted (paired with CR to NEA_PAYABLE / 2050). " +
        "This is a sub-account of Utilities (5600). " +
        "String key referenced in journal builder as 'ELECTRICITY_EXPENSE_NEA'.",
    },
    {
      code: "5700",
      name: "Salaries & Wages",
      type: "EXPENSE",
      description: "Staff salaries, wages, and performance bonuses.",
    },
    {
      // FIX BUG 3: Property Tax moved here from 5400.
      code: "5800",
      name: "Property Tax",
      type: "EXPENSE",
      description: "Annual and quarterly property tax obligations.",
    },
    {
      code: "5900",
      name: "Miscellaneous Expense",
      type: "EXPENSE",
      description: "Unclassified or one-off operating expenses.",
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
          `  ✓ [${entity.name}] Created: ${accountData.code} — ${accountData.name}`,
        );
        results.created++;
      } else {
        console.log(
          `  - [${entity.name}] Exists:  ${accountData.code} — ${accountData.name}`,
        );
        results.skipped++;
      }
    } catch (err) {
      console.error(
        `  ✗ [${entity.name}] Failed:  ${accountData.code} — ${err.message}`,
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
      console.error(`  Errors (${totals.errors.length}):`);
      for (const e of totals.errors) {
        console.error(`    ${e.code}: ${e.error}`);
      }
    }

    return { success: true, message: "Accounts seeded successfully", totals };
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
// COLLISION SELF-CHECK (dev/debug helper)
// Call this before running the seed to catch future regressions.
// ─────────────────────────────────────────────────────────────────────────────

export function assertNoDuplicateCodes() {
  const accounts = getChartOfAccounts();
  const seen = new Map(); // code → name
  const collisions = [];

  for (const acct of accounts) {
    if (seen.has(acct.code)) {
      collisions.push({
        code: acct.code,
        first: seen.get(acct.code),
        duplicate: acct.name,
      });
    } else {
      seen.set(acct.code, acct.name);
    }
  }

  // Also check each seeded code against ACCOUNT_CODES values
  const codeValues = Object.entries(ACCOUNT_CODES);
  for (const [key, code] of codeValues) {
    const seeded = seen.get(code);
    if (seeded) {
      // Warn if the seeded name doesn't look like it matches the ACCOUNT_CODES key
      // (heuristic: account name should roughly correspond to the key meaning)
      const keyWords = key.toLowerCase().replace(/_/g, " ");
      const nameWords = seeded.toLowerCase();
      // Loan interest should map to loan interest, not salaries
      if (key === "LOAN_INTEREST_EXPENSE" && !nameWords.includes("interest")) {
        collisions.push({
          code,
          semanticMismatch: true,
          accountCodesKey: key,
          seededName: seeded,
          error: `Code ${code} is ACCOUNT_CODES.${key} but seeded as "${seeded}"`,
        });
      }
      if (key === "LOAN_LIABILITY" && !nameWords.includes("loan")) {
        collisions.push({
          code,
          semanticMismatch: true,
          accountCodesKey: key,
          seededName: seeded,
          error: `Code ${code} is ACCOUNT_CODES.${key} but seeded as "${seeded}"`,
        });
      }
    }
  }

  // Electricity accounts are NOT in ACCOUNT_CODES — the journal builder resolves them
  // by string key ("ELECTRICITY_EXPENSE_NEA" → "5610", "NEA_PAYABLE" → "2050").
  // Those codes ARE seeded above, so we just verify they exist in the chart:
  const ELECTRICITY_CODES = {
    ELECTRICITY_EXPENSE_NEA: "5610",
    NEA_PAYABLE: "2050",
  };
  for (const [builderKey, code] of Object.entries(ELECTRICITY_CODES)) {
    if (!seen.has(code)) {
      collisions.push({
        code,
        semanticMismatch: true,
        accountCodesKey: builderKey,
        seededName: null,
        error: `Builder key "${builderKey}" expects code ${code} but it is NOT in getChartOfAccounts(). Add it.`,
      });
    }
  }

  if (collisions.length > 0) {
    console.error("\n⚠️  ACCOUNT CODE COLLISIONS DETECTED:");
    for (const c of collisions) {
      if (c.semanticMismatch) {
        console.error(`  SEMANTIC MISMATCH — ${c.error}`);
      } else {
        console.error(
          `  DUPLICATE CODE ${c.code}: "${c.first}" vs "${c.duplicate}"`,
        );
      }
    }
    throw new Error(
      `seedAccount: ${collisions.length} code collision(s) found. Fix getChartOfAccounts() before seeding.`,
    );
  }

  console.log("✓ No duplicate codes detected in Chart of Accounts.");
  return true;
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
      // Run self-check first — will throw if any collision exists
      assertNoDuplicateCodes();
      await seedAccounts(entityIdArg ?? null);
      process.exit(0);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  })();
}
