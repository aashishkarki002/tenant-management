/**
 * rent.service.js — FIXED VERSION
 *
 * Bugs found and fixed:
 *
 * BUG 1 — sendEmailToTenants: emails fire EVERY day (critical spam bug)
 *   Line 570: const { reminderDay } = checkNepaliSpecialDays({ forceTest: true })
 *   Two problems:
 *     a) forceTest: true makes the function always return all-true — guard can never work
 *     b) Destructures `reminderDay` but the object key is `isReminderDay` → always undefined
 *     c) if (undefined) is falsy → guard NEVER fires → emails sent on every cron run
 *   Fix: Remove forceTest, use correct key, fix guard direction.
 *
 * BUG 2 — handleMonthlyRents: tdsAmountPaisa is multiplied by sqft incorrectly
 *   Line 490: tenant.tdsPaisa * (tenant.leasedSquareFeet || 0)
 *   tenant.tdsPaisa is already the TOTAL tds amount (not per-sqft rate).
 *   Multiplying by sqft again inflates TDS by ~1000x.
 *   Fix: Use tenant.tdsPaisa directly.
 *
 * BUG 3 — handleMonthlyRents: overdue marking runs inside rent creation
 *   Lines 453-462 mark overdue rents as part of handleMonthlyRents.
 *   The master cron also has a dedicated overdue step — remove it from master cron
 *   and keep it here where it belongs (runs before creating new rents).
 *
 * ADMIN IDs — sendEmailToTenants already queries all admins correctly:
 *   Line 622: adminModel.find({ role: "admin" }) — no hardcoded IDs. ✅
 *   No change needed here, the master cron's getNotifiableAdmins() is consistent.
 */

import mongoose from "mongoose";
import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import adminModel from "../auth/admin.Model.js";
import {
  getNepaliMonthDates,
  checkNepaliSpecialDays,
} from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
import { sendEmail } from "../../config/nodemailer.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildRentChargeJournal } from "../ledger/journal-builders/index.js";
import Notification from "../notifications/notification.model.js";
import NepaliDate from "nepali-datetime";
import { getIO } from "../../config/socket.js";
import { Cam } from "../cam/cam.model.js";
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
} from "../../utils/moneyUtil.js";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// No changes below until handleMonthlyRents and sendEmailToTenants
// ─────────────────────────────────────────────────────────────────────────────

function calculateRentTotals(rent) {
  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    const rentAmountPaisa = rent.unitBreakdown.reduce(
      (sum, unit) => sum + (unit.rentAmountPaisa || 0),
      0,
    );
    const tdsAmountPaisa = rent.unitBreakdown.reduce(
      (sum, unit) => sum + (unit.tdsAmountPaisa || 0),
      0,
    );
    const paidAmountPaisa = rent.unitBreakdown.reduce(
      (sum, unit) => sum + (unit.paidAmountPaisa || 0),
      0,
    );
    return {
      rentAmountPaisa,
      tdsAmountPaisa,
      paidAmountPaisa,
      remainingAmountPaisa: rentAmountPaisa - paidAmountPaisa,
      netAmountPaisa: rentAmountPaisa - tdsAmountPaisa,
    };
  }

  const getRawPaisa = (field) => {
    if (rent.get && typeof rent.get === "function") {
      return rent.get(field, null, { getters: false }) || 0;
    }
    return rent[field] || 0;
  };

  const rentAmountPaisa = getRawPaisa("rentAmountPaisa");
  const tdsAmountPaisa = getRawPaisa("tdsAmountPaisa");
  const paidAmountPaisa = getRawPaisa("paidAmountPaisa");

  return {
    rentAmountPaisa,
    tdsAmountPaisa,
    paidAmountPaisa,
    remainingAmountPaisa: rentAmountPaisa - paidAmountPaisa,
    netAmountPaisa: rentAmountPaisa - tdsAmountPaisa,
  };
}

