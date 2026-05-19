  /**
 * fiscalCalendar.js — Nepal Fiscal Calendar: single source of truth
 *
 * All quarter/fiscal-year definitions must be imported from here.
 * Never define FISCAL_QUARTER_MONTHS or FISCAL_YEAR_MONTH_ORDER locally.
 *
 * Nepal Fiscal Year runs Shrawan → Ashadh (BS months 4–3, crossing a BS year).
 *
 * 0-based BS month index (NepaliDate API):
 *   Baisakh=0  Jestha=1  Ashadh=2  Shrawan=3  Bhadra=4   Ashwin=5
 *   Kartik=6   Mangsir=7 Poush=8   Magh=9     Falgun=10  Chaitra=11
 *
 * 1-based nepaliMonth (DB storage):
 *   Baisakh=1  Jestha=2  Ashadh=3  Shrawan=4  Bhadra=5   Ashwin=6
 *   Kartik=7   Mangsir=8 Poush=9   Magh=10    Falgun=11  Chaitra=12
 *
 * Fiscal Quarters (1-based month ranges):
 *   Q1 → Shrawan(4),  Bhadra(5),   Ashwin(6)
 *   Q2 → Kartik(7),   Mangsir(8),  Poush(9)
 *   Q3 → Magh(10),    Falgun(11),  Chaitra(12)
 *   Q4 → Baisakh(1),  Jestha(2),   Ashadh(3)   ← crosses into next BS year
 */

import NepaliDate from "nepali-datetime";

// ─── Raw constants (0-based months — NepaliDate API) ─────────────────────────

/** Quarter → 0-based BS month indices. */
export const FISCAL_QUARTER_MONTHS = {
  1: [3, 4, 5],
  2: [6, 7, 8],
  3: [9, 10, 11],
  4: [0, 1, 2],
};

/** 12 BS months in fiscal-year order (Shrawan first), 0-based. */
export const FISCAL_YEAR_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

/** Quarter metadata (1-based months for readability / DB storage). */
export const FISCAL_QUARTERS = [
  { quarter: 1, months: [4, 5, 6],    name: "Q1", nepaliMonths: ["Shrawan",  "Bhadra",  "Ashwin"]  },
  { quarter: 2, months: [7, 8, 9],    name: "Q2", nepaliMonths: ["Kartik",   "Mangsir", "Poush"]   },
  { quarter: 3, months: [10, 11, 12], name: "Q3", nepaliMonths: ["Magh",     "Falgun",  "Chaitra"] },
  { quarter: 4, months: [1, 2, 3],    name: "Q4", nepaliMonths: ["Baisakh",  "Jestha",  "Ashadh"]  },
];

// ─── 1-based helpers (match nepaliMonth DB field) ─────────────────────────────

/**
 * Returns 1-based nepaliMonth numbers for a given fiscal quarter.
 * @param {1|2|3|4} quarter
 * @returns {number[]}  e.g. getFiscalQuarterMonths(1) → [4, 5, 6]
 */
export function getFiscalQuarterMonths(quarter) {
  const q = Number(quarter);
  if (q < 1 || q > 4) throw new RangeError(`quarter must be 1–4, got ${quarter}`);
  return FISCAL_QUARTER_MONTHS[q].map((m0) => m0 + 1);
}

/**
 * Returns the fiscal quarter (1–4) containing the given 1-based nepaliMonth.
 * @param {number} month1Based  1–12
 * @returns {1|2|3|4}
 */
export function getFiscalQuarterFromMonth(month1Based) {
  const m = Number(month1Based);
  if (m < 1 || m > 12) throw new RangeError(`month must be 1–12, got ${month1Based}`);
  const m0 = m - 1;
  for (const [q, months] of Object.entries(FISCAL_QUARTER_MONTHS)) {
    if (months.includes(m0)) return Number(q);
  }
  /* istanbul ignore next */
  throw new Error(`Unreachable: month ${m} not in FISCAL_QUARTER_MONTHS`);
}

