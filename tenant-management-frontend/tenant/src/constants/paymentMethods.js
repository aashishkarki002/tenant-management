/**
 * Ledger payment methods — must match backend
 * tenant-management-backend/src/utils/paymentAccountUtils.js
 */

export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CHEQUE: "cheque",
  MOBILE_WALLET: "mobile_wallet",
});

/** Stable order for select UIs */
export const PAYMENT_METHOD_ORDER = Object.freeze([
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.CHEQUE,
  PAYMENT_METHODS.MOBILE_WALLET,
]);

export const PAYMENT_METHOD_LABELS = Object.freeze({
  [PAYMENT_METHODS.CASH]: "Cash",
  [PAYMENT_METHODS.BANK_TRANSFER]: "Bank Transfer",
  [PAYMENT_METHODS.CHEQUE]: "Cheque",
  [PAYMENT_METHODS.MOBILE_WALLET]: "Mobile Wallet",
});

export const VALID_PAYMENT_METHOD_VALUES = Object.freeze(
  Object.values(PAYMENT_METHODS),
);

/**
 * @param {string|null|undefined} method
 * @returns {string}
 */
export function getPaymentMethodLabel(method) {
  if (method == null || String(method).trim() === "") return "N/A";
  const key = String(method).toLowerCase().trim();
  if (PAYMENT_METHOD_LABELS[key]) return PAYMENT_METHOD_LABELS[key];
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Bank account picker required (matches journal routing for receipts/disbursements).
 * @param {string|null|undefined} method
 * @returns {boolean}
 */
export function paymentMethodRequiresBankAccount(method) {
  const m = String(method ?? "").toLowerCase().trim();
  return m === PAYMENT_METHODS.BANK_TRANSFER || m === PAYMENT_METHODS.CHEQUE;
}

/**
 * @returns {{ value: string, label: string }[]}
 */
export function getLedgerPaymentMethodSelectOptions() {
  return PAYMENT_METHOD_ORDER.map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));
}

/**
 * @param {string|null|undefined} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeLedgerPaymentMethod(raw, fallback = PAYMENT_METHODS.BANK_TRANSFER) {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (VALID_PAYMENT_METHOD_VALUES.includes(s)) return s;
  return fallback;
}
export function isChequePayment(method) {
  return normalizeLedgerPaymentMethod(method, "") === PAYMENT_METHODS.CHEQUE;
}
