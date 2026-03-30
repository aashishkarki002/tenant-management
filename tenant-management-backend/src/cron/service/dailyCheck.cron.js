import cron from "node-cron";
import Admin from "../../modules/auth/admin.Model.js";
import { ChecklistTemplate } from "../../modules/dailyChecks/checkListTemplate.model.js";
import { ChecklistResult } from "../../modules/dailyChecks/checkListResult.model.js";
import Notification, {
  NOTIFICATION_TYPES,
} from "../../modules/notifications/notification.model.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import { getIO } from "../../config/socket.js";
import { CronLog } from "../model/CronLog.js";
import {
  getNepaliToday,
  formatNepaliISO,
} from "../../utils/nepaliDateHelper.js";
import { createResult } from "../../modules/dailyChecks/dailyChecksList.service.js";

// ─── Notification type keys ────────────────────────────────────────────────
const NOTIF = {
  MORNING: "DAILY_CHECKLIST_MORNING",
  ESCALATION: "DAILY_CHECKLIST_ESCALATION",
  EOD_WARNING: "DAILY_CHECKLIST_EOD_WARNING",
};

for (const v of Object.values(NOTIF)) {
  if (!NOTIFICATION_TYPES.includes(v)) {
    throw new Error(
      `[dailyCheck.cron] Notification type "${v}" is not listed in NOTIFICATION_TYPES`,
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Build today meta
function buildTodayMeta() {
  const { englishToday, npToday, bsYear, bsMonth, bsDay } = getNepaliToday();
  const bsDate = formatNepaliISO(npToday);
  return { englishToday, bsYear, bsMonth, bsDay, bsDate };
}

// Resolve admin/staff IDs
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

  return [...new Set(ids)];
}

// Notify admins (aggregated)
async function notifyAdminsAggregated(adminIds, title, message, data) {
  const io = getIO();
  const promises = adminIds.map(async (adminId) => {
    try {
      const notification = await Notification.create({
        admin: adminId,
        type: data.type,
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
      console.error(`Failed to notify admin ${adminId}:`, err.message);
    }
  });

  await Promise.allSettled(promises);
}

// Push notifications to many admins
async function pushToMany(adminIds, payload) {
  let sent = 0,
    failed = 0;
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

// Check if already notified
async function alreadyNotified(resultId, notifType, bsDate) {
  return Notification.exists({
    type: notifType,
    "data.resultId": resultId.toString(),
    "data.bsDate": bsDate,
  });
}

// ─── STEP A — Morning checklist creation + aggregated push ────────────────
export async function createAndNotifyMorning() {
  const startedAt = new Date();
  const { englishToday, bsYear, bsMonth, bsDate } = buildTodayMeta();

  console.log(
    `\n🌅 [dailyChecklist.cron] 07:30 — creating results for ${bsDate} BS...`,
  );

  const systemAdminId =
    process.env.SYSTEM_ADMIN_ID ||
    (
      await Admin.findOne({ role: "super_admin", isActive: true })
        .select("_id")
        .lean()
    )?._id?.toString();

  if (!systemAdminId) {
    console.error("❌ No system admin found — cannot create results");
    return;
  }

  const templates = await ChecklistTemplate.find({
    isActive: true,
    checklistType: "DAILY",
  })
    .populate("property", "name")
    .populate("block", "name")
    .lean();

  if (!templates.length) {
    console.log("→ No active DAILY templates found — skipping");
    await CronLog.create({
      type: "DAILY_CHECKLIST_CREATION",
      ranAt: startedAt,
      message: "No active DAILY templates",
      count: 0,
      success: true,
    });
    return;
  }

  const createdResults = [];
  let created = 0,
    skipped = 0,
    failed = 0;

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

      if (outcome.alreadyExisted) skipped++;
      else if (outcome.success) {
        created++;
        createdResults.push({ result: outcome.data, template });
      } else failed++;
    } catch (err) {
      failed++;
      console.error(
        `❌ Error creating result for template ${template._id}:`,
        err.message,
      );
    }
  }

  console.log(
    `→ Created: ${created}, Already existed: ${skipped}, Failed: ${failed}`,
  );

  if (createdResults.length > 0) {
    const staffIds = await resolveAdminIds("staff");
    const allIds = staffIds.length ? staffIds : await resolveAdminIds("all");

    // Aggregate push/in-app message
    const summary = createdResults
      .map(({ template }) => {
        return `${template.category} (${template.property?.name ?? "Property"})`;
      })
      .join("; ");

    const payload = {
      title: "📋 Daily Checklists Ready",
      body: summary,
      data: { type: NOTIF.MORNING, bsDate },
    };

    await pushToMany(allIds, payload);
    await notifyAdminsAggregated(
      allIds,
      payload.title,
      payload.body,
      payload.data,
    );

    await CronLog.create({
      type: "DAILY_CHECKLIST_CREATION",
      ranAt: startedAt,
      message: `Morning creation: ${created} created, ${skipped} skipped, ${failed} failed`,
      count: created,
      success: failed === 0,
      error: failed > 0 ? `${failed} failed` : null,
    });
  }
}

// ─── STEP B — Mid-morning escalation (aggregated) ───────────────────────
export async function sendMidMorningEscalation() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(`\n[10:30] Mid-morning escalation (${bsDate} BS)...`);

  const startOfDay = new Date(englishToday);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const pendingResults = await ChecklistResult.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: "PENDING",
  })
    .populate("property", "name")
    .lean();

  if (!pendingResults.length)
    return console.log("→ All checklists started — no escalation needed");

  const allIds = await resolveAdminIds("all");
  if (!allIds.length) return;

  // Aggregate pending by category/property
  const summary = pendingResults
    .map((r) => `${r.category} (${r.property?.name ?? "Property"})`)
    .join("; ");
  const payload = {
    title: "⚠️ Daily Checks Pending",
    body: summary,
    data: {
      type: NOTIF.ESCALATION,
      bsDate,
      pendingCount: pendingResults.length,
    },
  };

  await pushToMany(allIds, payload);
  await notifyAdminsAggregated(
    allIds,
    payload.title,
    payload.body,
    payload.data,
  );

  await CronLog.create({
    type: "DAILY_CHECKLIST_ESCALATION",
    ranAt: startedAt,
    message: `Mid-morning escalation: ${pendingResults.length} pending`,
    count: pendingResults.length,
    success: true,
  });
}

