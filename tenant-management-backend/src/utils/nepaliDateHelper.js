// utils/nepaliDateUtils.js
import NepaliDate from "nepali-datetime";

/**
 * @param {number} [year] - Nepali year (optional, defaults to current year)
 * @param {number} [month] - 0-based Nepali month (optional, defaults to current month)
 * @returns {{ firstDay: NepaliDate, reminderDay: NepaliDate, lastDay: NepaliDate }}
 */
function getNepaliMonthDates(year, month) {
  const now = new NepaliDate();
  const npYear = year !== undefined ? year : now.getYear();
  const npMonth0 = month !== undefined ? month : now.getMonth(); // 0-based for nepali date according to nepali calendar api
  const npMonth = npMonth0 + 1; // 1-based for mongoose database

  const lastDayNumber = NepaliDate.getDaysOfMonth(npYear, npMonth);
  const reminderDayNumber = lastDayNumber - 7;
  const englishMonth = now.getMonth() + 1;
  const englishYear = now.getEnglishYear();
  const firstDay = new NepaliDate(npYear, npMonth0, 1);
  const lastDay = new NepaliDate(npYear, npMonth0, lastDayNumber);
  const reminderDay = new NepaliDate(npYear, npMonth0, reminderDayNumber);

  return {
    nepaliDate: now.toString(),
    npYear,
    npMonth,
    englishDate: now.formatEnglishDate("YYYY-MM-DD"),
    englishMonth,
    englishYear,
    firstDay,
    reminderDay,
    lastDay,
    firstDayEnglish: firstDay.formatEnglishDate("YYYY-MM-DD"),
    reminderDayEnglish: reminderDay.formatEnglishDate("YYYY-MM-DD"),
    lastDayEnglish: lastDay.formatEnglishDate("YYYY-MM-DD"),
    englishDueDate: lastDay.formatEnglishDate("YYYY-MM-DD"),
  };
}

export { getNepaliMonthDates };
