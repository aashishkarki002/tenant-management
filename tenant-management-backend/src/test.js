import NepaliDate from "nepali-datetime";
import { getNepaliMonthDates } from "./utils/nepaliDateHelper.js";

const today = new NepaliDate(); // current Nepali date
const { firstDay } = getNepaliMonthDates(); // first day of current month

if (
  today.getYear() === firstDay.getYear() &&
  today.getMonth() === firstDay.getMonth() &&
  today.getDate() === firstDay.getDate()
) {
  console.log(
    "✅ Today is the first day of the Nepali month. Proceed with rent creation."
  );
} else {
  console.log("❌ Not the first day of the month, skipping rent creation.");
}
