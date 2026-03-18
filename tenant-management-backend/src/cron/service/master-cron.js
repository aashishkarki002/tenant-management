/**
 * master-cron.js
 *
 * Sequential rent lifecycle orchestrator. Runs daily at 00:00 NPT.
 *
 * ── Step order ────────────────────────────────────────────────────────────────
 *
 *  Day 1 of each Nepali month:
 *    [1]  Create rent documents for all active tenants
 *    [2]  Create CAM documents
 *    [3a] Mark PREVIOUS month's unpaid/partially-paid rents as "overdue"
 *    [3b] Apply / recalculate late fees on all overdue rents  ← every day
 *    [4]  Email tenants about new rent charges
 *
 *  Day (lastDayOfMonth − 7):
 *    [5]  Notify all admins of still-unpaid rents
 *
 *  Every other day:
 *    [3b] Late fee recalculation only (compounding policies grow daily)
 *
 * ── Why [3b] runs every day ───────────────────────────────────────────────────
 *
 *  Flat fee policies: lateFee.cron skips already-charged rents (idempotent).
 *  Compounding policies: the fee grows each day → must recalculate daily.
 *  Running it every day costs one DB query on non-trigger days and is
 *  significantly simpler than scheduling it separately.
 */

import cron from "node-cron";
import NepaliDate from "nepali-datetime";
import { CronLog } from "../model/CronLog.js";
import Admin from "../../modules/auth/admin.Model.js";
import { Rent } from "../../modules/rents/rent.Model.js";
import Notification from "../../modules/notifications/notification.model.js";
import { getIO } from "../../config/socket.js";
import handleMonthlyRents, {
  sendEmailToTenants,
} from "../../modules/rents/rent.service.js";
import { handleMonthlyCams } from "../../modules/cam/cam.service.js";
import { applyLateFees } from "./lateFee.cron.js";
import { applyLoanEmiReminders } from "./loanEmi.cron.js";
import {
  getNepaliMonthDates,
  addNepaliMonths,
  getNepaliToday,
} from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
dotenv.config();

// ─── In-process lock ──────────────────────────────────────────────────────────
// Replace with redlock for multi-instance deployments.
let isRunning = false;

// ─── Admin resolver ───────────────────────────────────────────────────────────

async function getNotifiableAdmins() {
  const admins = await Admin.find(
    { isActive: true, isDeleted: { $ne: true } },
    { _id: 1 },
  ).lean();

  if (admins.length > 0) return admins.map((a) => a._id.toString());

  const fallback = process.env.SYSTEM_ADMIN_ID;
  if (fallback) {
    console.warn(
      "⚠️  No active admins in DB — falling back to SYSTEM_ADMIN_ID",
    );
    return [fallback];
  }

  console.error(
    "❌ getNotifiableAdmins: no admins found and SYSTEM_ADMIN_ID not set",
  );
  return [];
}

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
      console.error(`   ❌ Failed to notify admin ${adminId}:`, err.message);
    }
  }
}

// ─── Nepali today ─────────────────────────────────────────────────────────────

function getTodayNepali() {
  const { npToday, bsYear, bsMonth, bsDay } = getNepaliToday();
  const lastDayOfMonth = NepaliDate.getDaysOfMonth(bsYear, npToday.getMonth());
  const reminderDay = lastDayOfMonth - 7;
  return {
    today: npToday,
    todayDay: bsDay,
    todayMonth: bsMonth,
    todayYear: bsYear,
    lastDayOfMonth,
    reminderDay,
  };
}

// ─── Step 3a: Mark overdue ────────────────────────────────────────────────────

