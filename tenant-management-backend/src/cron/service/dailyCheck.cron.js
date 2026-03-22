/**
 * dailyChecklist.cron.js
 *
 * Creates a fresh DailyChecklist document for every active property × category
 * each morning, then drives three timed push/socket notifications that push
 * staff through the check-and-submit loop.
 *
 * ── Why these three times? ────────────────────────────────────────────────────
 *
 *   07:30  CREATION + MORNING PROMPT
 *          Checklists are seeded 30 min after shift start (most caretakers
 *          begin at 07:00–07:30 in Nepal). Staff receive a push so they know
 *          work orders are waiting. Admins are NOT notified — no action needed
 *          from management at this point.
 *
 *   10:30  MID-MORNING ESCALATION
 *          Any checklist still PENDING three hours into the shift means nobody
 *          has started it. Staff + admins are notified so a manager can follow
 *          up before the busiest part of the day.
 *
 *   16:30  END-OF-DAY WARNING
 *          Last chance before offices close (~18:00 NPT). Only PENDING and
 *          IN_PROGRESS checklists trigger the push — completed ones are skipped.
 *          Admins-only at this point; staff have presumably finished their shift.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *
 *   Creation: existingDoc guard on (property, category, checkDate = today).
 *   Notifications: one Notification document per (checklistId, notifType, bsDate).
 *   Re-running any step on the same day is a silent no-op.
 *
 * ── Integration ───────────────────────────────────────────────────────────────
 *
 *   Call scheduleDailyChecklistCron() once at app startup, AFTER MongoDB is
 *   connected and initializeWebPush() has been called.
 *
 *   import { scheduleDailyChecklistCron } from "./cron/dailyChecklist.cron.js";
 *   scheduleDailyChecklistCron();
 *
 *   The three exported step functions can also be called manually from an
 *   admin API route for testing / catch-up runs:
 *
 *   import {
 *     createAndNotifyMorning,
 *     sendMidMorningEscalation,
 *     sendEndOfDayWarning,
 *   } from "./cron/dailyChecklist.cron.js";
 */

import cron from "node-cron";
import Admin from "../../modules/auth/admin.Model.js";
import Property from "../../modules/property/Property.Model.js";
import { DailyChecklist } from "../../modules/dailyChecks/dailyChecksList.model.js";
import Notification from "../../modules/notifications/notification.model.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import { getIO } from "../../config/socket.js";
import { CronLog } from "../model/CronLog.js";
import {
  getNepaliToday,
  getNepaliYearMonthFromDate,
  formatNepaliISO,
} from "../../utils/nepaliDateHelper.js";
import { buildChecklistSections } from "../../modules/dailyChecks/checkListTemplate.js";

// ─── Which categories get a fresh checklist every day ─────────────────────────
//
// Add or remove entries to match your property's actual daily rounds.
// FIRE is kept separate because its priority is Urgent (see _inferPriority).
// Categories with lower frequency (WEEKLY, MONTHLY) should use a dedicated
// frequency cron or be created manually — don't add them here.

const DAILY_CATEGORIES = [
  "COMMON_AREA",
  "ELECTRICAL",
  "SANITARY",
  "WATER_TANK",
  "CCTV",
  "PARKING",
  "FIRE",
];

// ─── Notification type keys ───────────────────────────────────────────────────

const NOTIF = {
  MORNING: "DAILY_CHECKLIST_MORNING",
  ESCALATION: "DAILY_CHECKLIST_ESCALATION",
  EOD_WARNING: "DAILY_CHECKLIST_EOD_WARNING",
};

// ─── Admin / staff resolvers ──────────────────────────────────────────────────

/**
 * @param {"all"|"staff_only"|"admin_only"} scope
 * @returns {Promise<string[]>}
 */
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

  // Fallback to SYSTEM_ADMIN_ID so tests never silently skip
  if (!ids.length && process.env.SYSTEM_ADMIN_ID) {
    ids = [process.env.SYSTEM_ADMIN_ID];
  }

  return ids;
}

// ─── Socket + push helpers ────────────────────────────────────────────────────

