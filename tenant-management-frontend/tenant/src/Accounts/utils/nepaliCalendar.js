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
  getCurrentNepaliMonthYear,
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
  toNepaliDate,

  // Arithmetic
  addNepaliMonths,
  addNepaliDays,
  diffNepaliDays,

  // Conversion
  getNepaliYearMonthFromDate,
  jsDateToNepali,

  // Validation
  isValidNepaliYearMonth,
} from "@/utils/nepaliDate";

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
  getCurrentNepaliMonthYear,
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

// ── Dynamic helpers (called at render time, never cached as module constants) ─

/**
 * Returns the current fiscal year start (e.g. 2081).
 *
 * Industry standard: derive fresh on every call — do NOT use a module-level
 * constant for anything time-sensitive. Module constants are computed once
 * at bundle load time and become stale across midnight / new-year boundaries.
 *
 * Usage: const fy = getCurrentFiscalYear()
 */
export function getCurrentFiscalYear() {
  return getFYStartYear();
}

/**
 * Returns the current Nepali month name in English (e.g. "Baisakh").
 * Fresh on every call — safe across new-year boundaries.
 */
export function getCurrentBSMonthName() {
  try {
    return NEPALI_MONTH_NAMES[new NepaliDate().getMonth()];
  } catch {
    return null;
  }
}

/**
 * Returns the current Nepali month number 1-indexed (1=Baisakh … 12=Chaitra).
 * Fresh on every call.
 */
export function getCurrentBSMonth() {
  try {
    // NepaliDate.getMonth() is 0-indexed
    return new NepaliDate().getMonth() + 1;
  } catch {
    return 1;
  }
}

// ── Derived constants that are truly static (safe to cache) ──────────────────

export const QUARTER_LABELS = {
  1: "Shrawan–Ashwin",
  2: "Kartik–Poush",
  3: "Magh–Chaitra",
  4: "Baisakh–Ashadh",
};

/**
 * Nepali months in Nepal Fiscal Year order (Shrawan first).
 * FY runs Shrawan(4)→Bhadra(5)→…→Chaitra(12)→Baisakh(1)→…→Ashadh(3).
 *
 * Each entry: { month: number (1-indexed), name: string }
 *
 * Use this whenever rendering a month picker so users see the FY sequence,
 * not the calendar sequence (Baisakh-first). Industry standard for any
 * fiscal-year-scoped date picker.
 */
export const NEPALI_MONTHS_FY_ORDER = [
  // Second half of calendar year = first half of FY
  { month: 4, name: "Shrawan" },
  { month: 5, name: "Bhadra" },
  { month: 6, name: "Ashwin" },
  { month: 7, name: "Kartik" },
  { month: 8, name: "Mangsir" },
  { month: 9, name: "Poush" },
  { month: 10, name: "Magh" },
  { month: 11, name: "Falgun" },
  { month: 12, name: "Chaitra" },
  // First three months of calendar year = last quarter of FY
  { month: 1, name: "Baisakh" },
  { month: 2, name: "Jestha" },
  { month: 3, name: "Ashadh" },
];

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Convert an English ISO string / Date to a short BS label: "19 Pou".
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
 */
export function toBSDate(isoOrDate) {
  return toNepaliDate(isoOrDate);
}
