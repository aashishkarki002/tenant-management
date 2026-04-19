/**
 * Nepali fiscal-year quarter definitions.
 *
 * Nepal's fiscal year runs Shrawan → Ashadh (month 4 → month 3 of next year).
 * months array uses 1-based Nepali month numbers matching the DB field nepaliMonth.
 */
export const NEPALI_QUARTERS = [
  { label: "Q1 (Shrawan–Ashwin)", short: "Q1", months: [4, 5, 6] },
  { label: "Q2 (Kartik–Poush)", short: "Q2", months: [7, 8, 9] },
  { label: "Q3 (Magh–Chaitra)", short: "Q3", months: [10, 11, 12] },
  { label: "Q4 (Baisakh–Ashadh)", short: "Q4", months: [1, 2, 3] },
];

/** Returns 0-based quarter index for a given 1-based nepaliMonth, or 0 as fallback. */
export const getQuarterForMonth = (nepaliMonth) => {
  const idx = NEPALI_QUARTERS.findIndex((q) => q.months.includes(nepaliMonth));
  return idx === -1 ? 0 : idx;
};

/** Returns { start, end } — 1-based nepaliMonth numbers for the quarter boundaries. */
export const getQuarterMonthRange = (quarterIdx) => ({
  start: NEPALI_QUARTERS[quarterIdx].months[0],
  end: NEPALI_QUARTERS[quarterIdx].months[2],
});
