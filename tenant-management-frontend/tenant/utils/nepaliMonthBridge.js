/**
 * nepaliMonthBridge.js
 *
 * Bridge between the nepali-datetime library (0-based months internally)
 * and the application's DB/API convention (1-based months everywhere public).
 *
 * Why this file exists
 * ─────────────────────
 * nepali-datetime:  nd.getMonth() === 0  →  Baisakh
 * DB / API layer:   nepaliMonth  === 1   →  Baisakh
 *
 * nepaliDate.js (client util) already handles this at its own boundary, but
 * any code that directly calls NepaliDate methods still needs the translation.
 * This bridge is the single authoritative place for that conversion so no
 * component or hook has to think about it.
 *
 * Additionally, it exposes billing-period–specific helpers that the plain
 * date util doesn't need to know about (e.g. "last N months" for the
 * backfill selector).
 */

import {
  getCurrentNepaliYear,
  getCurrentNepaliMonth,
  NEPALI_MONTH_NAMES,
  getNepaliMonthOptions,
  getNepaliYearOptions,
} from "./nepaliDate"; // re-uses the client util — no duplication

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the current Nepali billing period (year + 1-based month).
 * Use this to set initial state for the billing-period selector.
 *
 *   const [billingPeriod, setBillingPeriod] = useState(getCurrentBillingPeriod);
 *
 * @returns {{ nepaliYear: number, nepaliMonth: number }}
 */
export function getCurrentBillingPeriod() {
  return {
    nepaliYear: getCurrentNepaliYear(),
    nepaliMonth: getCurrentNepaliMonth(), // already 1-based from the client util
  };
}

/**
 * Returns a human-readable label for a billing period.
 *
 *   labelForPeriod({ nepaliYear: 2082, nepaliMonth: 8 }) → "Mangsir 2082"
 *
 * IMPORTANT: nepaliMonth is 1-based here but NEPALI_MONTH_NAMES is 0-indexed,
 * so we subtract 1 when indexing. This is the single translation point.
 *
 * @param {{ nepaliYear: number, nepaliMonth: number }} period
 * @returns {string}
 */
export function labelForPeriod({ nepaliYear, nepaliMonth }) {
  const name = NEPALI_MONTH_NAMES[nepaliMonth - 1]; // ← 1→0 conversion
  return `${name} ${nepaliYear}`;
}

/**
 * Stable composite key for a billing period — safe to use as <Select value>
 * or React key. Format: "YYYY-MM" with zero-padded month.
 *
 *   periodKey({ nepaliYear: 2082, nepaliMonth: 8 }) → "2082-08"
 *
 * @param {{ nepaliYear: number, nepaliMonth: number }} period
 * @returns {string}
 */
export function periodKey({ nepaliYear, nepaliMonth }) {
  return `${nepaliYear}-${String(nepaliMonth).padStart(2, "0")}`;
}

/**
 * Parse a composite key back into a billing period object.
 * Returns null when the key is malformed — never throws, safe for <Select onChange>.
 *
 *   parsePeriodKey("2082-08") → { nepaliYear: 2082, nepaliMonth: 8 }
 *
 * @param {string} key
 * @returns {{ nepaliYear: number, nepaliMonth: number } | null}
 */
export function parsePeriodKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const nepaliYear = parseInt(m[1], 10);
  const nepaliMonth = parseInt(m[2], 10);
  if (nepaliMonth < 1 || nepaliMonth > 12) return null;
  return { nepaliYear, nepaliMonth };
}

/**
 * Parse "MonthName YYYY" (e.g. "Ashwin 2081") into 1-based month + year.
 *
 * @param {string} value
 * @returns {{ month: number, year: number } | null}
 */
export function parseNepaliMonthString(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.trim().match(/^(\S+)\s+(\d{4})$/);
  if (!match) return null;

  const monthName = match[1].toLowerCase();
  const year = parseInt(match[2], 10);
  if (Number.isNaN(year)) return null;

  const monthIndex = NEPALI_MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === monthName,
  );
  if (monthIndex < 0) return null;

  return { month: monthIndex + 1, year };
}

// ─── Select-option builders ───────────────────────────────────────────────────

/**
 * Returns the last `count` billing periods as select options, newest first.
 * Default count is 13 — gives the admin a full trailing year plus the current
 * month, which covers every practical backfill scenario.
 *
 * Returns:
 *   [{ value: "2082-11", label: "Falgun 2082", nepaliYear: 2082, nepaliMonth: 11 }, …]
 *
 * @param {number} [count=13]
 * @returns {{ value: string, label: string, nepaliYear: number, nepaliMonth: number }[]}
 */
export function getRecentBillingPeriods(count = 13) {
  const current = getCurrentBillingPeriod();
  const options = [];

  let { nepaliYear, nepaliMonth } = current;

  for (let i = 0; i < count; i++) {
    const period = { nepaliYear, nepaliMonth };
    options.push({
      ...period,
      label: labelForPeriod(period),
      value: periodKey(period),
    });

    // Step back one month — handles year boundary correctly
    nepaliMonth -= 1;
    if (nepaliMonth < 1) {
      nepaliMonth = 12;
      nepaliYear -= 1;
    }
  }

  return options; // newest first
}

/**
 * Month options for a standalone month <Select>.
 * Thin re-export of the client util so consumers only import from this bridge.
 *
 * Returns [{ value: 1, label: "Baisakh" }, … { value: 12, label: "Chaitra" }]
 * value is always 1-based.
 *
 * @param {'en'|'np'} [lang='en']
 * @returns {{ value: number, label: string }[]}
 */
export function getMonthSelectOptions(lang = "en") {
  return getNepaliMonthOptions({ lang });
}

/**
 * Year options for a standalone year <Select>.
 * Descending order (newest first).
 *
 * @param {number} [startYear=2078]
 * @returns {{ value: number, label: string }[]}
 */
export function getYearSelectOptions(startYear = 2078) {
  return getNepaliYearOptions(startYear);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns true when both fields are valid 1-based Nepali month/year values.
 * Use this in canSave guards before the API call.
 *
 * @param {{ nepaliYear?: number, nepaliMonth?: number }} period
 * @returns {boolean}
 */
export function isBillingPeriodValid({ nepaliYear, nepaliMonth } = {}) {
  return (
    typeof nepaliYear === "number" &&
    Number.isInteger(nepaliYear) &&
    nepaliYear >= 2070 &&
    nepaliYear <= 2200 &&
    typeof nepaliMonth === "number" &&
    Number.isInteger(nepaliMonth) &&
    nepaliMonth >= 1 &&
    nepaliMonth <= 12
  );
}
