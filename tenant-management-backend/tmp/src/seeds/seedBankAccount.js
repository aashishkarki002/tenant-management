import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../config/db.js";
import { Account } from "../modules/ledger/accounts/Account.Model.js";
import BankAccount from "../modules/banks/BankAccountModel.js";
import { fileURLToPath } from "url";

/**
 * Seed/update Account documents from BankAccount records.
 *
 * BankAccount already has accountCode (e.g. "1010-NABIL"). The ledger requires
 * a matching Account document for each such code so journal entries resolve.
 * This script:
 * - For each non-deleted BankAccount, ensures an Account exists with code = accountCode.
 * - Creates the Account if missing (type ASSET, name from bank).
 * - Updates existing Account name to match bank account (keeps chart in sync).
 *
 * Run after adding accountCode to BankAccount or to fix missing Account rows.
 *
 * Usage: node src/seeds/seedBankAccount.js
 * Or:    node --loader ts-node/esm src/seeds/seedBankAccount.js  (if using ts-node)
 */
export async function seedBankAccount() {
  try {
    await connectDB();

    const bankAccounts = await BankAccount.find({ isDeleted: { $ne: true } });
    if (bankAccounts.length === 0) {
      console.log("No bank accounts found. Nothing to seed.");
      return { success: true, created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    for (const bank of bankAccounts) {
      const code = (bank.accountCode || "").trim().toUpperCase();
      if (!code) {
        console.warn(
          `⚠ BankAccount ${bank._id} (${bank.bankName}) has no accountCode — skipping.`
        );
        continue;
      }

      const accountName = `${bank.bankName} — ${bank.accountName}`;
      const existing = await Account.findOne({ code });

      if (!existing) {
        await Account.create({
          code,
          name: accountName,
          type: "ASSET",
          parentAccount: null,
          currentBalancePaisa: bank.balancePaisa ?? 0,
          isActive: true,
          description: `Ledger account for bank: ${bank.bankName}, ${bank.accountNumber}`,
        });
        console.log(`✓ Created Account: ${code} — ${accountName}`);
        created++;
      } else {
        const updates = {};
        if (existing.name !== accountName) {
          updates.name = accountName;
        }
        if (
          existing.currentBalancePaisa !== (bank.balancePaisa ?? 0) &&
          existing.currentBalancePaisa === 0
        ) {
          updates.currentBalancePaisa = bank.balancePaisa ?? 0;
        }
        if (Object.keys(updates).length > 0) {
          await Account.updateOne({ code }, { $set: updates });
          console.log(`✓ Updated Account: ${code} — ${accountName}`);
          updated++;
        } else {
          console.log(`- Account already in sync: ${code}`);
        }
      }
    }

    console.log(
      `\n✓ Bank account seed done. Created: ${created}, Updated: ${updated}`
    );
    return { success: true, created, updated };
  } catch (error) {
    console.error("Error seeding accounts from bank accounts:", error);
    return { success: false, error: error.message };
  }
}

// Run if executed directly
const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (currentFile === runFile || import.meta.url.includes(runFile)) {
  (async () => {
    try {
      await seedBankAccount();
      process.exit(0);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  })();
}
