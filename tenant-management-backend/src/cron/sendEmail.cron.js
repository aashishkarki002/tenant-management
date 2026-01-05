import cron from "node-cron";
import { getNepaliMonthDates } from "../utils/nepaliDateHelper.js";
import { Rent } from "../modules/rents/rent.Model.js";
import { Tenant } from "../modules/tenant/Tenant.Model.js";
import { sendEmail } from "../config/nodemailer.js";
import NepaliDate from "nepali-datetime";

export const startSendEmailCron = async () => {
  let isRunning = false;

  cron.schedule("0 0 1 * *", async () => {
    // Run daily at midnight
    if (isRunning) return;
    isRunning = true;

    try {
      const { reminderDay, npMonth, npYear } = getNepaliMonthDates();
      const todayNepaliDate = new NepaliDate();

      // Compare dates by year, month, and day
      const todayYear = todayNepaliDate.getYear();
      const todayMonth = todayNepaliDate.getMonth();
      const todayDay = todayNepaliDate.getDate();

      const reminderYear = reminderDay.getYear();
      const reminderMonth = reminderDay.getMonth();
      const reminderDayNumber = reminderDay.getDate();

      // Check if today matches the reminder day
      if (
        todayYear !== reminderYear ||
        todayMonth !== reminderMonth ||
        todayDay !== reminderDayNumber
      ) {
        console.log("Not the reminder day, skipping email sending");
        isRunning = false;
        return;
      }

      console.log("Today is the reminder day! Sending rent reminder emails...");

      // Find all rents for current month that are pending or partially_paid
      const pendingRents = await Rent.find({
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        status: { $in: ["pending", "partially_paid"] },
      })
        .populate("tenant", "name email")
        .lean();

      if (!pendingRents || pendingRents.length === 0) {
        console.log("No pending rents found for reminder emails");
        isRunning = false;
        return;
      }

      console.log(
        `Found ${pendingRents.length} pending rent(s) to send reminders for`
      );

      // Send emails to tenants with pending rents
      const emailResults = [];
      for (const rent of pendingRents) {
        try {
          if (!rent.tenant || !rent.tenant.email) {
            console.log(`Skipping rent ${rent._id} - no tenant email found`);
            continue;
          }

          const remainingAmount = rent.rentAmount - rent.paidAmount;
          const emailHtml = `
            <h2>Rent Payment Reminder</h2>
            <p>Dear ${rent.tenant.name},</p>
            <p>This is a reminder that your rent payment for ${npMonth}/${npYear} is pending.</p>
            <p><strong>Rent Amount:</strong> Rs. ${rent.rentAmount}</p>
            <p><strong>Paid Amount:</strong> Rs. ${rent.paidAmount}</p>
            <p><strong>Remaining Amount:</strong> Rs. ${remainingAmount}</p>
            <p><strong>Status:</strong> ${rent.status}</p>
            <p>Please make the payment at your earliest convenience.</p>
            <p>Thank you.</p>
          `;

          await sendEmail({
            to: rent.tenant.email,
            subject: `Rent Payment Reminder - ${npMonth}/${npYear}`,
            html: emailHtml,
          });

          emailResults.push({
            rentId: rent._id,
            tenantEmail: rent.tenant.email,
            success: true,
          });
          console.log(
            `Reminder email sent to ${rent.tenant.email} for rent ${rent._id}`
          );
        } catch (error) {
          console.error(
            `Error sending email to tenant ${rent.tenant?._id}:`,
            error
          );
          emailResults.push({
            rentId: rent._id,
            tenantEmail: rent.tenant?.email,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = emailResults.filter((r) => r.success).length;
      console.log(
        `Email reminder cron completed: ${successCount}/${emailResults.length} emails sent successfully`
      );
    } catch (error) {
      console.error("Error in email reminder cron:", error);
    } finally {
      isRunning = false;
    }
  });

  console.log("Email reminder cron job scheduled (runs daily at midnight)");
};
