/**
 * cron.applyLateFees.integration.test.js
 *
 * Integration tests for applyLateFees() — step [3b] from master-cron.js.
 * Uses MongoMemoryReplSet (replica set) because applyLateFees uses mongoose sessions.
 *
 * Coverage:
 *   - disabled policy → no-op
 *   - no overdue rents → no-op
 *   - flat (fixed) fee: charges once, idempotent on re-run
 *   - flat percentage: charges once, idempotent on re-run
 *   - simple_daily: processes, returns non-zero processed count
 *   - within grace period → skipped
 *   - journal is called once per charged rent
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// ── "Today" = BS 2081-10-10 (10 days past due date of 2081-09-30) ─────────
// effectiveDaysLate = diffNepaliDays(due, today) - grace
// We'll make diffNepaliDays return 10, grace = 5 → effectiveDaysLate = 5

const mockPostJournalEntry = jest.fn().mockResolvedValue({ transaction: {}, ledgerEntries: [] });

jest.unstable_mockModule("../utils/nepaliDateHelper.js", () => ({
  diffNepaliDays: jest.fn().mockReturnValue(10), // 10 days past due
  getNepaliToday: jest.fn().mockReturnValue({ npToday: {}, bsYear: 2081, bsMonth: 10, bsDay: 10 }),
  getNepaliMonthDates: jest.fn().mockReturnValue({ lastDayNepali: "2081-10-30" }),
  parseNepaliISO: jest.fn().mockReturnValue({}),
  formatNepaliISO: jest.fn().mockReturnValue("2081-10-10"),
  addNepaliMonths: jest.fn(),
  assertNepaliFields: jest.fn(),
  resolveNepaliPeriod: jest.fn(),
}));

jest.unstable_mockModule("../modules/ledger/ledger.service.js", () => ({
  ledgerService: { postJournalEntry: mockPostJournalEntry },
}));

jest.unstable_mockModule("../modules/ledger/journal-builders/lateFee.js", () => ({
  buildLateFeeJournal: jest.fn().mockReturnValue({ type: "LATE_FEE", entries: [] }),
}));

jest.unstable_mockModule("../cron/model/CronLog.js", () => ({
  CronLog: { create: jest.fn().mockResolvedValue({}) },
}));

// ── PolicyStore: mutable so each test can set a different policy ───────────
let currentPolicy = null;
jest.unstable_mockModule("../modules/systemConfig/SystemConfig.Model.js", () => ({
  SystemConfig: {
    findOne: jest.fn().mockImplementation(() => ({
      lean: () => currentPolicy,
    })),
  },
}));

const { applyLateFees } = await import("../cron/service/lateFee.cron.js");
const { Rent } = await import("../modules/rents/rent.Model.js");
// Register referenced models so .populate() doesn't throw MissingSchemaError
await import("../modules/tenant/Tenant.Model.js");
await import("../modules/property/Property.Model.js");
await import("../modules/blocks/Block.Model.js");

// ─────────────────────────────────────────────────────────────────────────────

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Rent.deleteMany({});
  mockPostJournalEntry.mockClear();
  currentPolicy = null;
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeId() {
  return new mongoose.Types.ObjectId();
}

function overdueRent(overrides = {}) {
  return {
    tenant: makeId(),
    innerBlock: makeId(),
    block: makeId(),
    property: makeId(),
    englishMonth: 10,
    englishYear: 2024,
    grossRentAmountPaisa: 5000000,  // Rs 50,000
    paidAmountPaisa: 0,
    tdsAmountPaisa: 0,
    status: "overdue",
    rentFrequency: "monthly",
    units: [makeId()],
    nepaliMonth: 9,
    nepaliYear: 2081,
    nepaliDate: "2081-09-01",
    createdBy: makeId(),
    englishDueDate: new Date("2024-10-25"),
    nepaliDueDate: "2081-09-30",
    lateFeeApplied: false,
    lateFeePaisa: 0,
    ...overrides,
  };
}

function enablePolicy(type, amount, { grace = 5, compounding = false, cap = 0, appliesTo = "rent" } = {}) {
  currentPolicy = {
    value: {
      enabled: true,
      gracePeriodDays: grace,
      type,
      amount,
      compounding,
      maxLateFeeAmount: cap,
      appliesTo,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("applyLateFees — no-op scenarios", () => {
  it("returns success with processed=0 when policy is disabled", async () => {
    currentPolicy = { value: { enabled: false } };
    await Rent.create(overdueRent());

    const result = await applyLateFees(makeId().toString());

    expect(result.processed).toBe(0);
    expect(result.success).toBe(true);
    expect(mockPostJournalEntry).not.toHaveBeenCalled();
  });

  it("returns success with processed=0 when no overdue rents", async () => {
    enablePolicy("fixed", 500);
    // seed only paid/pending rents
    await Rent.create(overdueRent({ status: "paid" }));
    await Rent.create(overdueRent({ status: "pending" }));

    const result = await applyLateFees(makeId().toString());

    expect(result.processed).toBe(0);
    expect(mockPostJournalEntry).not.toHaveBeenCalled();
  });

  it("skips rent within grace period (diffNepaliDays returns 3, grace=5)", async () => {
    enablePolicy("fixed", 500, { grace: 5 });
    // override diffNepaliDays to return 3 (within grace)
    const { diffNepaliDays } = await import("../utils/nepaliDateHelper.js");
    diffNepaliDays.mockReturnValueOnce(3);

    await Rent.create(overdueRent());
    const result = await applyLateFees(null);

    expect(result.processed).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe("applyLateFees — fixed fee policy", () => {
  it("charges fixed fee on first run", async () => {
    enablePolicy("fixed", 500); // Rs 500 = 50000 paisa
    await Rent.create(overdueRent());

    const result = await applyLateFees(makeId().toString());

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(1);

    const rent = await Rent.findOne({});
    expect(rent.lateFeePaisa).toBe(50000);
    expect(rent.lateFeeApplied).toBe(true);
  });

  it("is idempotent — second run skips already-charged rent", async () => {
    enablePolicy("fixed", 500);
    await Rent.create(overdueRent());

    await applyLateFees(null); // first run
    mockPostJournalEntry.mockClear();

    const second = await applyLateFees(null); // second run

    expect(second.processed).toBe(0);
    // flat policy excludes lateFeeApplied=true from query → not in skipped count either
    expect(mockPostJournalEntry).not.toHaveBeenCalled();

    // DB: fee unchanged
    const rent = await Rent.findOne({});
    expect(rent.lateFeePaisa).toBe(50000);
  });

  it("charges multiple overdue rents independently", async () => {
    enablePolicy("fixed", 500);
    await Rent.create([overdueRent(), overdueRent(), overdueRent()]);

    const result = await applyLateFees(null);

    expect(result.processed).toBe(3);
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(3);
  });
});

describe("applyLateFees — percentage flat policy", () => {
  it("charges correct percentage of outstanding balance", async () => {
    enablePolicy("percentage", 2); // 2% flat, no compounding
    await Rent.create(overdueRent({ grossRentAmountPaisa: 1000000 })); // Rs 10,000

    const result = await applyLateFees(null);

    expect(result.processed).toBe(1);
    const rent = await Rent.findOne({});
    // 2% of Rs 10,000 = Rs 200 = 20000 paisa
    expect(rent.lateFeePaisa).toBe(20000);
  });

  it("is idempotent — second run skips", async () => {
    enablePolicy("percentage", 2);
    await Rent.create(overdueRent());

    await applyLateFees(null);
    mockPostJournalEntry.mockClear();
    const second = await applyLateFees(null);

    expect(second.processed).toBe(0);
    expect(mockPostJournalEntry).not.toHaveBeenCalled();
  });
});

describe("applyLateFees — simple_daily policy", () => {
  it("processes overdue rent and posts journal", async () => {
    enablePolicy("simple_daily", 2); // 2% per day
    await Rent.create(overdueRent({ grossRentAmountPaisa: 1000000 }));

    const result = await applyLateFees(null);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(1);

    const rent = await Rent.findOne({});
    // 2% × 5 effective days × 1000000 paisa = 100000 paisa
    expect(rent.lateFeePaisa).toBe(100000);
    expect(rent.lateFeeApplied).toBe(true);
  });
});

describe("applyLateFees — balance accounting", () => {
  it("skips rent with zero outstanding balance (fully paid)", async () => {
    enablePolicy("fixed", 500);
    // Create overdue rent, then set paidAmountPaisa via updateOne (bypasses pre-save hook)
    // so status stays "overdue" but balance is zero — tests the defensive balance check
    const doc = await Rent.create(overdueRent());
    await Rent.updateOne({ _id: doc._id }, { $set: { paidAmountPaisa: 5000000 } });

    const result = await applyLateFees(null);

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPostJournalEntry).not.toHaveBeenCalled();
  });

  it("accounts for TDS when computing outstanding balance", async () => {
    enablePolicy("percentage", 5);
    // gross = 1000000, TDS = 100000 → effective = 900000
    // Set tdsAmountPaisa via updateOne to bypass pre-save status recalc
    const doc = await Rent.create(overdueRent({ grossRentAmountPaisa: 1000000 }));
    await Rent.updateOne({ _id: doc._id }, { $set: { tdsAmountPaisa: 100000 } });

    const result = await applyLateFees(null);

    expect(result.processed).toBe(1);
    const rent = await Rent.findOne({});
    // 5% of (1000000 - 100000) = 5% of 900000 = 45000 paisa
    expect(rent.lateFeePaisa).toBe(45000);
  });
});