// ─── STEP C — End-of-day warning (aggregated) ───────────────────────────
export async function sendEndOfDayWarning() {
  const startedAt = new Date();
  const { bsDate, englishToday } = buildTodayMeta();

  console.log(`\n🚨 [16:30] End-of-day warning (${bsDate} BS)...`);

  const startOfDay = new Date(englishToday);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const incompleteResults = await ChecklistResult.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .populate("property", "name")
    .lean();

  if (!incompleteResults.length) {
    await CronLog.create({
      type: "DAILY_CHECKLIST_EOD_WARNING",
      ranAt: startedAt,
      message: "All checklists completed",
      count: 0,
      success: true,
    });
    return;
  }

  const adminIds = await resolveAdminIds("admin");
  if (!adminIds.length) return;

  const summary = incompleteResults
    .map(
      (r) => `${r.category} (${r.property?.name ?? "Property"}): ${r.status}`,
    )
    .join("; ");
  const payload = {
    title: "🚨 Incomplete Daily Checks",
    body: summary,
    data: { type: NOTIF.EOD_WARNING, bsDate },
  };

  await pushToMany(adminIds, payload);
  await notifyAdminsAggregated(
    adminIds,
    payload.title,
    payload.body,
    payload.data,
  );

  await CronLog.create({
    type: "DAILY_CHECKLIST_EOD_WARNING",
    ranAt: startedAt,
    message: `EOD warning sent for ${incompleteResults.length} incomplete check(s)`,
    count: incompleteResults.length,
    success: true,
  });
}

// ─── Scheduler ─────────────────────────────────────────────────────────────
export function scheduleDailyChecklistCron() {
  cron.schedule("30 7 * * *", createAndNotifyMorning, {
    timezone: "Asia/Kathmandu",
  });
  cron.schedule("30 10 * * *", sendMidMorningEscalation, {
    timezone: "Asia/Kathmandu",
  });
  cron.schedule("30 16 * * *", sendEndOfDayWarning, {
    timezone: "Asia/Kathmandu",
  });

  console.log("✅ Daily checklist cron scheduled (Asia/Kathmandu):");
  console.log("   07:30 — create results + morning push (aggregated)");
  console.log("   10:30 — mid-morning escalation (aggregated)");
  console.log("   16:30 — end-of-day warning (aggregated)");
}