// ─── BS → Gregorian date range helpers ───────────────────────────────────────

/**
 * Calendar BS year for a 0-based BS month within a fiscal year.
 * Q4 months (0,1,2 = Baisakh,Jestha,Ashadh) fall in fiscalYear+1.
 */
function calendarYearForMonth0(month0, fiscalYear) {
  return month0 <= 2 ? fiscalYear + 1 : fiscalYear;
}

/**
 * Gregorian ISO date strings for the first and last day of a BS month.
 * @param {number} year   BS calendar year
 * @param {number} month0 0-based BS month
 * @returns {{ startDate: string, endDate: string }}
 */
export function bsMonthToDateRange(year, month0) {
  const firstNp = new NepaliDate(year, month0, 1);
  const lastDay  = NepaliDate.getDaysOfMonth(year, month0);
  const lastNp   = new NepaliDate(year, month0, lastDay);
  const toISO    = (nd) => nd.getDateObject().toISOString().split("T")[0];
  return { startDate: toISO(firstNp), endDate: toISO(lastNp) };
}

/**
 * { year, month0 } descriptors for every month of a fiscal quarter.
 * @param {1|2|3|4} quarter
 * @param {number}  [fiscalYear]  BS year; defaults to current year
 */
export function getFiscalQuarterMonthDescriptors(quarter, fiscalYear) {
  const fy = fiscalYear ?? new NepaliDate().getYear();
  return FISCAL_QUARTER_MONTHS[Number(quarter)].map((m0) => ({
    year: calendarYearForMonth0(m0, fy),
    month0: m0,
  }));
}

/**
 * { year, month0 } descriptors for all 12 months of a fiscal year.
 * @param {number} fiscalYear  BS year
 */
export function getFiscalYearMonthDescriptors(fiscalYear) {
  return FISCAL_YEAR_MONTH_ORDER.map((m0) => ({
    year: calendarYearForMonth0(m0, fiscalYear),
    month0: m0,
  }));
}

/**
 * Resolve a filter object to a Gregorian ISO date range.
 * Precedence: explicit startDate/endDate > month > quarter > full fiscal year.
 *
 * @param {{
 *   startDate?:  string,
 *   endDate?:    string,
 *   month?:      number|string,   1-based BS month
 *   quarter?:    number|string,   1-4
 *   fiscalYear?: number|string,   BS year
 * }} filters
 * @returns {{ resolvedStart: string|undefined, resolvedEnd: string|undefined }}
 */
export function resolveFiscalGregorianRange(filters) {
  if (filters.startDate || filters.endDate) {
    return { resolvedStart: filters.startDate, resolvedEnd: filters.endDate };
  }

  const fiscalYear =
    filters.fiscalYear != null && filters.fiscalYear !== ""
      ? Number(filters.fiscalYear)
      : undefined;

  if (filters.month) {
    const month0       = Number(filters.month) - 1;
    const fy           = fiscalYear ?? new NepaliDate().getYear();
    const calendarYear = calendarYearForMonth0(month0, fy);
    const r            = bsMonthToDateRange(calendarYear, month0);
    return { resolvedStart: r.startDate, resolvedEnd: r.endDate };
  }

  if (filters.quarter) {
    const months = getFiscalQuarterMonthDescriptors(Number(filters.quarter), fiscalYear);
    const first  = bsMonthToDateRange(months[0].year, months[0].month0);
    const last   = bsMonthToDateRange(months[months.length - 1].year, months[months.length - 1].month0);
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }

  if (fiscalYear != null && Number.isFinite(fiscalYear)) {
    const fyMonths = getFiscalYearMonthDescriptors(fiscalYear);
    const first    = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
    const last     = bsMonthToDateRange(fyMonths[fyMonths.length - 1].year, fyMonths[fyMonths.length - 1].month0);
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }

  return { resolvedStart: undefined, resolvedEnd: undefined };
}
