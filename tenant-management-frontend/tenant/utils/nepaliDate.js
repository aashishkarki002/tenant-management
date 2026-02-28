/**
 * nepaliDateClient.js
 *
 * Client-side Nepali Date Utility
 * Mirrors the server-side nepaliDateHelper.js conventions:
 *   - 0-based months internally (NepaliDate API)
 *   - 1-based months at every public boundary (matching DB storage)
 *   - Pure functions, no side effects
 *   - Full JSDoc for IDE autocomplete
 *
 * Peer dependency: nepali-datetime
 *   npm install nepali-datetime
 */

import NepaliDate from "nepali-datetime";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Human-readable Nepali month names indexed 0–11 */
export const NEPALI_MONTH_NAMES = [
  "Baisakh", // 1
  "Jestha", // 2
  "Ashadh", // 3
  "Shrawan", // 4
  "Bhadra", // 5
  "Ashwin", // 6
  "Kartik", // 7
  "Mangsir", // 8
  "Poush", // 9
  "Magh", // 10
  "Falgun", // 11
  "Chaitra", // 12
];

/** Nepali month names in Devanagari script indexed 0–11 */
export const NEPALI_MONTH_NAMES_NP = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भदौ",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
];

/** Quarter → [startMonth1Based, endMonth1Based] */
export const QUARTER_MONTH_RANGES = {
  1: [1, 3],
  2: [4, 6],
  3: [7, 9],
  4: [10, 12],
};

// ============================================================================
// CURRENT DATE HELPERS  (the most-used functions on the frontend)
// ============================================================================

/**
 * Get the current Nepali date as a NepaliDate instance.
 * @returns {NepaliDate}
 */
export function getCurrentNepaliDate() {
  return new NepaliDate();
}

/**
 * Returns a plain object describing today in Nepali calendar.
 *
 * @returns {{
 *   year: number,        // e.g. 2081
 *   month: number,       // 1-based, e.g. 9  (matches DB convention)
 *   day: number,         // day of month
 *   monthName: string,   // "Ashwin"
 *   monthNameNp: string, // "असोज"
 *   quarter: number,     // 1–4
 *   isoString: string,   // "2081-09-15"
 *   displayDate: string, // "15 Ashwin, 2081"
 *   dayOfWeek: number,   // 0 = Sunday … 6 = Saturday
 * }}
 */
export function getTodayNepali() {
  const nd = new NepaliDate();
  const year = nd.getYear();
  const month0 = nd.getMonth(); // 0-based
  const month = month0 + 1; // 1-based (public boundary)
  const day = nd.getDate();

  return {
    year,
    month,
    day,
    monthName: NEPALI_MONTH_NAMES[month0],
    monthNameNp: NEPALI_MONTH_NAMES_NP[month0],
    quarter: Math.ceil(month / 3),
    isoString: _formatISO(year, month, day),
    displayDate: `${day} ${NEPALI_MONTH_NAMES[month0]}, ${year}`,
    dayOfWeek: nd.getDay(),
  };
}

/**
 * Get current Nepali year (4 digits).
 * @returns {number}
 */
export function getCurrentNepaliYear() {
  return new NepaliDate().getYear();
}

/**
 * Get current Nepali month (1-based, matches DB storage).
 * @returns {number}  1–12
 */
export function getCurrentNepaliMonth() {
  return new NepaliDate().getMonth() + 1;
}

/**
 * Get current Nepali quarter (1–4).
 * @returns {number}
 */
export function getCurrentNepaliQuarter() {
  return Math.ceil(getCurrentNepaliMonth() / 3);
}

// ============================================================================
// MONTH UTILITIES
// ============================================================================

/**
 * Get metadata and boundary dates for any Nepali month.
 * Defaults to the current month when called with no arguments.
 *
 * @param {number} [year]   - Nepali year (defaults to current)
 * @param {number} [month]  - 1-based month (defaults to current)
 * @returns {{
 *   year: number,
 *   month: number,           // 1-based
 *   monthName: string,
 *   monthNameNp: string,
 *   totalDays: number,
 *   firstDay: NepaliDate,
 *   lastDay: NepaliDate,
 *   firstDayISO: string,     // "YYYY-MM-DD"
 *   lastDayISO: string,
 *   quarter: number,
 * }}
 */
export function getNepaliMonthInfo(year, month) {
  const nd = new NepaliDate();
  const y = year !== undefined ? year : nd.getYear();
  const m1 = month !== undefined ? month : nd.getMonth() + 1; // 1-based
  const m0 = m1 - 1; // 0-based for API

  _assertYearMonth(y, m1);

  const totalDays = NepaliDate.getDaysOfMonth(y, m0);
  const firstDay = new NepaliDate(y, m0, 1);
  const lastDay = new NepaliDate(y, m0, totalDays);

  return {
    year: y,
    month: m1,
    monthName: NEPALI_MONTH_NAMES[m0],
    monthNameNp: NEPALI_MONTH_NAMES_NP[m0],
    totalDays,
    firstDay,
    lastDay,
    firstDayISO: _formatISO(y, m1, 1),
    lastDayISO: _formatISO(y, m1, totalDays),
    quarter: Math.ceil(m1 / 3),
  };
}

