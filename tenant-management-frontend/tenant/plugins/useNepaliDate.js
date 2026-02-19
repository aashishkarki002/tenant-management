// hooks/useNepaliDate.js
import { useState, useEffect, useMemo } from "react";
import NepaliDate from "nepali-datetime";

/**
 * React Hooks for Nepali Date Management
 *
 * Industry standards applied:
 * - useMemo for expensive calculations (prevents re-computation)
 * - Cleanup functions in useEffect (prevents memory leaks)
 * - Stable object references (prevents infinite loops)
 * - Optional auto-refresh for real-time updates
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const NEPALI_MONTH_NAMES = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const NEPALI_DAY_NAMES = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहिबार",
  "शुक्रबार",
  "शनिबार",
];
const NEPALI_DAY_NAMES_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ============================================================================
// HOOK: Current Nepali Date
// ============================================================================

/**
 * Get current Nepali date with optional auto-refresh
 *
 * Industry pattern: Only re-render when date actually changes (not every second)
 *
 * @param {Object} options
 * @param {boolean} [options.autoRefresh=false] - Update every minute
 * @returns {Object} Current Nepali date info
 *
 * @example
 * const { year, month, day, monthName, formatted } = useNepaliDate();
 * // { year: 2081, month: 9, day: 15, monthName: 'Kartik', formatted: '२०८१-०९-१५' }
 */
export function useNepaliDate({ autoRefresh = false } = {}) {
  const [tick, setTick] = useState(0);

  // Auto-refresh effect (industry standard: cleanup timer to prevent leaks)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1); // Force re-calculation
    }, 60000); // Update every minute (not every second to save CPU)

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Memoize expensive NepaliDate calculation
  // Industry standard: useMemo prevents re-creating object on every render
  const nepaliInfo = useMemo(() => {
    const np = new NepaliDate();
    const year = np.getYear();
    const month = np.getMonth(); // 0-based
    const day = np.getDate();
    const dayOfWeek = np.getDay();

    return {
      // Raw values
      year,
      month: month + 1, // 1-based for display
      month0: month, // 0-based for calculations
      day,
      dayOfWeek,

      // Formatted strings
      monthName: NEPALI_MONTH_NAMES[month],
      dayName: NEPALI_DAY_NAMES_EN[dayOfWeek],
      dayNameNp: NEPALI_DAY_NAMES[dayOfWeek],

      // Common formats
      formatted: np.format("YYYY-MM-DD"), // 2081-09-15
      formattedNepali: np.format("YYYY-MM-DD", "np"), // २०८१-०९-१५
      fullDate: `${NEPALI_MONTH_NAMES[month]} ${day}, ${year}`, // Kartik 15, 2081

      // Instance (for advanced usage)
      instance: np,
    };
  }, [tick]); // Only recalculate when tick changes

  return nepaliInfo;
}

// ============================================================================
// HOOK: Fiscal Year Management
// ============================================================================

/**
 * Manage Nepali fiscal year (Shrawan 1 - Ashadh 31)
 *
 * Industry pattern: Controlled state with computed values
 *
 * @param {number} [initialYear] - Starting fiscal year (e.g., 2082 for FY 82/83)
 * @returns {Object} Fiscal year state and controls
 *
 * @example
 * const { fiscalYear, fiscalYearLabel, startDate, endDate, setFiscalYear } = useFiscalYear(2082);
 * // { fiscalYear: 2082, fiscalYearLabel: '82/83', startDate: '2082-04-01', ... }
 */