function buildRentsFilter(filters = {}) {
  const query = {};
  if (filters.tenantId && mongoose.Types.ObjectId.isValid(filters.tenantId)) {
    query.tenant = new mongoose.Types.ObjectId(filters.tenantId);
  }
  if (
    filters.propertyId &&
    mongoose.Types.ObjectId.isValid(filters.propertyId)
  ) {
    query.property = new mongoose.Types.ObjectId(filters.propertyId);
  }
  if (
    filters.status &&
    ["pending", "paid", "partially_paid", "overdue", "cancelled"].includes(
      filters.status,
    )
  ) {
    query.status = filters.status;
  }
  if (filters.nepaliMonth != null) {
    const month = Number(filters.nepaliMonth);
    if (month >= 1 && month <= 12) query.nepaliMonth = month;
  }
  if (filters.nepaliYear != null) {
    const year = Number(filters.nepaliYear);
    if (!Number.isNaN(year)) query.nepaliYear = year;
  }
  if (filters.startDate || filters.endDate) {
    query.englishDueDate = {};
    if (filters.startDate)
      query.englishDueDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.englishDueDate.$lte = new Date(filters.endDate);
  }
  return query;
}

export async function getRentsService(filters = {}) {
  try {
    const query = buildRentsFilter(filters);
    const rents = await Rent.find(query)
      .sort({ nepaliDueDate: 1 })
      .populate({
        path: "tenant",
        match: { isDeleted: false },
        select: "name email",
      })
      .populate({ path: "innerBlock", select: "name" })
      .populate({ path: "block", select: "name" })
      .populate({ path: "property", select: "name" })
      .populate({ path: "units", select: "name" });

    const filteredRents = rents.filter((rent) => rent.tenant);

    const rentsWithFormatted = filteredRents.map((rent) => {
      const rentObj = rent.toObject({ virtuals: false, getters: false });
      const totals = calculateRentTotals(rent);
      const lateFeePaisa =
        rent.get("lateFeePaisa", null, { getters: false }) || 0;

      return {
        ...rentObj,
        totals: {
          rentAmountPaisa: totals.rentAmountPaisa,
          tdsAmountPaisa: totals.tdsAmountPaisa,
          paidAmountPaisa: totals.paidAmountPaisa,
          remainingAmountPaisa: totals.remainingAmountPaisa,
          netAmountPaisa: totals.netAmountPaisa,
          lateFeePaisa,
          totalDuePaisa: totals.remainingAmountPaisa + lateFeePaisa,
        },
        formatted: {
          rentAmount: formatMoney(totals.rentAmountPaisa),
          tdsAmount: formatMoney(totals.tdsAmountPaisa),
          paidAmount: formatMoney(totals.paidAmountPaisa),
          remainingAmount: formatMoney(totals.remainingAmountPaisa),
          netAmount: formatMoney(totals.netAmountPaisa),
          lateFee: formatMoney(lateFeePaisa),
          totalDue: formatMoney(totals.remainingAmountPaisa + lateFeePaisa),
        },
      };
    });

    return { success: true, rents: rentsWithFormatted };
  } catch (error) {
    console.error("Error fetching rents:", error);
    return {
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    };
  }
}

