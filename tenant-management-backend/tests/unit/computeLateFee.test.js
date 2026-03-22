/**
 * Unit tests for computeLateFee function
 * Tests all 4 policy modes: fixed, percentage (flat), simple_daily, compound
 */
import { computeLateFee } from '../../src/cron/service/lateFee.cron.js';

describe('computeLateFee - Pure Function Unit Tests', () => {
  const balance = 100_000; // Rs 1,000 in paisa

  describe('Fixed fee type', () => {
    test('always returns flat amount regardless of days', () => {
      const policy = { 
        type: 'fixed', 
        amount: 500, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      
      expect(computeLateFee(balance, 1, policy)).toBe(50_000);  // Rs 500 in paisa
      expect(computeLateFee(balance, 10, policy)).toBe(50_000); // same after 10 days
      expect(computeLateFee(balance, 30, policy)).toBe(50_000); // same after 30 days
    });

    test('applies maxLateFeeAmount cap', () => {
      const policy = { 
        type: 'fixed', 
        amount: 500, 
        maxLateFeeAmount: 200, 
        compounding: false 
      };
      
      expect(computeLateFee(balance, 1, policy)).toBe(20_000); // capped at Rs 200
    });

    test('returns 0 for zero days late', () => {
      const policy = { type: 'fixed', amount: 500, maxLateFeeAmount: 0, compounding: false };
      expect(computeLateFee(balance, 0, policy)).toBe(0);
    });

    test('returns 0 for zero balance', () => {
      const policy = { type: 'fixed', amount: 500, maxLateFeeAmount: 0, compounding: false };
      expect(computeLateFee(0, 10, policy)).toBe(0);
    });
  });

  describe('Flat percentage type (non-compounding)', () => {
    test('calculates percentage of balance once', () => {
      const policy = { 
        type: 'percentage', 
        amount: 2, 
        compounding: false, 
        maxLateFeeAmount: 0 
      };
      
      // 2% of Rs 1,000 = Rs 20 = 2,000 paisa
      expect(computeLateFee(balance, 1, policy)).toBe(2_000);
      expect(computeLateFee(balance, 10, policy)).toBe(2_000); // same, not compounding
      expect(computeLateFee(balance, 30, policy)).toBe(2_000);
    });

    test('applies cap correctly', () => {
      const policy = { 
        type: 'percentage', 
        amount: 5, 
        compounding: false, 
        maxLateFeeAmount: 30 
      };
      
      // 5% of Rs 1,000 = Rs 50, but capped at Rs 30
      expect(computeLateFee(balance, 1, policy)).toBe(3_000);
    });

    test('works with different balance amounts', () => {
      const policy = { 
        type: 'percentage', 
        amount: 3, 
        compounding: false, 
        maxLateFeeAmount: 0 
      };
      
      expect(computeLateFee(50_000, 1, policy)).toBe(1_500);   // 3% of Rs 500
      expect(computeLateFee(200_000, 1, policy)).toBe(6_000);  // 3% of Rs 2,000
    });
  });

  describe('Simple daily type (linear growth)', () => {
    test('grows linearly with days', () => {
      const policy = { 
        type: 'simple_daily', 
        amount: 2, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      
      // Rs 1,000 × 2% × days
      expect(computeLateFee(balance, 1, policy)).toBe(2_000);    // Rs 20
      expect(computeLateFee(balance, 5, policy)).toBe(10_000);   // Rs 100
      expect(computeLateFee(balance, 10, policy)).toBe(20_000);  // Rs 200
      expect(computeLateFee(balance, 20, policy)).toBe(40_000);  // Rs 400
    });

    test('applies maxLateFeeAmount cap', () => {
      const policy = { 
        type: 'simple_daily', 
        amount: 2, 
        maxLateFeeAmount: 150, 
        compounding: false 
      };
      
      // After 10 days: Rs 1,000 × 2% × 10 = Rs 200, capped at Rs 150
      expect(computeLateFee(balance, 10, policy)).toBe(15_000);
    });

    test('handles fractional percentages', () => {
      const policy = { 
        type: 'simple_daily', 
        amount: 0.5, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      
      // Rs 1,000 × 0.5% × 10 = Rs 50
      expect(computeLateFee(balance, 10, policy)).toBe(5_000);
    });
  });

  describe('Compound daily type (exponential growth)', () => {
    test('grows exponentially with days', () => {
      const policy = { 
        type: 'percentage', 
        amount: 2, 
        compounding: true, 
        maxLateFeeAmount: 0 
      };
      
      // Rs 1,000 × ((1.02)^days − 1)
      // Day 1:  Rs 1,000 × (1.02 - 1) = Rs 20.00 → 2,000 paisa
      expect(computeLateFee(balance, 1, policy)).toBe(2_000);
      
      // Day 5:  Rs 1,000 × (1.02^5 - 1) = Rs 104.08 → 10,408 paisa
      expect(computeLateFee(balance, 5, policy)).toBe(10_408);
      
      // Day 10: Rs 1,000 × (1.02^10 - 1) = Rs 218.99 → 21,899 paisa
      expect(computeLateFee(balance, 10, policy)).toBe(21_899);
      
      // Day 30: Rs 1,000 × (1.02^30 - 1) = Rs 811.36 → 81,136 paisa
      expect(computeLateFee(balance, 30, policy)).toBe(81_136);
    });

    test('applies maxLateFeeAmount cap', () => {
      const policy = { 
        type: 'percentage', 
        amount: 2, 
        compounding: true, 
        maxLateFeeAmount: 200 
      };
      
      // After 10 days would be Rs 218.99, but capped at Rs 200
      expect(computeLateFee(balance, 10, policy)).toBe(20_000);
    });

    test('compound grows faster than simple', () => {
      const simple = { 
        type: 'simple_daily', 
        amount: 2, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      const compound = { 
        type: 'percentage', 
        amount: 2, 
        compounding: true, 
        maxLateFeeAmount: 0 
      };
      
      const days = 30;
      const simpleFee = computeLateFee(balance, days, simple);
      const compoundFee = computeLateFee(balance, days, compound);
      
      // Simple: Rs 1,000 × 2% × 30 = Rs 600
      expect(simpleFee).toBe(60_000);
      
      // Compound: Rs 1,000 × (1.02^30 - 1) = Rs 811.36
      expect(compoundFee).toBe(81_136);
      
      // Compound should be higher
      expect(compoundFee).toBeGreaterThan(simpleFee);
    });

    test('handles small daily rates', () => {
      const policy = { 
        type: 'percentage', 
        amount: 0.1, 
        compounding: true, 
        maxLateFeeAmount: 0 
      };
      
      // Rs 1,000 × (1.001^10 - 1) ≈ Rs 10.05
      expect(computeLateFee(balance, 10, policy)).toBe(1_005);
    });
  });

  describe('Edge cases', () => {
    test('handles zero effective days', () => {
      const policy = { type: 'fixed', amount: 500, maxLateFeeAmount: 0, compounding: false };
      expect(computeLateFee(balance, 0, policy)).toBe(0);
    });

    test('handles negative days (should return 0)', () => {
      const policy = { type: 'fixed', amount: 500, maxLateFeeAmount: 0, compounding: false };
      expect(computeLateFee(balance, -5, policy)).toBe(0);
    });

    test('handles zero balance', () => {
      const policy = { type: 'percentage', amount: 2, compounding: true, maxLateFeeAmount: 0 };
      expect(computeLateFee(0, 10, policy)).toBe(0);
    });

    test('handles negative balance (should return 0)', () => {
      const policy = { type: 'percentage', amount: 2, compounding: false, maxLateFeeAmount: 0 };
      expect(computeLateFee(-10_000, 5, policy)).toBe(0);
    });

    test('cap of 0 means no cap', () => {
      const policy = { 
        type: 'fixed', 
        amount: 10000, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      
      // Rs 10,000 fee with no cap
      expect(computeLateFee(balance, 1, policy)).toBe(1_000_000);
    });

    test('rounds to nearest paisa (integer)', () => {
      const policy = { 
        type: 'percentage', 
        amount: 3.33, 
        compounding: false, 
        maxLateFeeAmount: 0 
      };
      
      // Rs 1,000 × 3.33% = Rs 33.30 = 3,330 paisa (should be integer)
      const result = computeLateFee(balance, 1, policy);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBe(3_330);
    });
  });

  describe('Real-world scenarios', () => {
    test('Scenario: Rs 50,000 rent, 15 days late, 2% simple daily', () => {
      const policy = { 
        type: 'simple_daily', 
        amount: 2, 
        maxLateFeeAmount: 0, 
        compounding: false 
      };
      const rentPaisa = 5_000_000; // Rs 50,000
      const days = 15;
      
      // Rs 50,000 × 2% × 15 = Rs 15,000
      expect(computeLateFee(rentPaisa, days, policy)).toBe(1_500_000);
    });

    test('Scenario: Rs 25,000 rent, 7 days late, Rs 1,000 fixed fee, capped at Rs 500', () => {
      const policy = { 
        type: 'fixed', 
        amount: 1000, 
        maxLateFeeAmount: 500, 
        compounding: false 
      };
      const rentPaisa = 2_500_000; // Rs 25,000
      
      expect(computeLateFee(rentPaisa, 7, policy)).toBe(50_000); // capped at Rs 500
    });

    test('Scenario: Rs 100,000 rent, 20 days late, 1.5% compound daily', () => {
      const policy = { 
        type: 'percentage', 
        amount: 1.5, 
        compounding: true, 
        maxLateFeeAmount: 0 
      };
      const rentPaisa = 10_000_000; // Rs 100,000
      const days = 20;
      
      // Rs 100,000 × (1.015^20 - 1) ≈ Rs 34,685
      expect(computeLateFee(rentPaisa, days, policy)).toBe(3_468_550);
    });
  });
});
