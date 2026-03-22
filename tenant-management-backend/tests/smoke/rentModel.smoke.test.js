/**
 * Smoke tests for rent pre-save hook
 * Tests status calculation logic
 */
import mongoose from 'mongoose';
import { Rent } from '../../src/modules/rents/rent.Model.js';
import { createRentFixture, cleanTestDatabase } from '../fixtures/testFixtures.js';

describe('Rent Model - Pre-save Hook Tests', () => {
  let connection;

  beforeAll(async () => {
    connection = await mongoose.connect(process.env.MONGO_URL);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await cleanTestDatabase();
  });

  describe('Status calculation', () => {
    test('sets status=pending on zero paidAmount', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 0,
          tdsAmountPaisa: 0,
        }),
      });
      
      expect(rent.status).toBe('pending');
    });

    test('sets status=partially_paid when partially paid', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 50_000,
          tdsAmountPaisa: 0,
        }),
      });
      
      expect(rent.status).toBe('partially_paid');
    });

    test('sets status=paid when fully paid', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 100_000,
          tdsAmountPaisa: 0,
        }),
      });
      
      expect(rent.status).toBe('paid');
    });

    test('accounts for TDS in effective rent calculation', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 90_000,
          tdsAmountPaisa: 10_000, // Effective rent = 90,000
        }),
      });
      
      expect(rent.status).toBe('paid'); // 90,000 paid = 90,000 effective
    });

    test('preserves overdue status after partial payment', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 0,
          tdsAmountPaisa: 0,
          status: 'overdue',
          overdueMarkedAt: new Date(),
        }),
      });
      
      // Make partial payment
      rent.paidAmountPaisa = 50_000;
      await rent.save();
      
      // Should remain overdue, not change to partially_paid
      expect(rent.status).toBe('overdue');
    });

    test('changes overdue to paid when fully paid', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 0,
          tdsAmountPaisa: 0,
          status: 'overdue',
          overdueMarkedAt: new Date(),
        }),
      });
      
      // Make full payment
      rent.paidAmountPaisa = 100_000;
      await rent.save();
      
      expect(rent.status).toBe('paid');
    });

    test('handles late fees in status calculation', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 100_000,
          tdsAmountPaisa: 0,
          lateFeePaisa: 5_000,
          status: 'overdue',
        }),
      });
      
      // Rent paid but late fee still outstanding
      expect(rent.status).toBe('partially_paid');
    });

    test('status=paid when rent + late fee fully paid', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000,
          paidAmountPaisa: 105_000,
          tdsAmountPaisa: 0,
          lateFeePaisa: 5_000,
        }),
      });
      
      expect(rent.status).toBe('paid');
    });
  });

  describe('Paisa integer enforcement', () => {
    test('rounds paisa values to integers', async () => {
      const rent = await Rent.create({
        ...createRentFixture({
          rentAmountPaisa: 100_000.5,
          paidAmountPaisa: 50_000.7,
          tdsAmountPaisa: 10_000.3,
        }),
      });
      
      expect(Number.isInteger(rent.rentAmountPaisa)).toBe(true);
      expect(Number.isInteger(rent.paidAmountPaisa)).toBe(true);
      expect(Number.isInteger(rent.tdsAmountPaisa)).toBe(true);
    });
  });
});
