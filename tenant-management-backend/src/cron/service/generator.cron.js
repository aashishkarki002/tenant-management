/**
 * generatorCheck.cron.js
 *
 * Sends push notifications to all active staff/admin accounts reminding them
 * to perform the daily generator check.
 *
 * ── Schedule (NPT) ────────────────────────────────────────────────────────────
 *
 *   09:00  Morning prompt — sent to ALL staff unconditionally.
 *          Early enough to be actioned during the morning shift.
 *
 *   14:00  Escalation — sent ONLY for generators that still have no check
 *          recorded today. Avoids spamming staff who already did the job.
 *          Escalation goes to admins + super_admins as well so management
 *          is aware of missed checks.
 *
 * ── Why not a single time? ────────────────────────────────────────────────────
 *
 *   A single 09:00 notification is easily dismissed and forgotten.
 *   The 14:00 escalation acts as a safety net without becoming noise —
 *   generators that were checked before 14:00 are silently skipped.
 *
 * ── Integration ───────────────────────────────────────────────────────────────
 *
 *   Import and call schedulGeneratorCheckCron() once at app startup, after
 *   initializeWebPush() has been called and MongoDB is connected.
 *
 *   import { scheduleGeneratorCheckCron } from "./cron/generatorCheck.cron.js";
 *   scheduleGeneratorCheckCron();
 */

import cron from "node-cron";
import Admin from "../../modules/auth/admin.Model.js";
import { Generator } from "../../modules/maintenance/generators/Generator.Model.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import { CronLog } from "../model/CronLog.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all active admin/staff ObjectIds.
 * @param {"all"|"staff_only"} scope
 * @returns {Promise<string[]>}
 */
async function getTargetAdminIds(scope = "all") {
  const roleFilter =
    scope === "staff_only"
      ? { role: { $in: ["staff"] } }
      : { role: { $in: ["staff", "admin", "super_admin"] } };

  const admins = await Admin.find(
    { isActive: true, isDeleted: { $ne: true }, ...roleFilter },
    { _id: 1 },
  ).lean();

  return admins.map((a) => a._id.toString());
}

/**
 * Returns generators that have NOT been checked today (NPT wall-clock day).
 * Uses the English date midnight boundary as a proxy — accurate enough since
 * the cron itself runs in NPT and the check timestamps are server-generated.
 *
 * @returns {Promise<Array<{_id, name}>>}
 */
async function getUncheckedGenerators() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0); // midnight local server time (NPT)

  return Generator.find(
    {
      isActive: true,
      status: { $ne: "DECOMMISSIONED" },
      $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: startOfToday } }],
    },
    { name: 1 },
  ).lean();
}

/**
 * Sends a push notification to a list of admin IDs.
 * Failures for individual admins are logged but never throw — one bad
 * push subscription should not abort the rest.
 *
 * @param {string[]} adminIds
 * @param {{ title: string, body: string, data?: object }} payload
 * @returns {Promise<{ sent: number, failed: number }>}
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
          `[generatorCheck.cron] push failed for admin ${id}:`,
          err.message,
        );
      }
    }),
  );

  return { sent, failed };
}

// ─── Step A: 09:00 morning prompt ─────────────────────────────────────────────

/**
 * Fired at 09:00 NPT.
 * Notifies all active staff unconditionally — at this point we don't know
 * yet whether checks have been done (shift just started).
 */
