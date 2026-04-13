/**
 * maintenance.cron.js
 *
 * Proactive maintenance reminder scheduler. Four jobs run daily (NPT):
 *
 *   00:05  spawnRecurringTasks     — spawn next task for recurring parents completed yesterday
 *   08:00  sendUnassignedTaskAlert — owner/admin nudge: OPEN tasks due today/overdue with no staff
 *   09:00  sendStaffDueReminder    — staff nudge: tasks assigned to them that are due today
 *   14:00  sendOverdueEscalation   — escalation: all OPEN/IN_PROGRESS past their scheduled date
 *
 * All functions are exported for manual testing (e.g. from cronTest.js).
 * Each failure is isolated — one admin's bad push subscription never aborts the rest.
 *
 * Registration:
 *   import { scheduleMaintenanceCron } from "./cron/service/maintenance.cron.js";
 *   scheduleMaintenanceCron(); // call once at startup, after DB connect + initializeWebPush()
 */

import cron from "node-cron";
import Admin from "../../modules/auth/admin.Model.js";
import { Maintenance } from "../../modules/maintenance/Maintenance.Model.js";
import { createAndEmitNotification } from "../../modules/notifications/notification.service.js";
import { createMaintenance } from "../../modules/maintenance/maintenance.service.js";
import { CronLog } from "../model/CronLog.js";
import { getNepaliToday } from "../../utils/nepaliDateHelper.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns ObjectId strings for all active admins matching the given role filter.
 * @param {"admin_only"|"staff_only"|"all"} scope
 */
async function getAdminIds(scope = "admin_only") {
  let roleFilter;
  if (scope === "staff_only") {
    roleFilter = { role: "staff" };
  } else if (scope === "all") {
    roleFilter = { role: { $in: ["staff", "admin", "super_admin"] } };
  } else {
    roleFilter = { role: { $in: ["admin", "super_admin"] } };
  }

  const admins = await Admin.find(
    { isActive: true, isDeleted: { $ne: true }, ...roleFilter },
    { _id: 1 },
  ).lean();

  return admins.map((a) => a._id.toString());
}

/**
 * Sends a push+socket+DB notification to multiple admins.
 * Individual failures are logged and swallowed.
 */
async function notifyMany(adminIds, { type, title, message, data = {} }) {
  if (!adminIds.length) return { sent: 0, skipped: 0 };

  try {
    await createAndEmitNotification({ type, title, message, data, adminIds });
    return { sent: adminIds.length, skipped: 0 };
  } catch (err) {
    console.error(`[maintenance.cron] notifyMany failed (${type}):`, err.message);
    return { sent: 0, skipped: adminIds.length };
  }
}

