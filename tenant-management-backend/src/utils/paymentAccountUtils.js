/**
 * paymentAccountUtil.js
 *
 * Single source of truth for mapping a payment method to the correct
 * DR/CR account code. Every journal builder must go through this — never
 * hard-code CASH_BANK inline.
 *
 * Supported payment methods: cash | bank_transfer | cheque | mobile_wallet
 *
 * Usage:
 *   const drAccountCode = getDebitAccountForPayment(paymentMethod, bankAccountCode);
 */

import { ACCOUNT_CODES } from "../config/accounts.js";

/** All valid payment methods. Extend here when adding new ones. */
export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CHEQUE: "cheque",
  MOBILE_WALLET: "mobile_wallet",
});

/**
 * Returns the account code that should be DEBITED when money is RECEIVED
 * (i.e. the "cash/bank" side of a receipt entry).
 *
 * @param {string} paymentMethod    - One of PAYMENT_METHODS
 * @param {string} [bankAccountCode]- Account code of the specific bank account
 *                                    (required when method is bank_transfer or cheque)
 * @returns {string} account code
 * @throws  {Error}  if paymentMethod is unknown or bankAccountCode is missing for bank payments
 */
export function getDebitAccountForPayment(paymentMethod, bankAccountCode) {
  switch (paymentMethod) {
    case PAYMENT_METHODS.CASH:
      return ACCOUNT_CODES.CASH; // e.g. "1100"

    case PAYMENT_METHODS.BANK_TRANSFER:
    case PAYMENT_METHODS.CHEQUE:
      if (!bankAccountCode) {
        throw new Error(
          `bankAccountCode is required for payment method "${paymentMethod}"`,
        );
      }
      return bankAccountCode; // e.g. "1010-NABIL"

    case PAYMENT_METHODS.MOBILE_WALLET:
      return ACCOUNT_CODES.MOBILE_WALLET ?? ACCOUNT_CODES.CASH_BANK;

    default:
      throw new Error(
        `Unknown payment method: "${paymentMethod}". ` +
          `Valid options: ${Object.values(PAYMENT_METHODS).join(", ")}`,
      );
  }
}

/**
 * Returns the account code that should be CREDITED when money is PAID OUT
 * (i.e. the "cash/bank" side of an expense or disbursement entry).
 * For most cases this is the same as the debit side for receipts.
 *
 * @param {string} paymentMethod
 * @param {string} [bankAccountCode]
 * @returns {string}
 */
export function getCreditAccountForPayment(paymentMethod, bankAccountCode) {
  // Same logic — the account is the same regardless of direction
  return getDebitAccountForPayment(paymentMethod, bankAccountCode);
}

/**
 * Validates a payment method string.
 * Throws a descriptive error so callers get clear feedback.
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
