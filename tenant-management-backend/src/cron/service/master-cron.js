/**
 * Master Cron — Sequential rent lifecycle orchestrator
 *
 * EMAIL FLOWS — two distinct flows, do not confuse them:
 *
 *  Flow A → Tenant email (Step 4):
 *    sendEmailToTenants() sends an email to each TENANT telling them
 *    their rent has been generated and is due this month.
 *    Triggered: Nepali day 1 only.
 *
 *  Flow B → Admin notification (Step 5):
 *    sendRentReminders() pushes an in-app Socket.IO notification to
 *    ALL admin dashboards listing which tenants still haven't paid.
 *    This is an ADMIN alert, not a tenant-facing email.
 *    Triggered: Nepali day (monthEnd - 7), e.g. day 23 of a 30-day month.
 *
 * ADMIN ID — dynamic resolution:
 *    Previously hardcoded as process.env.SYSTEM_ADMIN_ID.
 *    Now resolved at runtime via getNotifiableAdmins() which queries
 *    the Admin collection for all active admins.
 *    Each admin gets their own Notification document + socket emit.
 */

import cron from "node-cron";
import NepaliDate from "nepali-datetime";
import { CronLog } from "../model/CronLog.js";
import Admin from "../../modules/auth/admin.Model.js";
import { Rent } from "../../modules/rents/rent.Model.js";
import Notification from "../../modules/notifications/notification.model.js";
import { getIO } from "../../config/socket.js";
import handleMonthlyRents from "../../modules/rents/rent.service.js";
import { handleMonthlyCams } from "../../modules/cam/cam.service.js";
import { sendEmailToTenants } from "../../modules/rents/rent.service.js";
import {
  getNepaliMonthDates,
  addNepaliMonths,
} from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const LATE_FEE_PERCENTAGE = 5;

// ─── In-process lock ──────────────────────────────────────────────────────────
// Prevents a second run starting before the first finishes.
// For multi-server deployments replace with a Redis lock (redlock).

let isRunning = false;

// ─── Admin resolver ───────────────────────────────────────────────────────────

/**
 * Fetch all admins who should receive cron notifications at runtime.
 *
 * Industry standard: never hardcode IDs in cron jobs.
 * Query the DB so adding/removing admins requires zero code changes.
 *
 * Adjust the filter to match your Admin schema. Common patterns:
 *   { isActive: true }                                    — all active admins
 *   { isActive: true, role: "super_admin" }               — only super admins
 *   { isActive: true, "notifications.cronAlerts": true }  — opt-in field
 *
 * Falls back to SYSTEM_ADMIN_ID env var if the query returns nothing,
 * so the cron never silently fails during initial setup.
 *
 * @returns {Promise<string[]>} Array of admin ObjectId strings
 */
async function getNotifiableAdmins() {
  const admins = await Admin.find(
    { isActive: true, isDeleted: { $ne: true } }, // ← adjust to your schema
    { _id: 1 }, // only fetch _id, nothing else
  ).lean();

  if (admins.length > 0) {
    return admins.map((a) => a._id.toString());
  }

  // Fallback — useful during initial setup before any admins are seeded
  const fallback = process.env.SYSTEM_ADMIN_ID;
  if (fallback) {
    console.warn(
      "⚠️  No active admins in DB — falling back to SYSTEM_ADMIN_ID env var",
    );
    return [fallback];
  }

  console.error(
    "❌ getNotifiableAdmins: no admins found and SYSTEM_ADMIN_ID is not set",
  );
  return [];
}

/**
 * Emit a notification to ALL notifiable admins.
 * Creates one Notification document per admin (separate audit trail per admin).
 *
 * @param {{ type: string, title: string, message: string, data: Object, adminIds: string[] }} params
 */
async function notifyAdmins({ type, title, message, data, adminIds }) {
  const io = getIO();

  for (const adminId of adminIds) {
    try {
      const notification = await Notification.create({
        admin: adminId,
        type,
        title,
        message,
        data,
      });

      io.to(`admin:${adminId}`).emit("new-notification", {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          isRead: false,
          createdAt: notification.createdAt,
        },
      });
    } catch (err) {
      // One admin failing must not block the rest
      console.error(`   ❌ Failed to notify admin ${adminId}:`, err.message);
    }
  }
}

// ─── Nepali date resolver ─────────────────────────────────────────────────────

function getTodayNepali() {
  const today = new NepaliDate();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1; // 1-based
  const todayYear = today.getYear();
  const lastDayOfMonth = NepaliDate.getDaysOfMonth(todayYear, today.getMonth());
  const reminderDay = lastDayOfMonth - 7; // e.g. 23 of a 30-day month

  return {
    today,
    todayDay,
    todayMonth,
    todayYear,
    lastDayOfMonth,
    reminderDay,
  };
}