/** Returns the start-of-day (00:00:00.000 UTC) for today. */
function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns the start-of-day for yesterday. */
function startOfYesterday() {
  const d = startOfToday();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/** Returns the end-of-day (23:59:59.999 UTC) for today. */
function endOfToday() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Summarise a list of tasks into a readable string (up to 5, then "…and N more"). */
function summariseTasks(tasks, maxShown = 5) {
  const shown = tasks.slice(0, maxShown).map((t) => `"${t.title}"`);
  const rest = tasks.length - shown.length;
  return rest > 0 ? `${shown.join(", ")}, …and ${rest} more` : shown.join(", ");
}

// ─── Job A  00:05 NPT ─────────────────────────────────────────────────────────

/**
 * Finds recently-completed recurring tasks and spawns their next occurrence if
 * it doesn't already exist. Runs at 00:05 so it catches tasks settled yesterday.
 */
export async function spawnRecurringTasks() {
  const startedAt = new Date();
  console.log("\n  🔁 [maintenance.cron] 00:05 recurring spawn...");

  try {
    const parents = await Maintenance.find({
      recurring: true,
      status: "COMPLETED",
      completedAt: { $gte: startOfYesterday(), $lt: startOfToday() },
      sourceType: { $ne: "RECURRING" }, // prevent cascade
      recurringIntervalDays: { $gt: 0 },
    }).lean();

    if (!parents.length) {
      console.log("       → No recurring tasks completed yesterday");
      return;
    }

    let spawned = 0;
    let skipped = 0;

    for (const parent of parents) {
      // Idempotency: skip if a child already exists
      const existing = await Maintenance.countDocuments({
        sourceType: "RECURRING",
        sourceRef: parent._id,
      });

      if (existing > 0) {
        skipped++;
        continue;
      }

      const nextDate = new Date(parent.completedAt);
      nextDate.setDate(nextDate.getDate() + parent.recurringIntervalDays);

      await createMaintenance({
        title: parent.title,
        description: parent.description,
        type: parent.type,
        priority: parent.priority,
        scope: parent.scope,
        unit: parent.unit,
        block: parent.block,
        property: parent.property,
        tenant: parent.tenant,
        entityId: parent.entityId,
        assignedTo: parent.assignedTo,
        amountPaisa: parent.amountPaisa,
        scheduledDate: nextDate,
        recurring: true,
        recurringIntervalDays: parent.recurringIntervalDays,
        sourceType: "RECURRING",
        sourceRef: parent._id,
        sourceRefModel: "Maintenance",
        createdBy: parent.createdBy,
      });

      spawned++;
    }

    const message = `Recurring spawn: ${spawned} spawned, ${skipped} already existed (${parents.length} parent(s) checked)`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "MAINTENANCE_RECURRING_SPAWN",
      ranAt: startedAt,
      message,
      count: spawned,
      success: true,
    });
  } catch (err) {
    console.error("[maintenance.cron] spawnRecurringTasks error:", err.message);
    await CronLog.create({
      type: "MAINTENANCE_RECURRING_SPAWN",
      ranAt: startedAt,
      message: "Recurring spawn failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Job B  08:00 NPT ─────────────────────────────────────────────────────────

/**
 * Alerts owner/admins about OPEN tasks that are due today or already overdue
 * and still have no staff assigned. This is the "please assign someone" nudge.
 */
export async function sendUnassignedTaskAlert() {
  const startedAt = new Date();
  console.log("\n  ⚠️  [maintenance.cron] 08:00 unassigned task alert...");

  try {
    const tasks = await Maintenance.find({
      status: "OPEN",
      assignedTo: null,
      scheduledDate: { $lte: endOfToday() },
    })
      .select("title priority scheduledDate")
      .lean();

    if (!tasks.length) {
      console.log("       → No unassigned due/overdue tasks");
      return;
    }

    const adminIds = await getAdminIds("admin_only");
    if (!adminIds.length) {
      console.log("       → No active admins found — skipping");
      return;
    }

    const summary = summariseTasks(tasks);
    const { sent } = await notifyMany(adminIds, {
      type: "MAINTENANCE_DUE_UNASSIGNED",
      title: "⚠️ Unassigned Maintenance Tasks",
      message:
        tasks.length === 1
          ? `1 task is due with no staff assigned: ${summary}. Please assign staff.`
          : `${tasks.length} tasks are due/overdue with no staff assigned: ${summary}. Please assign staff.`,
      data: {
        count: tasks.length,
        taskIds: tasks.map((t) => t._id.toString()),
      },
    });

    const message = `Unassigned alert: ${tasks.length} task(s) — ${sent} admin(s) notified`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "MAINTENANCE_DUE_UNASSIGNED",
      ranAt: startedAt,
      message,
      count: tasks.length,
      success: true,
    });
  } catch (err) {
    console.error("[maintenance.cron] sendUnassignedTaskAlert error:", err.message);
    await CronLog.create({
      type: "MAINTENANCE_DUE_UNASSIGNED",
      ranAt: startedAt,
      message: "Unassigned task alert failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Job C  09:00 NPT ─────────────────────────────────────────────────────────

/**
 * Sends each assigned staff member a personal reminder about their tasks
 * that are scheduled for today. Groups by staff so each person gets one notification.
 */
export async function sendStaffDueReminder() {
  const startedAt = new Date();
  console.log("\n  🔧 [maintenance.cron] 09:00 staff due reminder...");

  try {
    const tasks = await Maintenance.find({
      status: { $in: ["OPEN", "IN_PROGRESS"] },
      assignedTo: { $ne: null },
      scheduledDate: { $gte: startOfToday(), $lte: endOfToday() },
    })
      .select("title priority assignedTo")
      .lean();

    if (!tasks.length) {
      console.log("       → No assigned tasks due today");
      return;
    }

    // Group by assignedTo staff id
    const byStaff = new Map();
    for (const task of tasks) {
      const staffId = task.assignedTo.toString();
      if (!byStaff.has(staffId)) byStaff.set(staffId, []);
      byStaff.get(staffId).push(task);
    }

    let totalSent = 0;

    for (const [staffId, staffTasks] of byStaff) {
      const summary = summariseTasks(staffTasks);
      const { sent } = await notifyMany([staffId], {
        type: "MAINTENANCE_STAFF_REMINDER",
        title: "🔧 Maintenance Due Today",
        message:
          staffTasks.length === 1
            ? `You have 1 task due today: ${summary}. Please complete it.`
            : `You have ${staffTasks.length} tasks due today: ${summary}. Please complete them.`,
        data: {
          count: staffTasks.length,
          taskIds: staffTasks.map((t) => t._id.toString()),
        },
      });
      totalSent += sent;
    }

    const message = `Staff reminder: ${tasks.length} task(s) across ${byStaff.size} staff member(s) — ${totalSent} notification(s) sent`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "MAINTENANCE_STAFF_REMINDER",
      ranAt: startedAt,
      message,
      count: tasks.length,
      success: true,
    });
  } catch (err) {
    console.error("[maintenance.cron] sendStaffDueReminder error:", err.message);
    await CronLog.create({
      type: "MAINTENANCE_STAFF_REMINDER",
      ranAt: startedAt,
      message: "Staff due reminder failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Job D  14:00 NPT ─────────────────────────────────────────────────────────

/**
 * Escalation: notifies all admins AND each assigned staff member about tasks
 * that are still OPEN or IN_PROGRESS past their scheduled date.
 * Only fires if overdue tasks exist — no noise when everything is on track.
 */
export async function sendOverdueEscalation() {
  const startedAt = new Date();
  console.log("\n  🚨 [maintenance.cron] 14:00 overdue escalation...");

  try {
    const tasks = await Maintenance.find({
      status: { $in: ["OPEN", "IN_PROGRESS"] },
      scheduledDate: { $lt: startOfToday() },
    })
      .select("title priority assignedTo scheduledDate")
      .lean();

    if (!tasks.length) {
      console.log("       → No overdue tasks — skipping escalation");
      return;
    }

    console.log(`       → ${tasks.length} overdue task(s)`);

    const adminIds = await getAdminIds("admin_only");
    const summary = summariseTasks(tasks);

    // Notify admins
    if (adminIds.length) {
      await notifyMany(adminIds, {
        type: "MAINTENANCE_OVERDUE_ESCALATION",
        title: "🚨 Overdue Maintenance Tasks",
        message:
          tasks.length === 1
            ? `1 task is overdue and unresolved: ${summary}. Please review.`
            : `${tasks.length} tasks are overdue and unresolved: ${summary}. Please review.`,
        data: {
          count: tasks.length,
          taskIds: tasks.map((t) => t._id.toString()),
        },
      });
    }

    // Also notify each assigned staff about their own overdue tasks
    const assignedTasks = tasks.filter((t) => t.assignedTo);
    if (assignedTasks.length) {
      const byStaff = new Map();
      for (const task of assignedTasks) {
        const staffId = task.assignedTo.toString();
        if (!byStaff.has(staffId)) byStaff.set(staffId, []);
        byStaff.get(staffId).push(task);
      }

      for (const [staffId, staffTasks] of byStaff) {
        const staffSummary = summariseTasks(staffTasks);
        await notifyMany([staffId], {
          type: "MAINTENANCE_OVERDUE_ESCALATION",
          title: "🚨 Overdue Tasks Need Attention",
          message:
            staffTasks.length === 1
              ? `Your task ${staffSummary} is overdue. Please update its status or contact your admin.`
              : `You have ${staffTasks.length} overdue tasks: ${staffSummary}. Please update or contact your admin.`,
          data: {
            count: staffTasks.length,
            taskIds: staffTasks.map((t) => t._id.toString()),
          },
        });
      }
    }

    const message = `Overdue escalation: ${tasks.length} task(s) — ${adminIds.length} admin(s) notified, ${assignedTasks.length} assigned task(s) with staff notified`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "MAINTENANCE_OVERDUE_ESCALATION",
      ranAt: startedAt,
      message,
      count: tasks.length,
      success: true,
    });
  } catch (err) {
    console.error("[maintenance.cron] sendOverdueEscalation error:", err.message);
    await CronLog.create({
      type: "MAINTENANCE_OVERDUE_ESCALATION",
      ranAt: startedAt,
      message: "Overdue escalation failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Registers all four maintenance cron jobs. Call once at app startup,
 * after DB connect and initializeWebPush().
 */
export function scheduleMaintenanceCron() {
  // 00:05 NPT — spawn next recurring task for parents completed yesterday
  cron.schedule("5 0 * * *", spawnRecurringTasks, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 08:00 NPT — owner/admin alert for unassigned due/overdue tasks
  cron.schedule("0 8 * * *", sendUnassignedTaskAlert, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 09:00 NPT — personal reminder to each assigned staff member for today's tasks
  cron.schedule("0 9 * * *", sendStaffDueReminder, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 14:00 NPT — escalation for all overdue unresolved tasks (admins + staff)
  cron.schedule("0 14 * * *", sendOverdueEscalation, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  console.log("✅ Maintenance cron scheduled:");
  console.log("   00:05 NPT — spawn next recurring tasks");
  console.log("   08:00 NPT — unassigned due/overdue task alert to admins");
  console.log("   09:00 NPT — staff reminder for tasks due today");
  console.log("   14:00 NPT — overdue escalation to admins + assigned staff");
}
