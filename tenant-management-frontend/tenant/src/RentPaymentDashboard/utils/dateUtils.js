import NepaliDate from "nepali-datetime";
import {
  tryParseNepaliISO,
  formatNepaliDisplayNoComma,
  NEPALI_MONTH_NAMES,
} from "@/utils/nepaliDate";

/**
 * Formats Nepali due date from rent object.
 * Priority: nepaliDueDate → nepaliMonth+nepaliYear → english month/year → englishDueDate
 *
 * @param {Object} rent
 * @returns {string}
 */
export const formatNepaliDueDate = (rent) => {
  try {
    if (rent.nepaliDueDate) {
      const nepaliDateStr = rent.nepaliDueDate.split("T")[0];
      const parsed = tryParseNepaliISO(nepaliDateStr);
      if (parsed) {
        return formatNepaliDisplayNoComma(parsed);
      }
    }

    if (rent.nepaliMonth && rent.nepaliYear) {
      try {
        const nd = new NepaliDate(
          rent.nepaliYear,
          rent.nepaliMonth - 1,
          1,
        );
        return nd.format("YYYY-MMM");
      } catch {
        const name = NEPALI_MONTH_NAMES[rent.nepaliMonth - 1];
        if (name) return `${name} ${rent.nepaliYear}`;
      }
    }

    if (rent.month && rent.year) {
      const dateStr = `${rent.year}-${String(rent.month).padStart(2, "0")}-01`;
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    if (rent.englishDueDate) {
      const dateStr = rent.englishDueDate.split("T")[0];
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    return "N/A";
  } catch (error) {
    console.error("Error converting date to Nepali:", error);
    if (rent.nepaliDueDate) {
      const dateStr = rent.nepaliDueDate.split("T")[0];
      return dateStr;
    }
    if (rent.nepaliMonth && rent.nepaliYear) {
      return `${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`;
    }
    if (rent.month && rent.year) {
      return `${rent.month}/${rent.year}`;
    }
    return "N/A";
  }
};