async function markOverdueRents(today) {
  const prevNepali = addNepaliMonths(today, -1);
  const prevYear = prevNepali.getYear();
  const prevMonth = prevNepali.getMonth() + 1;

  console.log(
    `  🔴 [3a] Overdue marking — ` +
      `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
  );

  const result = await Rent.updateMany(
    {
      nepaliYear: prevYear,
      nepaliMonth: prevMonth,
      // Both pending AND partially_paid become overdue if month has turned
      status: { $in: ["pending", "partially_paid"] },
    },
    { $set: { status: "overdue", overdueMarkedAt: new Date() } },
  );

  console.log(`       → ${result.modifiedCount} rent(s) marked overdue`);
  return { marked: result.modifiedCount };
}

// ─── Step 5: Admin reminders ──────────────────────────────────────────────────

async function sendRentReminders(adminIds) {
  const { todayDay, todayMonth, todayYear, lastDayOfMonth } = getTodayNepali();
  const { lastDayNepali } = getNepaliMonthDates();
  const daysLeft = lastDayOfMonth - todayDay;

  console.log(
    `  📣 [5] Admin reminders — day ${todayDay}, ` +
      `${daysLeft}d left, ${adminIds.length} admin(s)`,
  );

  const pendingRents = await Rent.find({
    nepaliYear: todayYear,
    nepaliMonth: todayMonth,
    status: { $in: ["pending", "partially_paid"] },
  })
    .populate("tenant", "name")
    .lean();

  if (!pendingRents.length) {
    console.log("       → No pending rents");
    return { notified: 0, skipped: 0, errors: [] };
  }

  let notified = 0,
    skipped = 0;
  const errors = [];

  for (const rent of pendingRents) {
    try {
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

      await notifyAdmins({
        type: "RENT_REMINDER",
        title: "Rent Due Reminder",
        message:
          `${tenantName}'s rent for ${todayYear}-${String(todayMonth).padStart(2, "0")} ` +
          `is unpaid. Due by ${lastDayNepali} (${daysLeft}d left).`,
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
    }
  }

  console.log(`       → ${notified} notified, ${skipped} skipped`);
  return { notified, skipped, errors };
}

// ─── Master orchestrator ──────────────────────────────────────────────────────