export function useFiscalYear(initialYear) {
  // Auto-detect current fiscal year if not provided
  const currentFY = useMemo(() => {
    const np = new NepaliDate();
    const year = np.getYear();
    const month = np.getMonth(); // 0-based

    // Fiscal year starts in Shrawan (month 3)
    // If current month is Baisakh-Ashadh (0-2), we're in previous fiscal year
    return month < 3 ? year - 1 : year;
  }, []);

  const [fiscalYear, setFiscalYear] = useState(initialYear ?? currentFY);

  // Compute fiscal year details (memoized to prevent recalculation)
  const fiscalInfo = useMemo(() => {
    const startYear = fiscalYear;
    const endYear = fiscalYear + 1;

    // Fiscal year: Shrawan 1 (month 3) to Ashadh 31 (month 2 of next year)
    const startDate = new NepaliDate(startYear, 3, 1); // Shrawan 1
    const endDayCount = NepaliDate.getDaysOfMonth(endYear, 2); // Days in Ashadh
    const endDate = new NepaliDate(endYear, 2, endDayCount); // Ashadh 31

    return {
      fiscalYear: startYear,
      fiscalYearLabel: `${String(startYear).slice(-2)}/${String(endYear).slice(-2)}`, // "82/83"
      fiscalYearFull: `${startYear}/${endYear}`, // "2082/2083"

      // Start date (Shrawan 1)
      startDate: startDate.format("YYYY-MM-DD"),
      startDateNepali: startDate.format("YYYY-MM-DD", "np"),
      startDateInstance: startDate,
      startDateEnglish: startDate.formatEnglishDate("YYYY-MM-DD"),

      // End date (Ashadh 31)
      endDate: endDate.format("YYYY-MM-DD"),
      endDateNepali: endDate.format("YYYY-MM-DD", "np"),
      endDateInstance: endDate,
      endDateEnglish: endDate.formatEnglishDate("YYYY-MM-DD"),

      // Controls
      setFiscalYear,
      nextYear: () => setFiscalYear((y) => y + 1),
      prevYear: () => setFiscalYear((y) => y - 1),
      resetToCurrent: () => setFiscalYear(currentFY),
    };
  }, [fiscalYear, currentFY]);

  return fiscalInfo;
}

// ============================================================================
// HOOK: Custom Nepali Date Range
// ============================================================================

/**
 * Manage custom Nepali date range with validation
 *
 * Industry pattern: Derived state with validation
 *
 * @param {Object} initial
 * @param {number} initial.year - Nepali year
 * @param {number} initial.month - Nepali month (1-based)
 * @param {number} [initial.day=1] - Nepali day
 * @returns {Object} Date state and formatted values
 *
 * @example
 * const date = useNepaliDateState({ year: 2081, month: 9, day: 15 });
 * // Access: date.formatted, date.instance, date.setYear(2082)
 */
export function useNepaliDateState({ year, month, day = 1 }) {
  const [dateState, setDateState] = useState({ year, month, day });

  const dateInfo = useMemo(() => {
    try {
      const np = new NepaliDate(
        dateState.year,
        dateState.month - 1,
        dateState.day,
      );

      return {
        year: dateState.year,
        month: dateState.month,
        day: dateState.day,
        monthName: NEPALI_MONTH_NAMES[dateState.month - 1],
        formatted: np.format("YYYY-MM-DD"),
        formattedNepali: np.format("YYYY-MM-DD", "np"),
        instance: np,
        englishDate: np.formatEnglishDate("YYYY-MM-DD"),

        // Controls
        setYear: (y) => setDateState((s) => ({ ...s, year: y })),
        setMonth: (m) => setDateState((s) => ({ ...s, month: m })),
        setDay: (d) => setDateState((s) => ({ ...s, day: d })),
        setDate: (y, m, d) => setDateState({ year: y, month: m, day: d }),
      };
    } catch (error) {
      console.error("Invalid Nepali date:", dateState, error);
      return null;
    }
  }, [dateState]);

  return dateInfo;
}

// ============================================================================
// UTILITY: Format Helpers
// ============================================================================

/**
 * Format any NepaliDate instance
 * (Pure function, not a hook - can be used anywhere)
 *
 * @param {NepaliDate} nepaliDate
 * @param {string} [format='YYYY-MM-DD']
 * @returns {string}
 */
export function formatNepaliDate(nepaliDate, format = "YYYY-MM-DD") {
  return nepaliDate.format(format);
}

/**
 * Get month name by index
 * @param {number} monthIndex - 0-based month index
 * @returns {string}
 */
export function getMonthName(monthIndex) {
  return NEPALI_MONTH_NAMES[monthIndex] ?? "Unknown";
}

/**
 * Get all month names (useful for dropdowns)
 * @returns {Array<{value: number, label: string}>}
 */
export function getMonthOptions() {
  return NEPALI_MONTH_NAMES.map((name, index) => ({
    value: index + 1, // 1-based
    label: name,
  }));
}
