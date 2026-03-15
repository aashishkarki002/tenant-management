/**
 * loanEmi.cron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reminds property owners / admins about upcoming and overdue loan EMI payments.
 *
 * ── Schedule (NPT) ────────────────────────────────────────────────────────────
 *
 *   Runs daily at 08:00 NPT (after midnight DB jobs, before staff arrive).
 *   Wired into master-cron.js as step [6] so it shares the same session,
 *   admin list, and CronLog pattern as the rest of the pipeline.
 *
 * ── Notification tiers ────────────────────────────────────────────────────────
 *
 *   7 days before EMI due   → gentle reminder to all admins
 *   3 days before EMI due   → urgent reminder to all admins
 *   On due date (day 0)     → "due today" alert
 *   Past due (overdue)      → daily escalation until paid; marks loan OVERDUE_EMI
 *
 * ── How "due date" is calculated ─────────────────────────────────────────────
 *
 *   loan.firstEmiDate + (installmentsPaid × 1 month) = next EMI date.
 *   If firstEmiDate is null, falls back to disbursedDate + 1 month.
 *   All comparisons are done in English calendar days (the EMI date is
 *   stored in English format on the Loan document).
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *
 *   One Notification document per (loan._id, tier, nepaliMonth, nepaliYear).
 *   Re-runs on the same day are silent no-ops.
 *
 * ── Integration ───────────────────────────────────────────────────────────────
 *
 *   Called from master-cron.js step [6]:
 *     const loanResult = await applyLoanEmiReminders(adminIds);
 *
 *   OR scheduled standalone (if not using master-cron):
 *     scheduleLoanEmiCron();
 */

import cron from "node-cron";
import NepaliDate from "nepali-datetime";
import { Loan } from "../../modules/loans/Loan.model.js";
import { CronLog } from "../model/CronLog.js";
import Notification from "../../modules/notifications/notification.model.js";
import { getIO } from "../../config/socket.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import Admin from "../../modules/auth/admin.Model.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const REMINDER_TIERS = [
  { daysAhead: 7, label: "7-day", urgency: "info" },
  { daysAhead: 3, label: "3-day", urgency: "warning" },
  { daysAhead: 0, label: "due", urgency: "urgent" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Add N calendar months to a JS Date.
 * Handles month overflow (e.g. Jan 31 + 1 month = Feb 28/29).
 */
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // If overflow, pin to last day of target month
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * Difference in calendar days between two JS Dates (b − a), ignoring time.
 */
function diffDays(a, b) {
  const msPerDay = 86_400_000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / msPerDay);
}

/**
 * Returns the next EMI due date for a loan (JS Date, time-zeroed).
 *   base = firstEmiDate ?? (disbursedDate + 1 month)
 *   next = base + installmentsPaid months
 */
function getNextEmiDate(loan) {
  const base = loan.firstEmiDate
    ? new Date(loan.firstEmiDate)
    : addMonths(new Date(loan.disbursedDate), 1);

  const next = addMonths(base, loan.installmentsPaid);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Emit a socket notification + persist a Notification document.
 * Mirrors the notifyAdmins() pattern from master-cron.js.
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
      console.error(`   ❌ Failed to notify admin ${adminId}:`, err.message);
    }
  }
}

/**
 * Fire push notifications to a list of admin IDs.
 * Mirrors pushToMany() from generator.cron.js.
 */
async function pushToMany(adminIds, payload) {
  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    adminIds.map(async (id) => {
      try {
        await sendPushToAdmin(id, payload);
        sent++;
      } catch (err) {
        failed++;
        console.error(
          `[loanEmi.cron] push failed for admin ${id}:`,
          err.message,
        );
      }
    }),
  );
  return { sent, failed };
}

/**
 * Check idempotency: has this exact tier notification already been sent
 * for this loan in the current Nepali month/year?
 */
async function alreadyNotified(loanId, tier, nepaliYear, nepaliMonth) {
  return Notification.exists({
    type: "LOAN_EMI_REMINDER",
    "data.loanId": loanId.toString(),
    "data.tier": tier,
    "data.nepaliYear": nepaliYear,
    "data.nepaliMonth": nepaliMonth,
  });
}

// ─── Per-loan processor ───────────────────────────────────────────────────────