export async function sendMorningGeneratorReminder() {
  const startedAt = new Date();
  console.log("\n  🔔 [generatorCheck.cron] 09:00 morning reminder...");

  try {
    // Skip if no active generators to check
    const activeGenerators = await Generator.countDocuments({
      isActive: true,
      status: { $ne: "DECOMMISSIONED" },
    });

    if (activeGenerators === 0) {
      console.log("       → No active generators — skipping");
      return;
    }

    const adminIds = await getTargetAdminIds("all");
    if (!adminIds.length) {
      console.log("       → No active staff found — skipping");
      return;
    }

    const { sent, failed } = await pushToMany(adminIds, {
      title: "🔋 Daily Generator Check",
      body:
        activeGenerators === 1
          ? "Please log today's generator check — fuel level and status."
          : `Please log today's check for all ${activeGenerators} generators — fuel level and status.`,
      data: { type: "GENERATOR_CHECK_REMINDER", time: "morning" },
    });

    const message = `Morning reminder: ${sent} push(es) sent, ${failed} failed (${activeGenerators} generator(s))`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "GENERATOR_CHECK_REMINDER",
      ranAt: startedAt,
      message,
      count: sent,
      success: failed === 0,
      error: failed > 0 ? `${failed} push(es) failed` : null,
    });
  } catch (err) {
    console.error("[generatorCheck.cron] Morning reminder error:", err.message);
    await CronLog.create({
      type: "GENERATOR_CHECK_REMINDER",
      ranAt: startedAt,
      message: "Morning reminder failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Step B: 14:00 escalation ─────────────────────────────────────────────────

/**
 * Fired at 14:00 NPT.
 * Only notifies if there are generators with no check recorded today.
 * Targets all roles (admins included) so management sees missed checks.
 */
export async function sendAfternoonEscalation() {
  const startedAt = new Date();
  console.log("\n  🚨 [generatorCheck.cron] 14:00 escalation check...");

  try {
    const unchecked = await getUncheckedGenerators();

    if (!unchecked.length) {
      console.log("       → All generators checked today — no escalation");
      return;
    }

    const names = unchecked.map((g) => g.name).join(", ");
    console.log(
      `       → ${unchecked.length} unchecked generator(s): ${names}`,
    );

    const adminIds = await getTargetAdminIds("all"); // escalate to admins too
    if (!adminIds.length) {
      console.log("       → No active staff found — skipping");
      return;
    }

    const { sent, failed } = await pushToMany(adminIds, {
      title: "⚠️ Generator Check Overdue",
      body:
        unchecked.length === 1
          ? `${unchecked[0].name} hasn't been checked today. Please log it now.`
          : `${unchecked.length} generators unchecked: ${names}. Please log checks now.`,
      data: {
        type: "GENERATOR_CHECK_ESCALATION",
        time: "afternoon",
        uncheckedIds: unchecked.map((g) => g._id.toString()),
      },
    });

    const message =
      `Afternoon escalation: ${unchecked.length} unchecked generator(s) — ` +
      `${sent} push(es) sent, ${failed} failed`;
    console.log(`       → ${message}`);

    await CronLog.create({
      type: "GENERATOR_CHECK_ESCALATION",
      ranAt: startedAt,
      message,
      count: unchecked.length,
      success: failed === 0,
      error: failed > 0 ? `${failed} push(es) failed` : null,
    });
  } catch (err) {
    console.error(
      "[generatorCheck.cron] Afternoon escalation error:",
      err.message,
    );
    await CronLog.create({
      type: "GENERATOR_CHECK_ESCALATION",
      ranAt: startedAt,
      message: "Afternoon escalation failed",
      count: 0,
      success: false,
      error: err.message,
    }).catch(() => {});
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Registers both cron jobs. Call once at app startup.
 *
 * @example
 * // In your app entry point, after DB connect + initializeWebPush():
 * import { scheduleGeneratorCheckCron } from "./cron/generatorCheck.cron.js";
 * scheduleGeneratorCheckCron();
 */
export function scheduleGeneratorCheckCron() {
  // 09:00 NPT — morning prompt
  cron.schedule("0 9 * * *", sendMorningGeneratorReminder, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  // 14:00 NPT — afternoon escalation (only fires if checks are missing)
  cron.schedule("0 14 * * *", sendAfternoonEscalation, {
    timezone: "Asia/Kathmandu",
    scheduled: true,
  });

  console.log("✅ Generator check cron scheduled:");
  console.log("   09:00 NPT — morning reminder to all staff");
  console.log(
    "   14:00 NPT — escalation if any generator unchecked (admins notified)",
  );
}
