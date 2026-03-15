/**
 * bank.domain.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Domain helpers for updating operational bank balances.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TWO BALANCE STORES — ONE OWNER EACH                                   │
 * │                                                                         │
 * │  BankAccount.balancePaisa      — operational "what's in the bank"      │
 * │    • Owned exclusively by this file (applyPaymentToBank /              │
 * │      applyDisbursementFromBank).                                        │
 * │    • Used by the bank widget / reconciliation UI.                      │
 * │                                                                         │
 * │  Account.currentBalancePaisa   — accounting ledger balance              │
 * │    • Owned exclusively by ledgerService.postJournalEntry() via         │
 * │      applyJournalBalances().                                            │
 * │    • Used by financial reports, trial balance, P&L.                    │
 * │                                                                         │
 * │  These two must NEVER be written by the same function.                 │
 * │  Historically, applyPaymentToBank() also wrote                         │
 * │  Account.currentBalancePaisa for cash payments — causing a double      │
 * │  increment because postJournalEntry wrote it too.                      │
 * │                                                                         │
 * │  FIX: applyPaymentToBank / applyDisbursementFromBank touch ONLY        │
 * │  BankAccount.balancePaisa. For cash, there is no BankAccount document  │
 * │  — the Account.currentBalancePaisa is updated entirely by the journal. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * CALL PATTERN (callers must follow this exactly):
 *
 *   const session = await mongoose.startSession();
 *   session.startTransaction();
 *   try {
 *     await applyPaymentToBank({ paymentMethod, bankAccountId, amountPaisa, session });
 *     await ledgerService.postJournalEntry(payload, session, entityId);
 *     await session.commitTransaction();
 *   } catch (err) {
 *     await session.abortTransaction();
 *     throw err;
 *   } finally {
 *     session.endSession();
 *   }
 *
 * If either write fails, both roll back — the two stores stay in sync.
 */

import mongoose from "mongoose";
import BankAccount from "./BankAccountModel.js";
import { assertIntegerPaisa } from "../../utils/moneyUtil.js";
import { assertValidPaymentMethod } from "../../utils/paymentAccountUtils.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireSession(session, fnName) {
  if (!session) {
    throw new Error(
      `${fnName}: a Mongoose session is required. ` +
        `This call must be inside the same transaction as postJournalEntry().`,
    );
  }
}

async function findActiveBankAccount(bankAccountId, session) {
  if (!bankAccountId) {
    throw new Error(
      "bankAccountId is required for bank_transfer and cheque payments.",
    );
  }
  const doc = await BankAccount.findById(bankAccountId).session(session);
  if (!doc) throw new Error(`BankAccount not found: ${bankAccountId}`);
  if (doc.isDeleted)
    throw new Error(`BankAccount ${bankAccountId} has been deleted.`);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyPaymentToBank  (money IN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Increments BankAccount.balancePaisa when money is received.
 *
 * Cash payments have no BankAccount document — their Account.currentBalancePaisa
 * is updated entirely by postJournalEntry via applyJournalBalances(). Calling
 * this function with paymentMethod "cash" is a no-op and returns null, which
 * is safe — callers should not branch on the return value.
 *
 * @param {Object} params
 * @param {string}  params.paymentMethod   - "cash" | "bank_transfer" | "cheque" | "mobile_wallet"
 * @param {string}  [params.bankAccountId] - BankAccount._id; required for bank/cheque
 * @param {number}  params.amountPaisa     - positive integer
 * @param {mongoose.ClientSession} params.session
 *
 * @returns {Promise<Document|null>}  updated BankAccount, or null for cash
 */
export async function applyPaymentToBank({
  paymentMethod,
  bankAccountId,
  amountPaisa,
  session,
}) {
  assertValidPaymentMethod(paymentMethod);
  assertIntegerPaisa(amountPaisa, "amountPaisa");
  requireSession(session, "applyPaymentToBank");

  if (paymentMethod === "cash") {
    // Cash: no BankAccount document exists.
    // Account.currentBalancePaisa is handled by postJournalEntry — do nothing here.
    return null;
  }

  if (paymentMethod === "mobile_wallet") {
    // Wallet: no BankAccount document. Account.currentBalancePaisa handled by journal.
    return null;
  }

  // bank_transfer | cheque — increment the operational bank balance
  const bankAccount = await findActiveBankAccount(bankAccountId, session);
  bankAccount.balancePaisa += amountPaisa;
  await bankAccount.save({ session });
  return bankAccount;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyDisbursementFromBank  (money OUT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decrements BankAccount.balancePaisa when money is paid out.
 *
 * Same ownership rule as applyPaymentToBank: this function owns
 * BankAccount.balancePaisa only. Account.currentBalancePaisa is owned
 * by postJournalEntry.
 *
 * @param {Object} params  — same as applyPaymentToBank
 * @returns {Promise<Document|null>}
 */
export async function applyDisbursementFromBank({
  paymentMethod,
  bankAccountId,
  amountPaisa,
  session,
}) {
  assertValidPaymentMethod(paymentMethod);
  assertIntegerPaisa(amountPaisa, "amountPaisa");
  requireSession(session, "applyDisbursementFromBank");

  if (paymentMethod === "cash" || paymentMethod === "mobile_wallet") {
    // Account.currentBalancePaisa handled by postJournalEntry — do nothing here.
    return null;
  }

  const bankAccount = await findActiveBankAccount(bankAccountId, session);

  if (bankAccount.balancePaisa < amountPaisa) {
    throw new Error(
      `Insufficient balance in ${bankAccount.accountCode}: ` +
        `have ${bankAccount.balancePaisa} paisa, need ${amountPaisa} paisa.`,
    );
  }

  bankAccount.balancePaisa -= amountPaisa;
  await bankAccount.save({ session });
  return bankAccount;
}