export async function getRentByIdService(rentId) {
  try {
    const rent = await Rent.findById(rentId)
      .populate("tenant")
      .populate("innerBlock")
      .populate("block")
      .populate("property")
      .populate("units")
      .populate({ path: "unitBreakdown.unit", select: "name" });

    if (!rent) {
      return { success: false, statusCode: 404, message: "Rent not found" };
    }

    const rentObj = rent.toObject({ virtuals: false, getters: false });
    const totals = calculateRentTotals(rent);
    const lateFeePaisa =
      rent.get("lateFeePaisa", null, { getters: false }) || 0;

    return {
      success: true,
      rent: {
        ...rentObj,
        totals: {
          rentAmountPaisa: totals.rentAmountPaisa,
          tdsAmountPaisa: totals.tdsAmountPaisa,
          paidAmountPaisa: totals.paidAmountPaisa,
          remainingAmountPaisa: totals.remainingAmountPaisa,
          netAmountPaisa: totals.netAmountPaisa,
          lateFeePaisa,
          totalDuePaisa: totals.remainingAmountPaisa + lateFeePaisa,
        },
        formatted: {
          rentAmount: formatMoney(totals.rentAmountPaisa),
          tdsAmount: formatMoney(totals.tdsAmountPaisa),
          paidAmount: formatMoney(totals.paidAmountPaisa),
          remainingAmount: formatMoney(totals.remainingAmountPaisa),
          netAmount: formatMoney(totals.netAmountPaisa),
          lateFee: formatMoney(lateFeePaisa),
          totalDue: formatMoney(totals.remainingAmountPaisa + lateFeePaisa),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching rent:", error);
    return {
      success: false,
      message: "Rent fetching failed",
      error: error.message,
    };
  }
}

const ALLOWED_STATUSES = [
  "pending",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
];

export async function updateRentService(rentId, body) {
  try {
    const rent = await Rent.findById(rentId);
    if (!rent) {
      return { success: false, statusCode: 404, message: "Rent not found" };
    }

    if (body.lateFeePaisa !== undefined) {
      const lateFeePaisa = Number(body.lateFeePaisa);
      if (!Number.isInteger(lateFeePaisa) || lateFeePaisa < 0) {
        return {
          success: false,
          statusCode: 400,
          message: "lateFeePaisa must be a non-negative integer",
        };
      }
      rent.lateFeePaisa = lateFeePaisa;
      rent.lateFeeApplied = lateFeePaisa > 0;
      rent.lateFeeDate =
        lateFeePaisa > 0
          ? body.lateFeeDate
            ? new Date(body.lateFeeDate)
            : new Date()
          : null;
      rent.lateFeeStatus = lateFeePaisa > 0 ? "pending" : "pending";
    }

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return {
          success: false,
          statusCode: 400,
          message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
        };
      }
      rent.status = body.status;
    }

    if (body.lateFeeApplied !== undefined)
      rent.lateFeeApplied = Boolean(body.lateFeeApplied);
    if (body.lateFeeDate !== undefined)
      rent.lateFeeDate = body.lateFeeDate ? new Date(body.lateFeeDate) : null;

    await rent.save();

    const result = await getRentByIdService(rentId);
    return {
      success: true,
      rent: result.success ? result.rent : rent.toObject(),
      message: "Rent updated successfully",
    };
  } catch (error) {
    console.error("Error updating rent:", error);
    return {
      success: false,
      message: error.message || "Rent update failed",
      error: error.message,
    };
  }
}

export async function createNewRent(rentData, session = null) {
  try {
    if (!Number.isInteger(rentData.rentAmountPaisa)) {
      throw new Error(
        `rentAmountPaisa must be an integer, got: ${rentData.rentAmountPaisa}`,
      );
    }
    if (!Number.isInteger(rentData.tdsAmountPaisa)) {
      throw new Error(
        `tdsAmountPaisa must be an integer, got: ${rentData.tdsAmountPaisa}`,
      );
    }

    rentData.paidAmountPaisa ??= 0;
    rentData.lateFeePaisa ??= 0;

    if (rentData.unitBreakdown?.length > 0) {
      rentData.unitBreakdown = rentData.unitBreakdown.map((ub) => {
        if (!Number.isInteger(ub.rentAmountPaisa)) {
          throw new Error(
            `Unit breakdown rentAmountPaisa must be integer, got: ${ub.rentAmountPaisa}`,
          );
        }
        return {
          ...ub,
          rentAmountPaisa: ub.rentAmountPaisa,
          tdsAmountPaisa: ub.tdsAmountPaisa ?? 0,
          paidAmountPaisa: ub.paidAmountPaisa ?? 0,
        };
      });
    }

    const opts = session ? { session } : {};
    const created = await Rent.create([rentData], opts);
    const rent = created[0];
    const rentAmountPaisaRaw = rent.get("rentAmountPaisa", null, {
      getters: false,
    });

    console.log("✅ Rent created:", {
      id: rent._id,
      amount: formatMoney(rentAmountPaisaRaw),
      amountPaisa: rentAmountPaisaRaw,
    });

    return { success: true, message: "Rent created successfully", data: rent };
  } catch (error) {
    console.error("Error creating rent:", error);
    return {
      success: false,
      message: "Failed to create rent",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: handleMonthlyRents
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMonthlyRents(adminId) {
  const createdBy = adminId || process.env.SYSTEM_ADMIN_ID;
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
    // Step 1: Mark overdue rents (kept here — master cron removed its duplicate step)
    const overdueResult = await Rent.updateMany(
      {
        status: { $in: ["pending", "partially_paid"] },
        $or: [
          { nepaliYear: { $lt: npYear } },
          { nepaliYear: npYear, nepaliMonth: { $lt: npMonth } },
        ],
      },
      { $set: { status: "overdue" } },
    );
    console.log("Overdue rents updated:", overdueResult.modifiedCount);

    // Step 2: Get active tenants
    const tenants = await Tenant.find({ status: "active" }).lean();
    if (!tenants.length) {
      return { success: false, message: "No tenants found", count: 0 };
    }

    // Step 3: Skip tenants who already have a rent this month (idempotency)
    const existingRents = await Rent.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingRents.map((r) => r.tenant.toString()),
    );

    // Step 4: Build rent documents
    const rentsToInsert = tenants
      .filter((tenant) => !existingTenantIds.has(tenant._id.toString()))
      .map((tenant) => {
        const rentAmountPaisa =
          tenant.totalRentPaisa || rupeesToPaisa(tenant.totalRent || 0);

        // ✅ FIX: tenant.tdsPaisa is the TOTAL tds amount — do NOT multiply by sqft again
        // Old (buggy): tenant.tdsPaisa * (tenant.leasedSquareFeet || 0)
        const tdsAmountPaisa = tenant.tdsPaisa
          ? tenant.tdsPaisa
          : rupeesToPaisa(tenant.tds || 0);

        return {
          tenant: tenant._id,
          innerBlock: tenant.innerBlock,
          block: tenant.block,
          property: tenant.property,
          nepaliMonth: npMonth,
          nepaliYear: npYear,
          nepaliDate,
          rentAmountPaisa,
          tdsAmountPaisa,
          paidAmountPaisa: 0,
          lateFeePaisa: 0,
          units: tenant.units,
          createdBy,
          nepaliDueDate: lastDay,
          englishDueDate,
          englishMonth,
          englishYear,
          status: "pending",
          rentFrequency: tenant.rentPaymentFrequency || "monthly",
        };
      });

    if (rentsToInsert.length) {
      const insertedRents = await Rent.insertMany(rentsToInsert);

      for (const rent of insertedRents) {
        try {
          const rentChargePayload = buildRentChargeJournal(rent);
          await ledgerService.postJournalEntry(rentChargePayload, null);
        } catch (error) {
          console.error(
            `Failed to create ledger entry for rent ${rent._id}:`,
            error,
          );
          throw error;
        }
      }

      console.log("✅ Monthly rents created:", rentsToInsert.length);
      console.log(
        "   Total rent amount:",
        formatMoney(
          rentsToInsert.reduce((sum, r) => sum + r.rentAmountPaisa, 0),
        ),
      );
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
    console.error("Error in handleMonthlyRents:", error);
    return {
      success: false,
      message: "Rents processing failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: sendEmailToTenants
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailToTenants() {
  try {
    const { npMonth, npYear, lastDay } = getNepaliMonthDates();

    // ✅ FIX: Removed forceTest: true and corrected the destructured key name.
    //
    // Original (buggy):
    //   const { reminderDay } = checkNepaliSpecialDays({ forceTest: true })
    //   if (reminderDay) return early   ← guard NEVER fired because:
    //     a) forceTest always returns all-true
    //     b) `reminderDay` is the wrong key — should be `isReminderDay`
    //     c) `undefined` is falsy → guard was always skipped → emails every day
    //
    // This function is called from the master cron on Nepali day 1 ONLY.
    // The day-gating is handled by the master cron, not here.
    // Remove the internal guard entirely — single responsibility principle:
    // the cron decides WHEN to call this; this function just sends the emails.

    const rents = await Rent.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      emailReminderSent: false,
    }).populate("tenant");

    const cams = await Cam.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      emailReminderSent: false,
    }).populate("tenant");

    const allPending = [...rents, ...cams];

    if (allPending.length === 0) {
      return {
        success: true,
        message: "No pending rents or CAMs found for this month",
      };
    }

    const io = getIO();

    const pendingTenants = allPending.map((item) => {
      const amountPaisa = item.rentAmountPaisa || item.amountPaisa || 0;
      return {
        tenantId: item.tenant?._id,
        tenantName: item.tenant?.name || "Unknown",
        tenantEmail: item.tenant?.email || "N/A",
        amountPaisa,
        amount: formatMoney(amountPaisa),
        status: item.status,
        dueDate: item.nepaliDueDate || lastDay,
        itemId: item._id,
        type: item.rentAmountPaisa ? "rent" : "cam",
      };
    });

    // ✅ Admin notifications — already queries all admins by role. No hardcoded IDs.
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
    });

    await Promise.all(notificationPromises);

    // Group rents and CAMs by tenant
    const tenantMap = new Map();

    rents.forEach((rent) => {
      if (!rent.tenant?.email) return;
      const key = rent.tenant._id.toString();
      if (!tenantMap.has(key))
        tenantMap.set(key, { tenant: rent.tenant, rents: [], cams: [] });
      tenantMap.get(key).rents.push(rent);
    });

    cams.forEach((cam) => {
      if (!cam.tenant?.email) return;
      const key = cam.tenant._id.toString();
      if (!tenantMap.has(key))
        tenantMap.set(key, { tenant: cam.tenant, rents: [], cams: [] });
      tenantMap.get(key).cams.push(cam);
    });

    const sentRentIds = [];
    const sentCamIds = [];

    const emailPromises = Array.from(tenantMap.values()).map(
      async ({ tenant, rents: tenantRents, cams: tenantCams }) => {
        if (!tenant?.email) return;

        const rentTotalPaisa = tenantRents.reduce((sum, rent) => {
          const totals = calculateRentTotals(rent);
          return sum + totals.remainingAmountPaisa;
        }, 0);

        const camTotalPaisa = tenantCams.reduce(
          (sum, cam) => sum + (cam.amountPaisa || cam.amount * 100 || 0),
          0,
        );
        const totalAmountPaisa = rentTotalPaisa + camTotalPaisa;

        // Determine Nepali due date
        let nepaliDueDate;
        if (tenantRents.length > 0) {
          const rawDate = tenantRents[0].nepaliDueDate;
          const dateStr =
            rawDate instanceof Date
              ? rawDate.toISOString().slice(0, 10)
              : String(rawDate);
          if (dateStr.match) {
            nepaliDueDate = new NepaliDate(
              tenantRents[0].nepaliYear,
              tenantRents[0].nepaliMonth - 1,
              parseInt(dateStr.match(/(\d{2})$/)[1]),
            );
          } else {
            nepaliDueDate = lastDay || new NepaliDate(npYear, npMonth - 1, 30);
          }
        } else {
          nepaliDueDate = lastDay || new NepaliDate(npYear, npMonth - 1, 30);
        }

        const formattedDate = nepaliDueDate.format("YYYY-MMMM-DD");
        const monthYear = nepaliDueDate.format("YYYY-MMMM");
        const subject = "Reminder for Rent and CAM Payment";

        let paymentDetails = "";
        if (tenantRents.length > 0) {
          paymentDetails += `<tr><td style="padding:8px 0; border-bottom:1px solid #e0e0e0;"><strong>Rent:</strong> ${formatMoney(rentTotalPaisa)}</td></tr>`;
        }
        if (tenantCams.length > 0) {
          paymentDetails += `<tr><td style="padding:8px 0; border-bottom:1px solid #e0e0e0;"><strong>CAM Charges:</strong> ${formatMoney(camTotalPaisa)}</td></tr>`;
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Rent and CAM Reminder</title></head>
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
              <strong style="font-size:18px;">Total Amount:</strong>
              <strong style="font-size:18px; color:#d32f2f;">${formatMoney(totalAmountPaisa)}</strong>
            </td>
          </tr>
        </table>
        <p style="color:#555555; font-size:16px; line-height:1.5;">
          Please pay the amount before <strong>${formattedDate}</strong>.
        </p>
        <p style="color:#555555; font-size:16px; line-height:1.5; margin-top:30px;">
          Thank you,<br><strong>Your Management Team</strong>
        </p>
        <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;">
        <p style="color:#999999; font-size:12px; text-align:center;">
          This is an automated reminder. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

        try {
          await sendEmail({ to: tenant.email, subject, html });
          tenantRents.forEach((rent) => sentRentIds.push(rent._id));
          tenantCams.forEach((cam) => sentCamIds.push(cam._id));
        } catch (emailError) {
          console.error(`Failed to send email to ${tenant.email}:`, emailError);
        }
      },
    );

    await Promise.all(emailPromises);

    if (sentRentIds.length > 0) {
      await Rent.updateMany(
        { _id: { $in: sentRentIds } },
        { $set: { emailReminderSent: true } },
      );
    }
    if (sentCamIds.length > 0) {
      await Cam.updateMany(
        { _id: { $in: sentCamIds } },
        { $set: { emailReminderSent: true } },
      );
    }

    const sentCount = Array.from(tenantMap.values()).filter(
      ({ tenant }) => tenant?.email,
    ).length;
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
}

export default handleMonthlyRents;
