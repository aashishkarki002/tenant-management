// utils/ nepaliDateHelper.js
import NepaliDate from "nepali-datetime";

/**
 * Add N Nepali calendar days to a NepaliDate.
 * @param {NepaliDate} npDate - NepaliDate to add days to
 * @param {number} days - Number of Nepali days to add
 * @returns {NepaliDate} New NepaliDate
 */
function addNepaliDays(npDate, days) {
  const d = new NepaliDate(npDate);
  let year = d.getYear();
  let month = d.getMonth();
  let day = d.getDate();
  for (let i = 0; i < days; i++) {
    const maxDay = NepaliDate.getDaysOfMonth(year, month);
    day += 1;
    if (day > maxDay) {
      day = 1;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  }
  return new NepaliDate(year, month, day);
}

/**
 * @param {number} [year] - Nepali year (optional, defaults to current year)
 * @param {number} [month] - 0-based Nepali month (optional, defaults to current month)
 * @returns {{ firstDay: NepaliDate, reminderDay: NepaliDate, lastDay: NepaliDate, nepaliToday: NepaliDate, firstDayDate: Date, lastDayEndDate: Date, nepaliTodayDate: Date }}
 */
function getNepaliMonthDates(year, month) {
  const now = new NepaliDate();
  const npYear = year !== undefined ? year : now.getYear();
  const npMonth0 = month !== undefined ? month : now.getMonth(); // 0-based for nepali calendar api
  const npMonth = npMonth0 + 1; // 1-based for mongoose database

  const lastDayNumber = NepaliDate.getDaysOfMonth(npYear, npMonth0);
  const reminderDayNumber = lastDayNumber - 7;
  const englishMonth = now.getEnglishMonth() + 1;
  const englishYear = now.getEnglishYear();
  const firstDay = new NepaliDate(npYear, npMonth0, 1);
  const lastDay = new NepaliDate(npYear, npMonth0, lastDayNumber);
  const reminderDay = new NepaliDate(npYear, npMonth0, reminderDayNumber);

  // Start of current Nepali day (for "today" in Nepali terms)
  const nepaliToday = new NepaliDate(now.getYear(), now.getMonth(), now.getDate());
  const nepaliTodayDate = nepaliToday.getDateObject();

  // English Date range for current Nepali month (MongoDB Date queries)
  const firstDayDate = firstDay.getDateObject();
  const lastDayEndDate = addNepaliDays(lastDay, 1).getDateObject(); // exclusive end ($lt)

  return {
    nepaliDate: now.toString(),
    nepaliToday,
    nepaliTodayDate,
    npYear,
    npMonth,
    englishDate: now.formatEnglishDate("YYYY-MM-DD"),
    englishMonth,
    englishYear,
    firstDay,
    reminderDay,
    lastDay,
    firstDayDate,
    lastDayEndDate,
    firstDayEnglish: firstDay.formatEnglishDate("YYYY-MM-DD"),
    reminderDayEnglish: reminderDay.formatEnglishDate("YYYY-MM-DD"),
    lastDayEnglish: lastDay.formatEnglishDate("YYYY-MM-DD"),
    englishDueDate: lastDay.formatEnglishDate("YYYY-MM-DD"),
  };
}
/**
 * Check if today is first, reminder, or last day of Nepali month
 * @returns {{ isFirstDay: boolean, isReminderDay: boolean, isLastDay: boolean }}
 */
function checkNepaliSpecialDays({ forceTest = false } = {}) {
  if (forceTest) {
    return {
      isFirstDay: true,
      isReminderDay: true,
      isLastDay: true,
    };
  }

  const now = new NepaliDate();
  const { firstDay, reminderDay, lastDay } = getNepaliMonthDates();

  const isSameDay = (date1, date2) =>
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getYear() === date2.getYear();

  return {
    isFirstDay: isSameDay(now, firstDay),
    isReminderDay: isSameDay(now, reminderDay),
    isLastDay: isSameDay(now, lastDay),
  };
}


export { getNepaliMonthDates, checkNepaliSpecialDays, addNepaliDays };
