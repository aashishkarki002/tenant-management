/**
 * bank.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD for BankAccount documents with atomic Account co-creation/teardown.
 *
 * WHY THE ACCOUNT CO-CREATION EXISTS:
 *   postJournalEntry → resolveAccountsByEntity() does:
 *     Account.find({ code: { $in: codes }, entityId, isActive: true })
 *   If no Account document exists for code "1010-NABIL" it throws
 *   "Account not found" even if the BankAccount document is perfectly fine.
 *
 *   The Account document (chart of accounts) and the BankAccount document
 *   (operational record) are two separate collections that must stay 1-to-1.
 *   The only safe enforcement point is creation time, in the same transaction.
 *
 * FIX (this commit) — createBankAccount:
 *   Account $setOnInsert now includes entityId so resolveAccountsByEntity()
 *   can find it. Previously entityId was omitted, meaning entity-scoped
 *   journal posts would fail "Account not found" even though the account
 *   existed — it just had a null entityId.
 *
 * OTHER RULES:
 *   - Never hard-delete an Account row — soft-delete (isActive: false) only,
 *     so historical journal entries that reference it still resolve.
 *   - Code renames propagate to Account.code in the same transaction.
 *     LedgerEntry rows reference Account by ObjectId, not code string, so
 *     historical entries are unaffected by a rename.
 */

import mongoose from "mongoose";
import BankAccount from "./BankAccountModel.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export const createBankAccount = async (req, res) => {
  const {
    accountNumber,
    accountName,
    bankName,
    accountCode, // required — e.g. "1010-NABIL"
    openingBalance, // optional, in rupees
    entityId, // required for multi-entity setups
  } = req.body;

  if (!accountCode?.trim()) {
    return res.status(400).json({
      success: false,
      message:
        "accountCode is required (e.g. '1010-NABIL'). " +
        "It must be unique and match the convention for your chart of accounts.",
    });
  }

  if (!entityId) {
    return res.status(400).json({
      success: false,
      message:
        "entityId is required. Bank accounts must be scoped to an entity.",
    });
  }

  const normalizedCode = accountCode.toUpperCase().trim();
  const balancePaisa = openingBalance
    ? rupeesToPaisa(parseFloat(openingBalance))
    : 0;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // ── Step 1: Create the BankAccount (operational record) ────────────────
    const [newBankAccount] = await BankAccount.create(
      [
        {
          accountNumber,
          accountName,
          bankName,
          accountCode: normalizedCode,
          entityId, // ← scopes this bank account to its OwnershipEntity
          balancePaisa,
        },
      ],
      { session },
    );

    // ── Step 2: Upsert the matching Account row (chart of accounts) ────────
    //
    // WHY UPSERT:
    //   If a previous attempt crashed between steps 1 and 2, a retry would
    //   duplicate-key on BankAccount. Upsert makes the whole flow idempotent.
    //
    // FIX: entityId is now included in $setOnInsert so that
    //   resolveAccountsByEntity({ code, entityId }) can find this account
    //   when posting journal entries.
    //
    // currentBalancePaisa mirrors balancePaisa so the opening balance is
    // correct in financial reports from day one without a separate journal.
    await Account.findOneAndUpdate(
      { code: normalizedCode, entityId },
      {
        $setOnInsert: {
          code: normalizedCode,
          name: `${bankName} — ${accountName}`,
          type: "ASSET",
          entityId,
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
    const { entityId } = req.query;
    const filter = { isDeleted: false };
    if (entityId) filter.entityId = entityId;

    const bankAccounts = await BankAccount.find(filter);
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
// UPDATE
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

    // Keep Account.code in sync when the code changes.
    // LedgerEntry rows use Account._id (ObjectId), not code string,
    // so historical entries are unaffected.
    if (newCode !== oldCode) {
      await Account.findOneAndUpdate(
        { code: oldCode },
        { code: newCode },
        { session },
      );
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
// DELETE (soft)
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

    // Soft-delete the Account row — never hard-delete, historical journal
    // entries reference it by ObjectId and must remain resolvable.
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
