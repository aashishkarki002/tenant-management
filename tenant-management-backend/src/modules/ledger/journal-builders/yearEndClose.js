/**
 * yearEndClose.js
 *
 * Builds three closing journal payloads for Nepal fiscal year-end close.
 *
 * Nepal fiscal year: Shrawan (month 4) → Ashad (month 3 of year+1).
 * Closing entries are posted in Ashad of year+1 (the last period of the FY).
 *
 * CLOSING ENTRY TECHNIQUE (Income Summary):
 *
 *   Pass 1 — Close Revenue accounts (credit-normal → debit to close):
 *     DR  Revenue accounts (4xxx)   totalRevenuePaisa
 *     CR  Income Summary  (3500)    totalRevenuePaisa
 *
 *   Pass 2 — Close Expense accounts (debit-normal → credit to close):
 *     DR  Income Summary  (3500)    totalExpensePaisa
 *     CR  Expense accounts (5xxx)   totalExpensePaisa
 *
 *   Pass 3 — Transfer net income/loss to Retained Earnings (3100):
 *     If net income (revenue > expense):
 *       DR  Income Summary     (3500)  netIncomePaisa
 *       CR  Retained Earnings  (3100)  netIncomePaisa
 *     If net loss (expense > revenue):
 *       DR  Retained Earnings  (3100)  netLossPaisa
 *       CR  Income Summary     (3500)  netLossPaisa
 *
 * After all 3 passes, Income Summary (3500) balance must be zero.
 * Revenue (4xxx) and Expense (5xxx) balances must be zero.
 * Retained Earnings (3100) reflects cumulative net income.
 *
 * All amounts in PAISA (integers). Never rupees.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

// Revenue account codes that participate in year-end close
const REVENUE_ACCOUNT_CODES = [
  ACCOUNT_CODES.REVENUE,               // 4000
  ACCOUNT_CODES.CAM_REVENUE,           // 4050
  ACCOUNT_CODES.UTILITY_REVENUE,       // 4100
  ACCOUNT_CODES.LATE_FEE_REVENUE,      // 4200
  ACCOUNT_CODES.MAINTENANCE_REVENUE,   // 4300
  ACCOUNT_CODES.EVENT_STALL_REVENUE,   // 4400
];

// Expense account codes that participate in year-end close
const EXPENSE_ACCOUNT_CODES = [
  ACCOUNT_CODES.EXPENSE,               // 5000
  ACCOUNT_CODES.LOAN_INTEREST_EXPENSE, // 5100
  ACCOUNT_CODES.EXPENSE_OTHER,         // 5200
  ACCOUNT_CODES.EVENT_EXPENSE,         // 5450
  ACCOUNT_CODES.ELECTRICITY_EXPENSE_NEA, // 5610
  ACCOUNT_CODES.BAD_DEBT_EXPENSE,      // 5700
];

/**
 * Build Pass 1 — Close all revenue accounts into Income Summary.
 *
 * @param {Object}          params
 * @param {string|ObjectId} params.fiscalYearCloseId  FiscalYearClose document _id
 * @param {Map<string,number>} params.revenueBalances  accountCode → balancePaisa
 * @param {number}          params.fiscalYear         e.g. 2081
 * @param {string|ObjectId} params.closedBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object|null}  Journal payload or null if all revenue = 0
 */
export function buildYearEndRevenueCloseJournal({
  fiscalYearCloseId,
  revenueBalances,
  fiscalYear,
  closedBy,
  entityId,
}) {
  const entries = [];
  let totalRevenuePaisa = 0;

  for (const code of REVENUE_ACCOUNT_CODES) {
    const balance = revenueBalances.get(code) ?? 0;
    if (balance <= 0) continue;

    entries.push({
      accountCode: code,
      debitAmountPaisa: balance,
      creditAmountPaisa: 0,
      description: `Year-end close: zeroing revenue account ${code} FY ${fiscalYear}`,
    });
    totalRevenuePaisa += balance;
  }

  if (totalRevenuePaisa === 0) return null;

  // Credit Income Summary
  entries.push({
    accountCode: ACCOUNT_CODES.INCOME_SUMMARY, // 3500
    debitAmountPaisa: 0,
    creditAmountPaisa: totalRevenuePaisa,
    description: `Year-end close: total revenue transferred to income summary FY ${fiscalYear}`,
  });

  // Closing entry date: Ashad (month 3) of year+1 = last day of FY
  const closingYear  = fiscalYear + 1;
  const closingMonth = 3; // Ashad
  const closingDay   = NepaliDate.getDaysOfMonth(closingYear, closingMonth - 1); // 0-based
  const closingNp    = new NepaliDate(closingYear, closingMonth - 1, closingDay);
  const transactionDate = closingNp.getDateObject();
  const nepaliDate      = formatNepaliISO(closingNp);

  return {
    transactionType: "YEAR_END_CLOSE_REVENUE",
    referenceType: "FiscalYearClose",
    referenceId: fiscalYearCloseId,
    transactionDate,
    nepaliDate,
    nepaliMonth: closingMonth,
    nepaliYear:  closingYear,
    description: `Year-end close FY ${fiscalYear}: close revenue accounts to income summary`,
    createdBy: closedBy,
    totalAmountPaisa: totalRevenuePaisa,
    entityId,
    entries,
  };
}

/**
 * Build Pass 2 — Close all expense accounts into Income Summary.
 *
 * @param {Object}          params
 * @param {string|ObjectId} params.fiscalYearCloseId
 * @param {Map<string,number>} params.expenseBalances  accountCode → balancePaisa
 * @param {number}          params.fiscalYear
 * @param {string|ObjectId} params.closedBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object|null}  Journal payload or null if all expenses = 0
 */
