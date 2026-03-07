/**
 * tenant.search.test.js
 *
 * Production-ready integration tests for tenant search API
 *
 * TESTING STRATEGY:
 *   1. Unit tests for individual filter types
 *   2. Integration tests for combined filters
 *   3. Edge case validation
 *   4. Performance benchmarks
 *   5. Error handling verification
 *
 * RUN:
 *   npm test -- tenant.search.test.js
 *   npm run test:watch -- tenant.search.test.js
 */

import mongoose from "mongoose";
import { searchTenants } from "../modules/tenant/tenant.service.js";
import { Tenant } from "../modules/tenant/Tenant.Model.js";
import { Rent } from "../modules/rents/rent.Model.js";
import { Cam } from "../modules/cam/cam.model.js";
import { Property } from "../modules/property/property.Model.js";
import { Block } from "../modules/blocks/block.Model.js";
import { InnerBlock } from "../modules/innerBlocks/innerBlock.Model.js";
import { Unit } from "../modules/units/Unit.Model.js";

describe("Tenant Search API", () => {
  let testProperty, testBlock, testInnerBlock, testUnit1, testUnit2;
  let activeTenant, inactiveTenant, vacatedTenant;

  // ────────────────────────────────────────────────────────────────────────
  // SETUP & TEARDOWN
  // ────────────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/tenant-test");
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean slate
    await Promise.all([
      Tenant.deleteMany({}),
      Rent.deleteMany({}),
      Cam.deleteMany({}),
      Property.deleteMany({}),
      Block.deleteMany({}),
      InnerBlock.deleteMany({}),
      Unit.deleteMany({}),
    ]);

    // Create test hierarchy
    testProperty = await Property.create({
      name: "Test Tower",
      address: "Kathmandu",
      description: "Test property",
    });

    testBlock = await Block.create({
      name: "Block A",
      property: testProperty._id,
    });

    testInnerBlock = await InnerBlock.create({
      name: "Floor 1",
      block: testBlock._id,
      property: testProperty._id,
    });

    testUnit1 = await Unit.create({
      unitNumber: "A-101",
      sqft: 1000,
      price: 500000,
      property: testProperty._id,
      block: testBlock._id,
      innerBlock: testInnerBlock._id,
      isOccupied: true,
    });

    testUnit2 = await Unit.create({
      unitNumber: "A-102",
      sqft: 1200,
      price: 600000,
      property: testProperty._id,
      block: testBlock._id,
      innerBlock: testInnerBlock._id,
      isOccupied: true,
    });

    // Create test tenants
    const now = new Date();
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    activeTenant = await Tenant.create({
      name: "Raj Kumar",
      email: "raj@example.com",
      phone: "9841234567",
      address: "Kathmandu",
      status: "active",
      property: testProperty._id,
      block: testBlock._id,
      innerBlock: testInnerBlock._id,
      units: [testUnit1._id],
      pricePerSqft: 500,
      pricePerSqftPaisa: 50000,
      camRatePerSqft: 50,
      camRatePerSqftPaisa: 5000,
      leasedSquareFeet: 1000,
      securityDepositPaisa: 15000000,
      totalRentPaisa: 50000000,
      camChargesPaisa: 5000000,
      rentPaymentFrequency: "monthly",
      leaseStartDate: past,
      leaseEndDate: future30, // Expiring in 30 days
      dateOfAgreementSigned: past,
      keyHandoverDate: past,
    });

    inactiveTenant = await Tenant.create({
      name: "Sita Sharma",
      email: "sita@example.com",
      phone: "9851234567",
      address: "Lalitpur",
      status: "inactive",
      property: testProperty._id,
      block: testBlock._id,
      innerBlock: testInnerBlock._id,
      units: [testUnit2._id],
      pricePerSqft: 600,
      pricePerSqftPaisa: 60000,
      camRatePerSqft: 60,
      camRatePerSqftPaisa: 6000,
      leasedSquareFeet: 1200,
      securityDepositPaisa: 18000000,
      totalRentPaisa: 72000000,
      camChargesPaisa: 7200000,
      rentPaymentFrequency: "quarterly",
      leaseStartDate: past,
      leaseEndDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year away
      dateOfAgreementSigned: past,
      keyHandoverDate: past,
    });

    vacatedTenant = await Tenant.create({
      name: "Hari Bahadur",
      email: "hari@example.com",
      phone: "9861234567",
      address: "Bhaktapur",
      status: "vacated",
      property: testProperty._id,
      block: testBlock._id,
      innerBlock: testInnerBlock._id,
      units: [testUnit1._id],
      pricePerSqft: 450,
      pricePerSqftPaisa: 45000,
      camRatePerSqft: 45,
      camRatePerSqftPaisa: 4500,
      leasedSquareFeet: 1000,
      securityDepositPaisa: 13500000,
      totalRentPaisa: 45000000,
      camChargesPaisa: 4500000,
      rentPaymentFrequency: "monthly",
      leaseStartDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      leaseEndDate: past, // Already expired
      dateOfAgreementSigned: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      keyHandoverDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // BASIC FILTERING TESTS
  // ────────────────────────────────────────────────────────────────────────

  describe("Status Filter", () => {
    it("should filter by single status", async () => {
      const result = await searchTenants({ status: "active" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
      expect(result[0].status).toBe("active");
    });

    it("should filter by multiple statuses", async () => {
      const result = await searchTenants({ status: ["active", "inactive"] });
      expect(result).toHaveLength(2);
      const names = result.map((t) => t.name).sort();
      expect(names).toEqual(["Raj Kumar", "Sita Sharma"]);
    });

    it("should return all tenants if no status filter", async () => {
      const result = await searchTenants({});
      expect(result).toHaveLength(3);
    });

    it("should ignore invalid status values", async () => {
      const result = await searchTenants({ status: ["active", "invalid"] });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("active");
    });
  });

  describe("Text Search", () => {
    it("should search by name", async () => {
      const result = await searchTenants({ search: "raj" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
    });

    it("should search by email", async () => {
      const result = await searchTenants({ search: "sita@" });
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("sita@example.com");
    });

    it("should search by phone", async () => {
      const result = await searchTenants({ search: "9841" });
      expect(result).toHaveLength(1);
      expect(result[0].phone).toBe("9841234567");
    });

    it("should be case-insensitive", async () => {
      const result = await searchTenants({ search: "RAJ" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
    });

    it("should handle special regex characters", async () => {
      // Should not throw error
      const result = await searchTenants({ search: "test[.*]" });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Location Filters", () => {
    it("should filter by block", async () => {
      const result = await searchTenants({ block: testBlock._id.toString() });
      expect(result).toHaveLength(3);
    });

    it("should filter by innerBlock", async () => {
      const result = await searchTenants({
        innerBlock: testInnerBlock._id.toString(),
      });
      expect(result).toHaveLength(3);
    });

    it("should throw error for invalid block ID", async () => {
      await expect(searchTenants({ block: "invalid-id" })).rejects.toThrow(
        "Invalid block ID format"
      );
    });

    it("should throw error for invalid innerBlock ID", async () => {
      await expect(
        searchTenants({ innerBlock: "invalid-id" })
      ).rejects.toThrow("Invalid innerBlock ID format");
    });
  });

  describe("Billing Frequency Filter", () => {
    it("should filter by monthly frequency", async () => {
      const result = await searchTenants({ frequency: "monthly" });
      expect(result).toHaveLength(2);
      const names = result.map((t) => t.name).sort();
      expect(names).toEqual(["Hari Bahadur", "Raj Kumar"]);
    });

    it("should filter by quarterly frequency", async () => {
      const result = await searchTenants({ frequency: "quarterly" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Sita Sharma");
    });

    it("should filter by multiple frequencies", async () => {
      const result = await searchTenants({
        frequency: ["monthly", "quarterly"],
      });
      expect(result).toHaveLength(3);
    });
  });

  describe("Lease Status Filter", () => {
    it("should filter expiring soon leases", async () => {
      const result = await searchTenants({ lease: "expiring_soon" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
    });

    it("should filter expired leases", async () => {
      const result = await searchTenants({ lease: "expired" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Hari Bahadur");
    });

    it("should filter both expiring and expired", async () => {
      const result = await searchTenants({
        lease: ["expiring_soon", "expired"],
      });
      expect(result).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // PAYMENT STATUS TESTS
  // ────────────────────────────────────────────────────────────────────────

  describe("Payment Status Computation", () => {
    beforeEach(async () => {
      const now = new Date();
      const dueSoon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
      const overdue = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // -5 days

      // Create paid rent for Raj
      await Rent.create({
        tenant: activeTenant._id,
        property: testProperty._id,
        block: testBlock._id,
        innerBlock: testInnerBlock._id,
        rentAmountPaisa: 50000000,
        paidAmountPaisa: 50000000,
        tdsAmountPaisa: 5000000,
        status: "paid",
        dueDate: now,
        englishMonth: now.getMonth() + 1,
        englishYear: now.getFullYear(),
        nepaliMonth: 10,
        nepaliYear: 2080,
        rentFrequency: "monthly",
      });

      // Create due soon rent for Sita
      await Rent.create({
        tenant: inactiveTenant._id,
        property: testProperty._id,
        block: testBlock._id,
        innerBlock: testInnerBlock._id,
        rentAmountPaisa: 72000000,
        paidAmountPaisa: 0,
        tdsAmountPaisa: 7200000,
        status: "pending",
        dueDate: dueSoon,
        englishMonth: now.getMonth() + 1,
        englishYear: now.getFullYear(),
        nepaliMonth: 10,
        nepaliYear: 2080,
        rentFrequency: "quarterly",
      });

      // Create overdue rent for Hari
      await Rent.create({
        tenant: vacatedTenant._id,
        property: testProperty._id,
        block: testBlock._id,
        innerBlock: testInnerBlock._id,
        rentAmountPaisa: 45000000,
        paidAmountPaisa: 0,
        tdsAmountPaisa: 4500000,
        status: "overdue",
        dueDate: overdue,
        englishMonth: now.getMonth(),
        englishYear: now.getFullYear(),
        nepaliMonth: 9,
        nepaliYear: 2080,
        rentFrequency: "monthly",
      });
    });

    it("should compute paid status correctly", async () => {
      const result = await searchTenants({ paymentStatus: "paid" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
      expect(result[0].paymentStatus).toBe("paid");
    });

    it("should compute due_soon status correctly", async () => {
      const result = await searchTenants({ paymentStatus: "due_soon" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Sita Sharma");
      expect(result[0].paymentStatus).toBe("due_soon");
    });

    it("should compute overdue status correctly", async () => {
      const result = await searchTenants({ paymentStatus: "overdue" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Hari Bahadur");
      expect(result[0].paymentStatus).toBe("overdue");
    });

    it("should compute outstanding amount", async () => {
      const result = await searchTenants({ paymentStatus: "overdue" });
      expect(result[0].outstandingAmount).toBeGreaterThan(0);
      expect(typeof result[0].outstandingAmount).toBe("number");
    });

    it("should filter by multiple payment statuses", async () => {
      const result = await searchTenants({
        paymentStatus: ["due_soon", "overdue"],
      });
      expect(result).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // COMBINED FILTERS
  // ────────────────────────────────────────────────────────────────────────

  describe("Combined Filters", () => {
    it("should combine status + frequency", async () => {
      const result = await searchTenants({
        status: "active",
        frequency: "monthly",
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
    });

    it("should combine text search + status", async () => {
      const result = await searchTenants({
        search: "a",
        status: ["active", "inactive"],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it("should combine all filters", async () => {
      const result = await searchTenants({
        status: "active",
        frequency: "monthly",
        block: testBlock._id.toString(),
        lease: "expiring_soon",
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Raj Kumar");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // DATA INTEGRITY
  // ────────────────────────────────────────────────────────────────────────

  describe("Response Data Integrity", () => {
    it("should convert paisa to rupees", async () => {
      const result = await searchTenants({ status: "active" });
      expect(result[0].totalRent).toBe(500000); // 50000000 paisa = 500000 rupees
      expect(result[0].camCharges).toBe(50000); // 5000000 paisa = 50000 rupees
    });

    it("should populate relationships", async () => {
      const result = await searchTenants({});
      expect(result[0].property).toBeDefined();
      expect(result[0].property.name).toBe("Test Tower");
      expect(result[0].block).toBeDefined();
      expect(result[0].block.name).toBe("Block A");
      expect(result[0].innerBlock).toBeDefined();
      expect(result[0].units).toBeInstanceOf(Array);
      expect(result[0].units.length).toBeGreaterThan(0);
    });

    it("should filter out tenants with no units", async () => {
      // Create tenant without units
      await Tenant.create({
        name: "No Units Tenant",
        email: "nounit@example.com",
        phone: "9871234567",
        address: "Test",
        status: "active",
        property: testProperty._id,
        block: testBlock._id,
        innerBlock: testInnerBlock._id,
        units: [],
        pricePerSqft: 500,
        pricePerSqftPaisa: 50000,
        camRatePerSqft: 50,
        camRatePerSqftPaisa: 5000,
        leasedSquareFeet: 1000,
        securityDepositPaisa: 15000000,
        totalRentPaisa: 50000000,
        camChargesPaisa: 5000000,
        rentPaymentFrequency: "monthly",
        leaseStartDate: new Date(),
        leaseEndDate: new Date(),
        dateOfAgreementSigned: new Date(),
        keyHandoverDate: new Date(),
      });

      const result = await searchTenants({});
      expect(result.every((t) => t.units.length > 0)).toBe(true);
    });

    it("should exclude deleted tenants", async () => {
      await Tenant.findByIdAndUpdate(activeTenant._id, { isDeleted: true });
      const result = await searchTenants({ status: "active" });
      expect(result).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // PERFORMANCE TESTS
  // ────────────────────────────────────────────────────────────────────────

  describe("Performance", () => {
    beforeEach(async () => {
      // Create 100 tenants for performance testing
      const tenants = [];
      for (let i = 0; i < 100; i++) {
        tenants.push({
          name: `Test Tenant ${i}`,
          email: `test${i}@example.com`,
          phone: `98${String(i).padStart(8, "0")}`,
          address: "Test Address",
          status: i % 3 === 0 ? "active" : i % 3 === 1 ? "inactive" : "vacated",
          property: testProperty._id,
          block: testBlock._id,
          innerBlock: testInnerBlock._id,
          units: [testUnit1._id],
          pricePerSqft: 500,
          pricePerSqftPaisa: 50000,
          camRatePerSqft: 50,
          camRatePerSqftPaisa: 5000,
          leasedSquareFeet: 1000,
          securityDepositPaisa: 15000000,
          totalRentPaisa: 50000000,
          camChargesPaisa: 5000000,
          rentPaymentFrequency: i % 2 === 0 ? "monthly" : "quarterly",
          leaseStartDate: new Date(),
          leaseEndDate: new Date(),
          dateOfAgreementSigned: new Date(),
          keyHandoverDate: new Date(),
        });
      }
      await Tenant.insertMany(tenants);
    });

    it("should complete search in under 500ms", async () => {
      const start = Date.now();
      await searchTenants({ status: "active", frequency: "monthly" });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it("should handle complex filters efficiently", async () => {
      const start = Date.now();
      await searchTenants({
        status: ["active", "inactive"],
        frequency: ["monthly", "quarterly"],
        block: testBlock._id.toString(),
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
