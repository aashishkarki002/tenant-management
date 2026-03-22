/**
 * accounts.js  (UPDATED)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every chart-of-accounts code in the system.
 *
 * CHANGE: Corrected LOAN_INTEREST_EXPENSE code from "5400" → "5100" to match
 * the seeded Account document. Previously the journal builder (loan.js) used
 * ACCOUNT_CODES.LOAN_INTEREST_EXPENSE = "5100" (hardcoded) while this file
 * had a stale "5400" — this would cause resolveAccountsByEntity() to fail with
 * "Account 5400 not found" at runtime because no Account with code "5400" was
 * seeded.
 *
 * "5400" is now BANK_CHARGES (reserved, not yet seeded) — see seedLoanAccounts.js.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE RULES — READ BEFORE ADDING A CODE                        │
 * │                                                                         │
 * │  1. EVERY code used by ANY journal builder MUST be declared here.      │
 * │  2. CASH ("1000") is physical cash on hand ONLY.                       │
 * │  3. Bank sub-accounts ("1010-NABIL" …) are NEVER declared here.       │
 * │  4. CASH_BANK is a deprecated alias — do NOT use in new code.          │
 * │  5. Every code here MUST have a corresponding seeded Account document  │
 * │     for each OwnershipEntity. Missing doc → runtime throw.             │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Numbering convention:
 *   1000–1999  Assets
 *     1000   Cash on hand          (paymentMethod === "cash" only)
 *     1010–   Bank sub-accounts    (dynamic, created with BankAccount doc)
 *     1050   Mobile wallet float   (must be seeded before use)
 *     1200   Accounts receivable   (tenant rent / CAM / electricity due)
 *   2000–2999  Liabilities
 *     2000   Accounts payable      (trade payables to vendors)
 *     2100   Security deposit      (owed back to tenants on exit)
 *     2200   Loan principal        (outstanding principal owed to lenders)
 *   3000–3999  Equity              (reserved)
 *   4000–4999  Revenue
 *     4000   Rental income
 *     4100   Utility / electricity revenue
 *     4200   Late fee revenue
 *   5000–5999  Expenses
 *     5000   General expense
 *     5100   Loan interest expense  ← finance cost per EMI
 *     5200   Miscellaneous expense
 *     5400   Bank charges & fees    (reserved — not yet seeded)
 */

export const ACCOUNT_CODES = {
  // ── Assets ─────────────────────────────────────────────────────────────────

  /** Physical cash on hand. Use ONLY when paymentMethod === "cash". */
  CASH: "1000",

  /**
   * @deprecated  alias for CASH.
   * Kept for backward-compat with LedgerEntry rows written before the rename.
   * Do NOT reference in new code. Grep and replace periodically.
   */
  CASH_BANK: "1000",

  /**
   * E-wallet float (eSewa, Khalti, etc.).
   * Requires a seeded Account document (code "1050") before first use.
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

  /**
   * Outstanding principal owed to banks and lenders.
   *
   * Increases on disbursement (DR Bank / CR 2200).
   * Decreases on principal repayment (DR 2200 / CR Bank).
   * Mirrors Liability.amountPaisa for all active loans.
   */
  LOAN_LIABILITY: "2200",

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

  /**
   * Loan interest expense — finance cost recognised on the P&L each EMI.
   *
   * This is NOT a liability reduction. Interest is the cost of borrowing
   * for this period. It has no effect on the outstanding principal owed
   * to the lender (that is tracked by LOAN_LIABILITY "2200").
   *
   * Journal on each EMI payment:
   *   DR  2200  principalPaisa   ← reduces what we owe
   *   DR  5100  interestPaisa    ← finance cost on P&L  ← THIS account
   *   CR  1010  totalPaisa       ← cash exits the bank
   *
   * Must be seeded: see seedLoanAccounts.js
   */
  LOAN_INTEREST_EXPENSE: "5100", // FIX: was "5400" — corrected to match seeded Account

  /** Miscellaneous / unclassified expense. */
  EXPENSE_OTHER: "5200",

  /**
   * Bank processing fees, annual maintenance charges, loan origination fees.
   * Reserved — not yet seeded in chart of accounts.
   * @reserved do not use until Account "5400" is seeded.
   */
  BANK_CHARGES: "5400",
  ELECTRICITY_EXPENSE_NEA: "5610", // or whatever code fits your chart
  NEA_PAYABLE: "2050", // or whatever liability code fits
};