/**
 * Build an array of month options for a <select> or dropdown.
 * Returns all 12 months or only those within a given quarter.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.quarter]         - Filter to this quarter (1–4)
 * @param {'en'|'np'} [opts.lang='en']     - Label language
 * @returns {{ value: number, label: string }[]}   value is 1-based month
 */
export function getNepaliMonthOptions({ quarter, lang = "en" } = {}) {
  const names = lang === "np" ? NEPALI_MONTH_NAMES_NP : NEPALI_MONTH_NAMES;

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: names[i],
  }));

  if (!quarter) return months;

  const [start, end] = QUARTER_MONTH_RANGES[quarter] ?? [1, 12];
  return months.filter((m) => m.value >= start && m.value <= end);
}

/**
 * Mirror of server-side getMonthsInQuarter — returns month numbers (1-based)
 * for a given quarter so that client filter state matches Mongo queries exactly.
 *
 * @param {number} quarter  1–4
 * @returns {number[]}  e.g. [7, 8, 9] for quarter 3
 */
export function getMonthsInQuarter(quarter) {
  const startIndex = (Number(quarter) - 1) * 3;
  return Array.from({ length: 3 }, (_, i) => startIndex + i + 1);
}

/**
 * Build a year range array for a <select>.
 *
 * @param {number} [startYear=2075]
 * @param {number} [endYear]         - Defaults to current Nepali year
 * @returns {{ value: number, label: string }[]}
 */
export function getNepaliYearOptions(startYear = 2075, endYear) {
  const end = endYear ?? getCurrentNepaliYear();
  const years = [];
  for (let y = end; y >= startYear; y--) {
    years.push({ value: y, label: String(y) });
  }
  return years;
}

// ============================================================================
// FILTER STATE HELPERS  (for date-range filter components)
// ============================================================================

/**
 * Returns a filter state object for "this month" in the Nepali calendar.
 * Plug it straight into your component state or API params.
 *
 * @returns {{
 *   nepaliYear:  number,
 *   nepaliMonth: number,   // 1-based
 *   quarter:     null,
 *   monthName:   string,
 * }}
 */
export function getCurrentMonthFilter() {
  const { year, month, monthName } = getTodayNepali();
  return { nepaliYear: year, nepaliMonth: month, quarter: null, monthName };
}

/**
 * Returns a filter state object for "this quarter".
 *
 * @returns {{
 *   nepaliYear: number,
 *   quarter:    number,
 *   months:     number[],   // 1-based month numbers in the quarter
 *   nepaliMonth: null,
 * }}
 */
export function getCurrentQuarterFilter() {
  const { year, quarter } = getTodayNepali();
  return {
    nepaliYear: year,
    quarter,
    months: getMonthsInQuarter(quarter),
    nepaliMonth: null,
  };
}

/**
 * Returns a filter state object for "this year".
 *
 * @returns {{
 *   nepaliYear:  number,
 *   nepaliMonth: null,
 *   quarter:     null,
 * }}
 */
export function getCurrentYearFilter() {
  return {
    nepaliYear: getCurrentNepaliYear(),
    nepaliMonth: null,
    quarter: null,
  };
}

/**
 * Given a year + quarter selection, returns the API-ready month list
 * and display label — handy for wiring up quarter filter dropdowns.
 *
 * @param {number} year
 * @param {number} quarter  1–4
 * @returns {{
 *   nepaliYear:  number,
 *   months:      number[],   // 1-based
 *   label:       string,     // "Q2 2081 (Ashadh – Shrawan – Bhadra)"
 * }}
 */