/**
 * Evaluate a single ACTIVE loan and send the appropriate reminder if due.
 *
 * @param {Object}   loan       — lean Loan document (populated: property)
 * @param {string[]} adminIds
 * @param {Object}   todayMeta  — { today, nepaliYear, nepaliMonth }
 * @returns {{ notified: boolean, tier: string|null, daysAhead: number }}
 */
async function processOneLoan(
  loan,
  adminIds,
  { today, nepaliYear, nepaliMonth },
) {
  // No remaining installments
  if (loan.installmentsPaid >= loan.tenureMonths) {
    return {
      notified: false,
      tier: null,
      daysAhead: null,
      reason: "fully paid",
    };
  }

  const nextEmiDate = getNextEmiDate(loan);
  const daysAhead = diffDays(today, nextEmiDate); // negative = overdue

  const propertyName = loan.property?.name ?? "your property";
  const loanLabel = `${loan.lender} (${loan.loanType})`;
  const installmentsLeft = loan.tenureMonths - loan.installmentsPaid;
  const emiRupees = (loan.emiPaisa / 100).toLocaleString("en-NP");

  // ── Overdue EMI (past due date) ────────────────────────────────────────────
  if (daysAhead < 0) {
    const overdueDays = Math.abs(daysAhead);
    const tier = `overdue_${overdueDays}`; // unique per overdue day → daily escalation

    // Only send once per overdue day
    const sent = await alreadyNotified(loan._id, tier, nepaliYear, nepaliMonth);
    if (sent)
      return {
        notified: false,
        tier,
        daysAhead,
        reason: "already notified today",
      };

    const title = "🚨 Loan EMI Overdue";
    const message =
      `EMI for ${loanLabel} on ${propertyName} is ${overdueDays} day(s) overdue. ` +
      `Rs ${emiRupees} unpaid. ${installmentsLeft} installment(s) remaining.`;

    await notifyAdmins({
      type: "LOAN_EMI_REMINDER",
      title,
      message,
      adminIds,
      data: {
        loanId: loan._id.toString(),
        tier,
        daysAhead,
        nepaliYear,
        nepaliMonth,
        emiPaisa: loan.emiPaisa,
        installmentsLeft,
        lender: loan.lender,
        propertyName,
        nextEmiDate,
      },
    });

    await pushToMany(adminIds, {
      title,
      body: message,
      data: { type: "LOAN_EMI_OVERDUE", loanId: loan._id.toString() },
    });

    return { notified: true, tier, daysAhead };
  }

  // ── Upcoming EMI — match against reminder tiers ────────────────────────────
  const matchedTier = REMINDER_TIERS.find((t) => t.daysAhead === daysAhead);
  if (!matchedTier) {
    return {
      notified: false,
      tier: null,
      daysAhead,
      reason: "not a reminder day",
    };
  }

  const tierKey = matchedTier.label;
  const sent = await alreadyNotified(
    loan._id,
    tierKey,
    nepaliYear,
    nepaliMonth,
  );
  if (sent)
    return {
      notified: false,
      tier: tierKey,
      daysAhead,
      reason: "already notified",
    };

  let title, message;
  if (daysAhead === 0) {
    title = "📅 Loan EMI Due Today";
    message =
      `EMI for ${loanLabel} on ${propertyName} is due TODAY. ` +
      `Rs ${emiRupees} due. ${installmentsLeft} installment(s) remaining.`;
  } else {
    title = daysAhead <= 3 ? "⚠️ Loan EMI Due Soon" : "💡 Upcoming Loan EMI";
    message =
      `EMI for ${loanLabel} on ${propertyName} is due in ${daysAhead} day(s). ` +
      `Rs ${emiRupees} due on ${nextEmiDate.toDateString()}. ` +
      `${installmentsLeft} installment(s) remaining.`;
  }

  await notifyAdmins({
    type: "LOAN_EMI_REMINDER",
    title,
    message,
    adminIds,
    data: {
      loanId: loan._id.toString(),
      tier: tierKey,
      daysAhead,
      nepaliYear,
      nepaliMonth,
      emiPaisa: loan.emiPaisa,
      installmentsLeft,
      lender: loan.lender,
      propertyName,
      nextEmiDate,
    },
  });

  await pushToMany(adminIds, {
    title,
    body: message,
    data: { type: "LOAN_EMI_REMINDER", loanId: loan._id.toString() },
  });

  return { notified: true, tier: tierKey, daysAhead };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Scan all active loans and send EMI reminders where applicable.
 * Called from master-cron.js step [6] or standalone scheduler below.
 *
 * @param {string[]} [adminIds]  — reuse list from master-cron; fetched fresh if omitted
 * @returns {Promise<CronResult>}
 */
export async function applyLoanEmiReminders(adminIds) {
  const startedAt = new Date();
  console.log("\n  🏦 [loanEmi.cron] Starting EMI reminder run...");

  // ── Resolve admins ──────────────────────────────────────────────────────────
  let resolvedAdminIds = adminIds;
  if (!resolvedAdminIds?.length) {
    const admins = await Admin.find(
      { isActive: true, isDeleted: { $ne: true } },
      { _id: 1 },
    ).lean();
    resolvedAdminIds = admins.map((a) => a._id.toString());

    if (!resolvedAdminIds.length && process.env.SYSTEM_ADMIN_ID) {
      resolvedAdminIds = [process.env.SYSTEM_ADMIN_ID];
    }
  }

  if (!resolvedAdminIds.length) {
    console.log("       → No admins found — skipping");
    return {
      success: true,
      message: "No admins — skipped",
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  // ── Nepali today ────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nd = new NepaliDate(today);
  const nepaliYear = nd.getYear();
  const nepaliMonth = nd.getMonth() + 1;
  const todayMeta = { today, nepaliYear, nepaliMonth };

  // ── Load active loans ───────────────────────────────────────────────────────
  const loans = await Loan.find({ status: "ACTIVE" })
    .populate("property", "name")
    .lean();

  if (!loans.length) {
    console.log("       → No active loans");
    return {
      success: true,
      message: "No active loans",
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  console.log(`       → ${loans.length} active loan(s) found`);

  // ── Process each loan ───────────────────────────────────────────────────────
  let processed = 0,
    skipped = 0,
    failed = 0;
  const errors = [];

  for (const loan of loans) {
    try {
      const result = await processOneLoan(loan, resolvedAdminIds, todayMeta);
      if (result.notified) {
        processed++;
        console.log(
          `       ✓ ${loan.lender} [${loan._id}] — tier: ${result.tier}, ` +
            `daysAhead: ${result.daysAhead}`,
        );
      } else {
        skipped++;
        console.log(`       ↷ Skipped ${loan._id}: ${result.reason}`);
      }
    } catch (err) {
      failed++;
      errors.push({ loanId: loan._id.toString(), error: err.message });
      console.error(`       ✗ Failed ${loan._id}:`, err.message);
    }
  }

  const message = `Loan EMI reminders: ${processed} sent, ${skipped} skipped, ${failed} failed`;
  console.log(`       → ${message}`);

  // ── CronLog (only if something happened) ───────────────────────────────────
  if (processed > 0 || failed > 0) {
    await CronLog.create({
      type: "LOAN_EMI_REMINDER",
      ranAt: startedAt,
      message,
      count: processed,
      success: failed === 0,
      error: errors.length
        ? errors.map((e) => `${e.loanId}: ${e.error}`).join(" | ")
        : null,
    }).catch((e) =>
      console.error("[loanEmi.cron] CronLog write failed:", e.message),
    );
  }

  return {
    success: true,
    message,
    processed,
    skipped,
    failed,
    errors: errors.length ? errors : undefined,
  };
}

// ─── Standalone scheduler (only if NOT using master-cron) ─────────────────────

/**
 * Call once at app startup ONLY if you are NOT running master-cron.js.
 * If master-cron.js is active, add applyLoanEmiReminders() as step [6] there instead.
 *
 * @example
 * import { scheduleLoanEmiCron } from "./cron/loanEmi.cron.js";
 * scheduleLoanEmiCron();
 */
export function scheduleLoanEmiCron() {
  cron.schedule(
    "0 8 * * *", // 08:00 NPT daily
    async () => {
      await applyLoanEmiReminders();
    },
    { timezone: "Asia/Kathmandu", scheduled: true },
  );

  console.log("✅ Loan EMI reminder cron scheduled — 08:00 NPT daily");
  console.log(
    "   Tiers: 7-day info · 3-day warning · due-today urgent · daily overdue escalation",
  );
}
