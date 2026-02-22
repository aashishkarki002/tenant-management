/**
 * ESCALATION CRON JOB
 *
 * Runs daily at 00:05 Nepal time and applies rent escalation
 * to all tenants whose nextEscalationDate has arrived.
 *
 * Setup:
 *   npm install node-cron
 *
 * Register once at app startup:
 *   import { startEscalationCron } from "./cron/escalation.cron.js";
 *   startEscalationCron();
 */

import cron from "node-cron";
import { processDueEscalations } from "../rent.escalation.service.js";
import {
  formatNepaliISO,
  getNepaliMonthDates,
} from "../../../../utils/nepaliDateHelper.js";
import { getCurrentQuarterInfo } from "../../../../utils/quarterlyRentHelper.js";

export function startEscalationCron() {
  // 00:05 every day, pinned to Nepal timezone (UTC+5:45).
  // Without the timezone option, node-cron uses server local time —
  // on a UTC server this would fire at 05:50 Nepal time instead of 00:05.
  cron.schedule(
    "5 0 * * *",
    async () => {
      const now = new Date();

      // Use getNepaliMonthDates() for consistent Nepali context
      const { nepaliToday, npYear, npMonth } = getNepaliMonthDates();
      const { quarter, year } = getCurrentQuarterInfo();

      console.log(
        `[EscalationCron] ▶ Started at ${now.toISOString()} ` +
          `| Nepali: ${formatNepaliISO(nepaliToday)} | Q${quarter} ${year}`,
      );

      try {
        const summary = await processDueEscalations(now);

        console.log(
          `[EscalationCron] ✅ Processed: ${summary.processed} | Failed: ${summary.failed}`,
        );

        if (summary.failed > 0) {
          console.warn(
            "[EscalationCron] Failed entries:",
            summary.details.filter((d) => d.status !== "ok"),
          );
        }
      } catch (err) {
        console.error("[EscalationCron] ❌ Fatal error:", err);
      }
    },
    {
      timezone: "Asia/Kathmandu", // ← critical: ensures 00:05 Nepal time
    },
  );

  console.log(
    "✅ Escalation cron scheduled — runs daily at 00:05 Nepal time (Asia/Kathmandu)",
  );
}
