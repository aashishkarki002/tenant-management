import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import adminModel from "../auth/admin.Model.js";
import {
  getNepaliMonthDates,
  checkNepaliSpecialDays,
} from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
import { sendEmail } from "../../config/nodemailer.js";

import Notification from "../notifications/notification.model.js";
import NepaliDate from "nepali-datetime";
import { getIO } from "../../config/socket.js";
dotenv.config();

const ADMIN_ID = process.env.SYSTEM_ADMIN_ID;

const handleMonthlyRents = async () => {
  const {
    npMonth,
    npYear,
    nepaliDate,
    englishDueDate,
    lastDay,
    englishMonth,
    englishYear,
  } = getNepaliMonthDates();

  try {
    // Step 1: Update overdue rents
    const overdueResult = await Rent.updateMany(
      {
        status: { $in: ["pending", "partially_paid"] },
        $or: [
          { nepaliYear: { $lt: npYear } },
          { nepaliYear: npYear, nepaliMonth: { $lt: npMonth } },
        ],
      },
      { $set: { status: "overdue" } }
    );
    console.log("Overdue rents updated:", overdueResult.modifiedCount);

    // Step 2: Create new monthly rents
    const tenants = await Tenant.find({ status: "active" }).lean();

    if (!tenants.length) {
      return { success: false, message: "No tenants found", count: 0 };
    }

    const existingRents = await Rent.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");

    const existingTenantIds = new Set(
      existingRents.map((r) => r.tenant.toString())
    );

    const rentsToInsert = tenants
      .filter((tenant) => !existingTenantIds.has(tenant._id.toString()))
      .map((tenant) => ({
        tenant: tenant._id,
        innerBlock: tenant.innerBlock,
        block: tenant.block,
        property: tenant.property,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate,
        rentAmount: tenant.totalRent,
        units: tenant.units,
        createdBy: ADMIN_ID,
        nepaliDueDate: lastDay,
        englishDueDate,
        paidAmount: 0,
        englishMonth,
        englishYear,
        status: "pending",
      }));

    if (rentsToInsert.length) {
      await Rent.insertMany(rentsToInsert);
      console.log("Monthly rents created:", rentsToInsert.length);
    } else {
      console.log("All rents for this month already exist");
    }

    return {
      success: true,
      message: "Rents processed successfully",
      createdCount: rentsToInsert.length,
      updatedOverdueCount: overdueResult.modifiedCount,
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Rents processing failed", error };
  }
};
export default handleMonthlyRents;

export const sendEmailToTenants = async () => {
  try {
    const { npMonth, npYear } = getNepaliMonthDates();
    const { reminderDay } = checkNepaliSpecialDays();
    if (reminderDay) {
      return {
        success: true,
        message: "today is not reminder day",
      };
    }
    const rents = await Rent.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).populate("tenant");

    if (rents.length === 0) {
      return {
        success: true,
        message: "No pending rents found for this month",
      };
    }
    const io = getIO();

    const pendingTenants = rents.map((rent) => ({
      tenantId: rent.tenant?._id,
      tenantName: rent.tenant?.name || "Unknown",
      tenantEmail: rent.tenant?.email || "N/A",
      rentAmount: rent.rentAmount,
      status: rent.status,
      dueDate: rent.nepaliDueDate,
      rentId: rent._id,
    }));
    const admins = await adminModel.find({ role: "admin" });
    const notificationPromises = admins.map(async (admin) => {
      const notification = await Notification.create({
        admin: admin._id,
        type: "RENT_REMINDER",
        title: "Rent Payment Reminder",
        message: `${rents.length} tenant(s) have pending rent payments for ${npYear}-${npMonth}`,
        data: {
          pendingCount: rents.length,
          tenants: pendingTenants,
          monthYear: `${npYear}-${npMonth}`,
          month: npMonth,
          year: npYear,
        },
        isRead: false,
      });
      if (io) {
        io.to(`admin:${admin._id}`).emit("new-notification", {
          notification: {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
          },
        });
      }

      return notification;
    });

    await Promise.all(notificationPromises);
    const emailPromises = rents.map(async (rent) => {
      const tenant = rent.tenant;
      if (!tenant?.email) {
        console.log(`No email for tenant: ${tenant?.name || "Unknown"}`);
        return;
      }

      // Reconstruct NepaliDate from stored nepaliDueDate
      // Since nepaliDueDate is stored but corrupted, extract day from it
      let nepaliDay = 30; // default

      if (rent.nepaliDueDate) {
        // Try to extract day from the stored date string
        const dateStr = rent.nepaliDueDate.toString();
        const match = dateStr.match(/2\d{3}-\d{2}-(\d{2})/);
        if (match) {
          nepaliDay = parseInt(match[1]);
        }
      }

      // Create proper NepaliDate object
      // rent.nepaliMonth is 1-based (from DB), but NepaliDate constructor needs 0-based
      const nepaliDueDate = new NepaliDate(
        rent.nepaliYear,
        rent.nepaliMonth - 1,
        nepaliDay
      );

      const formattedDate = nepaliDueDate.format("YYYY-MMMM-DD");
      const monthYear = nepaliDueDate.format("YYYY-MMMM");

      const subject = "Reminder for Rent Payment";
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Rent Reminder</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin:0; padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:20px;">
              <h2 style="color:#333333; font-size:24px; margin-bottom:10px;">Hello ${tenant.name},</h2>
              <p style="color:#555555; font-size:16px; line-height:1.5;">
                This is a reminder for your rent payment of <strong>Rs. ${rent.rentAmount}</strong> for <strong>${monthYear}</strong>.
              </p>
              <p style="color:#555555; font-size:16px; line-height:1.5;">
                Please pay your rent before <strong>${formattedDate}</strong>.
              </p>
              <p style="color:#555555; font-size:16px; line-height:1.5; margin-top:30px;">
                Thank you,<br>
                <strong>Your Management Team</strong>
              </p>
              <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;">
              <p style="color:#999999; font-size:12px; text-align:center;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      try {
        await sendEmail({ to: tenant.email, subject, html });
        rent.emailReminderSent = true;
      } catch (emailError) {
        console.error(`Failed to send email to ${tenant.email}:`, emailError);
      }
    });

    await Promise.all(emailPromises);

    // Save all updated rents
    const savePromises = rents
      .filter((rent) => rent.emailReminderSent)
      .map((rent) => rent.save());
    await Promise.all(savePromises);

    const sentCount = rents.filter((r) => r.emailReminderSent).length;

    return {
      success: true,
      message: `Email sent to ${sentCount} out of ${rents.length} tenants successfully`,
    };
  } catch (error) {
    console.error("Error sending emails:", error);
    return {
      success: false,
      message: "Failed to send emails",
      error: error.message,
    };
  }
};
