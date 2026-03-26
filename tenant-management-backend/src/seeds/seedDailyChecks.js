/**
 * seedDailyChecklists.js
 *
 * Run once to bootstrap the Template + Result system for all existing
 * properties and blocks in the database.
 *
 * What it does:
 *   1. Finds the first super_admin to use as createdBy
 *   2. Finds all active Properties
 *   3. For each property → finds all its Blocks
 *   4. For each block × DAILY_CATEGORIES → creates a ChecklistTemplate (if not already present)
 *   5. For each template → creates a ChecklistResult for today (if not already present)
 *
 * Safe to run multiple times — fully idempotent at every step.
 *
 * Usage:
 *   node src/seeds/seedDailyChecklists.js
 *
 * Or add to package.json:
 *   "seed:checklists": "node src/seeds/seedDailyChecklists.js"
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { ChecklistTemplate } from "../modules/dailyChecks/checkListTemplate.model.js";
import { ChecklistResult } from "../modules/dailyChecks/checkListResult.model.js";
import { buildChecklistSections } from "../modules/dailyChecks/checkListTemplate.js";
import { getNepaliToday, formatNepaliISO } from "../utils/nepaliDateHelper.js";

// ── Load env (adjust path if your .env is elsewhere) ─────────────────────────
dotenv.config();

// ── Import your existing models ───────────────────────────────────────────────
// Adjust these import paths to match your actual file locations.
import Property from "../modules/property/Property.Model.js";
import { Block } from "../modules/blocks/Block.Model.js";
import Admin from "../modules/auth/admin.Model.js";

// ─── Categories to seed ───────────────────────────────────────────────────────
// These are the 7 daily categories. Remove any that don't apply to your property.

const DAILY_CATEGORIES = [
  "COMMON_AREA",
  "ELECTRICAL",
  "SANITARY",
  "WATER_TANK",
  "CCTV",
  "PARKING",
  "FIRE",
];

// ─── Main seeder ──────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  // ── Step 1: Find a super_admin to use as createdBy ────────────────────────
  const admin = await Admin.findOne({
    role: { $in: ["super_admin", "admin"] },
    isActive: true,
    isDeleted: { $ne: true },
  })
    .select("_id name")
    .lean();

  if (!admin) {
    console.error("❌ No active admin found. Create an admin account first.");
    process.exit(1);
  }
  console.log(`👤 Using admin: ${admin.name} (${admin._id})\n`);

  // ── Step 2: Get today in Nepali ────────────────────────────────────────────
  const { englishToday, npToday, bsYear, bsMonth, bsDay } = getNepaliToday();
  const bsDate = formatNepaliISO(npToday);
  console.log(
    `📅 Today (BS): ${bsDate}  |  English: ${englishToday.toDateString()}\n`,
  );

  // ── Step 3: Fetch all properties ───────────────────────────────────────────
  const properties = await Property.find({
    isDeleted: { $ne: true },
  })
    .select("_id name buildingConfig")
    .lean();

  if (!properties.length) {
    console.warn("⚠️  No properties found. Nothing to seed.");
    process.exit(0);
  }

  console.log(`🏢 Found ${properties.length} property/properties\n`);

  let templatesCreated = 0;
  let templatesSkipped = 0;
  let resultsCreated = 0;
  let resultsSkipped = 0;

  for (const property of properties) {
    console.log(`── Property: ${property.name} (${property._id})`);

    // ── Step 4: Find all blocks for this property ──────────────────────────
    const blocks = await Block.find({
      property: property._id,
      isDeleted: { $ne: true },
    })
      .select("_id name buildingConfig")
      .lean();

    if (!blocks.length) {
      console.log(`   ⚠️  No blocks found — skipping\n`);
      continue;
    }

    console.log(
      `   📦 ${blocks.length} block(s): ${blocks.map((b) => b.name).join(", ")}`,
    );

    for (const block of blocks) {
      console.log(`\n   ┌── Block: ${block.name} (${block._id})`);

      // buildingConfig can live on the block or fall back to the property level
      const buildingConfig =
        block.buildingConfig ?? property.buildingConfig ?? {};

      for (const category of DAILY_CATEGORIES) {
        // ── Step 5a: Create template if it doesn't exist ──────────────────
        const existingTemplate = await ChecklistTemplate.findOne({
          property: property._id,
          block: block._id,
          category,
          checklistType: "DAILY",
        })
          .select("_id totalItems")
          .lean();

        let templateId;
        let totalItems;

        if (existingTemplate) {
          templateId = existingTemplate._id;
          totalItems = existingTemplate.totalItems;
          templatesSkipped++;
          console.log(
            `   │  [TEMPLATE] ${category.padEnd(12)} — already exists (${totalItems} items)`,
          );
        } else {
          // Build sections from the factory
          let sections;
          try {
            sections = buildChecklistSections(
              category,
              buildingConfig,
              "DAILY",
            );
          } catch (err) {
            console.error(
              `   │  [TEMPLATE] ${category} — ❌ buildChecklistSections failed: ${err.message}`,
            );
            continue;
          }

          const template = await ChecklistTemplate.create({
            property: property._id,
            block: block._id,
            category,
            checklistType: "DAILY",
            name: `${block.name} – ${category} Daily`,
            sections,
            buildingConfig,
            isActive: true,
            createdBy: admin._id,
            lastRebuiltAt: new Date(),
            lastRebuiltBy: admin._id,
          });

          templateId = template._id;
          totalItems = template.totalItems;
          templatesCreated++;
          console.log(
            `   │  [TEMPLATE] ${category.padEnd(12)} — ✅ created  (${totalItems} items, ${template.sections.length} sections)`,
          );
        }

        // ── Step 5b: Create today's result if it doesn't exist ────────────
        const startOfDay = new Date(englishToday);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(englishToday);
        endOfDay.setHours(23, 59, 59, 999);

        const existingResult = await ChecklistResult.findOne({
          template: templateId,
          checkDate: { $gte: startOfDay, $lte: endOfDay },
        })
          .select("_id status")
          .lean();

        if (existingResult) {
          resultsSkipped++;
          console.log(
            `   │  [RESULT]   ${category.padEnd(12)} — already exists (status: ${existingResult.status})`,
          );
        } else {
          await ChecklistResult.create({
            template: templateId,
            property: property._id,
            block: block._id,
            category,
            checklistType: "DAILY",
            checkDate: englishToday,
            nepaliDate: bsDate,
            nepaliMonth: bsMonth,
            nepaliYear: bsYear,
            itemResults: [], // empty — no checks done yet
            totalItems, // copied from template so queries never need a join
            passedItems: 0, // 0 until submitted
            failedItems: 0,
            hasIssues: false,
            status: "PENDING",
            createdBy: admin._id,
          });

          resultsCreated++;
          console.log(
            `   │  [RESULT]   ${category.padEnd(12)} — ✅ created  (PENDING, 0/${totalItems} checked)`,
          );
        }
      }

      console.log(`   └──`);
    }

    console.log("");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("─────────────────────────────────────────");
  console.log("Seed complete:");
  console.log(
    `  Templates  — created: ${templatesCreated},  skipped: ${templatesSkipped}`,
  );
  console.log(
    `  Results    — created: ${resultsCreated},  skipped: ${resultsSkipped}`,
  );
  console.log("─────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
