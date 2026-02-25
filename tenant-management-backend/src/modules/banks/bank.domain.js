/**
 * bank_domain.js  (FIXED)
 *
 * Applies a received payment to the correct balance account.
 *
 * CRITICAL FIX — C-3:
 *   Cash payments now increment the CASH account (e.g. "1100") in the Account
 *   collection instead of silently returning null.
 *
 * RULE: This function must ALWAYS be called inside the same Mongoose session
 *   as ledgerService.postJournalEntry() so both operations are atomic.
 *   See H-2 fix in the integration guide.
 */

import mongoose from "mongoose";
import BankAccount from "./BankAccountModel.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { ACCOUNT_CODES } from "../ledger/config/accounts.js";
import { assertIntegerPaisa } from "../../utils/moneyUtil.js";
import { assertValidPaymentMethod } from "../../utils/paymentAccountUtils.js";

/**
 * Updates the balance of the appropriate balance-sheet account when money
 * is RECEIVED (payment in). Call once per payment, inside the shared session.
 *
 * @param {Object} params
 * @param {string}  params.paymentMethod   - "cash" | "bank_transfer" | "cheque" | "mobile_wallet"
 * @param {string}  [params.bankAccountId] - BankAccount._id (required for bank/cheque)
 * @param {number}  params.amountPaisa     - positive integer
 * @param {mongoose.ClientSession} params.session
 *
 * @returns {Promise<Document>}  the updated Account or BankAccount document
 */
export async function applyPaymentToBank({
  paymentMethod,
  bankAccountId,
  amountPaisa,
  session,
}) {
  // ── 1. Validate inputs ────────────────────────────────────────────────────
  assertValidPaymentMethod(paymentMethod);
  assertIntegerPaisa(amountPaisa, "amountPaisa");

  if (!session) {
    throw new Error(
      "applyPaymentToBank: a Mongoose session is required. " +
        "This call must be inside the same transaction as postJournalEntry().",
    );
  }

  // ── 2. Cash — update the CASH Account document ────────────────────────────
  if (paymentMethod === "cash") {
    const cashAccount = await Account.findOne({
      code: ACCOUNT_CODES.CASH,
    }).session(session);
    if (!cashAccount) {
      throw new Error(
        `Cash account (code: ${ACCOUNT_CODES.CASH}) not found. ` +
          "Please seed the chart of accounts before processing cash payments.",
      );
    }
    // Integer addition — no float error
    cashAccount.currentBalancePaisa += amountPaisa;
    await cashAccount.save({ session });
    return cashAccount;
  }

  // ── 3. Bank transfer / cheque — update the BankAccount document ───────────
  if (paymentMethod === "bank_transfer" || paymentMethod === "cheque") {
    if (!bankAccountId) {
      throw new Error(
        "bankAccountId is required for bank_transfer and cheque payments",
      );
    }

    const bankAccount =
      await BankAccount.findById(bankAccountId).session(session);
    if (!bankAccount) {
      throw new Error(`BankAccount not found: ${bankAccountId}`);
    }
    if (bankAccount.isDeleted) {
      throw new Error(`BankAccount ${bankAccountId} has been deleted`);
    }

    // Integer addition
    bankAccount.balancePaisa += amountPaisa;
    await bankAccount.save({ session });
    return bankAccount;
  }

  // ── 4. Mobile wallet (future-proof) ──────────────────────────────────────
  if (paymentMethod === "mobile_wallet") {
    const walletAccount = await Account.findOne({
      code: ACCOUNT_CODES.MOBILE_WALLET ?? ACCOUNT_CODES.CASH_BANK,
    }).session(session);
    if (!walletAccount) {
      throw new Error("Mobile wallet account not found in chart of accounts");
    }
    walletAccount.currentBalancePaisa += amountPaisa;
    await walletAccount.save({ session });
    return walletAccount;
  }

  // Should never reach here because assertValidPaymentMethod() already threw
  throw new Error(`Unhandled payment method: ${paymentMethod}`);
}

/**
 * Updates the balance when money is PAID OUT (expense disbursement).
 * Decrements the appropriate account balance.
 *
 * @param {Object} params  - same signature as applyPaymentToBank
 */
export async function applyDisbursementFromBank({
  paymentMethod,
  bankAccountId,
  amountPaisa,
  session,
}) {
  assertValidPaymentMethod(paymentMethod);
  assertIntegerPaisa(amountPaisa, "amountPaisa");

  if (!session) {
    throw new Error(
      "applyDisbursementFromBank: a Mongoose session is required.",
    );
  }

  if (paymentMethod === "cash") {
    const cashAccount = await Account.findOne({
      code: ACCOUNT_CODES.CASH,
    }).session(session);
    if (!cashAccount)
      throw new Error(`Cash account (${ACCOUNT_CODES.CASH}) not found`);

    if (cashAccount.currentBalancePaisa < amountPaisa) {
      throw new Error(
        `Insufficient cash balance: have ${cashAccount.currentBalancePaisa} paisa, ` +
          `need ${amountPaisa} paisa`,
      );
    }

    cashAccount.currentBalancePaisa -= amountPaisa;
    await cashAccount.save({ session });
    return cashAccount;
  }

  if (paymentMethod === "bank_transfer" || paymentMethod === "cheque") {
    if (!bankAccountId)
      throw new Error("bankAccountId required for bank payments");

    const bankAccount =
      await BankAccount.findById(bankAccountId).session(session);
    if (!bankAccount)
      throw new Error(`BankAccount not found: ${bankAccountId}`);
    if (bankAccount.isDeleted)
      throw new Error(`BankAccount ${bankAccountId} is deleted`);

    if (bankAccount.balancePaisa < amountPaisa) {
      throw new Error(
        `Insufficient bank balance: have ${bankAccount.balancePaisa} paisa, ` +
          `need ${amountPaisa} paisa`,
      );
    }

    bankAccount.balancePaisa -= amountPaisa;
    await bankAccount.save({ session });
    return bankAccount;
  }

  throw new Error(`Unhandled payment method: ${paymentMethod}`);
}
