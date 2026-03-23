/**
 * dailyChecklist.cron.js  (v2 — Template + Result split)
 *
 * The cron no longer builds section/item trees every morning.
 * Instead it:
 *   1. Fetches all active ChecklistTemplate documents
 *   2. Calls createResult(templateId, dateData, systemAdminId) for each one
 *      — createResult is idempotent, so re-runs are safe
 *   3. Drives the same three timed notification steps as before
 *
 * Net effect: each daily document is ~300–800 bytes instead of 8–15 KB.
 * The section/item tree lives in ChecklistTemplate, created once, reused forever.
 *
 * ── Schedule (unchanged) ──────────────────────────────────────────────────────
 *   07:30  Create results + morning push to staff
 *   10:30  Mid-morning escalation if any result is still PENDING
 *   16:30  End-of-day warning to admins if any result is PENDING / IN_PROGRESS
 *
 * ── Integration ───────────────────────────────────────────────────────────────
 *   import { scheduleDailyChecklistCron } from "./cron/dailyChecklist.cron.js";
 *   scheduleDailyChecklistCron();   // call once after DB connect
 */

import cron from "node-cron";
import Admin from "../../modules/auth/admin.Model.js";
import { ChecklistTemplate } from "../../modules/dailyChecks/checkListTemplate.model.js";
import { ChecklistResult } from "../../modules/dailyChecks/checkListResult.model.js";
import Notification from "../../modules/notifications/notification.model.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import { getIO } from "../../config/socket.js";
import { CronLog } from "../model/CronLog.js";
import {
  getNepaliToday,
  getNepaliYearMonthFromDate,
  formatNepaliISO,
} from "../../utils/nepaliDateHelper.js";
import { createResult } from "../../modules/dailyChecks/dailyChecksList.service.js";

// ─── Notification type keys ───────────────────────────────────────────────────

const NOTIF = {
  MORNING: "DAILY_CHECKLIST_MORNING",
  ESCALATION: "DAILY_CHECKLIST_ESCALATION",
  EOD_WARNING: "DAILY_CHECKLIST_EOD_WARNING",
};

// ─── Today meta builder ───────────────────────────────────────────────────────

function buildTodayMeta() {
  // getNepaliToday() returns englishToday (UTC midnight, Nepal calendar day),
  // npToday (NepaliDate instance), bsYear, bsMonth (1-based), bsDay.
  // Use englishToday from here — NOT new Date() — so day boundaries are
  // always correct regardless of server timezone.
  const { englishToday, npToday, bsYear, bsMonth, bsDay } = getNepaliToday();

  // formatNepaliISO expects a NepaliDate instance, NOT raw year/month/day numbers.
  const bsDate = formatNepaliISO(npToday);

  return { englishToday, bsYear, bsMonth, bsDay, bsDate };
}

// ─── Admin / staff resolvers ──────────────────────────────────────────────────

async function resolveAdminIds(scope = "all") {
  const roleFilter =
    scope === "staff_only"
      ? { role: { $in: ["staff"] } }
      : scope === "admin_only"
        ? { role: { $in: ["admin", "super_admin"] } }
        : { role: { $in: ["staff", "admin", "super_admin"] } };

  const admins = await Admin.find(
    { isActive: true, isDeleted: { $ne: true }, ...roleFilter },
    { _id: 1 },
  ).lean();

  let ids = admins.map((a) => a._id.toString());
  if (!ids.length && process.env.SYSTEM_ADMIN_ID) {
    ids = [process.env.SYSTEM_ADMIN_ID];
  }
  return ids;
}

// ─── Notify + push helpers ────────────────────────────────────────────────────

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
          `[dailyChecklist.cron] push failed for admin ${id}:`,
          err.message,
        );
      }
    }),
  );
  return { sent, failed };
}

