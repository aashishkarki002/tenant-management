/**
 * tenant.constant.js  (FIXED)
 *
 * ROOT ISSUE: PAYMENT_METHODS previously included "bank_guarantee".
 * The backend paymentAccountUtil.js only routes: cash | bank_transfer | cheque | mobile_wallet.
 * "bank_guarantee" is a *security deposit mechanism* (a document type), not a ledger
 * payment route — it never touches the Cash or BankAccount balance.
 *
 * Fix: split into two separate constants:
 *   PAYMENT_METHODS       — how money flows through the ledger (matches backend exactly)
 *   SECURITY_DEPOSIT_MODES — how the security deposit is secured
 *
 * When SD mode is BANK_GUARANTEE, no cash/bank journal entry is posted for the deposit.
 * When SD mode is CASH / BANK_TRANSFER / CHEQUE, the backend posts:
 *   DR Cash/Bank  CR Security Deposit Liability
 */

export const DOCUMENT_TYPES = {
  CITIZENSHIP: "tenantPhoto",
  AGREEMENT: "leaseAgreement",
  PHOTO: "photo",
  COMPANY_DOCUMENT: "companyDocument",
  TDS: "tds",
};

// ── Ledger payment methods (must match backend paymentAccountUtil.js exactly) ──
export const PAYMENT_METHODS = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CHEQUE: "cheque",
  MOBILE_WALLET: "mobile_wallet",
};

// ── Security deposit modes (separate concept — how the deposit is secured) ──
// BANK_GUARANTEE → no cash entry; bank guarantees payment if tenant defaults
// CASH / BANK_TRANSFER / CHEQUE → money actually received → ledger entry posted
export const SECURITY_DEPOSIT_MODES = {
  BANK_GUARANTEE: "bank_guarantee", // document only — no cash journal
  CASH: "cash", // posts DR Cash / CR SD Liability
  BANK_TRANSFER: "bank_transfer", // posts DR Bank / CR SD Liability
  CHEQUE: "cheque", // posts DR Bank / CR SD Liability
};

export const TENANT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
};

export const TAB_KEYS = {
  PERSONAL_INFO: "personalInfo",
  LEASE_DETAILS: "leaseDetails",
  FINANCIAL: "financial",
  DOCUMENTS: "documents",
};

export const RENT_PAYMENT_FREQUENCY = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
};
