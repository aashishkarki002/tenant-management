import cron from "node-cron";
import mongoose from "mongoose";
import { getNepaliMonthDates } from "../utils/nepaliDateHelper.js";
import { Rent } from "../modules/rents/rent.Model.js";
import dotenv from "dotenv";
import Notification from "../modules/notifications/notification.model.js";
import NepaliDate from "nepali-datetime";
dotenv.config();
const ADMIN_ID = process.env.SYSTEM_ADMIN_ID;
let isRunning = false;

export const startOverDueRentCron = (io) => {
  if (isRunning) return;
  isRunning = true;

  cron.schedule(
    "0 0 1 * * *",
    async () => {
      console.log("rent overdue cron started");

      const { npMonth, npYear, firstDay } = getNepaliMonthDates();
      const today = new NepaliDate();

      const todayStr = today.format("YYYY-MM-DD");
      const firstDayStr = firstDay.format("YYYY-MM-DD");

      if (todayStr < firstDayStr) {
        console.log("Today is before the first day of the month");
        return;
      }

      let previousMonth = npMonth - 1;
      let yearForPreviousMonth = npYear;
      if (previousMonth < 1) {
        previousMonth = 12;
        yearForPreviousMonth = npYear - 1;
      }

      console.log(
        ` Processing overdue rents for ${yearForPreviousMonth}-${previousMonth}`
      );

      const overdueRents = await Rent.find({
        nepaliMonth: previousMonth,
        nepaliYear: yearForPreviousMonth,
        status: { $in: ["pending", "partially_paid"] },
      })
        .populate("tenant", "name")
        .select("tenant rentAmount paidAmount");

      if (!overdueRents.length) {
        console.log("no overdue rents found");
        return;
      }

      await Rent.updateMany(
        {
          nepaliMonth: previousMonth,
          nepaliYear: yearForPreviousMonth,
          status: { $in: ["pending", "partially_paid"] },
        },
        { $set: { status: "overdue" } }
      );

      for (const rent of overdueRents) {
        const remaining = rent.rentAmount - (rent.paidAmount || 0);
        if (remaining > 0) {
          const notification = await Notification.create({
            admin: ADMIN_ID,
            type: "RENT_OVERDUE",
            title: `Rent Overdue for ${rent.tenant.name}`,
            message: `Rent for ${rent.tenant.name} is overdue for ${previousMonth}/${yearForPreviousMonth}`,
            data: {
              rentId: rent._id,
              nepaliMonth: previousMonth,
              nepaliYear: yearForPreviousMonth,
              amount: remaining,
            },
          });
          io.to(`admin:${ADMIN_ID}`).emit("rent:overdue", {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            createdAt: notification.createdAt,
          });
        }
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kathmandu",
    }
  );
};

export default startOverDueRentCron;