// ─── Step 3: Overdue marking ──────────────────────────────────────────────────

async function markOverdueRents() {
  const { today, todayMonth, todayYear } = getTodayNepali();

  const prevNepali = addNepaliMonths(today, -1);
  const prevYear = prevNepali.getYear();
  const prevMonth = prevNepali.getMonth() + 1;

  console.log(
    `  🔴 [3/5] Overdue marking — targeting ${prevYear}-${String(prevMonth).padStart(2, "0")}`,
  );

  const updateResult = await Rent.updateMany(
    { nepaliYear: prevYear, nepaliMonth: prevMonth, status: "pending" },
    { $set: { status: "overdue", overdueMarkedAt: new Date() } },
  );

  const markedCount = updateResult.modifiedCount;
  console.log(`       → ${markedCount} rent(s) marked overdue`);

  if (markedCount === 0) return { marked: 0, lateFeeApplied: 0, errors: [] };

  const overdueRents = await Rent.find({
    nepaliYear: prevYear,
    nepaliMonth: prevMonth,
    status: "overdue",
    lateFeeApplied: { $ne: true },
  }).lean();

  let lateFeeApplied = 0;
  const errors = [];

  for (const rent of overdueRents) {
    try {
      const lateFeeAmountPaisa = Math.round(
        (rent.amountPaisa * LATE_FEE_PERCENTAGE) / 100,
      );
      await Rent.findByIdAndUpdate(rent._id, {
        $set: {
          lateFeeApplied: true,
          lateFeeAmountPaisa,
          lateFeeAppliedAt: new Date(),
          totalDuePaisa: (rent.amountPaisa || 0) + lateFeeAmountPaisa,
        },
      });
      lateFeeApplied++;
    } catch (err) {
      errors.push(`rent ${rent._id}: ${err.message}`);
    }
  }

  return { marked: markedCount, lateFeeApplied, errors };
}

// ─── Step 5: Admin reminder notifications ────────────────────────────────────
// Notifies ADMINS about tenants who haven't paid — NOT a tenant-facing email.
// Tenant email is handled separately in Step 4 via sendEmailToTenants().

async function sendRentReminders(adminIds) {
  const { todayDay, todayMonth, todayYear, lastDayOfMonth } = getTodayNepali();
  const { lastDayNepali } = getNepaliMonthDates();
  const daysLeft = lastDayOfMonth - todayDay;

  console.log(
    `  📣 [5/5] Admin reminders — Nepali day ${todayDay}, ` +
      `due ${lastDayNepali} (${daysLeft}d left), ` +
      `notifying ${adminIds.length} admin(s)`,
  );

  const pendingRents = await Rent.find({
    nepaliYear: todayYear,
    nepaliMonth: todayMonth,
    status: "pending",
  })
    .populate("tenant", "name")
    .lean();

  if (pendingRents.length === 0) {
    console.log("       → No pending rents");
    return { notified: 0, skipped: 0, errors: [] };
  }

  let notified = 0,
    skipped = 0;
  const errors = [];

  for (const rent of pendingRents) {
    try {
      // Idempotency: one existing record for this rent+month = already sent
      const alreadySent = await Notification.exists({
        type: "RENT_REMINDER",
        "data.rentId": rent._id,
        "data.nepaliYear": todayYear,
        "data.nepaliMonth": todayMonth,
      });

      if (alreadySent) {
        skipped++;
        continue;
      }

      const tenantName = rent.tenant?.name ?? "Tenant";
      const message =
        `Reminder: Rent for ${tenantName} (Nepali ${todayYear}-` +
        `${String(todayMonth).padStart(2, "0")}) is still unpaid. ` +
        `Due by ${lastDayNepali} — ${daysLeft} day(s) left. ` +
        `A ${LATE_FEE_PERCENTAGE}% late fee applies after the due date.`;

      await notifyAdmins({
        type: "RENT_REMINDER",
        title: "Rent Due Reminder",
        message,
        adminIds,
        data: {
          rentId: rent._id,
          tenantId: rent.tenant?._id,
          tenantName,
          nepaliYear: todayYear,
          nepaliMonth: todayMonth,
          dueDateNepali: lastDayNepali,
          daysLeft,
        },
      });

      notified++;
    } catch (err) {
      errors.push(`rent ${rent._id}: ${err.message}`);
      console.error(`   ❌ Reminder error (${rent._id}):`, err.message);
    }
  }

  console.log(`       → ${notified} notified, ${skipped} skipped`);
  return { notified, skipped, errors };
}

// ─── Master orchestrator ──────────────────────────────────────────────────────

