/**
 * Integration tests for applyLateFees
 * Tests all 4 policy modes with database interactions
 */
import mongoose from 'mongoose';
import { applyLateFees } from '../../src/cron/service/lateFee.cron.js';
import { Rent } from '../../src/modules/rents/rent.Model.js';
import { SystemConfig } from '../../src/modules/systemConfig/SystemConfig.Model.js';
import { CronLog } from '../../src/cron/model/CronLog.js';
import { freezeToNepaliDate, advanceTimeByDays } from '../utils/nepaliTimeMachine.js';
import {
  createRentFixture,
  createTestId,
  lateFeeFixtures,
  cleanTestDatabase,
} from '../fixtures/testFixtures.js';

describe('applyLateFees - Integration Tests', () => {
  let connection;
  const adminId = createTestId('admin', 1);

  beforeAll(async () => {
    connection = await mongoose.connect(process.env.MONGO_URL);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await cleanTestDatabase();
  });

  describe('Fixed fee policy', () => {
    test('charges flat fee once and then becomes idempotent', async () => {
      // Freeze to 10 days after due date (past grace period)
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        // Setup policy
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        // Create overdue rent
        const rent = await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000, // Rs 1,000
            paidAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30', // Due in Shrawan (month 4)
            lateFeeApplied: false,
          }),
        });
        
        // First run
        const run1 = await applyLateFees(adminId);
        expect(run1.success).toBe(true);
        expect(run1.processed).toBe(1);
        expect(run1.totalDeltaFeePaisa).toBe(50_000); // Rs 500
        
        // Verify rent updated
        const updatedRent1 = await Rent.findById(rent._id);
        expect(updatedRent1.lateFeePaisa).toBe(50_000);
        expect(updatedRent1.lateFeeApplied).toBe(true);
        
        // Second run (same day)
        const run2 = await applyLateFees(adminId);
        expect(run2.processed).toBe(0);
        expect(run2.skipped).toBe(1);
        
        // Verify rent unchanged
        const updatedRent2 = await Rent.findById(rent._id);
        expect(updatedRent2.lateFeePaisa).toBe(50_000);
      } finally {
        restore();
      }
    });

    test('respects grace period', async () => {
      // 3 days after due date, within 5-day grace
      const restore = freezeToNepaliDate(2081, 5, 3);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        await Rent.create({
          ...createRentFixture({
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        expect(result.processed).toBe(0);
        expect(result.skipped).toBe(1);
        
        // Verify no fee charged
        const rent = await Rent.findOne({});
        expect(rent.lateFeePaisa).toBe(0);
        expect(rent.lateFeeApplied).toBe(false);
      } finally {
        restore();
      }
    });

    test('applies maxLateFeeAmount cap', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.withCap);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        // Policy: Rs 1,000 fee, capped at Rs 500
        expect(result.totalDeltaFeePaisa).toBe(50_000); // Rs 500 cap
        
        const rent = await Rent.findOne({});
        expect(rent.lateFeePaisa).toBe(50_000);
      } finally {
        restore();
      }
    });
  });

  describe('Flat percentage policy (non-compounding)', () => {
    test('charges percentage once', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.flatPercentage);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000, // Rs 1,000
            paidAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        // 2% of Rs 1,000 = Rs 20
        expect(result.totalDeltaFeePaisa).toBe(2_000);
        
        const rent = await Rent.findOne({});
        expect(rent.lateFeePaisa).toBe(2_000);
        expect(rent.lateFeeApplied).toBe(true);
      } finally {
        restore();
      }
    });

    test('is idempotent after first charge', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.flatPercentage);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        await applyLateFees(adminId);
        const run2 = await applyLateFees(adminId);
        
        expect(run2.skipped).toBe(1);
      } finally {
        restore();
      }
    });
  });

  describe('Simple daily policy (linear growth)', () => {
    test('grows linearly with each day', async () => {
      // Day 10 after due date (5 days past grace)
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.simpleDaily);
        
        const rent = await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000, // Rs 1,000
            paidAmountPaisa: 0,
            tdsAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        // First run: 5 effective days late
        const run1 = await applyLateFees(adminId);
        
        // Rs 1,000 × 2% × 5 = Rs 100
        expect(run1.totalDeltaFeePaisa).toBe(10_000);
        
        let updatedRent = await Rent.findById(rent._id);
        expect(updatedRent.lateFeePaisa).toBe(10_000);
        expect(updatedRent.lateFeeCompounding).toBe(true);
        
        // Advance to next day (now 6 effective days late)
        advanceTimeByDays(1);
        
        const run2 = await applyLateFees(adminId);
        
        // Delta: Rs 1,000 × 2% × 6 - Rs 100 = Rs 120 - Rs 100 = Rs 20
        expect(run2.totalDeltaFeePaisa).toBe(2_000);
        
        updatedRent = await Rent.findById(rent._id);
        expect(updatedRent.lateFeePaisa).toBe(12_000); // Total Rs 120
      } finally {
        restore();
      }
    });

    test('is idempotent within same day', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.simpleDaily);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        const run1 = await applyLateFees(adminId);
        expect(run1.processed).toBe(1);
        
        // Same day re-run
        const run2 = await applyLateFees(adminId);
        expect(run2.skipped).toBe(1); // Delta would be 0
      } finally {
        restore();
      }
    });
  });

  describe('Compound daily policy (exponential growth)', () => {
    test('grows exponentially with each day', async () => {
      const restore = freezeToNepaliDate(2081, 5, 15); // 10 effective days past grace
      
      try {
        await SystemConfig.create(lateFeeFixtures.compound);
        
        const rent = await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000, // Rs 1,000
            paidAmountPaisa: 0,
            tdsAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
            lateFeeApplied: false,
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        // Rs 1,000 × (1.02^10 - 1) ≈ Rs 218.99
        expect(result.totalDeltaFeePaisa).toBe(21_899);
        
        const updatedRent = await Rent.findById(rent._id);
        expect(updatedRent.lateFeePaisa).toBe(21_899);
        expect(updatedRent.lateFeeCompounding).toBe(true);
      } finally {
        restore();
      }
    });

    test('delta calculation is correct across days', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.compound);
        
        const rent = await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            paidAmountPaisa: 0,
            tdsAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        // Day 1: 5 effective days late
        const run1 = await applyLateFees(adminId);
        const fee1 = run1.totalDeltaFeePaisa;
        
        // Advance 1 day: now 6 effective days late
        advanceTimeByDays(1);
        
        const run2 = await applyLateFees(adminId);
        const delta = run2.totalDeltaFeePaisa;
        
        const updatedRent = await Rent.findById(rent._id);
        
        // Total should equal fee1 + delta
        expect(updatedRent.lateFeePaisa).toBe(fee1 + delta);
      } finally {
        restore();
      }
    });
  });

  describe('Policy scope filtering', () => {
    test('skips when policy is disabled', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.disabled);
        
        await Rent.create({
          ...createRentFixture({
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('disabled');
        expect(result.processed).toBe(0);
      } finally {
        restore();
      }
    });

    test('processes multiple overdue rents', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        await Rent.insertMany([
          createRentFixture({ _id: createTestId('r', 1), status: 'overdue', nepaliDueDate: '2081-04-30' }),
          createRentFixture({ _id: createTestId('r', 2), status: 'overdue', nepaliDueDate: '2081-04-30' }),
          createRentFixture({ _id: createTestId('r', 3), status: 'overdue', nepaliDueDate: '2081-04-30' }),
        ]);
        
        const result = await applyLateFees(adminId);
        
        expect(result.processed).toBe(3);
        expect(result.totalDeltaFeePaisa).toBe(150_000); // Rs 500 × 3
      } finally {
        restore();
      }
    });

    test('skips paid rents', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            paidAmountPaisa: 100_000,
            status: 'paid',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        expect(result.processed).toBe(0);
      } finally {
        restore();
      }
    });

    test('skips rents with no outstanding balance', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 100_000,
            paidAmountPaisa: 90_000,
            tdsAmountPaisa: 10_000,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        // Effective rent = 100,000 - 10,000 = 90,000
        // Paid = 90,000
        // Outstanding = 0
        expect(result.processed).toBe(0);
        expect(result.skipped).toBe(1);
      } finally {
        restore();
      }
    });
  });

  describe('CronLog creation', () => {
    test('creates log entry after successful run', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        await Rent.create({
          ...createRentFixture({
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        await applyLateFees(adminId);
        
        const log = await CronLog.findOne({ type: 'LATE_FEE_APPLICATION' });
        expect(log).toBeTruthy();
        expect(log.success).toBe(true);
        expect(log.count).toBe(1);
      } finally {
        restore();
      }
    });

    test('logs errors when rent processing fails', async () => {
      const restore = freezeToNepaliDate(2081, 5, 10);
      
      try {
        await SystemConfig.create(lateFeeFixtures.fixed);
        
        // Create rent with invalid data to trigger error
        await Rent.create({
          ...createRentFixture({
            status: 'overdue',
            nepaliDueDate: 'invalid-date', // Invalid format
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        expect(result.failed).toBeGreaterThan(0);
        expect(result.errors).toBeDefined();
      } finally {
        restore();
      }
    });
  });

  describe('Real-world scenarios', () => {
    test('Scenario: Rs 50,000 rent, 15 days overdue, 2% simple daily', async () => {
      const restore = freezeToNepaliDate(2081, 5, 20);
      
      try {
        await SystemConfig.create(lateFeeFixtures.simpleDaily);
        
        const rent = await Rent.create({
          ...createRentFixture({
            rentAmountPaisa: 5_000_000, // Rs 50,000
            paidAmountPaisa: 0,
            tdsAmountPaisa: 0,
            status: 'overdue',
            nepaliDueDate: '2081-04-30',
          }),
        });
        
        const result = await applyLateFees(adminId);
        
        // 15 effective days (grace = 5)
        // Rs 50,000 × 2% × 15 = Rs 15,000
        expect(result.totalDeltaFeePaisa).toBe(1_500_000);
        
        const updatedRent = await Rent.findById(rent._id);
        expect(updatedRent.lateFeePaisa).toBe(1_500_000);
      } finally {
        restore();
      }
    });
  });
});
