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

function buildTodayMeta() {
  const { englishToday, npToday, bsYear, bsMonth, bsDay } = getNepaliToday();
  const bsDate = formatNepaliISO(npToday);
  return { englishToday, bsYear, bsMonth, bsDay, bsDate };
}

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

/**
 * Send ONE aggregated in-app notification per admin.
 *
 * Uses upsert so that re-runs of the same cron (same type + bsDate) never
 * create a second notification — they just update the message in place and
 * re-emit via socket so the UI refreshes the count/body if it changed.
 */
async function notifyAdminsAggregated(adminIds, title, message, data) {
  const io = getIO();

  await Promise.allSettled(
    adminIds.map(async (adminId) => {
      try {
        // Upsert: one notification per (admin, type, bsDate) — idempotent
        const notification = await Notification.findOneAndUpdate(
          {
            admin: adminId,
            type: data.type,
            "data.bsDate": data.bsDate,
          },
          {
            $set: {
              title,
              message,
              data,
              isRead: false, // reset read flag if content changed
              updatedAt: new Date(),
            },
            $setOnInsert: {
              admin: adminId,
              type: data.type,
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true },
        );

        // Always re-emit so the client sees the latest count/body
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
        console.error(
          `[dailyCheck.cron] notify failed for ${adminId}:`,
          err.message,
        );
      }
    }),
  );
}

/**
 * Send push notifications to many admins.
 * Skips admins that already received a push for this type+date today
 * so re-runs don't spam devices.
 */
async function pushToMany(adminIds, payload, { type, bsDate } = {}) {
  // Find admins who were already pushed today for this notification type
  let alreadyPushedIds = new Set();
  if (type && bsDate) {
    const existing = await Notification.find(
      {
        admin: { $in: adminIds },
        type,
        "data.bsDate": bsDate,
        "data._pushed": true,
      },
      { admin: 1 },
    ).lean();
    alreadyPushedIds = new Set(existing.map((n) => n.admin.toString()));
  }

  const targets = adminIds.filter((id) => !alreadyPushedIds.has(id));
  if (!targets.length) return { sent: 0, failed: 0, skipped: adminIds.length };

  let sent = 0,
    failed = 0;
  await Promise.allSettled(
    targets.map(async (id) => {
      try {
        await sendPushToAdmin(id, payload);
        sent++;
      } catch (err) {
        failed++;
        console.error(`[dailyCheck.cron] push failed for ${id}:`, err.message);
      }
    }),
  );

  // Mark pushed so re-runs skip them
  if (type && bsDate && sent > 0) {
    await Notification.updateMany(
      { admin: { $in: targets }, type, "data.bsDate": bsDate },
      { $set: { "data._pushed": true } },
    );
  }

  return { sent, failed, skipped: alreadyPushedIds.size };
}

/**
 * Build a smart summary string:
 *   "14 checklists pending — Housekeeping (Hotel A); Cleaning (Hotel B); …"
 * Truncates the item list if it would be too long for a push notification.
 */
function buildSummary(items, { maxItems = 5, label = "item" } = {}) {
  const total = items.length;
  const shown = items.slice(0, maxItems);
  const rest = total - shown.length;
  const list = shown.join("; ") + (rest > 0 ? `; +${rest} more` : "");
  return `${total} ${label}${total !== 1 ? "s" : ""} — ${list}`;
}

// ─── STEP A — Morning checklist creation + single aggregated push ─────────
export async function createAndNotifyMorning() {
  const startedAt = new Date();
  const { englishToday, bsYear, bsMonth, bsDate } = buildTodayMeta();

  console.log(`\n🌅 [07:30] Creating daily checklists for ${bsDate} BS...`);

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

    // ONE aggregated message regardless of how many templates were created
    const items = createdResults.map(
      ({ template }) =>
        `${template.category} (${template.property?.name ?? "Property"})`,
    );
    const body = buildSummary(items, { label: "checklist", maxItems: 5 });

    const notifData = {
      type: NOTIF.MORNING,
      bsDate,
      createdCount: created,
    };

    // Single push per admin (deduped by pushToMany)
    const pushResult = await pushToMany(
      allIds,
      {
        title: "📋 Daily Checklists Ready",
        body,
        data: notifData,
      },
      { type: NOTIF.MORNING, bsDate },
    );

    // Single in-app notification per admin (upserted)
    await notifyAdminsAggregated(
      allIds,
      "📋 Daily Checklists Ready",
      body,
      notifData,
    );

    console.log(
      `→ Push: sent=${pushResult.sent}, failed=${pushResult.failed}, skipped=${pushResult.skipped}`,
    );
  }

  await CronLog.create({
    type: "DAILY_CHECKLIST_CREATION",
    ranAt: startedAt,
    message: `Morning creation: ${created} created, ${skipped} skipped, ${failed} failed`,
    count: created,
    success: failed === 0,
    error: failed > 0 ? `${failed} failed` : null,
  });
}