async function alreadyNotified(resultId, notifType, bsDate) {
  return Notification.exists({
    type: notifType,
    "data.resultId": resultId.toString(),
    "data.bsDate": bsDate,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP A — 07:30 NPT: Create results + morning push to staff
// ─────────────────────────────────────────────────────────────────────────────

export async function createAndNotifyMorning() {
  const startedAt = new Date();
  const { englishToday, bsYear, bsMonth, bsDay, bsDate } = buildTodayMeta();

  console.log(
    `\n  🌅 [dailyChecklist.cron] 07:30 — creating results for ${bsDate} BS...`,
  );

  const systemAdminId =
    process.env.SYSTEM_ADMIN_ID ??
    (
      await Admin.findOne({ role: "super_admin", isActive: true })
        .select("_id")
        .lean()
    )?._id?.toString();

  if (!systemAdminId) {
    console.error("   ❌ No system admin found — cannot create results");
    return;
  }

  // ── Fetch all active templates ────────────────────────────────────────────
  // Only DAILY type templates are created by this morning cron.
  // WEEKLY / MONTHLY templates are handled by separate logic or manual triggers.
  const templates = await ChecklistTemplate.find({
    isActive: true,
    checklistType: "DAILY",
  })
    .populate("property", "name")
    .populate("block", "name")
    .lean();

  if (!templates.length) {
    console.log("   → No active DAILY templates found — skipping");
    await CronLog.create({
      type: "DAILY_CHECKLIST_CREATION",
      ranAt: startedAt,
      message: "No active DAILY templates found",
      count: 0,
      success: true,
      error: null,
    }).catch(() => {});
    return;
  }

  console.log(`   → Found ${templates.length} active template(s)`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const createdResults = [];

  for (const template of templates) {
    try {
      const outcome = await createResult(
        template._id.toString(),
        {
          checkDate: englishToday,
          nepaliYear: bsYear,
          nepaliMonth: bsMonth,
          nepaliDate: bsDate,
        },
        systemAdminId,
      );

      if (outcome.alreadyExisted) {
        skipped++;
      } else if (outcome.success) {
        created++;
        createdResults.push({ result: outcome.data, template });
      } else {
        failed++;
        console.warn(
          `   ⚠️  Could not create result for template ${template._id}: ${outcome.message}`,
        );
      }
    } catch (err) {
      failed++;
      console.error(
        `   ❌ Error creating result for template ${template._id}:`,
        err.message,
      );
    }
  }

  console.log(
    `   → Created: ${created}, Already existed: ${skipped}, Failed: ${failed}`,
  );

  // ── Morning push to staff ─────────────────────────────────────────────────
  if (created > 0 || skipped > 0) {
    const staffIds = await resolveAdminIds("staff_only");
    const allIds = await resolveAdminIds("all");

    const totalPending = created + skipped;
    const pushBody =
      totalPending === 1
        ? `${templates[0].category} check for ${templates[0].property?.name ?? "the property"} is ready.`
        : `${totalPending} daily checklist(s) are ready for today.`;

    const { sent, pushFailed } = await pushToMany(
      staffIds.length ? staffIds : allIds,
      {
        title: "🔔 Daily Checklists Ready",
        body: pushBody,
        data: { type: NOTIF.MORNING, bsDate },
      },
    );

    // In-app notifications (one per result so each has its own checklistId link)
    for (const { result, template } of createdResults) {
      await notifyAdmins({
        type: NOTIF.MORNING,
        title: "📋 Daily Check Ready",
        message: `${template.category} checklist for ${template.property?.name ?? "property"} (${template.block?.name ?? "all blocks"}) is ready.`,
        adminIds: staffIds.length ? staffIds : allIds,
        data: {
          resultId: result._id.toString(),
          templateId: template._id.toString(),
          category: template.category,
          propertyName: template.property?.name ?? "",
          bsDate,
          bsYear,
          bsMonth,
        },
      });
    }

    const message =
      `Morning creation: ${created} created, ${skipped} already existed, ` +
      `${failed} failed, ${sent} push(es) sent`;
    console.log(`   → ${message}`);

    await CronLog.create({
      type: "DAILY_CHECKLIST_CREATION",
      ranAt: startedAt,
      message,
      count: created,
      success: failed === 0,
      error: failed > 0 ? `${failed} result(s) failed to create` : null,
    }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP B — 10:30 NPT: Mid-morning escalation (staff + admins)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendMidMorningEscalation() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(
    `\n  ⚠️  [dailyChecklist.cron] 10:30 — mid-morning escalation (${bsDate} BS)...`,
  );

  const startOfDay = new Date(englishToday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setHours(23, 59, 59, 999);

  const pendingResults = await ChecklistResult.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: "PENDING",
  })
    .populate("property", "name")
    .lean();

  if (!pendingResults.length) {
    console.log("   → All checklists started — no escalation needed");
    return;
  }

  console.log(`   → ${pendingResults.length} PENDING result(s) found`);

  const allIds = await resolveAdminIds("all");
  if (!allIds.length) return;

  const summary = [...new Set(pendingResults.map((r) => r.category))].join(
    ", ",
  );

  let escalated = 0;
  let escalationSkipped = 0;

  for (const result of pendingResults) {
    const already = await alreadyNotified(result._id, NOTIF.ESCALATION, bsDate);
    if (already) {
      escalationSkipped++;
      continue;
    }

    const propName = result.property?.name ?? "Unknown Property";

    await notifyAdmins({
      type: NOTIF.ESCALATION,
      title: "⚠️ Daily Check Pending",
      message: `${result.category} checklist for ${propName} hasn't been started yet.`,
      adminIds: allIds,
      data: {
        resultId: result._id.toString(),
        category: result.category,
        propertyName: propName,
        bsDate,
        bsYear,
        bsMonth,
      },
    });

    escalated++;
  }

  if (escalated > 0) {
    const { sent, failed } = await pushToMany(allIds, {
      title: "⚠️ Daily Checks Pending",
      body:
        pendingResults.length === 1
          ? `${pendingResults[0].category} check for ${pendingResults[0].property?.name ?? "a property"} hasn't started yet.`
          : `${pendingResults.length} checklist(s) still pending: ${summary}`,
      data: {
        type: NOTIF.ESCALATION,
        bsDate,
        pendingCount: pendingResults.length,
      },
    });

    const message =
      `Mid-morning escalation: ${escalated} escalated, ` +
      `${escalationSkipped} already notified, ${sent} push(es) sent, ${failed} failed`;
    console.log(`   → ${message}`);

    await CronLog.create({
      type: "DAILY_CHECKLIST_ESCALATION",
      ranAt: startedAt,
      message,
      count: escalated,
      success: failed === 0,
      error: failed > 0 ? `${failed} push(es) failed` : null,
    }).catch(() => {});
  } else {
    console.log(
      `   → All ${escalationSkipped} escalation(s) already sent for today`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP C — 16:30 NPT: End-of-day warning (admins only)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEndOfDayWarning() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(
    `\n  🚨 [dailyChecklist.cron] 16:30 — end-of-day warning (${bsDate} BS)...`,
  );

  const startOfDay = new Date(englishToday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setHours(23, 59, 59, 999);

  const incompleteResults = await ChecklistResult.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .populate("property", "name")
    .lean();

  if (!incompleteResults.length) {
    console.log("   → All checklists completed — no end-of-day warning");
    await CronLog.create({
      type: "DAILY_CHECKLIST_EOD_WARNING",
      ranAt: startedAt,
      message: "All checklists completed — no warning needed",
      count: 0,
      success: true,
      error: null,
    }).catch(() => {});
    return;
  }

  const pending = incompleteResults.filter((r) => r.status === "PENDING");
  const inProgress = incompleteResults.filter(
    (r) => r.status === "IN_PROGRESS",
  );
  console.log(
    `   → ${pending.length} PENDING, ${inProgress.length} IN_PROGRESS`,
  );

  const adminIds = await resolveAdminIds("admin_only");
  if (!adminIds.length) {
    console.log("   → No active admins — skipping end-of-day warning");
    return;
  }

  let warned = 0;
  let warningSkipped = 0;

  for (const result of incompleteResults) {
    const already = await alreadyNotified(
      result._id,
      NOTIF.EOD_WARNING,
      bsDate,
    );
    if (already) {
      warningSkipped++;
      continue;
    }

    const propName = result.property?.name ?? "Unknown Property";
    const statusLabel =
      result.status === "PENDING" ? "not started" : "still in progress";

    await notifyAdmins({
      type: NOTIF.EOD_WARNING,
      title: "🚨 Checklist Incomplete",
      message: `${result.category} check for ${propName} is ${statusLabel} at 16:30.`,
      adminIds,
      data: {
        resultId: result._id.toString(),
        category: result.category,
        status: result.status,
        propertyName: propName,
        bsDate,
        bsYear,
        bsMonth,
      },
    });

    warned++;
  }

  if (warned > 0) {
    const pushBody =
      incompleteResults.length === 1
        ? `${incompleteResults[0].category} check for ${incompleteResults[0].property?.name ?? "a property"} is incomplete.`
        : `${pending.length} unstarted, ${inProgress.length} in-progress checklist(s) need attention.`;

    const { sent, failed } = await pushToMany(adminIds, {
      title: "🚨 Incomplete Daily Checks",
      body: pushBody,
      data: {
        type: NOTIF.EOD_WARNING,
        bsDate,
        pendingCount: pending.length,
        inProgressCount: inProgress.length,
      },
    });

    const message =
      `EOD warning: ${warned} alert(s) sent, ${warningSkipped} already sent, ` +
      `${sent} push(es), ${failed} push failure(s)`;
    console.log(`   → ${message}`);

    await CronLog.create({
      type: "DAILY_CHECKLIST_EOD_WARNING",
      ranAt: startedAt,
      message,
      count: warned,
      success: failed === 0,
      error: failed > 0 ? `${failed} push(es) failed` : null,
    }).catch(() => {});
  } else {
    console.log(`   → All ${warningSkipped} warning(s) already sent for today`);
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleDailyChecklistCron() {
  cron.schedule("30 7 * * *", createAndNotifyMorning, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  cron.schedule("30 10 * * *", sendMidMorningEscalation, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  cron.schedule("30 16 * * *", sendEndOfDayWarning, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  console.log("✅ Daily checklist cron scheduled (Asia/Kathmandu):");
  console.log("   07:30 — create results from templates + morning push");
  console.log("   10:30 — mid-morning escalation if any PENDING");
  console.log("   16:30 — end-of-day warning to admins if any incomplete");
}
