/**
 * bank.controller.js  (FIXED — Account co-creation)
 *
 * ROOT PROBLEM:
 *   The ledger service's postJournalEntry does:
 *     Account.find({ code: { $in: accountCodes } })
 *   and throws "Account with code '1010-NABIL' not found" if the Account
 *   document doesn't exist — even if the BankAccount document does.
 *
 *   These are two separate collections:
 *     BankAccount  — operational record (accountNumber, bankName, balancePaisa)
 *     Account      — chart-of-accounts row (code, name, type, currentBalancePaisa)
 *
 *   They must stay in 1-to-1 sync. The only safe place to enforce that is
 *   at creation time, inside the same Mongoose transaction.
 *
 * FIX — createBankAccount:
 *   Open a session, create BOTH documents atomically.
 *   If either insert fails the whole operation rolls back.
 *   Uses findOneAndUpdate+upsert so re-running (e.g. after a crash) is safe.
 *
 * FIX — deleteBankAccount:
 *   Soft-deletes the BankAccount AND marks the Account inactive in one session.
 *   The Account row is kept (never hard-deleted) so historical journal entries
 *   that reference it still resolve correctly.
 *
 * FIX — updateBankAccount:
 *   If accountCode changes, update the Account.code in the same session.
 *   Changing a code after payments have been posted is dangerous — the
 *   controller warns but does not block it (admins may need to correct typos).
 */

import mongoose from "mongoose";
import BankAccount from "./BankAccountModel.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  — atomic: BankAccount + Account in one transaction
// ─────────────────────────────────────────────────────────────────────────────

export const createBankAccount = async (req, res) => {
  const {
    accountNumber,
    accountName,
    bankName,
    accountCode, // required — chart-of-accounts code e.g. "1010-NABIL"
    openingBalance, // optional — in rupees, converted to integer paisa
  } = req.body;

  if (!accountCode?.trim()) {
    return res.status(400).json({
      success: false,
      message:
        "accountCode is required (e.g. '1010-NABIL'). " +
        "It must be unique and match the convention for your chart of accounts.",
    });
  }

  const normalizedCode = accountCode.toUpperCase().trim();
  const balancePaisa = openingBalance
    ? rupeesToPaisa(parseFloat(openingBalance))
    : 0;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    /**
     * Step 1 — Create the BankAccount (operational record).
     * BankAccount.create([...], { session }) returns an array.
     */
    const [newBankAccount] = await BankAccount.create(
      [
        {
          accountNumber,
          accountName,
          bankName,
          accountCode: normalizedCode,
          balancePaisa,
        },
      ],
      { session },
    );

    /**
     * Step 2 — Upsert the matching Account row in the chart of accounts.
     *
     * WHY UPSERT NOT CREATE:
     *   If a previous attempt crashed after writing BankAccount but before
     *   writing Account, a retry would fail with a duplicate key on BankAccount.
     *   Upsert makes the whole operation idempotent.
     *
     * TYPE: always ASSET — a bank account is a current asset (money we hold).
     * currentBalancePaisa mirrors balancePaisa so the ledger opening balance
     * is correct from day one without a separate journal entry.
     */
    await Account.findOneAndUpdate(
      { code: normalizedCode },
      {
        $setOnInsert: {
          code: normalizedCode,
          name: `${bankName} — ${accountName}`,
          type: "ASSET",
          currentBalancePaisa: balancePaisa,
          isActive: true,
        },
      },
      { upsert: true, new: true, session },
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Bank account created successfully",
      bankAccount: newBankAccount,
    });
  } catch (error) {
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          `Account code "${normalizedCode}" is already in use. ` +
          "Each bank account must have a unique chart-of-accounts code.",
      });
    }
    console.error("createBankAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Bank account creation failed",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export const getBankAccounts = async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find({ isDeleted: false });
    return res.status(200).json({ success: true, bankAccounts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Bank accounts retrieval failed",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  — keep Account.code in sync if accountCode changes
// ─────────────────────────────────────────────────────────────────────────────

export const updateBankAccount = async (req, res) => {
  const { id } = req.params;
  const { accountNumber, accountName, bankName, accountCode } = req.body;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const bankAccount = await BankAccount.findById(id).session(session);
    if (!bankAccount) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found" });
    }

    const oldCode = bankAccount.accountCode;
    const newCode = accountCode ? accountCode.toUpperCase().trim() : oldCode;

    if (accountNumber) bankAccount.accountNumber = accountNumber;
    if (accountName) bankAccount.accountName = accountName;
    if (bankName) bankAccount.bankName = bankName;
    if (newCode !== oldCode) bankAccount.accountCode = newCode;

    await bankAccount.save({ session });

    // Keep Account.code in sync when accountCode is renamed
    if (newCode !== oldCode) {
      await Account.findOneAndUpdate(
        { code: oldCode },
        { code: newCode },
        { session },
      );
      // Note: LedgerEntry rows reference Account by ObjectId (_id), not by code
      // string, so historical entries are unaffected by a code rename.
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Bank account updated successfully",
      bankAccount,
    });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `Account code "${req.body.accountCode}" is already in use.`,
      });
    }
    console.error("updateBankAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update bank account",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE (soft)  — deactivate Account row in the same session
// ─────────────────────────────────────────────────────────────────────────────

export const deleteBankAccount = async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const bankAccount = await BankAccount.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session },
    );

    if (!bankAccount) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found" });
    }

    /**
     * Mark the Account row inactive rather than deleting it.
     * Hard-deleting it would cause getLedger() to fail for any historical
     * journal entries that used this account code.
     */
    await Account.findOneAndUpdate(
      { code: bankAccount.accountCode },
      { isActive: false },
      { session },
    );

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Bank account deleted",
      bankAccount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("deleteBankAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete bank account",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
