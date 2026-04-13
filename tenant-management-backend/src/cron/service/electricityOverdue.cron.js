/**
 * electricityOverdue.cron.js
 *
 * Runs daily at 02:00 NPT.
 * Marks electricity readings as "overdue" when they have been pending for
 * more than OVERDUE_DAYS days, then notifies all active admins.
 *
 * Registration:
 *   import { scheduleElectricityOverdueCron } from "./cron/service/electricityOverdue.cron.js";
 *   scheduleElectricityOverdueCron(); // call once at startup after DB connect
 */

import cron from "node-cron";
import { Electricity } from "../../modules/electricity/Electricity.Model.js";
import Admin from "../../modules/auth/admin.Model.js";
import { createAndEmitNotification } from "../../modules/notifications/notification.service.js";

const OVERDUE_DAYS = 30;

// ─── Core job ─────────────────────────────────────────────────────────────────

export async function markOverdueElectricityBills() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);

  const result = await Electricity.updateMany(
    {
      status:      "pending",
      readingDate: { $lt: cutoff },
    },
    { $set: { status: "overdue" } },
  );

  const count = result.modifiedCount ?? 0;
  console.log(`[ElectricityOverdueCron] Marked ${count} reading(s) as overdue (cutoff: ${cutoff.toISOString()})`);

  if (count === 0) return { count: 0 };

  // Notify all active admins
  try {
    const admins = await Admin.find(
      { isActive: true, isDeleted: { $ne: true }, role: { $in: ["admin", "super_admin"] } },
      { _id: 1 },
    ).lean();

    const adminIds = admins.map((a) => a._id.toString());

    if (adminIds.length) {
      await createAndEmitNotification({
        type:     "ELECTRICITY_BILLS_OVERDUE",
        title:    "Electricity Bills Overdue",
        message:  `${count} electricity bill${count > 1 ? "s have" : " has"} been marked overdue (pending > ${OVERDUE_DAYS} days).`,
        data:     { count, cutoff: cutoff.toISOString() },
        adminIds,
      });
    }
  } catch (notifyErr) {
    // Notification failure must not abort the cron result
    console.error("[ElectricityOverdueCron] Notification failed:", notifyErr.message);
  }

  return { count };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleElectricityOverdueCron() {
  // 02:00 every day (server time — deploy in NPT or adjust offset as needed)
  cron.schedule("0 2 * * *", async () => {
    console.log("[ElectricityOverdueCron] Starting overdue check...");
    try {
      const { count } = await markOverdueElectricityBills();
      console.log(`[ElectricityOverdueCron] Done — ${count} updated.`);
    } catch (err) {
      console.error("[ElectricityOverdueCron] Failed:", err.message);
    }
  });

  console.log("[ElectricityOverdueCron] Scheduled — runs daily at 02:00.");
}