/**
 * Persist a Notification document and emit it over Socket.IO.
 * Mirrors the notifyAdmins() pattern from master-cron.js / loanEmi.cron.js.
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
 * Send push notifications to multiple admins.
 * Mirrors pushToMany() from generator.cron.js / loanEmi.cron.js.
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
          `[dailyChecklist.cron] push failed for admin ${id}:`,
          err.message,
        );
      }
    }),
  );
  return { sent, failed };
}

// ─── Idempotency guard for notifications ─────────────────────────────────────

/**
 * Returns true if this notification has already been sent for this
 * checklist on today's BS date.
 *
 * We key on (checklistId, notifType, bsDate) so the guard resets every
 * day naturally — no cleanup job needed.
 */
async function alreadyNotified(checklistId, notifType, bsDate) {
  return Notification.exists({
    type: notifType,
    "data.checklistId": checklistId.toString(),
    "data.bsDate": bsDate,
  });
}

// ─── Checklist creation ───────────────────────────────────────────────────────

/**
 * Create one DailyChecklist document for a (property, category) pair if one
 * does not already exist for today.
 *
 * Returns { created: true } or { created: false, reason } on skip.
 *
 * @param {object} property   — lean Property document { _id, name, buildingConfig? }
 * @param {string} category   — one of DAILY_CATEGORIES
 * @param {object} todayMeta  — { englishToday, bsYear, bsMonth, bsDay, bsDate }
 * @param {string} systemAdminId
 */
