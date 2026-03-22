/**
 * Unit tests for nepaliDateHelper utilities
 * Tests date arithmetic, formatting, and calendar-specific logic
 */
import {
  diffNepaliDays,
  addNepaliDays,
  addNepaliMonths,
  getNepaliToday,
  formatNepaliISO,
  parseNepaliISO,
  getNepaliMonthDates,
} from '../../src/utils/nepaliDateHelper.js';
import NepaliDate from 'nepali-datetime';
import goldenDates from '../fixtures/golden-bs-dates.json' assert { type: 'json' };

describe('nepaliDateHelper - Pure Function Tests', () => {
  
  describe('diffNepaliDays', () => {
    test('returns correct count within same month', () => {
      const d1 = new NepaliDate(2081, 0, 5);  // Baisakh 5
      const d2 = new NepaliDate(2081, 0, 10); // Baisakh 10
      expect(diffNepaliDays(d1, d2)).toBe(5);
    });

    test('returns correct count across month boundary', () => {
      const d1 = new NepaliDate(2081, 0, 28); // Baisakh 28
      const d2 = new NepaliDate(2081, 1, 3);  // Jestha 3
      // Baisakh 2081 has 31 days → gap is (31-28) + 3 = 6 days
      expect(diffNepaliDays(d1, d2)).toBe(6);
    });

    test('returns negative for past dates', () => {
      const d1 = new NepaliDate(2081, 0, 10);
      const d2 = new NepaliDate(2081, 0, 5);
      expect(diffNepaliDays(d1, d2)).toBe(-5);
    });

    test('returns 0 for same date', () => {
      const d1 = new NepaliDate(2081, 0, 15);
      const d2 = new NepaliDate(2081, 0, 15);
      expect(diffNepaliDays(d1, d2)).toBe(0);
    });

    test('handles year boundary', () => {
      const d1 = new NepaliDate(2080, 11, 30); // Chaitra 30 (last day of year)
      const d2 = new NepaliDate(2081, 0, 5);   // Baisakh 5 (next year)
      expect(diffNepaliDays(d1, d2)).toBe(5);
    });

    test('handles long date ranges', () => {
      const d1 = new NepaliDate(2081, 0, 1);
      const d2 = new NepaliDate(2081, 11, 30); // End of year
      // Should be approximately 365 days
      const diff = diffNepaliDays(d1, d2);
      expect(diff).toBeGreaterThan(360);
      expect(diff).toBeLessThan(370);
    });
  });

  describe('addNepaliDays', () => {
    test('adds days within same month', () => {
      const d = new NepaliDate(2081, 0, 10); // Baisakh 10
      const result = addNepaliDays(d, 5);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getYear()).toBe(2081);
    });

    test('adds days across month boundary', () => {
      const d = new NepaliDate(2081, 0, 29); // Baisakh 29
      const result = addNepaliDays(d, 5);
      // Baisakh has 31 days, so 29 + 5 = day 34 → Jestha 3
      expect(result.getDate()).toBe(3);
      expect(result.getMonth()).toBe(1); // Jestha
    });

    test('subtracts days (negative)', () => {
      const d = new NepaliDate(2081, 0, 10);
      const result = addNepaliDays(d, -5);
      expect(result.getDate()).toBe(5);
      expect(result.getMonth()).toBe(0);
    });

    test('adds 0 days returns same date', () => {
      const d = new NepaliDate(2081, 5, 15);
      const result = addNepaliDays(d, 0);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(5);
      expect(result.getYear()).toBe(2081);
    });

    test('handles year boundary', () => {
      const d = new NepaliDate(2080, 11, 29); // Chaitra 29
      const result = addNepaliDays(d, 5);
      expect(result.getYear()).toBe(2081);
      expect(result.getMonth()).toBe(0); // Baisakh
    });
  });

  describe('addNepaliMonths', () => {
    test('adds months within same year', () => {
      const d = new NepaliDate(2081, 0, 15); // Baisakh 15
      const result = addNepaliMonths(d, 3);
      expect(result.getMonth()).toBe(3); // Shrawan
      expect(result.getYear()).toBe(2081);
      expect(result.getDate()).toBe(15);
    });

    test('adds months across year boundary', () => {
      const d = new NepaliDate(2080, 10, 15); // Falgun 15
      const result = addNepaliMonths(d, 3);
      expect(result.getYear()).toBe(2081);
      expect(result.getMonth()).toBe(1); // Jestha
    });

    test('clamps day at month end', () => {
      const d = new NepaliDate(2080, 11, 30); // Chaitra 30
      const result = addNepaliMonths(d, 1);
      // Baisakh 2081 has 31 days, so day 30 is valid
      expect(result.getMonth()).toBe(0); // Baisakh
      expect(result.getYear()).toBe(2081);
      expect(result.getDate()).toBe(30);
    });

    test('clamps day when target month is shorter', () => {
      // Find a month with 31 days and add to reach a month with fewer days
      const d = new NepaliDate(2081, 0, 31); // Baisakh 31 (last day)
      const result = addNepaliMonths(d, 6);
      // Month 6 (Kartik) may have 29-30 days — day should be clamped
      const maxDay = NepaliDate.getDaysOfMonth(2081, 6);
      expect(result.getDate()).toBeLessThanOrEqual(maxDay);
    });

    test('subtracts months (negative)', () => {
      const d = new NepaliDate(2081, 5, 15); // Ashwin 15
      const result = addNepaliMonths(d, -3);
      expect(result.getMonth()).toBe(2); // Ashadh
      expect(result.getYear()).toBe(2081);
    });

    test('adds 0 months returns same date', () => {
      const d = new NepaliDate(2081, 4, 20);
      const result = addNepaliMonths(d, 0);
      expect(result.getMonth()).toBe(4);
      expect(result.getYear()).toBe(2081);
      expect(result.getDate()).toBe(20);
    });

    test('handles large month offsets', () => {
      const d = new NepaliDate(2081, 0, 1);
      const result = addNepaliMonths(d, 24); // 2 years
      expect(result.getYear()).toBe(2083);
      expect(result.getMonth()).toBe(0);
    });
  });

  describe('formatNepaliISO & parseNepaliISO', () => {
    test('formats NepaliDate to ISO string', () => {
      const d = new NepaliDate(2081, 0, 5); // Baisakh 5
      expect(formatNepaliISO(d)).toBe('2081-01-05');
    });

    test('formats with zero-padding for single digits', () => {
      const d = new NepaliDate(2081, 8, 3); // Poush 3 (month 9, 1-based)
      expect(formatNepaliISO(d)).toBe('2081-09-03');
    });

    test('parses ISO string back to NepaliDate', () => {
      const np = parseNepaliISO('2081-05-15');
      expect(np.getYear()).toBe(2081);
      expect(np.getMonth()).toBe(4); // 0-based
      expect(np.getDate()).toBe(15);
    });

    test('round-trip: format then parse', () => {
      const original = new NepaliDate(2081, 7, 22);
      const formatted = formatNepaliISO(original);
      const parsed = parseNepaliISO(formatted);
      
      expect(parsed.getYear()).toBe(original.getYear());
      expect(parsed.getMonth()).toBe(original.getMonth());
      expect(parsed.getDate()).toBe(original.getDate());
    });

    test('throws on invalid ISO format', () => {
      expect(() => parseNepaliISO('2081/01/05')).toThrow();
      expect(() => parseNepaliISO('81-1-5')).toThrow();
      expect(() => parseNepaliISO('invalid')).toThrow();
    });

    test('throws on invalid date components', () => {
      expect(() => parseNepaliISO('2081-13-01')).toThrow(); // month 13
      expect(() => parseNepaliISO('2081-01-35')).toThrow(); // day 35
    });
  });

  describe('getNepaliToday with mocked time', () => {
    test('returns correct BS date for known English date', () => {
      // 2024-04-13 UTC → 2081-01-01 BS (Baisakh 1)
      const knownUTC = new Date('2024-04-13T00:00:00Z').getTime();
      const originalNow = Date.now;
      Date.now = () => knownUTC;
      
      try {
        const { bsYear, bsMonth, bsDay } = getNepaliToday();
        expect(bsYear).toBe(2081);
        expect(bsMonth).toBe(1); // 1-based
      } finally {
        Date.now = originalNow;
      }
    });

    test('englishToday is UTC midnight', () => {
      const knownUTC = new Date('2024-04-13T10:30:00Z').getTime();
      const originalNow = Date.now;
      Date.now = () => knownUTC;
      
      try {
        const { englishToday } = getNepaliToday();
        expect(englishToday.getUTCHours()).toBe(0);
        expect(englishToday.getUTCMinutes()).toBe(0);
        expect(englishToday.getUTCSeconds()).toBe(0);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('getNepaliMonthDates', () => {
    test('returns comprehensive month info for current month', () => {
      const info = getNepaliMonthDates();
      
      expect(info.npYear).toBeGreaterThan(2070);
      expect(info.npMonth).toBeGreaterThanOrEqual(1);
      expect(info.npMonth).toBeLessThanOrEqual(12);
      expect(info.firstDay).toBeInstanceOf(NepaliDate);
      expect(info.lastDay).toBeInstanceOf(NepaliDate);
      expect(info.reminderDay).toBeInstanceOf(NepaliDate);
      expect(info.nepaliToday).toBeInstanceOf(NepaliDate);
    });

    test('firstDay is always day 1', () => {
      const info = getNepaliMonthDates(2081, 3); // 0-based month
      expect(info.firstDay.getDate()).toBe(1);
    });

    test('reminderDay is 7 days before last day', () => {
      const info = getNepaliMonthDates(2081, 0); // Baisakh
      const lastDayNum = info.lastDay.getDate();
      const reminderDayNum = info.reminderDay.getDate();
      expect(lastDayNum - reminderDayNum).toBe(7);
    });

    test('handles months with different day counts', () => {
      // Baisakh 2081 has 31 days
      const baisakh = getNepaliMonthDates(2081, 0);
      expect(baisakh.lastDay.getDate()).toBe(31);
      
      // Chaitra typically has 30 days
      const chaitra = getNepaliMonthDates(2081, 11);
      expect(chaitra.lastDay.getDate()).toBeLessThanOrEqual(32);
    });
  });

  describe('Golden reference dataset validation', () => {
    test.each(goldenDates)(
      '$english → BS $bs_year-$bs_month-$bs_day ($month_name)',
      ({ english, bs_year, bs_month, bs_day, month_name }) => {
        const np = new NepaliDate(new Date(english));
        
        expect(np.getYear()).toBe(bs_year);
        expect(np.getMonth() + 1).toBe(bs_month); // +1 because getMonth() is 0-based
        expect(np.getDate()).toBe(bs_day);
      }
    );
  });

  describe('Month-shape matrix testing', () => {
    // BS 2081 month lengths (from nepali-datetime library)
    const BS_2081_MONTH_DAYS = [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31];
    //                          Bai Jes Ash Shr Bha Ash Kar Man Pou Mag Fal Cha

    BS_2081_MONTH_DAYS.forEach((expectedDays, monthIndex) => {
      test(`BS 2081 month ${monthIndex + 1} has ${expectedDays} days`, () => {
        const actualDays = NepaliDate.getDaysOfMonth(2081, monthIndex);
        expect(actualDays).toBe(expectedDays);
      });

      test(`BS 2081 month ${monthIndex + 1} last day never overflows`, () => {
        const lastDay = new NepaliDate(2081, monthIndex, expectedDays);
        const eng = lastDay.getDateObject();
        eng.setDate(eng.getDate() + 1);
        const nextNp = new NepaliDate(eng);
        
        // Next day should be in next month (or next year if Chaitra)
        const expectedNextMonth = (monthIndex + 1) % 12;
        expect(nextNp.getMonth()).toBe(expectedNextMonth);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    test('throws on invalid NepaliDate instance for diffNepaliDays', () => {
      expect(() => diffNepaliDays({}, new NepaliDate())).toThrow();
      expect(() => diffNepaliDays(new NepaliDate(), null)).toThrow();
    });

    test('throws on non-integer inputs for addNepaliDays', () => {
      const d = new NepaliDate(2081, 0, 15);
      expect(() => addNepaliDays(d, 3.5)).toThrow();
      expect(() => addNepaliDays(d, "5")).toThrow();
    });

    test('throws on non-integer inputs for addNepaliMonths', () => {
      const d = new NepaliDate(2081, 0, 15);
      expect(() => addNepaliMonths(d, 2.5)).toThrow();
      expect(() => addNepaliMonths(d, "3")).toThrow();
    });

    test('handles extreme date differences', () => {
      const d1 = new NepaliDate(2070, 0, 1);
      const d2 = new NepaliDate(2090, 11, 30);
      const diff = diffNepaliDays(d1, d2);
      // ~20 years ≈ 7300 days
      expect(diff).toBeGreaterThan(7000);
      expect(diff).toBeLessThan(8000);
    });
  });
});
