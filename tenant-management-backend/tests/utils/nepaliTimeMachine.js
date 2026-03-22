/**
 * Time-travel utility for testing Nepali date-dependent logic
 * 
 * Freezes time to a specific Nepali date by mocking Date.now()
 * Used in cron and rent lifecycle tests
 */
import NepaliDate from 'nepali-datetime';

/**
 * Freeze time to a specific Nepali date for the duration of a test.
 * 
 * @param {number} bsYear  - e.g. 2081
 * @param {number} bsMonth - 1-based e.g. 1 = Baisakh
 * @param {number} bsDay   - 1-based e.g. 1
 * @returns {Function} cleanup function — call in finally/afterEach
 * 
 * @example
 * test('masterCron runs rent creation on BS day 1', async () => {
 *   const restore = freezeToNepaliDate(2081, 5, 1); // Shrawan 1, 2081
 *   try {
 *     await masterCron({ forceRun: false });
 *     const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 5 });
 *     expect(rents.length).toBeGreaterThan(0);
 *   } finally {
 *     restore();
 *   }
 * });
 */
export function freezeToNepaliDate(bsYear, bsMonth, bsDay) {
  // Create Nepali date (0-based month for NepaliDate API)
  const np = new NepaliDate(bsYear, bsMonth - 1, bsDay);
  
  // Convert to English Date
  const englishDate = np.getDateObject();
  
  // Subtract NPT offset so getNepaliToday() reconstructs the right NPT date
  // NPT = UTC+5:45 = (5*60 + 45)*60*1000 = 20,700,000 ms
  const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
  const fakeUTC = englishDate.getTime() - NPT_OFFSET_MS;
  
  // Mock Date.now() to return our frozen time (ESM-compatible)
  const originalNow = Date.now;
  Date.now = () => fakeUTC;
  
  // Return cleanup function
  return () => {
    Date.now = originalNow;
  };
}

/**
 * Freeze to a specific English date (useful for known conversions)
 * 
 * @param {string} isoDate - ISO date string like "2024-04-13"
 * @returns {Function} cleanup function
 */
export function freezeToEnglishDate(isoDate) {
  const date = new Date(isoDate);
  const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
  const fakeUTC = date.getTime() - NPT_OFFSET_MS;
  
  const originalNow = Date.now;
  Date.now = () => fakeUTC;
  
  return () => {
    Date.now = originalNow;
  };
}

/**
 * Advance frozen time by N days
 * Must be called after freezeToNepaliDate or freezeToEnglishDate
 * 
 * @param {number} days - Number of days to advance (can be negative)
 */
export function advanceTimeByDays(days) {
  const currentFakeTime = Date.now();
  const newFakeTime = currentFakeTime + (days * 24 * 60 * 60 * 1000);
  const originalNow = Date.now;
  Date.now = () => newFakeTime;
}