// ─── STEP B — Mid-morning escalation (single aggregated notification) ─────
export async function sendMidMorningEscalation() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(`\n⚠️ [10:30] Mid-morning escalation (${bsDate} BS)...`);

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

  if (!pendingResults.length) {
    console.log("→ All checklists started — no escalation needed");
    await CronLog.create({
      type: "DAILY_CHECKLIST_ESCALATION",
      ranAt: startedAt,
      message: "No pending checklists — escalation skipped",
      count: 0,
      success: true,
    });
    return;
  }

  const allIds = await resolveAdminIds("all");
  if (!allIds.length) return;

  const items = pendingResults.map(
    (r) => `${r.category} (${r.property?.name ?? "Property"})`,
  );
  const body = buildSummary(items, { label: "checklist", maxItems: 5 });

  const notifData = {
    type: NOTIF.ESCALATION,
    bsDate,
    pendingCount: pendingResults.length,
  };

  const pushResult = await pushToMany(
    allIds,
    {
      title: "⚠️ Daily Checks Pending",
      body,
      data: notifData,
    },
    { type: NOTIF.ESCALATION, bsDate },
  );

  await notifyAdminsAggregated(
    allIds,
    "⚠️ Daily Checks Pending",
    body,
    notifData,
  );

  console.log(
    `→ Escalation sent: ${pendingResults.length} pending | push sent=${pushResult.sent}`,
  );

  await CronLog.create({
    type: "DAILY_CHECKLIST_ESCALATION",
    ranAt: startedAt,
    message: `Mid-morning escalation: ${pendingResults.length} pending`,
    count: pendingResults.length,
    success: true,
  });
}

// ─── STEP C — End-of-day warning (single aggregated notification) ─────────
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
    console.log("→ All checklists completed — no EOD warning needed");
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

  const items = incompleteResults.map(
    (r) => `${r.category} (${r.property?.name ?? "Property"}): ${r.status}`,
  );
  const body = buildSummary(items, {
    label: "incomplete checklist",
    maxItems: 5,
  });

  const notifData = {
    type: NOTIF.EOD_WARNING,
    bsDate,
    incompleteCount: incompleteResults.length,
  };

  const pushResult = await pushToMany(
    adminIds,
    {
      title: "🚨 Incomplete Daily Checks",
      body,
      data: notifData,
    },
    { type: NOTIF.EOD_WARNING, bsDate },
  );

  await notifyAdminsAggregated(
    adminIds,
    "🚨 Incomplete Daily Checks",
    body,
    notifData,
  );

  console.log(
    `→ EOD warning sent: ${incompleteResults.length} incomplete | push sent=${pushResult.sent}`,
  );

  await CronLog.create({
    type: "DAILY_CHECKLIST_EOD_WARNING",
    ranAt: startedAt,
    message: `EOD warning: ${incompleteResults.length} incomplete check(s)`,
    count: incompleteResults.length,
    success: true,
  });
}

// ─── Scheduler ─────────────────────────────────────────────────────────────
// Module-level task refs so we can stop/restart them dynamically.
let _morningTask = null;
let _escalationTask = null;
let _eodTask = null;

/**
 * Schedule (or reschedule) daily checklist crons.
 *
 * @param {object} config  Shape: { morning, escalation, eod }
 *   Each sub-object: { enabled: boolean, time: "HH:MM" }
 *   Defaults: morning=07:30, escalation=10:30, eod=16:30 — all enabled.
 *
 * Safe to call multiple times (stops existing tasks first).
 * Called at startup from app.js and re-called when admin saves cron settings.
 */
export function scheduleDailyChecklistCron(config = {}) {
  const {
    morning = { enabled: true, time: "07:30" },
    escalation = { enabled: true, time: "10:30" },
    eod = { enabled: true, time: "16:30" },
  } = config;

  // Stop existing tasks
  _morningTask?.stop();
  _escalationTask?.stop();
  _eodTask?.stop();
  _morningTask = null;
  _escalationTask = null;
  _eodTask = null;

  const parseCron = (time) => {
    const [h, m] = (time || "00:00").split(":").map(Number);
    return `${m} ${h} * * *`;
  };

  if (morning.enabled) {
    _morningTask = cron.schedule(parseCron(morning.time), createAndNotifyMorning, {
      timezone: "Asia/Kathmandu",
    });
  }
  if (escalation.enabled) {
    _escalationTask = cron.schedule(parseCron(escalation.time), sendMidMorningEscalation, {
      timezone: "Asia/Kathmandu",
    });
  }
  if (eod.enabled) {
    _eodTask = cron.schedule(parseCron(eod.time), sendEndOfDayWarning, {
      timezone: "Asia/Kathmandu",
    });
  }

  console.log("✅ Daily checklist cron scheduled (Asia/Kathmandu):");
  console.log(`   ${morning.enabled ? morning.time : "disabled"} — morning checklist creation`);
  console.log(`   ${escalation.enabled ? escalation.time : "disabled"} — mid-morning escalation`);
  console.log(`   ${eod.enabled ? eod.time : "disabled"} — end-of-day warning`);
}
