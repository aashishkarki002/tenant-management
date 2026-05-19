/**
 * Nepal TDS quarterly calendar helpers.
 *
 * Nepal fiscal year runs Shrawan (month 4) → Ashadh (month 3).
 * IRD requires TDS remittance quarterly within 25 days of quarter end.
 *
 * Quarter mapping (fiscal year basis):
 *   Q1 → months 4, 5, 6  (Shrawan, Bhadra, Ashwin)
 *   Q2 → months 7, 8, 9  (Kartik, Mangsir, Poush)
 *   Q3 → months 10, 11, 12 (Magh, Falgun, Chaitra)
 *   Q4 → months 1, 2, 3  of (fiscalYear + 1) (Baisakh, Jestha, Ashadh)
 */

/**
 * Returns the fiscal year that a given BS month/year belongs to.
 * Months 1-3 (Baisakh–Ashadh) are Q4 of the previous fiscal year.
 */
export function getFiscalYearForMonth(nepaliYear, nepaliMonth) {
  return nepaliMonth >= 4 ? nepaliYear : nepaliYear - 1;
}

/**
 * Returns quarter (1-4) for a given BS month.
 */
export function getQuarterForMonth(nepaliMonth) {
  if (nepaliMonth >= 4 && nepaliMonth <= 6) return 1;
  if (nepaliMonth >= 7 && nepaliMonth <= 9) return 2;
  if (nepaliMonth >= 10 && nepaliMonth <= 12) return 3;
  return 4; // months 1, 2, 3
}

/**
 * Returns the 3 {nepaliYear, nepaliMonth} pairs for a given fiscal year + quarter.
 */
export function getMonthsForQuarter(fiscalYear, quarter) {
  const map = {
    1: [
      { nepaliYear: fiscalYear, nepaliMonth: 4 },
      { nepaliYear: fiscalYear, nepaliMonth: 5 },
      { nepaliYear: fiscalYear, nepaliMonth: 6 },
    ],
    2: [
      { nepaliYear: fiscalYear, nepaliMonth: 7 },
      { nepaliYear: fiscalYear, nepaliMonth: 8 },
      { nepaliYear: fiscalYear, nepaliMonth: 9 },
    ],
    3: [
      { nepaliYear: fiscalYear, nepaliMonth: 10 },
      { nepaliYear: fiscalYear, nepaliMonth: 11 },
      { nepaliYear: fiscalYear, nepaliMonth: 12 },
    ],
    4: [
      { nepaliYear: fiscalYear + 1, nepaliMonth: 1 },
      { nepaliYear: fiscalYear + 1, nepaliMonth: 2 },
      { nepaliYear: fiscalYear + 1, nepaliMonth: 3 },
    ],
  };
  return map[quarter];
}

/**
 * Returns a human-readable quarter label, e.g. "FY2081 Q1 (Shrawan–Ashwin)".
 */
export function getQuarterLabel(fiscalYear, quarter) {
  const labels = {
    1: "Shrawan–Ashwin",
    2: "Kartik–Poush",
    3: "Magh–Chaitra",
    4: "Baisakh–Ashadh",
  };
  return `FY${fiscalYear} Q${quarter} (${labels[quarter]})`;
}
