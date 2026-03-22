/**
 * Sanity test to verify module resolution
 */
import { describe, test, expect } from '@jest/globals';

describe('Module Resolution Sanity Check', () => {
  test('can import rent.service.js', async () => {
    const module = await import('../../src/modules/rents/rent.service.js');
    expect(module.handleMonthlyRents).toBeDefined();
    expect(typeof module.handleMonthlyRents).toBe('function');
  });

  test('can import Rent model', async () => {
    const module = await import('../../src/modules/rents/rent.Model.js');
    expect(module.Rent).toBeDefined();
  });

  test('can import lateFee.cron.js', async () => {
    const module = await import('../../src/cron/service/lateFee.cron.js');
    expect(module.applyLateFees).toBeDefined();
    expect(typeof module.applyLateFees).toBe('function');
  });
});
