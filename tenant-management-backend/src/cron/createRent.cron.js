import cron from "node-cron";
import { Rent } from "../modules/rents/rent.Model.js";
import { Tenant } from "../modules/tenant/Tenant.Model.js";
import { getNepaliMonthDates } from "../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";
import dotenv from "dotenv";
dotenv.config();
const admin = process.env.SYSTEM_ADMIN_ID;
let isRunning = false;
export const startCreateRentCron = async () => {
  cron.schedule(
    "0 0 1 * *",
    async () => {
      const {
        firstDay,
        reminderDay,
        lastDay,
        npMonth,
        npYear,
        nepaliDate,
        englishDate,
        englishMonth,
        englishYear,
        firstDayEnglish,
        reminderDayEnglish,
        englishDueDate,
        lastDayEnglish,
      } = getNepaliMonthDates();
      if (isRunning) return;
      isRunning = true;
      try {
        const todayNepaliDay = new NepaliDate().getDate();

        if (todayNepaliDay !== firstDay) {
          console.log("Not the first day of the month, skipping rent creation");
          isRunning = false;
          return;
        }

        const tenants = await Tenant.find({ isDeleted: false, isActive: true });
        if (!tenants || tenants.length === 0) {
          console.log("No active tenants found");
          isRunning = false;
          return;
        }

        const createdRents = [];
        const errors = [];
        for (const tenant of tenants) {
          try {
            // Check if rent already exists for this tenant and month

            const existingRents = await Rent.find({
              tenant: tenant._id,
              nepaliMonth: npMonth,
              nepaliYear: npYear,
            })
              .select("tenant")
              .lean();
            console.log("existingRents for tenant", tenant._id, existingRents);
            if (existingRents.length > 0) {
              console.log(`Rent already exists for tenant ${tenant._id}`);
              continue;
            }

            const newRent = await Rent.create({
              tenant: tenant._id,
              innerBlock: tenant.innerBlock,
              block: tenant.block,
              property: tenant.property,
              nepaliMonth: npMonth,
              nepaliYear: npYear,
              rentAmount: tenant.totalRent,
              createdBy: admin,
              units: tenant.units,
              englishMonth: englishMonth,
              englishYear: englishYear,
              nepaliDate: nepaliDate,
              nepaliDueDate: lastDay,
              englishDueDate: new Date(englishDueDate),
              lastPaidDate: null,
              lastPaidBy: null,
              lateFee: 0,
              lateFeeDate: null,
              lateFeeApplied: false,
              lateFeeStatus: "pending",
            });
            console.log("newRent", newRent);
            createdRents.push(newRent);
            console.log("createdRents", createdRents);
          } catch (error) {
            console.error(
              `Error creating rent for tenant ${tenant._id}:`,
              error
            );
            errors.push({
              tenantId: tenant._id,
              error: error.message,
            });
          }
        }
      } catch (error) {
        console.error("Rent creation cron error:", error);
      } finally {
        isRunning = false;
      }
    },
    { scheduled: true, timezone: "Asia/Kathmandu" }
  );
};
