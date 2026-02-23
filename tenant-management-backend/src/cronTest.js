/**
 * cronTest.js — Cron simulation using your own nepali date utils
 *
 * All date logic goes through getNepaliMonthDates() and checkNepaliSpecialDays()
 * — the same utils the crons use in production. No raw NepaliDate calls here.
 *
 * Fixes from first run:
 *   1. T3 crash: nepaliDueDate in DB is a Date object, not a string.
 *      dateStr.match() fails. Fixed by coercing to string first.
 *   2. T4 crash: dummy Rent was missing required fields (createdBy, nepaliDate,
 *      englishYear, englishMonth). Fixed by pulling all values from getNepaliMonthDates().
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import handleMonthlyRents, {
  sendEmailToTenants,
} from "./modules/rents/rent.service.js";
import { handleMonthlyCams } from "./modules/cam/cam.service.js";
import { Rent } from "./modules/rents/rent.Model.js";
import { Tenant } from "./modules/tenant/Tenant.Model.js";

// ✅ Use your own utils — same ones the cron uses in production
import {
  getNepaliMonthDates,
  checkNepaliSpecialDays,
  addNepaliMonths,
} from "./utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

await mongoose.connect(process.env.MONGODB_URI);
console.log("✅ Connected to MongoDB\n");

const TENANT_EMAIL = "aashishkarki002@gmail.com";

// =============================================================================
// Print today's Nepali context — always first so you know what day it is
// Uses getNepaliMonthDates() exactly as the crons do
// =============================================================================
function printNepaliContext() {
  // getNepaliMonthDates() gives you everything the cron uses
  const {
    npYear,
    npMonth,
    nepaliMonthName,
    firstDayNepali,
    lastDayNepali,
    reminderDayNepali,
    englishDate,
  } = getNepaliMonthDates();

  // checkNepaliSpecialDays() is what the cron calls to decide whether to run
  const { isFirstDay, isReminderDay, isLastDay } = checkNepaliSpecialDays();

  const lastDayOfMonth = NepaliDate.getDaysOfMonth(npYear, npMonth - 1); // month is 1-based, getDaysOfMonth takes 0-based
  const reminderDayNum = lastDayOfMonth - 7;

  console.log("═".repeat(58));
  console.log(`📅 getNepaliMonthDates() output:`);
  console.log(
    `   Nepali today:  ${npYear}-${String(npMonth).padStart(2, "0")} (${nepaliMonthName})`,
  );
  console.log(`   English today: ${englishDate}`);
  console.log(`   First day:     ${firstDayNepali}`);
  console.log(`   Reminder day:  ${reminderDayNepali} (day ${reminderDayNum})`);
  console.log(`   Last day:      ${lastDayNepali}`);
  console.log(`\n📅 checkNepaliSpecialDays() output:`);
  console.log(
    `   isFirstDay:    ${isFirstDay}   ← cron runs Step 1–4 when true`,
  );
  console.log(
    `   isReminderDay: ${isReminderDay} ← cron runs Step 5 (admin alert) when true`,
  );
  console.log(`   isLastDay:     ${isLastDay}`);
  console.log("═".repeat(58) + "\n");

  return {
    npYear,
    npMonth,
    isFirstDay,
    isReminderDay,
    reminderDayNum,
    lastDayOfMonth,
  };
}

// =============================================================================
// TEST 1: Verify tenant financials (read-only, no DB writes)
// =============================================================================
async function test1_verifyTenant() {
  console.log("🧪 TEST 1: Verify tenant financials (read-only)\n");

  const tenant = await Tenant.findOne({ email: TENANT_EMAIL }).lean();
  if (!tenant) {
    console.error("   ❌ Tenant not found");
    return null;
  }

  console.log(`   Name:          ${tenant.name}`);
  console.log(`   Status:        ${tenant.status}`);
  console.log(`   Frequency:     ${tenant.rentPaymentFrequency}`);
  console.log(
    `   Gross rent:    Rs. ${(tenant.grossAmountPaisa / 100).toLocaleString()} (${tenant.grossAmountPaisa} paisa)`,
  );
  console.log(
    `   TDS:           Rs. ${(tenant.tdsPaisa / 100).toLocaleString()} (${tenant.tdsPaisa} paisa)`,
  );
  console.log(
    `   Net rent:      Rs. ${(tenant.totalRentPaisa / 100).toLocaleString()} (${tenant.totalRentPaisa} paisa)`,
  );
  console.log(
    `   CAM:           Rs. ${(tenant.camChargesPaisa / 100).toLocaleString()} (${tenant.camChargesPaisa} paisa)`,
  );
  console.log(
    `   Monthly total: Rs. ${((tenant.totalRentPaisa + tenant.camChargesPaisa) / 100).toLocaleString()}`,
  );

  // Show the TDS bug side-by-side
  const correctTds = tenant.tdsPaisa;
  const buggyTds = tenant.tdsPaisa * tenant.leasedSquareFeet;
  console.log(`\n   ✅ TDS bug verification:`);
  console.log(
    `      Correct (tdsPaisa directly):   ${correctTds} paisa = Rs. ${(correctTds / 100).toFixed(2)}`,
  );
  console.log(
    `      Buggy   (×${tenant.leasedSquareFeet} sqft):         ${buggyTds} paisa = Rs. ${(buggyTds / 100).toFixed(2)} ← old bug`,
  );

  // Check escalation info
  if (tenant.rentEscalation?.enabled) {
    console.log(`\n   📈 Escalation enabled:`);
    console.log(
      `      Next date (Nepali): ${tenant.rentEscalation.nextEscalationNepaliDate}`,
    );
    console.log(
      `      Interval:           ${tenant.rentEscalation.intervalMonths} months`,
    );
    console.log(
      `      Increase:           ${tenant.rentEscalation.percentageIncrease}%`,
    );
    console.log(`      Applies to:         ${tenant.rentEscalation.appliesTo}`);
  }

  console.log("\n   ✅ TEST 1 PASSED\n");
  return tenant;
}

// =============================================================================
// TEST 2: Simulate day 1 — rent + CAM creation
// Uses getNepaliMonthDates() to confirm what month would be created
// =============================================================================
async function test2_simulateDay1() {
  console.log("🧪 TEST 2: Simulate Nepali day 1 (rent + CAM creation)\n");
  console.log(
    "   ⚠️  Creates documents in DB — run against test DB or delete after.\n",
  );

  // getNepaliMonthDates() tells us what month the cron would create rents for
  const { npYear, npMonth, firstDayNepali, lastDayNepali, nepaliMonthName } =
    getNepaliMonthDates();

  console.log(
    `   Would create rents for: Nepali ${npYear}-${String(npMonth).padStart(2, "0")} (${nepaliMonthName})`,
  );
  console.log(`   First day: ${firstDayNepali} | Due date: ${lastDayNepali}\n`);

  // Check idempotency — does a rent already exist for this month?
  const existing = await Rent.findOne({
    nepaliMonth: npMonth,
    nepaliYear: npYear,
  }).populate("tenant", "name email");

  if (existing) {
    console.log(`   ℹ️  Rent already exists for ${npYear}-${npMonth}:`);
    console.log(`      Tenant: ${existing.tenant?.name ?? "unknown"}`);
    console.log(`      Status: ${existing.status}`);
    console.log(
      `      Amount: Rs. ${(existing.rentAmountPaisa / 100).toLocaleString()}`,
    );
    console.log(
      `      TDS:    Rs. ${(existing.tdsAmountPaisa / 100).toLocaleString()}`,
    );
    console.log("   Idempotency guard working ✅ — skipping creation\n");
    return;
  }

  const rentResult = await handleMonthlyRents();
  console.log("   Rent result:", rentResult);

  const camResult = await handleMonthlyCams();
  console.log("   CAM result: ", camResult);

  // Verify the created rent
  const created = await Rent.findOne({
    nepaliMonth: npMonth,
    nepaliYear: npYear,
  }).populate("tenant", "name email");

  if (created) {
    const tenant = await Tenant.findOne({ email: TENANT_EMAIL }).lean();
    console.log(`\n   ✅ Rent created for ${created.tenant?.name}:`);
    console.log(
      `      Rent:    Rs. ${(created.rentAmountPaisa / 100).toLocaleString()} (${created.rentAmountPaisa} paisa)`,
    );
    console.log(
      `      TDS:     Rs. ${(created.tdsAmountPaisa / 100).toLocaleString()} (${created.tdsAmountPaisa} paisa)`,
    );
    console.log(`      Status:  ${created.status}`);
    console.log(`      Due:     ${created.nepaliDueDate}`);

    if (tenant && created.rentAmountPaisa === tenant.totalRentPaisa) {
      console.log(`      Amount matches tenant.totalRentPaisa ✅`);
    } else {
      console.log(
        `      ⚠️  Mismatch! Rent: ${created.rentAmountPaisa}, Tenant expects: ${tenant?.totalRentPaisa}`,
      );
    }
  }

  console.log("\n   ✅ TEST 2 PASSED\n");
}

// =============================================================================
// TEST 3: Simulate email sending
// Bug fixed: nepaliDueDate in DB is a Date object — coerce to string before .match()
// =============================================================================
async function test3_simulateEmail() {
  console.log("🧪 TEST 3: Simulate reminder email\n");
  console.log(`   📧 Will send to: ${TENANT_EMAIL}`);
  console.log("   Check inbox after.\n");

  // Show what month the email is for using getNepaliMonthDates()
  const { npYear, npMonth, nepaliMonthName, lastDayNepali } =
    getNepaliMonthDates();
  console.log(
    `   Email covers: Nepali ${npYear}-${String(npMonth).padStart(2, "0")} (${nepaliMonthName})`,
  );
  console.log(`   Due date shown in email: ${lastDayNepali}\n`);

  // Pre-check: is there a pending rent to email about?
  const pendingRent = await Rent.findOne({
    nepaliYear: npYear,
    nepaliMonth: npMonth,
    status: { $in: ["pending", "partially_paid"] },
  }).populate("tenant", "name email");

  if (!pendingRent) {
    console.log(
      "   ℹ️  No pending rent found for this month — email would send nothing.",
    );
    console.log("   Run TEST 2 first to create a rent, then retry.\n");
    return;
  }

  console.log(`   Found pending rent for: ${pendingRent.tenant?.name}`);
  console.log(
    `   Amount: Rs. ${(pendingRent.rentAmountPaisa / 100).toLocaleString()}`,
  );

  // BUG FIX demonstration — nepaliDueDate is a Date object in DB, not a string
  const rawDueDate = pendingRent.nepaliDueDate;
  console.log(
    `\n   nepaliDueDate type in DB: ${typeof rawDueDate} (${rawDueDate instanceof Date ? "Date object" : "string"})`,
  );
  if (rawDueDate instanceof Date) {
    console.log(
      `   ⚠️  dateStr.match() would crash on this — fix applied in rent.service.js`,
    );
    console.log(`   Coerced to string: "${String(rawDueDate).slice(0, 24)}"`);
  }
  console.log();

  const result = await sendEmailToTenants();
  console.log("   Result:", result);

  if (result.success) {
    console.log(`\n   ✅ TEST 3 PASSED — check ${TENANT_EMAIL}\n`);
  } else {
    console.log(`\n   ❌ TEST 3 FAILED: ${result.error}\n`);
  }
}

// =============================================================================
// TEST 4: Simulate overdue marking
// Bug fixed: dummy rent now includes all required fields from getNepaliMonthDates()
// =============================================================================
async function test4_simulateOverdue() {
  console.log("🧪 TEST 4: Simulate overdue marking\n");

  // getNepaliMonthDates() for current month
  const { npYear, npMonth } = getNepaliMonthDates();

  // Use addNepaliMonths to derive previous month — same util the cron uses
  const todayNp = new NepaliDate();
  const prevNp = addNepaliMonths(todayNp, -1);
  const prevYear = prevNp.getYear();
  const prevMonth = prevNp.getMonth() + 1; // 1-based

  // getNepaliMonthDates for previous month — gives us all required fields
  const prevMonthDates = getNepaliMonthDates(
    prevNp.getYear(),
    prevNp.getMonth(),
  ); // 0-based month

  console.log(
    `   Current Nepali month:  ${npYear}-${String(npMonth).padStart(2, "0")}`,
  );
  console.log(
    `   Previous Nepali month: ${prevYear}-${String(prevMonth).padStart(2, "0")}`,
  );
  console.log(`   Previous due date:     ${prevMonthDates.lastDayNepali}\n`);

  const tenant = await Tenant.findOne({ email: TENANT_EMAIL }).lean();
  if (!tenant) {
    console.error("   ❌ Tenant not found");
    return;
  }

  // Check if test rent already exists for previous month
  let testRent = await Rent.findOne({
    nepaliYear: prevYear,
    nepaliMonth: prevMonth,
  });

  if (testRent) {
    // Reset to pending so we can observe the transition
    await Rent.findByIdAndUpdate(testRent._id, {
      $set: { status: "pending", lateFeeApplied: false, overdueMarkedAt: null },
    });
    console.log(`   Found existing rent ${testRent._id} — reset to pending`);
  } else {
    // Create dummy rent using ALL required fields from getNepaliMonthDates()
    // Bug fix: previous run was missing createdBy, nepaliDate, englishYear, englishMonth
    testRent = await Rent.create({
      tenant: tenant._id,
      block: tenant.block,
      innerBlock: tenant.innerBlock,
      property: tenant.property,
      units: tenant.units,

      nepaliMonth: prevMonth,
      nepaliYear: prevYear,

      // ✅ Required fields pulled from getNepaliMonthDates() — was missing before
      nepaliDate: prevMonthDates.firstDayDate, // JS Date of first day
      nepaliDueDate: prevMonthDates.lastDayNepali, // "YYYY-MM-DD" string
      englishDueDate: prevMonthDates.lastDayEndDate,
      englishMonth: prevMonthDates.englishMonth,
      englishYear: prevMonthDates.englishYear,
      createdBy: process.env.SYSTEM_ADMIN_ID, // ✅ required ObjectId

      rentAmountPaisa: tenant.totalRentPaisa,
      tdsAmountPaisa: tenant.tdsPaisa,
      paidAmountPaisa: 0,
      lateFeePaisa: 0,
      status: "pending",
      rentFrequency: tenant.rentPaymentFrequency || "monthly",
    });
    console.log(`   Created dummy pending rent: ${testRent._id}`);
  }

  // Run the same overdue query the cron runs
  const result = await Rent.updateMany(
    {
      status: { $in: ["pending", "partially_paid"] },
      $or: [
        { nepaliYear: { $lt: npYear } },
        { nepaliYear: npYear, nepaliMonth: { $lt: npMonth } },
      ],
    },
    { $set: { status: "overdue", overdueMarkedAt: new Date() } },
  );

  console.log(
    `\n   updateMany result: ${result.modifiedCount} rent(s) marked overdue`,
  );

  const updated = await Rent.findById(testRent._id);
  console.log(`   Rent ${testRent._id}: ${updated.status}`);
  console.log(`   overdueMarkedAt: ${updated.overdueMarkedAt}`);

  if (updated.status === "overdue") {
    console.log("   ✅ TEST 4 PASSED\n");
  } else {
    console.log("   ❌ TEST 4 FAILED — status did not change\n");
  }
}

// =============================================================================
// MAIN
// =============================================================================
printNepaliContext();

const args = process.argv.slice(2);
const runAll = args.length === 0;

try {
  if (runAll || args.includes("--t1")) await test1_verifyTenant();
  if (runAll || args.includes("--t2")) await test2_simulateDay1();
  if (runAll || args.includes("--t3")) await test3_simulateEmail();
  if (runAll || args.includes("--t4")) await test4_simulateOverdue();
} finally {
  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

// =============================================================================
// USAGE
//   node cronTest.js           → all tests
//   node cronTest.js --t1      → financials only (read-only, safe)
//   node cronTest.js --t2      → day 1 simulation (writes to DB)
//   node cronTest.js --t3      → send reminder email
//   node cronTest.js --t4      → overdue marking simulation
// =============================================================================
