/**
 * fixDuplicateSecurityDepositJournals.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG: When creating a tenant with a security deposit, tenant.create.js was
 * posting the SECURITY_DEPOSIT journal entry AFTER createSd() had already
 * posted it internally. This resulted in two Transaction + LedgerEntry pairs
 * per SD, and Account.currentBalancePaisa incremented twice.
 *
 * For bank_transfer / cheque payments the duplicate also used the wrong
 * account code ("1000" / CASH_BANK instead of the specific bank sub-account),
 * so the cash/bank control account was inflated by each SD amount.
 *
 * WHAT THIS MIGRATION DOES:
 *   1. Finds every SD that has > 1 SECURITY_DEPOSIT Transaction record.
 *   2. Keeps the OLDEST Transaction (the correct one from createSd).
 *   3. For each duplicate Transaction:
 *        a. Fetches its LedgerEntry rows to know which accounts were touched.
 *        b. Reverses the Account.currentBalancePaisa changes ($inc the inverse).
 *        c. Deletes the LedgerEntry rows.
 *        d. Deletes the Transaction document.
 *   4. Prints a full summary / dry-run report.
 *
 * RUN (dry-run first, then for real):
 *   DRY_RUN=true node src/migrations/fixDuplicateSecurityDepositJournals.js
 *   node src/migrations/fixDuplicateSecurityDepositJournals.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Transaction } from "../modules/ledger/transactions/Transaction.Model.js";
import { LedgerEntry } from "../modules/ledger/Ledger.Model.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import { computeBalanceChange } from "../modules/ledger/domains/accountBalanceManger.js";

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(paisa) {
  return `Rs. ${(paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

/**
 * Given a set of LedgerEntry documents belonging to a duplicate Transaction,
 * reverse each account's currentBalancePaisa by applying the inverse posting.
 *
 * Uses $inc so concurrent writes cannot race to zero — the delta is always
 * the exact amount that was incorrectly added.
 */
async function reverseAccountBalances(entries, session) {
  // Group by account._id so we can batch the reversal per account
  const deltaMap = new Map(); // accountId(string) → { accountId, inverseDelta }

  for (const entry of entries) {
    const accountId = String(entry.account._id ?? entry.account);
    const accountType = entry.account.type; // populated below

    // computeBalanceChange returns the signed amount that was ADDED to the
    // balance when this entry was originally posted. We negate it to reverse.
    const originalDelta = computeBalanceChange(
      accountType,
      entry.debitAmountPaisa,
      entry.creditAmountPaisa,
    );

    const prev = deltaMap.get(accountId) ?? { accountId, inverseDelta: 0 };
    deltaMap.set(accountId, {
      accountId,
      inverseDelta: prev.inverseDelta - originalDelta,
    });
  }

  for (const { accountId, inverseDelta } of deltaMap.values()) {
    if (inverseDelta === 0) continue;

    if (!DRY_RUN) {
      await Account.findByIdAndUpdate(
        accountId,
        { $inc: { currentBalancePaisa: inverseDelta } },
        { session },
      );
    }
  }

  return deltaMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  console.log(DRY_RUN ? "🔍 DRY-RUN MODE — no data will be changed\n" : "⚡ LIVE MODE — changes will be committed\n");

  // ── Step 1: find SDs with more than one SECURITY_DEPOSIT Transaction ────────
  const duplicateGroups = await Transaction.aggregate([
    {
      $match: {
        type: "SECURITY_DEPOSIT",
        referenceType: "SecurityDeposit",
        status: { $ne: "VOIDED" },
      },
    },
    {
      $group: {
        _id: "$referenceId",
        txIds: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`Found ${duplicateGroups.length} SecurityDeposit(s) with duplicate journal entries.\n`);

  if (duplicateGroups.length === 0) {
    console.log("✅ Nothing to fix.");
    await mongoose.disconnect();
    return;
  }

  let totalDuplicatesRemoved = 0;
  let totalEntriesDeleted = 0;

  for (const group of duplicateGroups) {
    const sdId = group._id;

    // Fetch all transactions for this SD, oldest first
    const transactions = await Transaction.find({
      type: "SECURITY_DEPOSIT",
      referenceType: "SecurityDeposit",
      referenceId: sdId,
      status: { $ne: "VOIDED" },
    }).sort({ _id: 1 }); // oldest _id = created first = the correct one

    const [keep, ...duplicates] = transactions;

    console.log(`SD ${sdId}`);
    console.log(`  ✔  Keep    Transaction ${keep._id} (${keep.transactionDate.toISOString()})`);

    for (const dup of duplicates) {
      console.log(`  ✖  Remove  Transaction ${dup._id} (${dup.transactionDate.toISOString()})`);

      // Fetch LedgerEntry rows for this duplicate — populate account for type
      const entries = await LedgerEntry.find({ transaction: dup._id }).populate(
        "account",
        "code name type currentBalancePaisa",
      );

      console.log(`     Entries (${entries.length}):`);
      for (const e of entries) {
        const side = e.debitAmountPaisa > 0
          ? `DR ${fmt(e.debitAmountPaisa)}`
          : `CR ${fmt(e.creditAmountPaisa)}`;
        console.log(`       ${side}  →  [${e.account.code}] ${e.account.name}`);
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const deltaMap = await reverseAccountBalances(entries, session);

        console.log(`     Balance reversals:`);
        for (const [accountId, { inverseDelta }] of deltaMap) {
          const acc = entries.find((e) => String(e.account._id) === accountId)?.account;
          const sign = inverseDelta >= 0 ? "+" : "";
          console.log(`       ${sign}${inverseDelta} paisa  →  [${acc?.code}] ${acc?.name}`);
        }

        if (!DRY_RUN) {
          await LedgerEntry.deleteMany({ transaction: dup._id }, { session });
          await Transaction.findByIdAndDelete(dup._id, { session });
          await session.commitTransaction();
        } else {
          await session.abortTransaction();
        }

        totalEntriesDeleted += entries.length;
        totalDuplicatesRemoved++;
      } catch (err) {
        await session.abortTransaction();
        console.error(`     ❌ ERROR processing transaction ${dup._id}:`, err.message);
      } finally {
        session.endSession();
      }
    }

    console.log();
  }

  console.log("─".repeat(60));
  console.log(`Duplicate transactions found : ${totalDuplicatesRemoved}`);
  console.log(`LedgerEntry rows affected    : ${totalEntriesDeleted}`);
  if (DRY_RUN) {
    console.log("\n🔍 DRY-RUN complete — run without DRY_RUN=true to apply changes.");
  } else {
    console.log("\n✅ Migration complete.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
