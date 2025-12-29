import nepaliDateConverter from "nepali-date-converter";
const NepaliDate = nepaliDateConverter.default;

/**
 * Converts Nepali BS date to English AD Date object
 * @param {string} nepaliDate - in format "YYYY-MM-DD"
 * @returns {Date} - JavaScript Date object
 */
const convertBSToAD = (nepaliDate) => {
  const [year, month, day] = nepaliDate.split("-").map(Number);
  const nepaliDateObj = new NepaliDate(year, month, day);
  return nepaliDateObj.toJsDate();
};

/**
 * Converts English AD Date object to Nepali BS string
 * @param {Date} adDate
 * @returns {string} - Nepali date in "YYYY-MM-DD"
 */
const convertADToBS = (adDate) => {
  const nepaliDateObj = new NepaliDate(adDate);
  const bsYear = nepaliDateObj.getYear();
  const bsMonth = nepaliDateObj.getMonth(); // getMonth() returns 1-12
  const bsDay = nepaliDateObj.getDate();
  return `${bsYear}-${bsMonth.toString().padStart(2, "0")}-${bsDay
    .toString()
    .padStart(2, "0")}`;
};
export { convertADToBS, convertBSToAD };