export function buildYearEndExpenseCloseJournal({
  fiscalYearCloseId,
  expenseBalances,
  fiscalYear,
  closedBy,
  entityId,
}) {
  const entries = [];
  let totalExpensePaisa = 0;

  // Debit Income Summary
  // We add the Income Summary DR entry first, then the expense CRs
  for (const code of EXPENSE_ACCOUNT_CODES) {
    const balance = expenseBalances.get(code) ?? 0;
    if (balance <= 0) continue;

    entries.push({
      accountCode: code,
      debitAmountPaisa: 0,
      creditAmountPaisa: balance,
      description: `Year-end close: zeroing expense account ${code} FY ${fiscalYear}`,
    });
    totalExpensePaisa += balance;
  }

  if (totalExpensePaisa === 0) return null;

  // Add Income Summary DR entry at front
  entries.unshift({
    accountCode: ACCOUNT_CODES.INCOME_SUMMARY, // 3500
    debitAmountPaisa: totalExpensePaisa,
    creditAmountPaisa: 0,
    description: `Year-end close: total expenses transferred from income summary FY ${fiscalYear}`,
  });

  const closingYear  = fiscalYear + 1;
  const closingMonth = 3;
  const closingDay   = NepaliDate.getDaysOfMonth(closingYear, closingMonth - 1);
  const closingNp    = new NepaliDate(closingYear, closingMonth - 1, closingDay);
  const transactionDate = closingNp.getDateObject();
  const nepaliDate      = formatNepaliISO(closingNp);

  return {
    transactionType: "YEAR_END_CLOSE_EXPENSE",
    referenceType: "FiscalYearClose",
    referenceId: fiscalYearCloseId,
    transactionDate,
    nepaliDate,
    nepaliMonth: closingMonth,
    nepaliYear:  closingYear,
    description: `Year-end close FY ${fiscalYear}: close expense accounts to income summary`,
    createdBy: closedBy,
    totalAmountPaisa: totalExpensePaisa,
    entityId,
    entries,
  };
}

/**
 * Build Pass 3 — Transfer Income Summary balance to Retained Earnings.
 *
 * @param {Object}          params
 * @param {string|ObjectId} params.fiscalYearCloseId
 * @param {number}          params.totalRevenuePaisa
 * @param {number}          params.totalExpensePaisa
 * @param {number}          params.fiscalYear
 * @param {string|ObjectId} params.closedBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object}  Journal payload
 */
export function buildYearEndRetainedEarningsJournal({
  fiscalYearCloseId,
  totalRevenuePaisa,
  totalExpensePaisa,
  fiscalYear,
  closedBy,
  entityId,
}) {
  const netPaisa = totalRevenuePaisa - totalExpensePaisa;
  const absNet   = Math.abs(netPaisa);

  if (absNet === 0) {
    // Perfect break-even — still need a nominal entry to mark the close complete
    // Use 1 paisa zero-net entry is not possible; return null to skip
    return null;
  }

  const closingYear  = fiscalYear + 1;
  const closingMonth = 3;
  const closingDay   = NepaliDate.getDaysOfMonth(closingYear, closingMonth - 1);
  const closingNp    = new NepaliDate(closingYear, closingMonth - 1, closingDay);
  const transactionDate = closingNp.getDateObject();
  const nepaliDate      = formatNepaliISO(closingNp);

  let entries;

  if (netPaisa > 0) {
    // Net income: DR Income Summary / CR Retained Earnings
    entries = [
      {
        accountCode: ACCOUNT_CODES.INCOME_SUMMARY,
        debitAmountPaisa: absNet,
        creditAmountPaisa: 0,
        description: `Year-end close FY ${fiscalYear}: clear income summary (net income)`,
      },
      {
        accountCode: ACCOUNT_CODES.RETAINED_EARNINGS, // 3100
        debitAmountPaisa: 0,
        creditAmountPaisa: absNet,
        description: `Year-end close FY ${fiscalYear}: net income ${absNet} paisa to retained earnings`,
      },
    ];
  } else {
    // Net loss: DR Retained Earnings / CR Income Summary
    entries = [
      {
        accountCode: ACCOUNT_CODES.RETAINED_EARNINGS,
        debitAmountPaisa: absNet,
        creditAmountPaisa: 0,
        description: `Year-end close FY ${fiscalYear}: net loss ${absNet} paisa charged to retained earnings`,
      },
      {
        accountCode: ACCOUNT_CODES.INCOME_SUMMARY,
        debitAmountPaisa: 0,
        creditAmountPaisa: absNet,
        description: `Year-end close FY ${fiscalYear}: clear income summary (net loss)`,
      },
    ];
  }

  return {
    transactionType: "YEAR_END_CLOSE_RETAINED",
    referenceType: "FiscalYearClose",
    referenceId: fiscalYearCloseId,
    transactionDate,
    nepaliDate,
    nepaliMonth: closingMonth,
    nepaliYear:  closingYear,
    description: `Year-end close FY ${fiscalYear}: transfer net ${netPaisa >= 0 ? "income" : "loss"} ${absNet} paisa to retained earnings`,
    createdBy: closedBy,
    totalAmountPaisa: absNet,
    entityId,
    entries,
  };
}

// Expose the full account code lists for use by the service
export { REVENUE_ACCOUNT_CODES, EXPENSE_ACCOUNT_CODES };