export function buildQuarterFilter(year, quarter) {
  const months = getMonthsInQuarter(quarter);
  const names = months.map((m) => NEPALI_MONTH_NAMES[m - 1]).join(" – ");
  return {
    nepaliYear: year,
    months,
    label: `Q${quarter} ${year} (${names})`,
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format a NepaliDate (or raw year/month/day) as "YYYY-MM-DD".
 * Month is always 1-based at the public boundary.
 *
 * @overload
 * @param {NepaliDate} nd
 * @returns {string}
 *
 * @overload
 * @param {number} year
 * @param {number} month   1-based
 * @param {number} day
 * @returns {string}
 */
export function formatNepaliISO(yearOrNd, month, day) {
  if (yearOrNd instanceof NepaliDate) {
    const nd = yearOrNd;
    return _formatISO(nd.getYear(), nd.getMonth() + 1, nd.getDate());
  }
  return _formatISO(yearOrNd, month, day);
}

/**
 * Format for display: "15 Ashwin, 2081" (or Nepali script).
 *
 * @param {NepaliDate|{year:number,month:number,day:number}} date - month 1-based
 * @param {'en'|'np'} [lang='en']
 * @returns {string}
 */
export function formatNepaliDisplay(date, lang = "en") {
  let year, month1, day;

  if (date instanceof NepaliDate) {
    year = date.getYear();
    month1 = date.getMonth() + 1;
    day = date.getDate();
  } else {
    ({ year, month: month1, day } = date);
  }

  const name =
    lang === "np"
      ? NEPALI_MONTH_NAMES_NP[month1 - 1]
      : NEPALI_MONTH_NAMES[month1 - 1];

  return `${day} ${name}, ${year}`;
}

/**
 * Parse a "YYYY-MM-DD" Nepali ISO string into { year, month, day }.
 * Month in the returned object is 1-based.
 *
 * @param {string} isoString
 * @returns {{ year: number, month: number, day: number, nd: NepaliDate }}
 * @throws {Error} on bad format
 */
export function parseNepaliISO(isoString) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString);
  if (!m)
    throw new Error(`Invalid Nepali ISO: "${isoString}". Expected YYYY-MM-DD`);

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10); // 1-based
  const day = parseInt(m[3], 10);

  _assertYearMonth(year, month);

  return {
    year,
    month, // 1-based — consistent with all other public APIs here
    day,
    nd: new NepaliDate(year, month - 1, day),
  };
}

// ============================================================================
// DATE ARITHMETIC
// ============================================================================

/**
 * Add (or subtract) months from a NepaliDate, returning a new NepaliDate.
 * Day is clamped to the target month's valid range.
 *
 * @param {NepaliDate} nd
 * @param {number} months  May be negative
 * @returns {NepaliDate}
 */
export function addNepaliMonths(nd, months) {
  let year = nd.getYear();
  let month = nd.getMonth(); // 0-based
  const day = nd.getDate();

  const total = month + months;
  const yearOffset = Math.floor(total / 12);
  let newMonth = total % 12;
  if (newMonth < 0) {
    newMonth += 12;
    year += yearOffset - 1;
  } else {
    year += yearOffset;
  }

  const maxDay = NepaliDate.getDaysOfMonth(year, newMonth);
  return new NepaliDate(year, newMonth, Math.min(day, maxDay));
}

/**
 * Add (or subtract) days from a NepaliDate via English Date conversion.
 *
 * @param {NepaliDate} nd
 * @param {number} days  May be negative
 * @returns {NepaliDate}
 */
export function addNepaliDays(nd, days) {
  const eng = nd.getDateObject();
  eng.setDate(eng.getDate() + days);
  return new NepaliDate(eng);
}

/**
 * Difference in days between two NepaliDate instances (nd2 − nd1).
 * Positive when nd2 is later.
 *
 * @param {NepaliDate} nd1
 * @param {NepaliDate} nd2
 * @returns {number}
 */
export function diffNepaliDays(nd1, nd2) {
  const ms = nd2.getDateObject().getTime() - nd1.getDateObject().getTime();
  return Math.round(ms / 86_400_000);
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert a JS Date (or ISO string) to Nepali year + month (1-based).
 * Mirrors server-side getNepaliYearMonthFromDate().
 *
 * @param {Date|string} jsDate
 * @returns {{ npYear: number, npMonth: number }}
 */
export function getNepaliYearMonthFromDate(jsDate) {
  const nd = new NepaliDate(jsDate instanceof Date ? jsDate : new Date(jsDate));
  return { npYear: nd.getYear(), npMonth: nd.getMonth() + 1 };
}

/**
 * Convert a JS Date to a full Nepali date descriptor.
 *
 * @param {Date|string} jsDate
 * @returns {{ year:number, month:number, day:number, monthName:string, isoString:string }}
 */
export function jsDateToNepali(jsDate) {
  const nd = new NepaliDate(jsDate instanceof Date ? jsDate : new Date(jsDate));
  const year = nd.getYear();
  const month = nd.getMonth() + 1;
  const day = nd.getDate();
  return {
    year,
    month,
    day,
    monthName: NEPALI_MONTH_NAMES[month - 1],
    isoString: _formatISO(year, month, day),
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Returns true when year + month (1-based) are within supported range.
 *
 * @param {number} year
 * @param {number} month  1-based
 * @returns {boolean}
 */
export function isValidNepaliYearMonth(year, month) {
  return (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2200 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/** @private */
function _formatISO(year, month1Based, day) {
  return `${year}-${String(month1Based).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** @private */
function _assertYearMonth(year, month) {
  if (!isValidNepaliYearMonth(year, month)) {
    throw new Error(`Invalid Nepali year/month: ${year}/${month}`);
  }
}
