import cron from "node-cron";
import { getNepaliMonthDates } from "../utils/nepaliDateHelper.js";
import { Rent } from "../modules/rents/rent.Model.js";
import { sendEmail } from "../config/nodemailer.js";
import NepaliDate from "nepali-datetime";
let isRunning = false;
export const startSendEmailCron = async () => {
  cron.schedule(
    "0 0 1 * *",
    async () => {
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

        // // Check if today matches the reminder day
        if (
          todayYear !== reminderYear ||
          todayMonth !== reminderMonth ||
          todayDay !== reminderDayNumber
        ) {
          console.log("Not the reminder day, skipping email sending");
          isRunning = false;
          return;
        }

        console.log(
          "Today is the reminder day! Sending rent reminder emails..."
        );

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
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <title>Rent Payment Reminder</title>
          </head>
          <body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:6px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background:#1f2937; padding:24px; text-align:center;">
                        <h1 style="margin:0; font-size:22px; color:#ffffff; letter-spacing:0.5px;">
                          Rent Payment Reminder
                        </h1>
                      </td>
                    </tr>
          
                    <!-- Body -->
                    <tr>
                      <td style="padding:32px; color:#374151; font-size:14px; line-height:1.6;">
                        <p style="margin-top:0;">Dear <strong>${
                          rent.tenant.name
                        }</strong>,</p>
          
                        <p>
                          This is a formal reminder regarding your rent payment for the period of 
                          <strong>${npMonth}/${npYear}</strong>, which is currently outstanding.
                        </p>
          
                        <!-- Details Table -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0; border-collapse:collapse;">
                          <tr>
                            <td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Rent Amount</td>
                            <td style="padding:10px; border:1px solid #e5e7eb;">Rs. ${
                              rent.rentAmount
                            }</td>
                          </tr>
                          <tr>
                            <td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Paid Amount</td>
                            <td style="padding:10px; border:1px solid #e5e7eb;">Rs. ${
                              rent.paidAmount
                            }</td>
                          </tr>
                          <tr>
                            <td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Remaining Amount</td>
                            <td style="padding:10px; border:1px solid #e5e7eb; color:#b91c1c; font-weight:600;">
                              Rs. ${remainingAmount}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Payment Status</td>
                            <td style="padding:10px; border:1px solid #e5e7eb; text-transform:capitalize;">
                              ${rent.status.replace("_", " ")}
                            </td>
                          </tr>
                        </table>
          
                        <p>
                          Kindly ensure that the outstanding amount is settled at your earliest convenience 
                          to avoid any late fees or service interruptions.
                        </p>
          
                        <p style="margin-bottom:0;">
                          Should you have already made the payment, please disregard this notice.
                        </p>
                      </td>
                    </tr>
          
                    <!-- Footer -->
                    <tr>
                      <td style="background:#f9fafb; padding:20px; text-align:center; font-size:12px; color:#6b7280;">
                        <p style="margin:4px 0;">This is an automated message. Please do not reply.</p>
                        <p style="margin:4px 0;">© ${new Date().getFullYear()} Property Management System</p>
                      </td>
                    </tr>
          
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
          `;

            await sendEmail({
              to: rent.tenant.email,
              subject: `Rent Payment Reminder - ${npMonth}/${npYear}`,
              html: emailHtml,
            });
            await Rent.updateOne(
              { _id: rent._id },
              { $set: { emailReminderSent: true } }
            );
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
    },
    {
      scheduled: true,
      timezone: "Asia/Kathmandu",
    }
  );

  console.log("Email reminder cron job scheduled (runs daily at midnight)");
};
