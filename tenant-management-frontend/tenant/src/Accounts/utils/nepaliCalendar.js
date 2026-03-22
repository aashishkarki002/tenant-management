/**
 * nepaliCalendar.js — single import point for all Nepali calendar helpers.
 *
 * Previously every component re-declared BS_MONTHS[], toBSDate(), getCurrentFiscalYear() etc.
 * Now everything comes from the two canonical util files:
 *   • nepaliDate.js     — NepaliDate-powered helpers (current date, FY, quarters …)
 *   • formatNepali.js   — English → Nepali date string conversion
 *
 * Import from this file everywhere instead of repeating the same 40-line block
 * in AccountingPage, RevenueBreakDown, ExpenseBreakDown, LedgerTable …
 */

// ── Re-export everything from the canonical util files ──────────────────────
import NepaliDate from "nepali-datetime";
import {
  // Constants
  NEPALI_MONTH_NAMES,
  NEPALI_MONTH_SHORT,
  NEPALI_MONTH_NAMES_NP,
  QUARTER_MONTH_RANGES,

  // Current-date helpers
  getTodayNepali,
  getCurrentNepaliYear,
  getCurrentNepaliMonth,
  getCurrentNepaliQuarter,

  // Month / quarter / year utilities
  getNepaliMonthInfo,
  getNepaliMonthOptions,
  getMonthsInQuarter,
  getNepaliYearOptions,
  buildQuarterFilter,

  // Fiscal-year helpers
  getFYStartYear,
  getFYLabel,
  getCurrentFYMonths,
  getCurrentFYQuarter,

  // Formatting
  formatNepaliISO,
  formatNepaliDisplay,
  parseNepaliISO,

  // Arithmetic
  addNepaliMonths,
  addNepaliDays,
  diffNepaliDays,

  // Conversion
  getNepaliYearMonthFromDate,
  jsDateToNepali,

  // Validation
  isValidNepaliYearMonth,
} from "../../../utils/nepaliDate"; // adjust path to your project layout

import { toNepaliDate } from "../../../utils/formatNepali"; // English ISO → "DD Month YYYY"

export {
  // Constants
  NEPALI_MONTH_NAMES,
  NEPALI_MONTH_SHORT,
  NEPALI_MONTH_NAMES_NP,
  QUARTER_MONTH_RANGES,

  // Current-date helpers
  getTodayNepali,
  getCurrentNepaliYear,
  getCurrentNepaliMonth,
  getCurrentNepaliQuarter,

  // Month / quarter / year utilities
  getNepaliMonthInfo,
  getNepaliMonthOptions,
  getMonthsInQuarter,
  getNepaliYearOptions,
  buildQuarterFilter,

  // Fiscal-year helpers
  getFYStartYear,
  getFYLabel,
  getCurrentFYMonths,
  getCurrentFYQuarter,

  // Formatting
  formatNepaliISO,
  formatNepaliDisplay,
  parseNepaliISO,

  // Arithmetic
  addNepaliMonths,
  addNepaliDays,
  diffNepaliDays,

  // Conversion
  getNepaliYearMonthFromDate,
  jsDateToNepali,

  // Validation
  isValidNepaliYearMonth,

  // Formatting helpers from this module
  toNepaliDate,
};

// ── Derived convenience helpers (computed once, shared everywhere) ──────────

/**
 * The current fiscal year start (e.g. 2081).
 * Replaces the ad-hoc getCurrentFiscalYear() that was copy-pasted into AccountingPage.
 */
export const CURRENT_FISCAL_YEAR = getFYStartYear();

/**
 * Name of the current Nepali month in English (e.g. "Ashwin").
 * Replaces getCurrentBSMonthName() in AccountingPage.
 */
export const CURRENT_BS_MONTH_NAME = (() => {
  try {
    return NEPALI_MONTH_NAMES[new NepaliDate().getMonth()];
  } catch {
    return null;
  }
})();

/**
 * Quarter → human-readable month-range label used in dropdowns / compare UI.
 * e.g. QUARTER_LABELS[1] === "Shrawan–Ashwin"
 *
 * Previously this object was duplicated in AccountingPage AND useMonthlyChart.
 */
export const QUARTER_LABELS = {
  1: "Shrawan–Ashwin",
  2: "Kartik–Poush",
  3: "Magh–Chaitra",
  4: "Baisakh–Ashadh",
};

/**
 * Convert an English ISO string / Date to a short BS label: "19 Pou".
 * Replaces the local toBSShort() inside AccountingPage.
 *
 * @param {string|Date} isoOrDate
 * @returns {string}
 */
export function toBSShort(isoOrDate) {
  if (!isoOrDate) return "—";
  try {
    const nd = new NepaliDate(new Date(isoOrDate));
    return `${nd.getDate()} ${NEPALI_MONTH_NAMES[nd.getMonth()].slice(0, 3)}`;
  } catch {
    return "—";
  }
}

/**
 * Convert an English ISO string / Date to a full BS label: "19 Poush 2081".
 * Thin wrapper around toNepaliDate() so callers only import from nepaliCalendar.
 *
 * @param {string|Date} isoOrDate
 * @returns {string}
 */
export function toBSDate(isoOrDate) {
  return toNepaliDate(isoOrDate);
}
