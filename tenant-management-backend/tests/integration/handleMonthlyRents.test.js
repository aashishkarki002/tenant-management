/**
 * Integration tests for handleMonthlyRents
 * Tests rent creation, idempotency, and database interactions
 */
import mongoose from 'mongoose';
import { handleMonthlyRents } from '../../src/modules/rents/rent.service.js';
import { Rent } from '../../src/modules/rents/rent.Model.js';
import { Tenant } from '../../src/modules/tenant/Tenant.Model.js';
import { freezeToNepaliDate } from '../utils/nepaliTimeMachine.js';
import {
  createTenantFixture,
  createTestId,
  cleanTestDatabase,
} from '../fixtures/testFixtures.js';

describe('handleMonthlyRents - Integration Tests', () => {
  let connection;

  beforeAll(async () => {
    // Connect to in-memory MongoDB
    connection = await mongoose.connect(process.env.MONGO_URL);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await cleanTestDatabase();
  });

  describe('Rent creation on first day of month', () => {
    test('creates one rent per active tenant', async () => {
      // Freeze to Shrawan 1, 2081
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        // Seed 3 active tenants
        const tenants = [
          createTenantFixture({ _id: createTestId('t', 1), name: 'Tenant 1' }),
          createTenantFixture({ _id: createTestId('t', 2), name: 'Tenant 2' }),
          createTenantFixture({ _id: createTestId('t', 3), name: 'Tenant 3' }),
        ];
        await Tenant.insertMany(tenants);
        
        // Run cron
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(true);
        expect(result.createdCount).toBe(3);
        
        // Verify database state
        const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 5 });
        expect(rents).toHaveLength(3);
        
        // Verify each rent has correct structure
        rents.forEach(rent => {
          expect(rent.nepaliYear).toBe(2081);
          expect(rent.nepaliMonth).toBe(5); // Shrawan
          expect(rent.status).toBe('pending');
          expect(rent.paidAmountPaisa).toBe(0);
          expect(rent.lateFeePaisa).toBe(0);
        });
      } finally {
        restore();
      }
    });

    test('is idempotent — second run does not create duplicates', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenants = [
          createTenantFixture({ _id: createTestId('t', 1) }),
          createTenantFixture({ _id: createTestId('t', 2) }),
        ];
        await Tenant.insertMany(tenants);
        
        // First run
        const result1 = await handleMonthlyRents();
        expect(result1.createdCount).toBe(2);
        
        // Second run (simulate forceRun or accidental re-execution)
        const result2 = await handleMonthlyRents();
        expect(result2.createdCount).toBe(0);
        expect(result2.message).toContain('already exist');
        
        // Verify only 2 rents exist
        const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 5 });
        expect(rents).toHaveLength(2);
      } finally {
        restore();
      }
    });

    test('skips inactive tenants', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenants = [
          createTenantFixture({ _id: createTestId('t', 1), status: 'active' }),
          createTenantFixture({ _id: createTestId('t', 2), status: 'inactive' }),
          createTenantFixture({ _id: createTestId('t', 3), status: 'terminated' }),
        ];
        await Tenant.insertMany(tenants);
        
        const result = await handleMonthlyRents();
        
        // Only 1 active tenant
        expect(result.createdCount).toBe(1);
        
        const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 5 });
        expect(rents).toHaveLength(1);
        expect(rents[0].tenant.toString()).toBe(createTestId('t', 1).toString());
      } finally {
        restore();
      }
    });

    test('skips deleted tenants', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenants = [
          createTenantFixture({ _id: createTestId('t', 1), isDeleted: false }),
          createTenantFixture({ _id: createTestId('t', 2), isDeleted: true }),
        ];
        await Tenant.insertMany(tenants);
        
        const result = await handleMonthlyRents();
        
        expect(result.createdCount).toBe(1);
      } finally {
        restore();
      }
    });

    test('handles no active tenants gracefully', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('No active tenants');
        expect(result.createdCount).toBe(0);
      } finally {
        restore();
      }
    });
  });

  describe('Overdue marking', () => {
    test('marks previous month pending rents as overdue', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1); // Shrawan 1
      
      try {
        // Create previous month (Bhadra) pending rents
        const tenant = createTenantFixture({ _id: createTestId('t', 1) });
        await Tenant.insertMany([tenant]);
        
        const previousRent = await Rent.create({
          tenant: tenant._id,
          block: tenant.block,
          innerBlock: tenant.innerBlock,
          property: tenant.property,
          nepaliYear: 2081,
          nepaliMonth: 4, // Bhadra (previous month)
          nepaliDate: '2081-04-01',
          nepaliDueDate: '2081-04-30',
          englishDueDate: new Date('2024-08-15'),
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 0,
          tdsAmountPaisa: 0,
          status: 'pending',
          createdBy: createTestId('admin'),
          englishMonth: 8,
          englishYear: 2024,
        });
        
        // Run cron for new month
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(true);
        expect(result.updatedOverdueCount).toBeGreaterThan(0);
        
        // Check that previous rent is now overdue
        const updatedRent = await Rent.findById(previousRent._id);
        expect(updatedRent.status).toBe('overdue');
      } finally {
        restore();
      }
    });

    test('marks partially_paid rents as overdue', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenant = createTenantFixture({ _id: createTestId('t', 1) });
        await Tenant.insertMany([tenant]);
        
        await Rent.create({
          tenant: tenant._id,
          block: tenant.block,
          innerBlock: tenant.innerBlock,
          property: tenant.property,
          nepaliYear: 2081,
          nepaliMonth: 4,
          nepaliDate: '2081-04-01',
          nepaliDueDate: '2081-04-30',
          englishDueDate: new Date('2024-08-15'),
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 50_000, // Partially paid
          tdsAmountPaisa: 0,
          status: 'partially_paid',
          createdBy: createTestId('admin'),
          englishMonth: 8,
          englishYear: 2024,
        });
        
        const result = await handleMonthlyRents();
        
        expect(result.updatedOverdueCount).toBe(1);
        
        const rent = await Rent.findOne({ nepaliYear: 2081, nepaliMonth: 4 });
        expect(rent.status).toBe('overdue');
      } finally {
        restore();
      }
    });

    test('does not mark paid rents as overdue', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenant = createTenantFixture({ _id: createTestId('t', 1) });
        await Tenant.insertMany([tenant]);
        
        await Rent.create({
          tenant: tenant._id,
          block: tenant.block,
          innerBlock: tenant.innerBlock,
          property: tenant.property,
          nepaliYear: 2081,
          nepaliMonth: 4,
          nepaliDate: '2081-04-01',
          nepaliDueDate: '2081-04-30',
          englishDueDate: new Date('2024-08-15'),
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 100_000, // Fully paid
          tdsAmountPaisa: 0,
          status: 'paid',
          createdBy: createTestId('admin'),
          englishMonth: 8,
          englishYear: 2024,
        });
        
        await handleMonthlyRents();
        
        const rent = await Rent.findOne({ nepaliYear: 2081, nepaliMonth: 4 });
        expect(rent.status).toBe('paid'); // Should remain paid
      } finally {
        restore();
      }
    });
  });

  describe('Rent document structure', () => {
    test('sets all required fields correctly', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenant = createTenantFixture({
          _id: createTestId('t', 1),
          totalRentPaisa: 5_000_000, // Rs 50,000
          tdsPaisa: 250_000, // Rs 2,500
        });
        await Tenant.insertMany([tenant]);
        
        await handleMonthlyRents();
        
        const rent = await Rent.findOne({ tenant: tenant._id });
        
        expect(rent.rentAmountPaisa).toBe(5_000_000);
        expect(rent.tdsAmountPaisa).toBe(250_000);
        expect(rent.paidAmountPaisa).toBe(0);
        expect(rent.lateFeePaisa).toBe(0);
        expect(rent.nepaliYear).toBe(2081);
        expect(rent.nepaliMonth).toBe(5);
        expect(rent.status).toBe('pending');
        expect(rent.nepaliDate).toBe('2081-05-01');
        expect(rent.nepaliDueDate).toBe('2081-05-31'); // Last day of Shrawan
      } finally {
        restore();
      }
    });

    test('handles tenants with zero TDS', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const tenant = createTenantFixture({
          _id: createTestId('t', 1),
          tdsPaisa: 0,
        });
        await Tenant.insertMany([tenant]);
        
        await handleMonthlyRents();
        
        const rent = await Rent.findOne({ tenant: tenant._id });
        expect(rent.tdsAmountPaisa).toBe(0);
      } finally {
        restore();
      }
    });

    test('preserves tenant references', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        const blockId = createTestId('block', 1);
        const innerBlockId = createTestId('inner', 1);
        const propertyId = createTestId('prop', 1);
        
        const tenant = createTenantFixture({
          _id: createTestId('t', 1),
          block: blockId,
          innerBlock: innerBlockId,
          property: propertyId,
        });
        await Tenant.insertMany([tenant]);
        
        await handleMonthlyRents();
        
        const rent = await Rent.findOne({ tenant: tenant._id });
        expect(rent.block.toString()).toBe(blockId.toString());
        expect(rent.innerBlock.toString()).toBe(innerBlockId.toString());
        expect(rent.property.toString()).toBe(propertyId.toString());
      } finally {
        restore();
      }
    });
  });

  describe('Month boundary handling', () => {
    test('creates rents for year-end month (Chaitra)', async () => {
      const restore = freezeToNepaliDate(2081, 12, 1); // Chaitra 1
      
      try {
        const tenant = createTenantFixture({ _id: createTestId('t', 1) });
        await Tenant.insertMany([tenant]);
        
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(true);
        expect(result.createdCount).toBe(1);
        
        const rent = await Rent.findOne({ tenant: tenant._id });
        expect(rent.nepaliYear).toBe(2081);
        expect(rent.nepaliMonth).toBe(12); // Chaitra
      } finally {
        restore();
      }
    });

    test('creates rents for new year (Baisakh)', async () => {
      const restore = freezeToNepaliDate(2082, 1, 1); // Baisakh 1, new year
      
      try {
        const tenant = createTenantFixture({ _id: createTestId('t', 1) });
        await Tenant.insertMany([tenant]);
        
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(true);
        
        const rent = await Rent.findOne({ tenant: tenant._id });
        expect(rent.nepaliYear).toBe(2082);
        expect(rent.nepaliMonth).toBe(1); // Baisakh
      } finally {
        restore();
      }
    });
  });

  describe('Error handling', () => {
    test('handles database connection errors gracefully', async () => {
      const restore = freezeToNepaliDate(2081, 5, 1);
      
      try {
        // Close connection to simulate error
        await mongoose.disconnect();
        
        const result = await handleMonthlyRents();
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('failed');
        
        // Reconnect for cleanup
        await mongoose.connect(process.env.MONGO_URL);
      } finally {
        restore();
      }
    });
  });
});
