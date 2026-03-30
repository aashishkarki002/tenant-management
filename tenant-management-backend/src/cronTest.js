/**
 * scripts/runMorningCronNow.js
 *
 * Manually triggers today's morning cron (createAndNotifyMorning)
 * without waiting for the 07:30 schedule.
 *
 * Usage:
 *   node --experimental-vm-modules scripts/runMorningCronNow.js
 */

import { connectDB } from "./config/db.js";
import { createAndNotifyMorning } from "./cron/service/dailyCheck.cron.js";
import "./modules/property/Property.Model.js";
import "./modules/blocks/Block.Model.js";
import "./modules/auth/admin.Model.js";
import "./modules/maintenance/Maintenance.Model.js";
import "./modules/notifications/notification.model.js";
import "./modules/dailyChecks/checkListTemplate.model.js";
import "./modules/dailyChecks/checkListResult.model.js";
import dotenv from "dotenv";
dotenv.config();
await connectDB();
console.log("✅ Connected to MongoDB\n");

await createAndNotifyMorning();

console.log("\n✅ Done");
