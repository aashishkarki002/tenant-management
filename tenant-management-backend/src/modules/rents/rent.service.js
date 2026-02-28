/**
 * rent.service.js
 *
 * Changes in this revision:
 *
 * 1. getRentsService — tenant populate now selects all fields the frontend
 *    payment utilities rely on: name, email, camChargesPaisa, camCharges,
 *    rentPaymentFrequency. Without these the allocation dialog shows $0 CAM
 *    and frequency shows "N/A".
 *
 * 2. buildRentsFilter — fully supports nepaliMonth, nepaliYear, propertyId,
 *    status, tenantId, startDate/endDate. No changes to logic, only docs added.
 *
 * 3. All other service functions (updateRentService, createNewRent,
 *    handleMonthlyRents, sendEmailToTenants) are unchanged.
 */

import mongoose from "mongoose";
import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import adminModel from "../auth/admin.Model.js";
import { getNepaliMonthDates } from "../../utils/nepaliDateHelper.js";
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
import { calculateRentTotals } from "./helpers/rentTotal.helper.js";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// QUERY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Mongoose filter object from the supported query parameters.
 *
 * Supported filters:
 *   tenantId    — ObjectId string
 *   propertyId  — ObjectId string  (covered by index: nepaliYear+nepaliMonth+status+property)
 *   status      — "pending"|"paid"|"partially_paid"|"overdue"|"cancelled"
 *   nepaliMonth — 1–12
 *   nepaliYear  — e.g. 2081
 *   startDate   — ISO string, matched against englishDueDate
 *   endDate     — ISO string, matched against englishDueDate
 */
