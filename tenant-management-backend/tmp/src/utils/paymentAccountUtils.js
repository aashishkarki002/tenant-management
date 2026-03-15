/**
 * paymentAccountUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for mapping a payment method to the correct
 * DR / CR account code.
 *
 * RULE: Every journal builder that has a cash/bank side MUST call
 * getDebitAccountForPayment() or getCreditAccountForPayment() — never
 * hard-code ACCOUNT_CODES.CASH_BANK inline.
 *
 * EXTENSION GUIDE — adding a new payment method:
 *   1. Add it to PAYMENT_METHODS below.
 *   2. Add a case in getDebitAccountForPayment().
 *   3. Add the account code to accounts.js if it needs its own code.
 *   4. Seed the Account document before going live.
 */

import { ACCOUNT_CODES } from "../modules/ledger/config/accounts.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** All valid payment methods. Add new ones here first. */
export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CHEQUE: "cheque",
  MOBILE_WALLET: "mobile_wallet",
});

// ─────────────────────────────────────────────────────────────────────────────
// Core routing function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the account code to DEBIT when money is RECEIVED
 * (the "cash / bank" side of a receipt journal entry).
 *
 * @param {string}  paymentMethod    - One of PAYMENT_METHODS values
 * @param {string}  [bankAccountCode]- Chart-of-accounts code of the specific
 *                                     bank account (e.g. "1010-NABIL").
 *                                     Required when method is bank_transfer or cheque.
 * @returns {string} Account code to use as the DR side
 *
 * @throws {Error} Unknown payment method
 * @throws {Error} bankAccountCode missing for bank_transfer / cheque
 * @throws {Error} MOBILE_WALLET account not configured (code not in accounts.js)
 */
export function getDebitAccountForPayment(paymentMethod, bankAccountCode) {
  switch (paymentMethod) {
    case PAYMENT_METHODS.CASH:
      // Physical cash → always the CASH account, never a bank sub-account
      return ACCOUNT_CODES.CASH;

    case PAYMENT_METHODS.BANK_TRANSFER:
    case PAYMENT_METHODS.CHEQUE:
      // Must always know WHICH bank account — no silent fallback to "1000"
      if (!bankAccountCode) {
        throw new Error(
          `bankAccountCode is required for payment method "${paymentMethod}". ` +
            `Pass the chart-of-accounts code of the destination bank account ` +
            `(e.g. "1010-NABIL"). Never use CASH_BANK as a fallback.`,
        );
      }
      return bankAccountCode;

    case PAYMENT_METHODS.MOBILE_WALLET: {
      // Wallet float has its own Account document — no fallback to cash/bank
      const code = ACCOUNT_CODES.MOBILE_WALLET;
      if (!code) {
        throw new Error(
          `MOBILE_WALLET is not defined in accounts.js. ` +
            `Add it and seed the Account document before processing wallet payments.`,
        );
      }
      return code;
    }

    default:
      throw new Error(
        `Unknown payment method: "${paymentMethod}". ` +
          `Valid options: ${Object.values(PAYMENT_METHODS).join(", ")}`,
      );
  }
}

/**
 * Returns the account code to CREDIT when money is PAID OUT
 * (the "cash / bank" side of an expense / disbursement journal entry).
 *
 * The account is always the same whether money flows in or out —
 * the difference is which side of the entry it appears on.
 *
 * @param {string}  paymentMethod
 * @param {string}  [bankAccountCode]
 * @returns {string}
 */
export function getCreditAccountForPayment(paymentMethod, bankAccountCode) {
  return getDebitAccountForPayment(paymentMethod, bankAccountCode);
}

/**
 * Throws a descriptive error if paymentMethod is not a known value.
 * Call this at the top of any service function that accepts paymentMethod
 * from user input, before doing any DB work.
 *
 * @param {string} paymentMethod
 */
export function assertValidPaymentMethod(paymentMethod) {
  if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
    throw new Error(
      `Invalid payment method: "${paymentMethod}". ` +
        `Must be one of: ${Object.values(PAYMENT_METHODS).join(", ")}`,
    );
  }
}
