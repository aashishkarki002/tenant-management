/**
 * Migration: Fix Account code "1000" name from "Bank Account" → "Cash in Hand"
 *
 * Problem:
 *   The original seedAccount.js seeded code "1000" as name "Bank Account".
 *   ACCOUNT_CODES.CASH = "1000" means physical cash on hand ONLY.
 *   All cash payments DR "1000" expecting "Cash in Hand", but the DB showed
 *   it as "Bank Account" — misleading and wrong. Bank sub-accounts are dynamic
 *   codes (1010-NABIL, etc.) created when a BankAccount document is added.
 *
 * Fix:
 *   For every Account with code "1000" and name "Bank Account", update:
 *     name        → "Cash in Hand"
 *     description → canonical description matching seedAccount.js v2
 *
 * Safe to re-run: uses updateMany with a name filter so already-fixed rows
 * are skipped. No balance or ledger data is touched.
 *
 * Run once:
 *   node src/migrations/fixCashAccountName.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";

async function fixCashAccountName() {
  await connectDB();

  // Find all "1000" accounts still carrying the old "Bank Account" name
  const stale = await Account.find({
    code: "1000",
    name: "Bank Account",
  }).lean();

  if (stale.length === 0) {
    console.log(
      'No stale accounts found. All code "1000" accounts are already named correctly.',
    );
    process.exit(0);
  }

  console.log(
    `\nFound ${stale.length} account(s) with code "1000" and name "Bank Account":`,
  );
  for (const a of stale) {
    console.log(`  _id=${a._id}  entityId=${a.entityId}  name="${a.name}"`);
  }

  const result = await Account.updateMany(
    { code: "1000", name: "Bank Account" },
    {
      $set: {
        name: "Cash in Hand",
        description:
          "Physical cash on hand. Journal builders post here when paymentMethod === 'cash'. " +
          "Do NOT use for bank transfers — those go to dynamic 1010-xxx sub-accounts.",
      },
    },
  );

  console.log(`\n✓ Updated ${result.modifiedCount} account(s):`);
  console.log('  code "1000" → name "Cash in Hand"');
  console.log("\nNo ledger entries were modified.");
  console.log(
    "  Existing ledger entries pointing to this account ObjectId are still valid —",
  );
  console.log(
    "  the account _id did not change, only the display name was corrected.",
  );

  await mongoose.disconnect();
  process.exit(0);
}

fixCashAccountName().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
