/**
 * cron.lateFee.unit.test.js
 *
 * Pure unit tests for computeLateFee().
 * No DB, no mocking of DB internals — just the math.
 *
 * Coverage:
 *   - fixed policy
 *   - simple_daily policy (linear growth)
 *   - percentage flat (one-time)
 *   - percentage + compounding (exponential)
 *   - maxLateFeeAmount cap
 *   - edge cases (0 days, 0 balance, negative clamp)
 */

import { jest } from "@jest/globals";

// ── Mock every external dep of lateFee.cron.js so no DB/socket is needed ──

jest.unstable_mockModule("../cron/model/CronLog.js", () => ({
  CronLog: { create: jest.fn().mockResolvedValue({}) },
}));
jest.unstable_mockModule("../modules/rents/rent.Model.js", () => ({
  Rent: { find: jest.fn().mockResolvedValue([]), distinct: jest.fn().mockResolvedValue([]) },
}));
jest.unstable_mockModule("../modules/rents/rent.domain.js", () => ({
  addLateFeeCharge: jest.fn(),
}));
jest.unstable_mockModule("../modules/systemConfig/SystemConfig.Model.js", () => ({
  SystemConfig: { findOne: jest.fn().mockResolvedValue(null) },
}));
jest.unstable_mockModule("../modules/ledger/ledger.service.js", () => ({
  ledgerService: { postJournalEntry: jest.fn().mockResolvedValue({}) },
}));
jest.unstable_mockModule("../modules/ledger/journal-builders/lateFee.js", () => ({
  buildLateFeeJournal: jest.fn().mockReturnValue({ type: "LATE_FEE", entries: [] }),
}));
jest.unstable_mockModule("../utils/nepaliDateHelper.js", () => ({
  diffNepaliDays: jest.fn().mockReturnValue(10),
  getNepaliMonthDates: jest.fn().mockReturnValue({ lastDayNepali: "2081-10-30" }),
  parseNepaliISO: jest.fn().mockReturnValue({}),
  getNepaliToday: jest.fn().mockReturnValue({ npToday: {}, bsYear: 2081, bsMonth: 10, bsDay: 10 }),
  formatNepaliISO: jest.fn().mockReturnValue("2081-10-10"),
  addNepaliMonths: jest.fn(),
  assertNepaliFields: jest.fn(),
  resolveNepaliPeriod: jest.fn(),
}));

const { computeLateFee } = await import("../cron/service/lateFee.cron.js");

// ─────────────────────────────────────────────────────────────────────────────

describe("computeLateFee — fixed policy", () => {
  const policy = { type: "fixed", amount: 500, compounding: false, maxLateFeeAmount: 0 };

  it("returns flat Rs 500 → 50000 paisa regardless of days", () => {
    expect(computeLateFee(1000000, 1, policy)).toBe(50000);
    expect(computeLateFee(1000000, 30, policy)).toBe(50000);
    expect(computeLateFee(500000, 1, policy)).toBe(50000);
  });

  it("returns 0 when effectiveDaysLate = 0", () => {
    expect(computeLateFee(1000000, 0, policy)).toBe(0);
  });

  it("returns 0 when overdueAmountPaisa = 0", () => {
    expect(computeLateFee(0, 10, policy)).toBe(0);
  });
});

describe("computeLateFee — simple_daily policy", () => {
  const policy = { type: "simple_daily", amount: 2, compounding: false, maxLateFeeAmount: 0 };

  it("grows linearly: balance × rate% × days", () => {
    // Rs 10,000 (1000000 paisa) × 2% × 10 days = Rs 2,000 = 200000 paisa
    expect(computeLateFee(1000000, 10, policy)).toBe(200000);
  });

  it("day 1: balance × rate%", () => {
    // 1000000 × 0.02 × 1 = 20000
    expect(computeLateFee(1000000, 1, policy)).toBe(20000);
  });

  it("day 5 vs day 10 — linear (not exponential)", () => {
    const day5 = computeLateFee(1000000, 5, policy);
    const day10 = computeLateFee(1000000, 10, policy);
    expect(day10).toBe(day5 * 2); // exactly 2× — linear
  });

  it("rounds to integer paisa", () => {
    // 100001 paisa × 2% × 1 day = 2000.02 → rounds to 2000
    expect(Number.isInteger(computeLateFee(100001, 1, policy))).toBe(true);
  });
});

