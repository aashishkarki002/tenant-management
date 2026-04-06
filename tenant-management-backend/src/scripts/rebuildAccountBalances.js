/**
 * rebuildAccountBalances.js
 *
 * Repair utility for Account.currentBalancePaisa drift.
 * Also creates missing Account documents for BankAccount records
 * that have no corresponding chart-of-accounts entry.
 *
 * USAGE:
 *   node src/scripts/rebuildAccountBalances.js
 *
 * DRY RUN (logs only, no writes):
 *   DRY_RUN=true node src/scripts/rebuildAccountBalances.js
 *
 * SAFETY:
 *   - Never deletes any document
 *   - bulkWrite uses updateOne (idempotent — safe to re-run)
 *   - Account creation uses $setOnInsert + upsert (idempotent)
 */

import mongoose from "mongoose";
import { config } from "dotenv";

config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/tenant-management";
const DRY_RUN = process.env.DRY_RUN === "true";

// ── Import models ─────────────────────────────────────────────────────────────
import { LedgerEntry } from "../modules/ledger/Ledger.Model.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import BankAccount from "../modules/banks/BankAccountModel.js";

// Accounts where normal balance = debit (balance = totalDebit - totalCredit)
const DEBIT_NORMAL_TYPES = new Set(["ASSET", "EXPENSE"]);

async function rebuildBalances() {
  console.log("\n── Job A: Rebuild Account.currentBalancePaisa from LedgerEntry ──\n");

  // Aggregate all ledger entries grouped by account
  const ledgerTotals = await LedgerEntry.aggregate([
    {
      $group: {
        _id: "$account",
        totalDebitPaisa: { $sum: "$debitAmountPaisa" },
        totalCreditPaisa: { $sum: "$creditAmountPaisa" },
        entryCount: { $sum: 1 },
      },
    },
  ]);

  const totalsById = new Map(
    ledgerTotals.map((r) => [String(r._id), r]),
  );

  const accounts = await Account.find({}).lean();
  console.log(`  Accounts found: ${accounts.length}`);
  console.log(`  Accounts with ledger entries: ${ledgerTotals.length}`);

  let drifted = 0;
  let noEntries = 0;
  const bulkOps = [];

  for (const account of accounts) {
    const totals = totalsById.get(String(account._id));

    if (!totals) {
      noEntries++;
      continue;
    }

    const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.type);
    const correctBalance = isDebitNormal
      ? totals.totalDebitPaisa - totals.totalCreditPaisa
      : totals.totalCreditPaisa - totals.totalDebitPaisa;

    const stored = account.currentBalancePaisa ?? 0;
    const drift = correctBalance - stored;

    if (drift !== 0) {
      drifted++;
      console.log(
        `  DRIFT  [${account.code}]  type=${account.type}` +
        `  stored=${stored}  correct=${correctBalance}  drift=${drift > 0 ? "+" : ""}${drift}`,
      );
      if (!DRY_RUN) {
        bulkOps.push({
          updateOne: {
            filter: { _id: account._id },
            update: { $set: { currentBalancePaisa: correctBalance } },
          },
        });
      }
    }
  }

  if (!DRY_RUN && bulkOps.length > 0) {
    await Account.bulkWrite(bulkOps);
    console.log(`\n  Applied ${bulkOps.length} balance correction(s).`);
  } else if (drifted === 0) {
    console.log("  No drift found — all balances are correct.");
  } else if (DRY_RUN) {
    console.log(`\n  DRY RUN — ${drifted} account(s) would be corrected.`);
  }

  return { total: accounts.length, drifted, noEntries };
}

async function fixOrphanBankAccounts() {
  console.log("\n── Job B: Create missing Account docs for BankAccount records ──\n");

  const bankAccounts = await BankAccount.find({ isDeleted: false }).lean();
  if (bankAccounts.length === 0) {
    console.log("  No bank accounts found.");
    return { orphansFixed: 0 };
  }

  const bankCodes = bankAccounts.map((b) => b.accountCode).filter(Boolean);
  const existingAccounts = await Account.find({
    code: { $in: bankCodes },
  }).lean();

  // Build set of (code + entityId) combos that already exist
  const existingKeys = new Set(
    existingAccounts.map((a) => `${a.code}::${String(a.entityId ?? "")}`),
  );

  const orphans = bankAccounts.filter((b) => {
    const key = `${b.accountCode}::${String(b.entityId ?? "")}`;
    return !existingKeys.has(key);
  });

  console.log(`  BankAccount docs: ${bankAccounts.length}`);
  console.log(`  Missing Account docs: ${orphans.length}`);

  for (const bank of orphans) {
    console.log(
      `  MISSING  code=${bank.accountCode}  bank=${bank.bankName}` +
      `  openingBalancePaisa=${bank.balancePaisa ?? 0}`,
    );

    if (!DRY_RUN) {
      await Account.findOneAndUpdate(
        { code: bank.accountCode, entityId: bank.entityId },
        {
          $setOnInsert: {
            code: bank.accountCode,
            name: `${bank.bankName} — ${bank.accountName}`,
            type: "ASSET",
            entityId: bank.entityId,
            currentBalancePaisa: bank.balancePaisa ?? 0,
            isActive: true,
          },
        },
        { upsert: true },
      );
      console.log(`    CREATED Account for ${bank.accountCode}`);
    }
  }

  if (DRY_RUN && orphans.length > 0) {
    console.log(`\n  DRY RUN — ${orphans.length} Account doc(s) would be created.`);
  }

  return { orphansFixed: orphans.length };
}

async function main() {
  if (DRY_RUN) console.log("\n[DRY RUN MODE — no writes will be made]\n");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const { total, drifted, noEntries } = await rebuildBalances();
  const { orphansFixed } = await fixOrphanBankAccounts();

  console.log("\n── Summary ─────────────────────────────────────────────────────\n");
  console.log(`  Accounts scanned:          ${total}`);
  console.log(`  Accounts with drift:       ${drifted}`);
  console.log(`  Accounts without entries:  ${noEntries}`);
  console.log(`  Orphan bank accounts fixed:${orphansFixed}`);
  if (DRY_RUN) console.log("\n  Re-run without DRY_RUN=true to apply changes.");
}

main()
  .then(() => {
    console.log("\nDone.\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFailed:", err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
