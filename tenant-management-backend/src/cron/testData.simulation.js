import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../config/db.js";
import { Tenant } from "../modules/tenant/Tenant.Model.js";
import { Rent } from "../modules/rents/rent.Model.js";
import Property from "../modules/tenant/Property.Model.js";
import Block from "../modules/tenant/Block.Model.js";
import InnerBlock from "../modules/tenant/InnerBlock.Model.js";
import { Unit } from "../modules/tenant/units/unit.model.js";
import Admin from "../modules/auth/admin.Model.js";
import { getNepaliMonthDates } from "../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * Test Data Simulation Script
 *
 * This script creates test data for testing the three cron jobs:
 * 1. createRent.cron.js - Creates rents for active tenants on 1st of month
 * 2. sendEmail.cron.js - Sends reminders on reminder day (7 days before month end)
 * 3. overDueRent.cron.js - Marks previous month's unpaid rents as overdue
 *
 * Usage: node src/cron/testData.simulation.js
 */

const createTestData = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log("✅ Connected to database\n");

    // Get current Nepali date info
    const {
      npMonth,
      npYear,
      firstDay,
      lastDay,
      reminderDay,
      englishMonth,
      englishYear,
      englishDueDate,
    } = getNepaliMonthDates();

    // Calculate previous month for overdue test
    let prevMonth = npMonth - 1;
    let prevYear = npYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    console.log("📅 Current Nepali Date Info:");
    console.log(`   Month: ${npMonth}, Year: ${npYear}`);
    console.log(`   First Day: ${firstDay.format("YYYY-MM-DD")}`);
    console.log(`   Reminder Day: ${reminderDay.format("YYYY-MM-DD")}`);
    console.log(`   Last Day: ${lastDay.format("YYYY-MM-DD")}`);
    console.log(`   Previous Month: ${prevMonth}, Year: ${prevYear}\n`);

    // Step 1: Create or find Property
    let property = await Property.findOne({ name: "Test Property" });
    if (!property) {
      property = await Property.create({
        name: "Test Property",
        description: "Test property for cron job testing",
      });
      console.log("✅ Created Property:", property._id);
    } else {
      console.log("✅ Found existing Property:", property._id);
    }

    // Step 2: Create or find Block
    let block = await Block.findOne({
      name: "Test Block A",
      property: property._id,
    });
    if (!block) {
      block = await Block.create({
        name: "Test Block A",
        property: property._id,
      });
      console.log("✅ Created Block:", block._id);
    } else {
      console.log("✅ Found existing Block:", block._id);
    }

    // Step 3: Create or find InnerBlock
    let innerBlock = await InnerBlock.findOne({
      name: "Test Inner Block 1",
      block: block._id,
      property: property._id,
    });
    if (!innerBlock) {
      innerBlock = await InnerBlock.create({
        name: "Test Inner Block 1",
        block: block._id,
        property: property._id,
      });
      console.log("✅ Created InnerBlock:", innerBlock._id);
    } else {
      console.log("✅ Found existing InnerBlock:", innerBlock._id);
    }

    // Step 4: Create or find Units
    const unitNames = [
      "Unit 101",
      "Unit 102",
      "Unit 103",
      "Unit 104",
      "Unit 105",
    ];
    const units = [];
    for (const unitName of unitNames) {
      let unit = await Unit.findOne({
        name: unitName,
        property: property._id,
        block: block._id,
        innerBlock: innerBlock._id,
      });
      if (!unit) {
        unit = await Unit.create({
          name: unitName,
          property: property._id,
          block: block._id,
          innerBlock: innerBlock._id,
          isOccupied: false,
        });
        console.log(`✅ Created Unit: ${unitName}`, unit._id);
      } else {
        console.log(`✅ Found existing Unit: ${unitName}`, unit._id);
      }
      units.push(unit);
    }

    // Step 5: Create or find Admin (for SYSTEM_ADMIN_ID)
    let admin = await Admin.findOne({ email: "system@test.com" });
    if (!admin) {
      admin = await Admin.create({
        name: "System Admin",
        email: "system@test.com",
        password: "Test123!@#", // Will be hashed by pre-save hook
        role: "super_admin",
        phone: "1234567890",
        isEmailVerified: true,
        isActive: true,
      });
      console.log("✅ Created Admin:", admin._id);
      console.log("   ⚠️  Update your .env file: SYSTEM_ADMIN_ID=" + admin._id);
    } else {
      console.log("✅ Found existing Admin:", admin._id);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Creating Test Tenants...");
    console.log("=".repeat(60) + "\n");

    // Step 6: Create Test Tenants with different scenarios
    const testTenants = [
      {
        name: "John Doe",
        email: "john.doe@test.com",
        phone: "9876543210",
        address: "123 Test Street",
        pricePerSqft: 50,
        camRatePerSqft: 10,
        leasedSquareFeet: 1000,
        totalRent: 45000, // Will be calculated: (50 - 5) * 1000 = 45000
        securityDeposit: 100000,
        status: "active",
        isActive: true,
        isDeleted: false,
        units: [units[0]._id],
      },
      {
        name: "Jane Smith",
        email: "jane.smith@test.com",
        phone: "9876543211",
        address: "456 Test Avenue",
        pricePerSqft: 60,
        camRatePerSqft: 12,
        leasedSquareFeet: 1200,
        totalRent: 64800, // Will be calculated: (60 - 6) * 1200 = 64800
        securityDeposit: 150000,
        status: "active",
        isActive: true,
        isDeleted: false,
        units: [units[1]._id],
      },
      {
        name: "Bob Johnson",
        email: "bob.johnson@test.com",
        phone: "9876543212",
        address: "789 Test Road",
        pricePerSqft: 55,
        camRatePerSqft: 11,
        leasedSquareFeet: 800,
        totalRent: 35200, // Will be calculated: (55 - 5.5) * 800 = 35200
        securityDeposit: 80000,
        status: "active",
        isActive: true,
        isDeleted: false,
        units: [units[2]._id],
      },
      {
        name: "Alice Williams",
        email: "alice.williams@test.com",
        phone: "9876543213",
        address: "321 Test Lane",
        pricePerSqft: 70,
        camRatePerSqft: 15,
        leasedSquareFeet: 1500,
        totalRent: 82500, // Will be calculated: (70 - 7) * 1500 = 82500
        securityDeposit: 200000,
        status: "active",
        isActive: true,
        isDeleted: false,
        units: [units[3]._id],
      },
      {
        name: "Charlie Brown",
        email: "charlie.brown@test.com",
        phone: "9876543214",
        address: "654 Test Boulevard",
        pricePerSqft: 45,
        camRatePerSqft: 9,
        leasedSquareFeet: 900,
        totalRent: 32400, // Will be calculated: (45 - 4.5) * 900 = 32400
        securityDeposit: 90000,
        status: "active",
        isActive: true,
        isDeleted: false,
        units: [units[4]._id],
      },
      // Inactive tenant (should not get rent created)
      {
        name: "Inactive Tenant",
        email: "inactive@test.com",
        phone: "9876543215",
        address: "999 Test Street",
        pricePerSqft: 50,
        camRatePerSqft: 10,
        leasedSquareFeet: 1000,
        totalRent: 45000,
        securityDeposit: 100000,
        status: "inactive",
        isActive: false,
        isDeleted: false,
        units: [],
      },
    ];

    const createdTenants = [];
    for (const tenantData of testTenants) {
      // Set dates
      const now = new Date();
      const leaseStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const leaseEnd = new Date(now.getFullYear() + 1, now.getMonth(), 1);

      let tenant = await Tenant.findOne({ email: tenantData.email });
      if (!tenant) {
        tenant = await Tenant.create({
          ...tenantData,
          property: property._id,
          block: block._id,
          innerBlock: innerBlock._id,
          dateOfAgreementSigned: leaseStart,
          leaseStartDate: leaseStart,
          leaseEndDate: leaseEnd,
          keyHandoverDate: leaseStart,
          documents: [
            {
              type: "agreement",
              files: [{ url: "https://example.com/agreement.pdf" }],
            },
          ],
        });
        console.log(`✅ Created Tenant: ${tenant.name} (${tenant.email})`);
      } else {
        // Update tenant to ensure it's active
        tenant.isActive = tenantData.isActive;
        tenant.status = tenantData.status;
        tenant.isDeleted = tenantData.isDeleted;
        await tenant.save();
        console.log(
          `✅ Found/Updated Tenant: ${tenant.name} (${tenant.email})`
        );
      }
      createdTenants.push(tenant);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Creating Test Rents...");
    console.log("=".repeat(60) + "\n");

    // Step 7: Create Test Rents for different scenarios
    const activeTenants = createdTenants.filter(
      (t) => t.isActive && !t.isDeleted
    );

    // Scenario 1: Current month - Pending rent (for email reminder test)
    console.log(
      "📧 Creating rents for EMAIL REMINDER test (current month, pending/partially_paid):"
    );
    for (let i = 0; i < Math.min(2, activeTenants.length); i++) {
      const tenant = activeTenants[i];
      const existingRent = await Rent.findOne({
        tenant: tenant._id,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
      });

      if (!existingRent) {
        const rent = await Rent.create({
          tenant: tenant._id,
          property: property._id,
          block: block._id,
          innerBlock: innerBlock._id,
          units: tenant.units,
          nepaliMonth: npMonth,
          nepaliYear: npYear,
          englishMonth: englishMonth,
          englishYear: englishYear,
          rentAmount: tenant.totalRent,
          paidAmount: i === 0 ? 0 : tenant.totalRent * 0.3, // First is pending, second is partially_paid
          status: i === 0 ? "pending" : "partially_paid",
          nepaliDate: new Date(),
          englishDueDate: new Date(englishDueDate),
          nepaliDueDate: new Date(lastDay.formatEnglishDate("YYYY-MM-DD")),
          createdBy: admin._id,
          lateFee: 0,
          lateFeeApplied: false,
          lateFeeStatus: "pending",
        });
        console.log(
          `   ✅ Created rent for ${tenant.name}: Status=${rent.status}, Amount=${rent.rentAmount}, Paid=${rent.paidAmount}`
        );
      } else {
        console.log(`   ⚠️  Rent already exists for ${tenant.name}`);
      }
    }

    // Scenario 2: Current month - Paid rent (should not get reminder)
    console.log("\n💰 Creating PAID rent (should not receive reminder):");
    if (activeTenants.length > 2) {
      const tenant = activeTenants[2];
      const existingRent = await Rent.findOne({
        tenant: tenant._id,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
      });

      if (!existingRent) {
        const rent = await Rent.create({
          tenant: tenant._id,
          property: property._id,
          block: block._id,
          innerBlock: innerBlock._id,
          units: tenant.units,
          nepaliMonth: npMonth,
          nepaliYear: npYear,
          englishMonth: englishMonth,
          englishYear: englishYear,
          rentAmount: tenant.totalRent,
          paidAmount: tenant.totalRent,
          status: "paid",
          nepaliDate: new Date(),
          englishDueDate: new Date(englishDueDate),
          nepaliDueDate: new Date(lastDay.formatEnglishDate("YYYY-MM-DD")),
          createdBy: admin._id,
          lateFee: 0,
          lateFeeApplied: false,
          lateFeeStatus: "pending",
          lastPaidDate: new Date(),
          lastPaidBy: admin._id,
        });
        console.log(
          `   ✅ Created PAID rent for ${tenant.name}: Amount=${rent.rentAmount}, Paid=${rent.paidAmount}`
        );
      } else {
        console.log(`   ⚠️  Rent already exists for ${tenant.name}`);
      }
    }

    // Scenario 3: Previous month - Pending/Partial rents (for overdue test)
    console.log(
      "\n⏰ Creating OVERDUE test rents (previous month, pending/partial):"
    );
    // Convert to 0-based month for NepaliDate operations
    const prevMonth0 = prevMonth - 1; // 0-based month for NepaliDate
    let prevMonthLastDayDate;

    try {
      // Use the 15th day of previous month as due date (safe default that should always be valid)
      prevMonthLastDayDate = new NepaliDate(prevYear, prevMonth0, 15);
      console.log(
        `   ✅ Created previous month due date: ${prevMonthLastDayDate.format(
          "YYYY-MM-DD"
        )}`
      );
    } catch (error) {
      console.error(`❌ Error creating previous month date: ${error.message}`);
      console.log(
        `   Attempted: Year=${prevYear}, Month=${prevMonth} (1-based), Month0=${prevMonth0} (0-based)`
      );
      // Fallback: use current date
      prevMonthLastDayDate = new NepaliDate();
      console.log(
        `   Using current date as fallback: ${prevMonthLastDayDate.format(
          "YYYY-MM-DD"
        )}`
      );
    }

    for (let i = 0; i < Math.min(2, activeTenants.length); i++) {
      const tenant = activeTenants[i + 3] || activeTenants[i]; // Use different tenants if available
      const existingRent = await Rent.findOne({
        tenant: tenant._id,
        nepaliMonth: prevMonth,
        nepaliYear: prevYear,
      });

      if (!existingRent) {
        const rent = await Rent.create({
          tenant: tenant._id,
          property: property._id,
          block: block._id,
          innerBlock: innerBlock._id,
          units: tenant.units,
          nepaliMonth: prevMonth,
          nepaliYear: prevYear,
          englishMonth: prevMonth === 12 ? 1 : prevMonth + 1, // Approximate
          englishYear: prevYear - 57, // Approximate conversion
          rentAmount: tenant.totalRent,
          paidAmount: i === 0 ? 0 : tenant.totalRent * 0.2,
          status: i === 0 ? "pending" : "partially_paid", // Will be marked overdue by cron
          nepaliDate: new Date(),
          englishDueDate: new Date(
            prevMonthLastDayDate.formatEnglishDate("YYYY-MM-DD")
          ),
          nepaliDueDate: new Date(
            prevMonthLastDayDate.formatEnglishDate("YYYY-MM-DD")
          ),
          createdBy: admin._id,
          lateFee: 0,
          lateFeeApplied: false,
          lateFeeStatus: "pending",
        });
        console.log(
          `   ✅ Created previous month rent for ${tenant.name}: Status=${rent.status}, Month=${prevMonth}/${prevYear}`
        );
      } else {
        console.log(
          `   ⚠️  Rent already exists for ${tenant.name} (${prevMonth}/${prevYear})`
        );
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Test Data Creation Complete!");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    console.log(`   • Property: 1`);
    console.log(`   • Block: 1`);
    console.log(`   • InnerBlock: 1`);
    console.log(`   • Units: ${units.length}`);
    console.log(
      `   • Tenants: ${createdTenants.length} (${activeTenants.length} active)`
    );
    console.log(`   • Admin: 1 (ID: ${admin._id})`);
    console.log("\n🧪 Test Scenarios Created:");
    console.log(`   1. Current month PENDING rent (for email reminder)`);
    console.log(`   2. Current month PARTIALLY_PAID rent (for email reminder)`);
    console.log(`   3. Current month PAID rent (should NOT get reminder)`);
    console.log(`   4. Previous month PENDING rent (will be marked overdue)`);
    console.log(
      `   5. Previous month PARTIALLY_PAID rent (will be marked overdue)`
    );
    console.log("\n⚠️  Important Notes:");
    console.log(
      `   • Note: overDueRent.cron.js uses "partial" in query but model enum is "partially_paid"`
    );
    console.log(
      `     You may need to update the cron to use "partially_paid" to match the model.`
    );
    console.log(
      `   • Make sure SYSTEM_ADMIN_ID=${admin._id} is set in your .env file`
    );
    console.log(
      `   • Email cron will run on reminder day: ${reminderDay.format(
        "YYYY-MM-DD"
      )}`
    );
    console.log(
      `   • Overdue cron will mark rents from month: ${prevMonth}/${prevYear}`
    );
    console.log(
      `   • Create rent cron will run on 1st day of month: ${firstDay.format(
        "YYYY-MM-DD"
      )}`
    );
    console.log("\n✨ You can now test the cron jobs!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test data:", error);
    process.exit(1);
  }
};

// Run the script
createTestData();
