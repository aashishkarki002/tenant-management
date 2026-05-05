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
 *     1010–  Bank sub-accounts     (dynamic, created with BankAccount doc)
 *     1050   Mobile wallet float   (must be seeded before use)
 *     1200   Accounts receivable   (tenant rent / CAM / electricity due)
 *   2000–2999  Liabilities
 *     2000   Accounts payable      (trade payables to vendors)
 *     2100   Security deposit      (owed back to tenants on exit)
 *     2200   Loan principal        (outstanding principal owed to lenders)
 *   3000–3999  Equity
 *     3000   Owner's capital       (contributed capital per entity)
 *     3100   Retained earnings     (accumulated profits after year-end close)
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
   * Cheques received but not yet deposited to the bank.
   *
   * Two-step cheque receipt flow:
   *   On receipt (PENDING):  DR 1150  amountPaisa  (ASSET ↑ — cheque in hand)
   *                          CR 4xxx  amountPaisa  (REVENUE ↑ — income recognised)
   *   On deposit (DEPOSITED): DR Bank  amountPaisa  (ASSET ↑ — money in bank)
   *                            CR 1150 amountPaisa  (ASSET ↓ — clears cheque in hand)
   *   On bounce (BOUNCED):   DR 4xxx  amountPaisa  (REVENUE ↓ — reversal)
   *                          CR 1150  amountPaisa  (ASSET ↓ — clears cheque in hand)
   *
   * Must be seeded for each OwnershipEntity.
   */
  CHEQUES_IN_HAND: "1150",

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

  /**
   * TDS withheld by tenants and paid directly to the government.
   * The landlord never receives this cash — it is a tax credit claimable
   * against the landlord's income tax liability.
   *
   * Non-cash entry posted at rent creation time:
   *   DR  1300  tdsAmountPaisa   (ASSET ↑ — recoverable from government)
   *   CR  1200  tdsAmountPaisa   (ASSET ↓ — reduces tenant's net AR balance)
   *
   * Must be seeded: run seedAccount.js after adding this code.
   */
  TDS_RECOVERABLE: "1300",

  /**
   * TDS amounts verified as paid to government by tenants.
   * Represents the subset of TDS that has been confirmed paid and is
   * available for claiming as a tax credit on income tax returns.
   *
   * Increases when tenant payment is verified:
   *   DR  1350  TDS Verified Paid
   *   CR  1300  TDS Recoverable (clears unverified amount)
   *
   * Must be seeded: run seedAccount.js after adding this code.
   */
  TDS_VERIFIED_PAID: "1350",

  // ── Liabilities ────────────────────────────────────────────────────────────

  /** Trade payables to vendors and contractors. */
  ACCOUNTS_PAYABLE: "2000",

  /**
   * Security deposits held on behalf of tenants.
   * Liability because the amount is owed back on vacancy.
   */
  SECURITY_DEPOSIT_LIABILITY: "2100",

  /**
   * Cheques issued but not yet presented to / cleared by the bank.
   *
   * Two-step cheque issue flow:
   *   On issue (PENDING):    DR 5xxx  amountPaisa  (EXPENSE ↑ — cost recorded)
   *                          CR 2150  amountPaisa  (LIABILITY ↑ — cheque obligation)
   *   On deposit (DEPOSITED): DR 2150 amountPaisa  (LIABILITY ↓ — clears the obligation)
   *                            CR Bank amountPaisa  (ASSET ↓ — money exits bank)
   *   On bounce (BOUNCED):   DR 2150  amountPaisa  (LIABILITY ↓ — reversal)
   *                          CR 5xxx  amountPaisa  (EXPENSE ↓ — reversal)
   *
   * Must be seeded for each OwnershipEntity.
   */
  CHEQUES_PAYABLE: "2150",

  /**
   * Outstanding principal owed to banks and lenders.
   *
   * Increases on disbursement (DR Bank / CR 2200).
   * Decreases on principal repayment (DR 2200 / CR Bank).
   * Mirrors Liability.amountPaisa for all active loans.
   */
  LOAN_LIABILITY: "2200",

  // ── Equity ─────────────────────────────────────────────────────────────────

  /**
   * Owner's contributed capital. Increases on capital injection, decreases on
   * withdrawal. Must be seeded for each OwnershipEntity.
   * Opening balance journal: DR Bank / CR 3000 (capital introduced).
   */
  OWNERS_CAPITAL: "3000",

  /**
   * Accumulated earnings retained in the business after distributions.
   * Increases when net profit is closed out at year-end.
   * Year-end closing entry: DR REVENUE accounts / CR 3100 (net profit transfer).
   * Must be seeded for each OwnershipEntity.
   */
  RETAINED_EARNINGS: "3100",

  // ── Revenue ────────────────────────────────────────────────────────────────

  /** Rental income from occupied units. */
  REVENUE: "4000",

  /**
   * Common Area Maintenance (CAM) income charged to tenants separately from rent.
   * Keeps CAM income distinct from rental income on the P&L.
   *
   * CAM_CHARGE journal:
   *   DR  1200  amountPaisa   (ASSET ↑ — tenant owes CAM)
   *   CR  4050  amountPaisa   (REVENUE ↑ — CAM income earned)
   *
   * Must be seeded: Account code "4050" required for each OwnershipEntity.
   */
  CAM_REVENUE: "4050",

  /** Electricity and utility charges billed to tenants. */
  UTILITY_REVENUE: "4100",

  /** Late payment penalties. */
  LATE_FEE_REVENUE: "4200",

  /**
   * Revenue from event stall / kiosk leases (Sallyan House courtyard events).
   * Posted when a kiosk lessee pays us for their space.
   *
   * Journal on kiosk payment received:
   *   DR  Cash/Bank      amountPaisa   (ASSET ↑)
   *   CR  4400           amountPaisa   (REVENUE ↑)
   *
   * Must be seeded: run seedAccount.js after adding this code.
   */
  EVENT_STALL_REVENUE: "4400",

  /**
   * Maintenance deductions withheld from security deposit and recognised as income.
   * Posted when SD is settled with MAINTENANCE_ADJUSTMENT type.
   * Must be seeded: Account code "4300" required for each OwnershipEntity.
   */
  MAINTENANCE_REVENUE: "4300",

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

  /**
   * Event operating expenses (Sallyan House courtyard events).
   * Covers stage setup, decorations, entertainment, event security, etc.
   *
   * Journal on event expense paid:
   *   DR  5450           amountPaisa   (EXPENSE ↑)
   *   CR  Cash/Bank      amountPaisa   (ASSET ↓)
   *
   * Must be seeded: run seedAccount.js after adding this code.
   */
  EVENT_EXPENSE: "5450",
  ELECTRICITY_EXPENSE_NEA: "5610",
  NEA_PAYABLE: "2050",
};