export async function masterCron({ forceRun = false } = {}) {
  if (isRunning) {
    console.warn("⚠️  Master cron already running — skipping");
    return;
  }
  isRunning = true;

  const startedAt = new Date();
  const {
    today,
    todayDay,
    todayMonth,
    todayYear,
    lastDayOfMonth,
    reminderDay,
  } = getTodayNepali();

  const isFirstDay = forceRun || todayDay === 1;
  const isReminderDay = forceRun || todayDay === reminderDay;

  console.log(
    `\n${"═".repeat(64)}\n` +
      `⏰ MASTER CRON  ${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")} (Nepali)` +
      `  |  ${lastDayOfMonth}-day month  |  reminder: day ${reminderDay}` +
      (forceRun ? "  |  ⚠️ forceRun" : "") +
      `\n${"═".repeat(64)}`,
  );

  const adminIds = await getNotifiableAdmins();
  console.log(`👥 Admins: ${adminIds.length}`);

  try {
    // ── Day-1 steps ─────────────────────────────────────────────────────────
    if (isFirstDay) {
      // [1] Create rent documents
      console.log("\n  📄 [1] Creating monthly rents...");
      const rentResult = await handleMonthlyRents();
      console.log(`       → ${rentResult.message}`);
      await CronLog.create({
        type: "MONTHLY_RENT",
        ranAt: startedAt,
        message: rentResult.message,
        count: rentResult.createdCount || 0,
        success: rentResult.success,
        error: rentResult.error?.toString() ?? null,
      });

      // [2] Create CAM documents
      console.log("\n  🏢 [2] Creating monthly CAMs...");
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

      // [3a] Mark previous month overdue
      // Must run before [3b] so newly-marked rents are included in the fee query
      console.log();
      const overdueResult = await markOverdueRents(today);
      await CronLog.create({
        type: "OVERDUE_MARKING",
        ranAt: startedAt,
        message: `${overdueResult.marked} rent(s) marked overdue`,
        count: overdueResult.marked,
        success: true,
        error: null,
      });

      // [4] Email tenants
      // Runs after [3a] so the email reflects the correct status
      console.log("\n  📧 [4] Emailing tenants...");
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

    // ── [3b] Late fees — runs EVERY day ──────────────────────────────────────
    // Flat policies: no-op on non-first days (lateFeeApplied guard inside cron)
    // Compounding policies: recalculates and posts delta journal daily
    console.log("\n  💸 [3b] Late fee run...");
    const lateFeeResult = await applyLateFees(adminIds[0] ?? null);

    // Only write CronLog if something happened (avoid log spam on quiet days)
    if (lateFeeResult.processed > 0 || lateFeeResult.failed > 0) {
      await CronLog.create({
        type: "LATE_FEE_APPLICATION",
        ranAt: startedAt,
        message: lateFeeResult.message,
        count: lateFeeResult.processed,
        success: lateFeeResult.failed === 0,
        error: lateFeeResult.errors?.length
          ? lateFeeResult.errors
              .map((e) => `${e.rentId}: ${e.error}`)
              .join(" | ")
          : null,
      });
    }

    // Notify admins if fees were charged today
    if (lateFeeResult.processed > 0 && adminIds.length > 0) {
      await notifyAdmins({
        type: "LATE_FEE_APPLIED",
        title: "Late Fees Applied",
        message:
          `${lateFeeResult.processed} late fee(s) applied — ` +
          `Rs${(lateFeeResult.totalDeltaFeePaisa / 100).toFixed(2)} total.`,
        adminIds,
        data: {
          processed: lateFeeResult.processed,
          totalDeltaFeePaisa: lateFeeResult.totalDeltaFeePaisa,
          nepaliYear: todayYear,
          nepaliMonth: todayMonth,
          failed: lateFeeResult.failed ?? 0,
        },
      });
    }
    console.log("\n  🏦 [6] Loan EMI reminder run...");
    const loanEmiResult = await applyLoanEmiReminders(adminIds); // ← ADD

    if (loanEmiResult.processed > 0 || loanEmiResult.failed > 0) {
      await CronLog.create({
        type: "LOAN_EMI_REMINDER",
        ranAt: startedAt,
        message: loanEmiResult.message,
        count: loanEmiResult.processed,
        success: loanEmiResult.failed === 0,
        error: loanEmiResult.errors?.length
          ? loanEmiResult.errors
              .map((e) => `${e.loanId}: ${e.error}`)
              .join(" | ")
          : null,
      });
    }

    // ── [5] Admin reminders (reminder day only) ───────────────────────────────
    if (isReminderDay) {
      console.log();
      const reminderResult = await sendRentReminders(adminIds);
      await CronLog.create({
        type: "RENT_REMINDER",
        ranAt: startedAt,
        message:
          `${reminderResult.notified} sent to ${adminIds.length} admin(s), ` +
          `${reminderResult.skipped} skipped`,
        count: reminderResult.notified,
        success: true,
        error: reminderResult.errors.length
          ? reminderResult.errors.join(" | ")
          : null,
      });
    }

    const elapsed = ((new Date() - startedAt) / 1000).toFixed(2);
    console.log(`\n✅ Master cron done in ${elapsed}s\n${"═".repeat(64)}\n`);
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
    isRunning = false;
  }
}

// ─── Schedule: daily 00:00 NPT ────────────────────────────────────────────────
cron.schedule(
  "0 0 0 * * *",
  async () => {
    await masterCron();
  },
  { timezone: "Asia/Kathmandu", scheduled: true },
);

console.log("✅ Master cron scheduled — daily 00:00 NPT");
console.log(
  "   Day 1:       [1] rents → [2] CAMs → [3a] mark overdue → [4] email tenants",
);
console.log(
  "   Every day:   [3b] late fees (flat: once; compounding: daily delta)",
);
console.log("   Day (end-7): [5] admin reminders");