describe("computeLateFee — percentage flat (one-time)", () => {
  const policy = { type: "percentage", amount: 5, compounding: false, maxLateFeeAmount: 0 };

  it("charges 5% of balance once", () => {
    // Rs 10,000 × 5% = Rs 500 = 50000 paisa
    expect(computeLateFee(1000000, 1, policy)).toBe(50000);
    // Same on day 30 — one-time, not growing
    expect(computeLateFee(1000000, 30, policy)).toBe(50000);
  });

  it("proportional to balance", () => {
    expect(computeLateFee(500000, 1, policy)).toBe(25000);
  });
});

describe("computeLateFee — percentage compounding (exponential)", () => {
  const policy = { type: "percentage", amount: 2, compounding: true, maxLateFeeAmount: 0 };

  it("applies compound formula: P × ((1+r)^d − 1)", () => {
    // 1000000 × ((1.02)^10 − 1) ≈ 218994 paisa
    const expected = Math.round(1000000 * (Math.pow(1.02, 10) - 1));
    expect(computeLateFee(1000000, 10, policy)).toBe(expected);
  });

  it("grows faster than simple_daily on same params", () => {
    const compounding = computeLateFee(1000000, 30, policy);
    const simple = computeLateFee(1000000, 30, { type: "simple_daily", amount: 2, maxLateFeeAmount: 0 });
    expect(compounding).toBeGreaterThan(simple);
  });

  it("day 1 ≈ percentage × balance (compound ≈ simple for 1 day)", () => {
    // ((1.02)^1 - 1) = 0.02 exactly
    expect(computeLateFee(1000000, 1, policy)).toBe(20000);
  });
});

describe("computeLateFee — maxLateFeeAmount cap", () => {
  it("caps at maxLateFeeAmount in rupees", () => {
    const policy = { type: "simple_daily", amount: 2, compounding: false, maxLateFeeAmount: 100 };
    // Without cap: 1000000 × 2% × 10 = 200000 paisa (Rs 2000)
    // With cap: Rs 100 = 10000 paisa
    expect(computeLateFee(1000000, 10, policy)).toBe(10000);
  });

  it("does not cap when fee is below maxLateFeeAmount", () => {
    const policy = { type: "fixed", amount: 50, compounding: false, maxLateFeeAmount: 100 };
    // Rs 50 fee < Rs 100 cap → no cap applied
    expect(computeLateFee(1000000, 1, policy)).toBe(5000);
  });

  it("maxLateFeeAmount = 0 means no cap", () => {
    const policy = { type: "simple_daily", amount: 2, compounding: false, maxLateFeeAmount: 0 };
    const fee = computeLateFee(10000000, 100, policy);
    expect(fee).toBeGreaterThan(0);
    // 10000000 × 2% × 100 = 20000000 paisa (Rs 200,000) — no cap
    expect(fee).toBe(20000000);
  });
});

describe("computeLateFee — paisa integer invariant", () => {
  it("always returns an integer", () => {
    const policies = [
      { type: "fixed", amount: 333, compounding: false, maxLateFeeAmount: 0 },
      { type: "simple_daily", amount: 1.5, compounding: false, maxLateFeeAmount: 0 },
      { type: "percentage", amount: 3, compounding: false, maxLateFeeAmount: 0 },
      { type: "percentage", amount: 1.5, compounding: true, maxLateFeeAmount: 0 },
    ];
    for (const policy of policies) {
      const fee = computeLateFee(999999, 7, policy);
      expect(Number.isInteger(fee)).toBe(true);
    }
  });

  it("never returns negative", () => {
    const policy = { type: "simple_daily", amount: 2, compounding: false, maxLateFeeAmount: 0 };
    expect(computeLateFee(0, 0, policy)).toBe(0);
    expect(computeLateFee(0, 10, policy)).toBe(0);
  });
});