async function createChecklistForProperty(
  property,
  category,
  todayMeta,
  systemAdminId,
) {
  const { englishToday, bsYear, bsMonth, bsDay, bsDate } = todayMeta;

  // ── Idempotency: skip if already exists for today ─────────────────────────
  // Use startOf/endOf day boundaries to be safe against time drift.
  const startOfDay = new Date(englishToday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await DailyChecklist.findOne({
    property: property._id,
    category,
    checkDate: { $gte: startOfDay, $lte: endOfDay },
  })
    .select("_id")
    .lean();

  if (existing) {
    return { created: false, reason: "already exists", id: existing._id };
  }

  // ── Build sections from template (property-level buildingConfig) ──────────
  // buildingConfig describes asset inventory (e.g. how many CCTV cameras, parking bays).
  // Falls back to {} — template builders handle missing config gracefully.
  const buildingConfig = property.buildingConfig ?? {};
  const sections = buildChecklistSections(category, buildingConfig, "DAILY");

  const doc = await DailyChecklist.create({
    property: property._id,
    block: null, // property-level daily check; block-level can be created separately
    category,
    checklistType: "DAILY",
    checkDate: englishToday,
    nepaliDate: bsDate, // "2082-04-07"
    nepaliMonth: bsMonth,
    nepaliYear: bsYear,
    sections,
    status: "PENDING",
    overallNotes: "",
    submittedBy: systemAdminId,
    createdBy: systemAdminId,
  });

  return { created: true, id: doc._id };
}

// ─── Today metadata builder ───────────────────────────────────────────────────

function buildTodayMeta() {
  const { npToday, bsYear, bsMonth, bsDay, englishToday } = getNepaliToday();
  const bsDate = formatNepaliISO(npToday); // "2082-04-07"
  return { npToday, bsYear, bsMonth, bsDay, bsDate, englishToday };
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP A — 07:30 NPT: Create checklists + morning push to staff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Seed DailyChecklist documents for every active property × DAILY_CATEGORIES.
 * 2. Push a morning prompt to all staff so they know rounds are ready.
 *
 * Fires at 07:30 NPT.
 */
export async function createAndNotifyMorning() {
  const startedAt = new Date();
  const todayMeta = buildTodayMeta();
  const { bsDate, bsYear, bsMonth } = todayMeta;

  console.log(
    `\n  📋 [dailyChecklist.cron] 07:30 — create + morning prompt (${bsDate} BS)...`,
  );

  // ── Resolve system admin for createdBy ────────────────────────────────────
  // Prefer SYSTEM_ADMIN_ID env; fall back to first active admin in DB.
  let systemAdminId = process.env.SYSTEM_ADMIN_ID;
  if (!systemAdminId) {
    const fallback = await Admin.findOne(
      {
        isActive: true,
        isDeleted: { $ne: true },
        role: { $in: ["admin", "super_admin"] },
      },
      { _id: 1 },
    ).lean();
    systemAdminId = fallback?._id?.toString();
  }

  if (!systemAdminId) {
    console.error(
      "       ✗ No system admin found — cannot set createdBy. Aborting.",
    );
    await CronLog.create({
      type: "DAILY_CHECKLIST_CREATION",
      ranAt: startedAt,
      message: "Aborted — no system admin available",
      count: 0,
      success: false,
      error: "SYSTEM_ADMIN_ID not set and no active admin in DB",
    }).catch(() => {});
    return;
  }

  // ── Load all active properties ─────────────────────────────────────────────
  const properties = await Property.find(
    {}, // filter (empty = get all)
    { _id: 1, name: 1, buildingConfig: 1 }, // projection
  ).lean();

  if (!properties.length) {
    console.log("       → No active properties — skipping");
    return;
  }

  console.log(
    `       → ${properties.length} propert(ies) × ${DAILY_CATEGORIES.length} categories`,
  );

  // ── Create checklists ──────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const createdIds = []; // for notification data

  for (const property of properties) {
    for (const category of DAILY_CATEGORIES) {
      try {
        const result = await createChecklistForProperty(
          property,
          category,
          todayMeta,
          systemAdminId,
        );
        if (result.created) {
          created++;
          createdIds.push(result.id.toString());
          console.log(`       ✓ Created [${category}] for "${property.name}"`);
        } else {
          skipped++;
          console.log(
            `       ↷ Skipped [${category}] "${property.name}": ${result.reason}`,
          );
        }
      } catch (err) {
        failed++;
        errors.push(`${property.name}/${category}: ${err.message}`);
        console.error(
          `       ✗ Failed [${category}] "${property.name}":`,
          err.message,
        );
      }
    }
  }

  const creationMessage =
    `Created ${created}, skipped ${skipped}, failed ${failed} ` +
    `(${properties.length} properties × ${DAILY_CATEGORIES.length} categories)`;
  console.log(`       → ${creationMessage}`);

  await CronLog.create({
    type: "DAILY_CHECKLIST_CREATION",
    ranAt: startedAt,
    message: creationMessage,
    count: created,
    success: failed === 0,
    error: errors.length ? errors.join(" | ") : null,
  }).catch(() => {});

  // ── Morning push to staff ──────────────────────────────────────────────────
  // Only notify if at least one checklist exists today (created or already existed).
  const totalToday = created + skipped;
  if (totalToday === 0) {
    console.log("       → No checklists for today — skipping morning push");
    return;
  }

  const staffIds = await resolveAdminIds("staff_only");
  if (!staffIds.length) {
    console.log("       → No active staff found — skipping morning push");
    return;
  }

  const pushPayload = {
    title: "📋 Daily Rounds Ready",
    body:
      properties.length === 1
        ? `${totalToday} checklist(s) for ${properties[0].name} are ready. Please complete your rounds.`
        : `${totalToday} checklist(s) across ${properties.length} properties are ready for today's rounds.`,
    data: {
      type: NOTIF.MORNING,
      bsDate,
      categories: DAILY_CATEGORIES,
    },
  };

  const { sent: pushSent, failed: pushFailed } = await pushToMany(
    staffIds,
    pushPayload,
  );

  // Socket notification for in-app banner
  await notifyAdmins({
    type: NOTIF.MORNING,
    title: pushPayload.title,
    message: pushPayload.body,
    adminIds: staffIds,
    data: {
      bsDate,
      bsYear,
      bsMonth,
      totalChecklists: totalToday,
      categories: DAILY_CATEGORIES,
    },
  });

  const notifMessage = `Morning push: ${pushSent} sent, ${pushFailed} failed (${staffIds.length} staff)`;
  console.log(`       → ${notifMessage}`);

  await CronLog.create({
    type: NOTIF.MORNING,
    ranAt: startedAt,
    message: notifMessage,
    count: pushSent,
    success: pushFailed === 0,
    error: pushFailed > 0 ? `${pushFailed} push(es) failed` : null,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP B — 10:30 NPT: Mid-morning escalation for PENDING checklists
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 3 hours after morning prompt — if any checklists are still PENDING (nobody
 * has touched them), escalate to both staff and admins.
 *
 * Idempotent: one Notification doc per (checklistId, ESCALATION, bsDate).
 *
 * Fires at 10:30 NPT.
 */
export async function sendMidMorningEscalation() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(
    `\n  ⚠️  [dailyChecklist.cron] 10:30 — mid-morning escalation (${bsDate} BS)...`,
  );

  // ── Find today's PENDING checklists ────────────────────────────────────────
  const startOfDay = new Date(englishToday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setHours(23, 59, 59, 999);

  const pendingChecklists = await DailyChecklist.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: "PENDING",
  })
    .populate("property", "name")
    .lean();

  if (!pendingChecklists.length) {
    console.log("       → All checklists started or completed — no escalation");
    await CronLog.create({
      type: "DAILY_CHECKLIST_ESCALATION",
      ranAt: startedAt,
      message: "No pending checklists — escalation skipped",
      count: 0,
      success: true,
      error: null,
    }).catch(() => {});
    return;
  }

  console.log(
    `       → ${pendingChecklists.length} PENDING checklist(s) found`,
  );

  // Group by property for a cleaner notification message
  const byProperty = pendingChecklists.reduce((acc, cl) => {
    const propName = cl.property?.name ?? "Unknown";
    if (!acc[propName]) acc[propName] = [];
    acc[propName].push(cl.category);
    return acc;
  }, {});

  const propertyNames = Object.keys(byProperty);
  const summary =
    propertyNames.length === 1
      ? `${propertyNames[0]}: ${byProperty[propertyNames[0]].join(", ")}`
      : `${propertyNames.length} properties with pending checks`;

  // ── Notify staff + admins ──────────────────────────────────────────────────
  const allIds = await resolveAdminIds("all");
  if (!allIds.length) {
    console.log("       → No active staff/admins — skipping escalation");
    return;
  }

  let escalated = 0;
  let escalationSkipped = 0;

  for (const cl of pendingChecklists) {
    const already = await alreadyNotified(cl._id, NOTIF.ESCALATION, bsDate);
    if (already) {
      escalationSkipped++;
      continue;
    }

    const propName = cl.property?.name ?? "Unknown Property";

    await notifyAdmins({
      type: NOTIF.ESCALATION,
      title: "⚠️ Daily Check Pending",
      message: `${cl.category} checklist for ${propName} hasn't been started yet.`,
      adminIds: allIds,
      data: {
        checklistId: cl._id.toString(),
        category: cl.category,
        propertyName: propName,
        bsDate,
        bsYear,
        bsMonth,
      },
    });

    escalated++;
  }

  // One consolidated push (avoid per-checklist push spam)
  if (escalated > 0) {
    const { sent, failed } = await pushToMany(allIds, {
      title: "⚠️ Daily Checks Pending",
      body:
        pendingChecklists.length === 1
          ? `${pendingChecklists[0].category} check for ${pendingChecklists[0].property?.name ?? "a property"} hasn't started yet.`
          : `${pendingChecklists.length} checklist(s) still pending: ${summary}`,
      data: {
        type: NOTIF.ESCALATION,
        bsDate,
        pendingCount: pendingChecklists.length,
      },
    });

    const message =
      `Mid-morning escalation: ${escalated} checklist(s) escalated, ` +
      `${escalationSkipped} already notified, ${sent} push(es) sent, ${failed} failed`;
    console.log(`       → ${message}`);

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
      `       → All ${escalationSkipped} escalation(s) already sent for today`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP C — 16:30 NPT: End-of-day warning (admins only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Last chance alert — notify ADMINS ONLY for any checklist that is still
 * PENDING or IN_PROGRESS as the work day nears its close.
 *
 * Staff are excluded at this point because this is a management-level
 * accountability alert, not an action nudge.
 *
 * Idempotent: one Notification doc per (checklistId, EOD_WARNING, bsDate).
 *
 * Fires at 16:30 NPT.
 */
export async function sendEndOfDayWarning() {
  const startedAt = new Date();
  const { bsDate, bsYear, bsMonth, englishToday } = buildTodayMeta();

  console.log(
    `\n  🚨 [dailyChecklist.cron] 16:30 — end-of-day warning (${bsDate} BS)...`,
  );

  // ── Find today's incomplete checklists ────────────────────────────────────
  const startOfDay = new Date(englishToday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(englishToday);
  endOfDay.setHours(23, 59, 59, 999);

  const incompleteChecklists = await DailyChecklist.find({
    checkDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .populate("property", "name")
    .lean();

  if (!incompleteChecklists.length) {
    console.log("       → All checklists completed — no end-of-day warning");
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

  // ── Separate PENDING from IN_PROGRESS for message clarity ────────────────
  const pending = incompleteChecklists.filter((c) => c.status === "PENDING");
  const inProgress = incompleteChecklists.filter(
    (c) => c.status === "IN_PROGRESS",
  );

  console.log(
    `       → ${pending.length} PENDING, ${inProgress.length} IN_PROGRESS`,
  );

  const adminIds = await resolveAdminIds("admin_only");
  if (!adminIds.length) {
    console.log("       → No active admins — skipping end-of-day warning");
    return;
  }

  let warned = 0;
  let warningSkipped = 0;

  for (const cl of incompleteChecklists) {
    const already = await alreadyNotified(cl._id, NOTIF.EOD_WARNING, bsDate);
    if (already) {
      warningSkipped++;
      continue;
    }

    const propName = cl.property?.name ?? "Unknown Property";
    const statusLabel =
      cl.status === "PENDING" ? "not started" : "still in progress";

    await notifyAdmins({
      type: NOTIF.EOD_WARNING,
      title: "🚨 Checklist Incomplete",
      message: `${cl.category} check for ${propName} is ${statusLabel} at 16:30.`,
      adminIds,
      data: {
        checklistId: cl._id.toString(),
        category: cl.category,
        status: cl.status,
        propertyName: propName,
        bsDate,
        bsYear,
        bsMonth,
      },
    });

    warned++;
  }

  // ── Consolidated push (one per run, not per checklist) ────────────────────
  if (warned > 0) {
    const pushBody =
      incompleteChecklists.length === 1
        ? `${incompleteChecklists[0].category} check for ${incompleteChecklists[0].property?.name ?? "a property"} is incomplete.`
        : `${pending.length} unstarted, ${inProgress.length} in-progress checklist(s) need attention before day's end.`;

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
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "DAILY_CHECKLIST_EOD_WARNING",
      ranAt: startedAt,
      message,
      count: warned,
      success: failed === 0,
      error: failed > 0 ? `${failed} push(es) failed` : null,
    }).catch(() => {});
  } else {
    console.log(
      `       → All ${warningSkipped} warning(s) already sent for today`,
    );
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Register all three cron jobs. Call once at app startup.
 *
 * ┌──────────┬─────────────────────────────────────────────────────────────┐
 * │  07:30   │ CREATE checklists + push staff morning prompt               │
 * │  10:30   │ ESCALATION — push staff + admins if any PENDING             │
 * │  16:30   │ EOD WARNING — push admins only if any PENDING/IN_PROGRESS   │
 * └──────────┴─────────────────────────────────────────────────────────────┘
 *
 * @example
 * import { scheduleDailyChecklistCron } from "./cron/dailyChecklist.cron.js";
 * scheduleDailyChecklistCron();
 */
export function scheduleDailyChecklistCron() {
  // 07:30 NPT — creation + morning prompt
  cron.schedule("30 7 * * *", createAndNotifyMorning, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 10:30 NPT — mid-morning escalation
  cron.schedule("30 10 * * *", sendMidMorningEscalation, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 16:30 NPT — end-of-day warning (admins only)
  cron.schedule("30 16 * * *", sendEndOfDayWarning, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  console.log("✅ Daily checklist cron scheduled (Asia/Kathmandu):");
  console.log("   07:30 — create checklists + morning push to staff");
  console.log("   10:30 — mid-morning escalation if any PENDING");
  console.log("   16:30 — end-of-day warning to admins if any incomplete");
}
