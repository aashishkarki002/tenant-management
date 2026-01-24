import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/tenant.model.js";
import adminModel from "../auth/admin.Model.js";
import {
  getNepaliMonthDates,
  checkNepaliSpecialDays,
} from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
import { sendEmail } from "../../config/nodemailer.js";
import { ledgerService } from "../ledger/ledger.service.js";
import Notification from "../notifications/notification.model.js";
import NepaliDate from "nepali-datetime";
import { getIO } from "../../config/socket.js";
import { Cam } from "../tenant/cam/cam.model.js";
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
      const insertedRents = await Rent.insertMany(rentsToInsert);
      for (const rent of insertedRents) {
        try {
          await ledgerService.recordRentCharge(rent._id, null);
        } catch (error) {
          throw error;
        }
      }
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
    const { npMonth, npYear, lastDay } = getNepaliMonthDates();
    const { reminderDay } = checkNepaliSpecialDays({ forceTest: true });
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
      emailReminderSent: { $ne: true },
    }).populate("tenant");
    const cams = await Cam.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      emailReminderSent: { $ne: true },
    }).populate("tenant");
    const allPending = [...rents, ...cams];
    if (allPending.length === 0) {
      return {
        success: true,
        message: "No pending rents or cams found for this month",
      };
    }
    const io = getIO();

    const pendingTenants = allPending.map((item) => ({
      tenantId: item.tenant?._id,
      tenantName: item.tenant?.name || "Unknown",
      tenantEmail: item.tenant?.email || "N/A",
      rentAmount: item.rentAmount || item.amount,
      status: item.status,
      dueDate: item.nepaliDueDate || lastDay,
      itemId: item._id,
      type: item.rentAmount ? "rent" : "cam",
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

    // Group rents and CAMs by tenant
    const tenantMap = new Map();
    
    rents.forEach((rent) => {
      const tenantId = rent.tenant?._id?.toString();
      if (tenantId) {
        if (!tenantMap.has(tenantId)) {
          tenantMap.set(tenantId, {
            tenant: rent.tenant,
            rents: [],
            cams: [],
          });
        }
        tenantMap.get(tenantId).rents.push(rent);
      }
    });

    cams.forEach((cam) => {
      const tenantId = cam.tenant?._id?.toString();
      if (tenantId) {
        if (!tenantMap.has(tenantId)) {
          tenantMap.set(tenantId, {
            tenant: cam.tenant,
            rents: [],
            cams: [],
          });
        }
        tenantMap.get(tenantId).cams.push(cam);
      }
    });

    const sentRentIds = [];
    const sentCamIds = [];

    const emailPromises = Array.from(tenantMap.values()).map(async ({ tenant, rents: tenantRents, cams: tenantCams }) => {
      if (!tenant?.email) {
        console.log(`No email for tenant: ${tenant?.name || "Unknown"}`);
        return;
      }

      // Calculate totals
      const rentTotal = tenantRents.reduce((sum, rent) => sum + (rent.rentAmount || 0), 0);
      const camTotal = tenantCams.reduce((sum, cam) => sum + (cam.amount || 0), 0);
      const totalAmount = rentTotal + camTotal;

      // Skip if no pending amounts
      if (totalAmount === 0) {
        console.log(`Skipping email for tenant ${tenant?.name || "Unknown"} - no pending amounts`);
        return;
      }

      // Get due date from rent or use lastDay
      let nepaliDueDate;
      
      if (tenantRents.length > 0 && tenantRents[0].nepaliDueDate) {
        const dateStr = tenantRents[0].nepaliDueDate.toString();
        const match = dateStr.match(/2\d{3}-\d{2}-(\d{2})/);
        if (match) {
          const nepaliDay = parseInt(match[1]);
          nepaliDueDate = new NepaliDate(
            tenantRents[0].nepaliYear,
            tenantRents[0].nepaliMonth - 1,
            nepaliDay
          );
        } else {
          // Fallback to lastDay if date parsing fails
          nepaliDueDate = lastDay || new NepaliDate(npYear, npMonth - 1, 30);
        }
      } else if (tenantCams.length > 0) {
        // For CAMs, use lastDay from getNepaliMonthDates
        nepaliDueDate = lastDay || new NepaliDate(npYear, npMonth - 1, 30);
      } else {
        // Fallback
        nepaliDueDate = lastDay || new NepaliDate(npYear, npMonth - 1, 30);
      }

      const formattedDate = nepaliDueDate.format("YYYY-MMMM-DD");
      const monthYear = nepaliDueDate.format("YYYY-MMMM");

      const subject = "Reminder for Rent and CAM Payment";
      
      // Build payment details HTML
      let paymentDetails = '';
      if (tenantRents.length > 0) {
        paymentDetails += `
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #e0e0e0;">
              <strong>Rent:</strong> Rs. ${rentTotal.toLocaleString()}
            </td>
          </tr>`;
      }
      if (tenantCams.length > 0) {
        paymentDetails += `
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #e0e0e0;">
              <strong>CAM Charges:</strong> Rs. ${camTotal.toLocaleString()}
            </td>
          </tr>`;
      }

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Rent and CAM Reminder</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin:0; padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:20px;">
              <h2 style="color:#333333; font-size:24px; margin-bottom:10px;">Hello ${tenant.name},</h2>
              <p style="color:#555555; font-size:16px; line-height:1.5;">
                This is a reminder for your pending payments for <strong>${monthYear}</strong>.
              </p>
              <table width="100%" style="margin:20px 0; border-collapse:collapse;">
                ${paymentDetails}
                <tr>
                  <td style="padding:12px 0; border-top:2px solid #333333; border-bottom:2px solid #333333;">
                    <strong style="font-size:18px;">Total Amount:</strong> <strong style="font-size:18px; color:#d32f2f;">Rs. ${totalAmount.toLocaleString()}</strong>
                  </td>
                </tr>
              </table>
              <p style="color:#555555; font-size:16px; line-height:1.5;">
                Please pay the amount before <strong>${formattedDate}</strong>.
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
        
        // Track successfully sent rent and CAM IDs to toggle emailReminderSent to true
        tenantRents.forEach((rent) => {
          sentRentIds.push(rent._id);
        });
        tenantCams.forEach((cam) => {
          sentCamIds.push(cam._id);
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${tenant.email}:`, emailError);
      }
    });

    await Promise.all(emailPromises);

    // Toggle emailReminderSent to true for all successfully sent rents
    if (sentRentIds.length > 0) {
      await Rent.updateMany(
        { _id: { $in: sentRentIds } },
        { $set: { emailReminderSent: true } }
      );
    }

    // Toggle emailReminderSent to true for all successfully sent CAMs
    if (sentCamIds.length > 0) {
      await Cam.updateMany(
        { _id: { $in: sentCamIds } },
        { $set: { emailReminderSent: true } }
      );
    }

    const sentCount = Array.from(tenantMap.values()).filter(({ tenant }) => tenant?.email).length;
    const totalTenants = tenantMap.size;

    return {
      success: true,
      message: `Email sent to ${sentCount} out of ${totalTenants} tenants successfully`,
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
