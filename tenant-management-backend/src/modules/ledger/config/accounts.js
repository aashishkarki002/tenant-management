/**
 * accounts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every chart-of-accounts code in the system.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE RULES — READ BEFORE ADDING A CODE                        │
 * │                                                                         │
 * │  1. EVERY code used by ANY journal builder MUST be declared here.      │
 * │     A missing key returns `undefined` as the account code — the        │
 * │     ledger silently creates entries with no account attached.           │
 * │                                                                         │
 * │  2. CASH ("1000") is physical cash on hand ONLY.                       │
 * │     Post here when paymentMethod === "cash".                            │
 * │                                                                         │
 * │  3. Bank sub-accounts ("1010-NABIL", "1010-SANIMA" …) are created      │
 * │     dynamically when an admin adds a bank account. They are NEVER       │
 * │     declared here. Journal builders receive the code as a parameter    │
 * │     — they never hard-code a bank code.                                │
 * │                                                                         │
 * │  4. CASH_BANK is a deprecated alias kept ONLY for backward-compat      │
 * │     with existing LedgerEntry rows. Do NOT use it in any new code.     │
 * │                                                                         │
 * │  5. MOBILE_WALLET ("1050") must have a seeded Account document before  │
 * │     any wallet payment is processed. Missing account → throws at        │
 * │     runtime. There is no silent fallback.                               │
 * │                                                                         │
 * │  6. Control accounts (1000, 1200, 2000 …) are NEVER posted to         │
 * │     directly when a sub-account exists. Their currentBalancePaisa is   │
 * │     maintained by rebuildAllBalances() only — not by tx writes.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Numbering convention (standard SME chart of accounts):
 *   1000–1999  Assets
 *     1000       Cash on hand          ← only for paymentMethod "cash"
 *     1010–1099  Bank sub-accounts     ← dynamic, created with BankAccount doc
 *     1050       Mobile wallet float   ← must be seeded before use
 *     1200       Accounts receivable
 *   2000–2999  Liabilities
 *     2000       Accounts payable
 *     2100       Security deposit liability
 *   3000–3999  Equity                  ← reserved
 *   4000–4999  Revenue
 *     4000       Rental income
 *     4100       Utility / electricity revenue
 *     4200       Late fee revenue
 *   5000–5999  Expenses
 *     5000       General expense
 *     5200       Other / miscellaneous expense
 */

export const ACCOUNT_CODES = {
  // ── Assets ─────────────────────────────────────────────────────────────────

  /** Physical cash on hand. Use ONLY when paymentMethod === "cash". */
  CASH: "1000",

  /**
   * @deprecated alias for CASH.
   * Kept for backward-compat with LedgerEntry rows written before the rename.
   * Do NOT reference this in any new code. Grep and replace periodically.
   */
  CASH_BANK: "1000",

  /**
   * E-wallet float (eSewa, Khalti, etc.).
   * Requires a seeded Account document (code "1050") before first use.
   * No silent fallback — missing account throws at runtime.
   */
  MOBILE_WALLET: "1050",

  /** Amounts owed by tenants: rent, CAM, electricity, late fees. */
  ACCOUNTS_RECEIVABLE: "1200",

  // ── Liabilities ────────────────────────────────────────────────────────────

  /** Trade payables to vendors and contractors. */
  ACCOUNTS_PAYABLE: "2000",

  /**
   * Security deposits held on behalf of tenants.
   * Liability because the amount is owed back on vacancy.
   */
  SECURITY_DEPOSIT_LIABILITY: "2100",

  // ── Revenue ────────────────────────────────────────────────────────────────

  /** Rental income from occupied units. */
  REVENUE: "4000",

  /** Electricity and utility charges billed to tenants. */
  UTILITY_REVENUE: "4100",

  /** Late payment penalties. */
  LATE_FEE_REVENUE: "4200",

  // ── Expenses ───────────────────────────────────────────────────────────────

  /** General operating expense. */
  EXPENSE: "5000",

  /** Miscellaneous / unclassified expense. */
  EXPENSE_OTHER: "5200",
};
