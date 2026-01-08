import { checkNepaliSpecialDays } from "./utils/nepaliDateHelper.js";

const { isFirstDay, isReminderDay, isLastDay } = checkNepaliSpecialDays();
console.log(isFirstDay, isReminderDay, isLastDay);
