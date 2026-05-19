/**
 * cron.markOverdue.integration.test.js
 *
 * Integration tests for markOverdueRents() — the step [3a] function from master-cron.js.
 * Uses a real in-memory MongoDB. Controls "today" via mocked nepaliDateHelper.
 *
 * Coverage:
 *   - pending → overdue for previous BS month
 *   - partially_paid → overdue for previous BS month
 *   - paid → stays paid (not touched)
 *   - current month pending → not touched
 *   - CAMs in previous month → overdue
 *   - idempotency: second run changes nothing
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// ── Control "today" = BS 2081-10-01 (Kartik 1) ────────────────────────────
// Previous month = BS 2081-09 (Ashwin, month index 8 in 0-based)
const mockPrevMonth = { getYear: () => 2081, getMonth: () => 8 }; // 0-based month 8 → nepaliMonth 9

jest.unstable_mockModule("../utils/nepaliDateHelper.js", () => ({
  addNepaliMonths: jest.fn().mockReturnValue(mockPrevMonth),
  getNepaliToday: jest.fn().mockReturnValue({ npToday: {}, bsYear: 2081, bsMonth: 10, bsDay: 1 }),
  getNepaliMonthDates: jest.fn().mockReturnValue({ lastDayNepali: "2081-10-30" }),
  parseNepaliISO: jest.fn().mockReturnValue({}),
  diffNepaliDays: jest.fn().mockReturnValue(0),
  formatNepaliISO: jest.fn().mockReturnValue("2081-10-01"),
  assertNepaliFields: jest.fn(),
  resolveNepaliPeriod: jest.fn(),
}));

// ── Mock master-cron side effects ──────────────────────────────────────────
jest.unstable_mockModule("node-cron", () => ({ default: { schedule: jest.fn() } }));
jest.unstable_mockModule("../config/socket.js", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) }),
}));
jest.unstable_mockModule("../modules/tenantBalance/tenantBalance.service.js", () => ({
  syncTenantBalance: jest.fn().mockResolvedValue({}),
  rebuildAllTenantBalances: jest.fn().mockResolvedValue({ processed: 0, errors: 0 }),
}));
jest.unstable_mockModule("../modules/rents/rent.service.js", () => ({
  default: jest.fn(),
  handleMonthlyRents: jest.fn().mockResolvedValue({ success: true, message: "ok", createdCount: 0 }),
  sendEmailToTenants: jest.fn().mockResolvedValue({ success: true }),
  buildCarryForwardMap: jest.fn().mockResolvedValue({}),
}));
jest.unstable_mockModule("../modules/cam/cam.service.js", () => ({
  handleMonthlyCams: jest.fn().mockResolvedValue({ success: true, message: "ok", count: 0 }),
  createCam: jest.fn(),
}));
jest.unstable_mockModule("../cron/service/lateFee.cron.js", () => ({
  applyLateFees: jest.fn().mockResolvedValue({ processed: 0, failed: 0, skipped: 0, totalDeltaFeePaisa: 0, errors: [] }),
  computeLateFee: jest.fn(),
}));
jest.unstable_mockModule("../cron/service/loanEmi.cron.js", () => ({
  applyLoanEmiReminders: jest.fn().mockResolvedValue({ processed: 0, failed: 0 }),
}));
jest.unstable_mockModule("../cron/service/rentDeferral.cron.js", () => ({
  runRentDeferralCron: jest.fn().mockResolvedValue({ processed: 0, skipped: 0, duplicates: 0, failed: 0, schedulesCompleted: 0, errors: [], targetPeriod: "" }),
}));
jest.unstable_mockModule("../modules/systemConfig/systemSetting.service.js", () => ({
  getCronSettings: jest.fn().mockResolvedValue({}),
}));
jest.unstable_mockModule("../modules/auth/admin.Model.js", () => ({
  default: { find: jest.fn().mockResolvedValue([]) },
}));
jest.unstable_mockModule("../modules/notifications/notification.model.js", () => ({
  default: { create: jest.fn().mockResolvedValue({}), exists: jest.fn().mockResolvedValue(null) },
}));
jest.unstable_mockModule("../cron/model/CronLog.js", () => ({
  CronLog: { create: jest.fn().mockResolvedValue({}) },
}));

// ── Import after mocks ─────────────────────────────────────────────────────
const { markOverdueRents } = await import("../cron/service/master-cron.js");
const { Rent } = await import("../modules/rents/rent.Model.js");
const { Cam } = await import("../modules/cam/cam.model.js");

// ─────────────────────────────────────────────────────────────────────────────

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Rent.deleteMany({});
  await Cam.deleteMany({});
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeId() {
  return new mongoose.Types.ObjectId();
}

function baseRent(overrides = {}) {
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
    status: "pending",
    rentFrequency: "monthly",
    units: [makeId()],
    nepaliMonth: 9,   // Ashwin — previous month
    nepaliYear: 2081,
    nepaliDate: "2081-09-01",
    createdBy: makeId(),
    englishDueDate: new Date("2024-10-25"),
    nepaliDueDate: "2081-09-30",
    ...overrides,
  };
}

function baseCam(overrides = {}) {
  return {
    tenant: makeId(),
    property: makeId(),
    block: makeId(),
    innerBlock: makeId(),
    month: 10,
    nepaliMonth: 9,
    nepaliYear: 2081,
    nepaliDate: "2081-09-01",
    year: 2024,
    amountPaisa: 200000,  // Rs 2,000
    paidAmountPaisa: 0,
    status: "pending",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("markOverdueRents — rent status transitions", () => {
  it("marks previous-month pending rent as overdue", async () => {
    await Rent.create(baseRent({ status: "pending" }));

    const mockToday = { getYear: () => 2081, getMonth: () => 9 }; // 0-based month 9 = Kartik
    await markOverdueRents(mockToday);

    const rent = await Rent.findOne({});
    expect(rent.status).toBe("overdue");
  });

  it("marks previous-month partially_paid rent as overdue", async () => {
    await Rent.create(baseRent({ status: "partially_paid", paidAmountPaisa: 1000000 }));

    const mockToday = {};
    await markOverdueRents(mockToday);

    const rent = await Rent.findOne({});
    expect(rent.status).toBe("overdue");
  });

  it("does NOT touch paid rents", async () => {
    // paidAmountPaisa must equal grossRentAmountPaisa for pre-save hook to store "paid"
    await Rent.create(baseRent({ status: "paid", paidAmountPaisa: 5000000 }));

    await markOverdueRents({});

    const rent = await Rent.findOne({});
    expect(rent.status).toBe("paid");
  });

  it("does NOT mark current-month rents as overdue", async () => {
    // Current month = 2081-10
    await Rent.create(baseRent({
      nepaliMonth: 10,
      nepaliYear: 2081,
      nepaliDate: "2081-10-01",
      nepaliDueDate: "2081-10-30",
      status: "pending",
    }));

    await markOverdueRents({});

    const rent = await Rent.findOne({});
    expect(rent.status).toBe("pending"); // untouched
  });

  it("handles mixed bag: marks only eligible rents", async () => {
    await Rent.create([
      baseRent({ status: "pending" }),
      baseRent({ status: "partially_paid", paidAmountPaisa: 500000 }),
      baseRent({ paidAmountPaisa: 5000000 }), // pre-save hook sets "paid" when fully paid
      baseRent({ nepaliMonth: 10, nepaliDate: "2081-10-01", nepaliDueDate: "2081-10-30", status: "pending" }),
    ]);

    const result = await markOverdueRents({});

    expect(result.marked).toBe(2); // pending + partially_paid from prev month

    const overdueRents = await Rent.find({ status: "overdue" });
    const pendingRents = await Rent.find({ status: "pending" });
    const paidRents = await Rent.find({ status: "paid" });

    expect(overdueRents).toHaveLength(2);
    expect(pendingRents).toHaveLength(1); // current month
    expect(paidRents).toHaveLength(1);
  });
});

describe("markOverdueRents — CAM status transitions", () => {
  it("marks previous-month pending CAMs as overdue", async () => {
    await Cam.create(baseCam({ status: "pending" }));
    await Cam.create(baseCam({ status: "partially_paid", paidAmountPaisa: 100000 }));
    // paidAmountPaisa must equal amountPaisa for pre-save hook to store "paid"
    await Cam.create(baseCam({ paidAmountPaisa: 200000 }));

    const result = await markOverdueRents({});

    expect(result.camsMarked).toBe(2);

    const overdueCams = await Cam.find({ status: "overdue" });
    expect(overdueCams).toHaveLength(2);

    const paidCam = await Cam.findOne({ status: "paid" });
    expect(paidCam).not.toBeNull();
  });
});

describe("markOverdueRents — idempotency", () => {
  it("second run marks nothing (already overdue)", async () => {
    await Rent.create(baseRent({ status: "pending" }));
    await Cam.create(baseCam({ status: "pending" }));

    const first = await markOverdueRents({});
    expect(first.marked).toBe(1);
    expect(first.camsMarked).toBe(1);

    const second = await markOverdueRents({});
    expect(second.marked).toBe(0);   // overdue is not in ['pending','partially_paid']
    expect(second.camsMarked).toBe(0);
  });

  it("accounting equation: overdue count equals original pending+partially_paid count", async () => {
    const pendingCount = 3;
    const partialCount = 2;
    const paidCount = 1;

    await Rent.create([
      ...Array(pendingCount).fill(null).map(() => baseRent({ status: "pending" })),
      ...Array(partialCount).fill(null).map(() => baseRent({ status: "partially_paid", paidAmountPaisa: 500000 })),
      // fully paid: pre-save hook computes "paid" when paidAmountPaisa === grossRentAmountPaisa
      ...Array(paidCount).fill(null).map(() => baseRent({ paidAmountPaisa: 5000000 })),
    ]);

    const result = await markOverdueRents({});

    expect(result.marked).toBe(pendingCount + partialCount);
    const totalOverdue = await Rent.countDocuments({ status: "overdue" });
    expect(totalOverdue).toBe(pendingCount + partialCount);
  });
});
