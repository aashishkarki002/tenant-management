import cron from "node-cron";
import { CronLog } from "./model/CronLog.js";
import handleMonthlyRents from "../modules/rents/rent.service.js";
import { checkNepaliSpecialDays } from "../utils/nepaliDateHelper.js";

export async function monthlyRentCron() {
  try {
    console.log(" Monthly rent cron started");
    const { isFirstDay } = checkNepaliSpecialDays();
    if (!isFirstDay) return;

    const result = await handleMonthlyRents();
    console.log(" Cron Result:", result);

    await CronLog.create({
      type: "MONTHLY_RENT",
      ranAt: new Date(),
      message: result.message,
      count: result.count || 0,
      success: result.success,
      error: result.error ? result.error.toString() : null,
    });

    console.log(" Cron result saved to database");
  } catch (error) {
    console.error(" Monthly Rent Cron Error:", error);

    await CronLog.create({
      type: "MONTHLY_RENT",
      ranAt: new Date(),
      message: "Cron failed",
      count: 0,
      success: false,
      error: error.toString(),
    });
  }
}

// Schedule cron job to run every 10 seconds (for testing)
// In production, change to: "0 0 1 * *" to run on the 1st day of each month at midnight
const cronJob = cron.schedule("0 0 1 * *", monthlyRentCron, {
  timezone: "Asia/Kathmandu",
  scheduled: true,
});

console.log(
  " Monthly rent cron job scheduled (runs every 10 seconds, executes only on first day of Nepali month)"
);
