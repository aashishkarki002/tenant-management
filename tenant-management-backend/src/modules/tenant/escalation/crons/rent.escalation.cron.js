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
import NepaliDate from "nepali-datetime";
import { processDueEscalations } from "../rent.escalation.service.js";
import { formatNepaliISO } from "../../../../utils/nepaliDateHelper.js";
import { getCurrentQuarterInfo } from "../../../../utils/quarterlyRentHelper.js";
export function startEscalationCron() {
  // 00:05 every day — runs slightly after midnight to avoid edge cases
  cron.schedule("5 0 * * *", async () => {
    const now = new Date();
    const todayNp = new NepaliDate(now);
    const { quarter, year } = getCurrentQuarterInfo();

    console.log(
      `[EscalationCron] ▶ Started at ${now.toISOString()} ` +
        `| Nepali: ${formatNepaliISO(todayNp)} | Q${quarter} ${year}`,
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
  });

  console.log("✅ Escalation cron scheduled — runs daily at 00:05");
}