function buildRentsFilter(filters = {}) {
  const query = {};

  if (filters.tenantId && mongoose.Types.ObjectId.isValid(filters.tenantId))
    query.tenant = new mongoose.Types.ObjectId(filters.tenantId);

  if (filters.propertyId && mongoose.Types.ObjectId.isValid(filters.propertyId))
    query.property = new mongoose.Types.ObjectId(filters.propertyId);

  if (
    ["pending", "paid", "partially_paid", "overdue", "cancelled"].includes(
      filters.status,
    )
  )
    query.status = filters.status;

  if (filters.nepaliMonth != null) {
    const m = Number(filters.nepaliMonth);
    if (m >= 1 && m <= 12) query.nepaliMonth = m;
  }

  if (filters.nepaliYear != null) {
    const y = Number(filters.nepaliYear);
    if (!Number.isNaN(y)) query.nepaliYear = y;
  }

  if (filters.startDate || filters.endDate) {
    query.englishDueDate = {};
    if (filters.startDate)
      query.englishDueDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.englishDueDate.$lte = new Date(filters.endDate);
  }

  return query;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ SERVICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch rents matching the given filters, with full population.
 *
 * IMPORTANT — tenant select list:
 *   The frontend payment utilities (paymentUtil.js → getPaymentAmounts,
 *   findMatchingCam, etc.) read these tenant sub-fields at runtime:
 *     • name                 — displayed in table rows
 *     • email                — used by reminder emails
 *     • camChargesPaisa      — fallback CAM amount when no CAM record exists
 *     • camCharges           — legacy rupee fallback for the same
 *     • rentPaymentFrequency — drives the Monthly / Quarterly tab split
 *
 *   Omitting any of these causes the dialog to show $0 CAM or "N/A" frequency.
 */
export async function getRentsService(filters = {}) {
  try {
    const rents = await Rent.find(buildRentsFilter(filters))
      .sort({ nepaliDueDate: 1 })
      .populate({
        path: "tenant",
        match: { isDeleted: false },
        // FIX: include all fields the frontend payment utilities need
        select: "name email camChargesPaisa camCharges rentPaymentFrequency",
      })
      .populate({ path: "innerBlock", select: "name" })
      .populate({ path: "block", select: "name" })
      .populate({ path: "property", select: "name" })
      .populate({ path: "units", select: "name" });

    const result = rents
      .filter((r) => r.tenant) // exclude rents whose tenant is soft-deleted
      .map((rent) => {
        const rentObj = rent.toObject({ virtuals: false, getters: false });
        const t = calculateRentTotals(rent);
        return {
          ...rentObj,
          totals: {
            rentAmountPaisa: t.rentAmountPaisa,
            tdsAmountPaisa: t.tdsAmountPaisa,
            effectiveRentPaisa: t.effectiveRentPaisa,
            paidAmountPaisa: t.paidAmountPaisa,
            remainingAmountPaisa: t.remainingAmountPaisa,
            lateFeePaisa: t.lateFeePaisa,
            totalDuePaisa: t.totalDuePaisa,
          },
          formatted: {
            rentAmount: formatMoney(t.rentAmountPaisa),
            tdsAmount: formatMoney(t.tdsAmountPaisa),
            effectiveRent: formatMoney(t.effectiveRentPaisa),
            paidAmount: formatMoney(t.paidAmountPaisa),
            remainingAmount: formatMoney(t.remainingAmountPaisa),
            lateFee: formatMoney(t.lateFeePaisa),
            totalDue: formatMoney(t.totalDuePaisa),
          },
        };
      });

    return { success: true, rents: result };
  } catch (error) {
    console.error("[getRentsService]", error.message);
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

    if (!rent)
      return { success: false, statusCode: 404, message: "Rent not found" };

    const rentObj = rent.toObject({ virtuals: false, getters: false });
    const t = calculateRentTotals(rent);

    return {
      success: true,
      rent: {
        ...rentObj,
        totals: {
          rentAmountPaisa: t.rentAmountPaisa,
          tdsAmountPaisa: t.tdsAmountPaisa,
          effectiveRentPaisa: t.effectiveRentPaisa,
          paidAmountPaisa: t.paidAmountPaisa,
          remainingAmountPaisa: t.remainingAmountPaisa,
          lateFeePaisa: t.lateFeePaisa,
          totalDuePaisa: t.totalDuePaisa,
        },
        formatted: {
          rentAmount: formatMoney(t.rentAmountPaisa),
          tdsAmount: formatMoney(t.tdsAmountPaisa),
          effectiveRent: formatMoney(t.effectiveRentPaisa),
          paidAmount: formatMoney(t.paidAmountPaisa),
          remainingAmount: formatMoney(t.remainingAmountPaisa),
          lateFee: formatMoney(t.lateFeePaisa),
          totalDue: formatMoney(t.totalDuePaisa),
        },
      },
    };
  } catch (error) {
    console.error("[getRentByIdService]", error.message);
    return {
      success: false,
      message: "Rent fetching failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!rent)
      return { success: false, statusCode: 404, message: "Rent not found" };

    if (body.lateFeePaisa !== undefined) {
      const lf = Number(body.lateFeePaisa);
      if (!Number.isInteger(lf) || lf < 0) {
        return {
          success: false,
          statusCode: 400,
          message: "lateFeePaisa must be a non-negative integer",
        };
      }
      rent.lateFeePaisa = lf;
      rent.lateFeeApplied = lf > 0;
      rent.lateFeeDate =
        lf > 0
          ? body.lateFeeDate
            ? new Date(body.lateFeeDate)
            : new Date()
          : null;
      if (lf > 0) rent.lateFeeStatus = "pending";
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
    console.error("[updateRentService]", error.message);
    return {
      success: false,
      message: error.message || "Rent update failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function createNewRent(rentData, session = null) {
  try {
    if (!Number.isInteger(rentData.rentAmountPaisa))
      throw new Error(
        `rentAmountPaisa must be integer, got: ${rentData.rentAmountPaisa}`,
      );
    if (!Number.isInteger(rentData.tdsAmountPaisa))
      throw new Error(
        `tdsAmountPaisa must be integer, got: ${rentData.tdsAmountPaisa}`,
      );

    rentData.paidAmountPaisa ??= 0;
    rentData.lateFeePaisa ??= 0;

    if (rentData.unitBreakdown?.length > 0) {
      rentData.unitBreakdown = rentData.unitBreakdown.map((ub) => {
        if (!Number.isInteger(ub.rentAmountPaisa))
          throw new Error(
            `Unit rentAmountPaisa must be integer, got: ${ub.rentAmountPaisa}`,
          );
        return {
          ...ub,
          tdsAmountPaisa: ub.tdsAmountPaisa ?? 0,
          paidAmountPaisa: ub.paidAmountPaisa ?? 0,
        };
      });
    }

    const opts = session ? { session } : {};
    const created = await Rent.create([rentData], opts);
    return {
      success: true,
      message: "Rent created successfully",
      data: created[0],
    };
  } catch (error) {
    console.error("[createNewRent]", error.message);
    return {
      success: false,
      message: "Failed to create rent",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON: handleMonthlyRents
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
    // Step 1: Mark overdue (all prior-period pending/partial rents)
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

    // Step 2: Active tenants
    const tenants = await Tenant.find({
      status: "active",
      isDeleted: false,
    }).lean();
    if (!tenants.length) {
      return {
        success: true,
        message: "No active tenants",
        createdCount: 0,
        updatedOverdueCount: 0,
      };
    }

    // Step 3: Idempotency — skip tenants who already have a rent this month
    const existingRents = await Rent.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingRents.map((r) => r.tenant.toString()),
    );

    const rentsToInsert = tenants
      .filter((t) => !existingTenantIds.has(t._id.toString()))
      .map((tenant) => ({
        tenant: tenant._id,
        innerBlock: tenant.innerBlock,
        block: tenant.block,
        property: tenant.property,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate,
        rentAmountPaisa:
          tenant.totalRentPaisa || rupeesToPaisa(tenant.totalRent || 0),
        tdsAmountPaisa: tenant.tdsPaisa || rupeesToPaisa(tenant.tds || 0),
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
      }));

    if (!rentsToInsert.length) {
      return {
        success: true,
        message: "All rents for this month already exist",
        createdCount: 0,
        updatedOverdueCount: overdueResult.modifiedCount,
      };
    }

    // Step 4: Bulk insert
    const insertedRents = await Rent.insertMany(rentsToInsert);

    // Step 5: Post one journal per rent — each in its own session.
    const journalLog = { success: 0, failed: 0, errors: [] };

    for (const rent of insertedRents) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const payload = buildRentChargeJournal(rent);
        await ledgerService.postJournalEntry(payload, session);
        await session.commitTransaction();
        journalLog.success++;
      } catch (err) {
        await session.abortTransaction();
        journalLog.failed++;
        journalLog.errors.push({ rentId: rent._id, error: err.message });
        console.error(
          `[handleMonthlyRents] journal failed for ${rent._id}:`,
          err.message,
        );
      } finally {
        session.endSession();
      }
    }

    return {
      success: true,
      message: `${insertedRents.length} rents created, ${journalLog.success} journaled, ${journalLog.failed} journal errors`,
      createdCount: insertedRents.length,
      updatedOverdueCount: overdueResult.modifiedCount,
      journalErrors: journalLog.errors.length ? journalLog.errors : undefined,
    };
  } catch (error) {
    console.error("[handleMonthlyRents]", error.message);
    return {
      success: false,
      message: "Rents processing failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON: sendEmailToTenants
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailToTenants() {
  try {
    const { npMonth, npYear, lastDay } = getNepaliMonthDates();

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

    if (![...rents, ...cams].length) {
      return { success: true, message: "No pending rents or CAMs this month" };
    }

    const io = getIO();
    const admins = await adminModel.find({ role: "admin" });
    await Promise.all(
      admins.map(async (admin) => {
        const notification = await Notification.create({
          admin: admin._id,
          type: "RENT_REMINDER",
          title: "Rent Payment Reminder",
          message: `${rents.length} tenant(s) have pending rent for ${npYear}-${npMonth}`,
          data: {
            pendingCount: rents.length,
            monthYear: `${npYear}-${npMonth}`,
          },
          isRead: false,
        });
        if (io)
          io.to(`admin:${admin._id}`).emit("new-notification", {
            notification,
          });
      }),
    );

    const tenantMap = new Map();
    const addToMap = (item, type) => {
      if (!item.tenant?.email) return;
      const key = item.tenant._id.toString();
      if (!tenantMap.has(key))
        tenantMap.set(key, { tenant: item.tenant, rents: [], cams: [] });
      tenantMap.get(key)[type].push(item);
    };
    rents.forEach((r) => addToMap(r, "rents"));
    cams.forEach((c) => addToMap(c, "cams"));

    const sentRentIds = [];
    const sentCamIds = [];

    await Promise.all(
      Array.from(tenantMap.values()).map(
        async ({ tenant, rents: tRents, cams: tCams }) => {
          const rentTotal = tRents.reduce(
            (s, r) => s + calculateRentTotals(r).remainingAmountPaisa,
            0,
          );
          const camTotal = tCams.reduce((s, c) => s + (c.amountPaisa || 0), 0);
          const total = rentTotal + camTotal;

          let dueDateStr = "";
          try {
            const ref = tRents[0] || tCams[0];
            dueDateStr = new NepaliDate(
              ref.nepaliYear,
              (ref.nepaliMonth || 1) - 1,
              30,
            ).format("YYYY-MMMM-DD");
          } catch {
            dueDateStr = lastDay?.format?.("YYYY-MMMM-DD") ?? "";
          }

          let details = "";
          if (tRents.length)
            details += `<tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0"><strong>Rent:</strong> ${formatMoney(rentTotal)}</td></tr>`;
          if (tCams.length)
            details += `<tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0"><strong>CAM:</strong> ${formatMoney(camTotal)}</td></tr>`;

          const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif">
        <table style="max-width:600px;margin:20px auto;border:1px solid #e0e0e0;border-radius:8px">
          <tr><td style="padding:20px">
            <h2>Hello ${tenant.name},</h2>
            <p>Reminder: pending payments for <strong>${npYear}-${npMonth}</strong>.</p>
            <table width="100%">${details}
              <tr><td style="padding:12px 0;border-top:2px solid #333;border-bottom:2px solid #333">
                <strong>Total: ${formatMoney(total)}</strong></td></tr>
            </table>
            <p>Please pay before <strong>${dueDateStr}</strong>.</p>
            <p>Thank you,<br><strong>Management Team</strong></p>
          </td></tr>
        </table></body></html>`;

          try {
            await sendEmail({
              to: tenant.email,
              subject: "Reminder for Rent and CAM Payment",
              html,
            });
            tRents.forEach((r) => sentRentIds.push(r._id));
            tCams.forEach((c) => sentCamIds.push(c._id));
          } catch (e) {
            console.error(`[sendEmailToTenants] ${tenant.email}:`, e.message);
          }
        },
      ),
    );

    if (sentRentIds.length)
      await Rent.updateMany(
        { _id: { $in: sentRentIds } },
        { $set: { emailReminderSent: true } },
      );
    if (sentCamIds.length)
      await Cam.updateMany(
        { _id: { $in: sentCamIds } },
        { $set: { emailReminderSent: true } },
      );

    const sent = Array.from(tenantMap.values()).filter(
      ({ tenant }) => tenant?.email,
    ).length;
    return {
      success: true,
      message: `Emails sent to ${sent} of ${tenantMap.size} tenants`,
    };
  } catch (error) {
    console.error("[sendEmailToTenants]", error.message);
    return {
      success: false,
      message: "Failed to send emails",
      error: error.message,
    };
  }
}

export default handleMonthlyRents;