export async function masterCron({ forceRun = false } = {}) {
  if (isRunning) {
    console.warn("⚠️  Master cron already running — skipping this trigger");
    return;
  }
  isRunning = true;

  const startedAt = new Date();
  const { todayDay, todayMonth, todayYear, lastDayOfMonth, reminderDay } =
    getTodayNepali();

  const isFirstDay = forceRun || todayDay === 1;
  const isReminderDay = forceRun || todayDay === reminderDay;

  console.log(
    `\n${"═".repeat(60)}\n` +
      `⏰ MASTER CRON — Nepali ${todayYear}-${String(todayMonth).padStart(2, "0")}-` +
      `${String(todayDay).padStart(2, "0")}` +
      ` | ${lastDayOfMonth}-day month | reminder: day ${reminderDay}` +
      (forceRun ? " | ⚠️ forceRun" : "") +
      `\n${"═".repeat(60)}`,
  );

  if (!isFirstDay && !isReminderDay) {
    console.log("⏭️  Not a trigger day — exiting\n");
    isRunning = false;
    return;
  }

  // Resolve admins once — shared across all steps that need them
  const adminIds = await getNotifiableAdmins();
  console.log(`👥 Notifiable admins resolved: ${adminIds.length}`);

  try {
    if (isFirstDay) {
      // Step 1 — Create rent documents for all active tenants
      console.log("\n  📄 [1/5] Creating monthly rents...");
      const rentResult = await handleMonthlyRents();
      console.log(`       → ${rentResult.message}`);
      await CronLog.create({
        type: "MONTHLY_RENT",
        ranAt: startedAt,
        message: rentResult.message,
        count: rentResult.count || 0,
        success: rentResult.success,
        error: rentResult.error?.toString() ?? null,
      });

      // Step 2 — Create CAM documents
      console.log("\n  🏢 [2/5] Creating monthly CAMs...");
      const camResult = await handleMonthlyCams();
      console.log(`       → ${camResult.message}`);
      await CronLog.create({
        type: "MONTHLY_CAM",
        ranAt: startedAt,
        message: camResult.message,
        count: camResult.count || 0,
        success: camResult.success,
        error: camResult.error?.toString() ?? null,
      });

      // Step 3 — Mark PREVIOUS month's unpaid rents as overdue + apply late fees
      // Runs after Step 1 so freshly-created rents are never accidentally flagged
      console.log();
      const overdueResult = await markOverdueRents();
      await CronLog.create({
        type: "OVERDUE_MARKING",
        ranAt: startedAt,
        message: `${overdueResult.marked} overdue, ${overdueResult.lateFeeApplied} late fees applied.`,
        count: overdueResult.marked,
        success: true,
        error: overdueResult.errors.length
          ? overdueResult.errors.join(" | ")
          : null,
      });

      // Step 4 — Email TENANTS: "Your rent for this month has been generated, please pay"
      // Runs after Step 1 so the email can reference real Rent document data
      console.log("\n  📧 [4/5] Emailing tenants about new rent charges...");
      const emailResult = await sendEmailToTenants();
      console.log(`       → ${emailResult?.message ?? "done"}`);
      await CronLog.create({
        type: "MONTHLY_EMAIL",
        ranAt: startedAt,
        message: emailResult?.message ?? "Completed",
        count: emailResult?.count || 0,
        success: emailResult?.success ?? true,
        error: emailResult?.error?.toString() ?? null,
      });
    }

    // Step 5 — Notify ADMINS: "These tenants haven't paid yet" (reminder day only)
    if (isReminderDay) {
      console.log();
      const reminderResult = await sendRentReminders(adminIds);
      await CronLog.create({
        type: "RENT_REMINDER",
        ranAt: startedAt,
        message: `${reminderResult.notified} reminder(s) sent to ${adminIds.length} admin(s), ${reminderResult.skipped} skipped.`,
        count: reminderResult.notified,
        success: true,
        error: reminderResult.errors.length
          ? reminderResult.errors.join(" | ")
          : null,
      });
    }

    const elapsed = ((new Date() - startedAt) / 1000).toFixed(2);
    console.log(
      `\n✅ Master cron complete in ${elapsed}s\n${"═".repeat(60)}\n`,
    );
  } catch (err) {
    console.error("❌ Master cron unhandled error:", err);
    await CronLog.create({
      type: "MASTER_CRON",
      ranAt: startedAt,
      message: "Master cron failed",
      count: 0,
      success: false,
      error: err.toString(),
    });
  } finally {
    isRunning = false; // Always release — even if a step throws
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
cron.schedule(
  "0 0 0 * * *",
  async () => {
    await masterCron();
  },
  { timezone: "Asia/Kathmandu", scheduled: true },
);

console.log("✅ Master cron scheduled — daily 00:00 NPT");
console.log(
  "   Day 1:       [1] create rents → [2] create CAMs → [3] mark overdue → [4] email tenants",
);
console.log("   Day (end-7): [5] notify all admins of unpaid rent");
