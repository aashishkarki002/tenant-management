# Cron Job Architecture, Failure Analysis & Testing Guide

**EasyManage — Property Management System | Backend Cron Documentation**

> Rent & CAM Lifecycle · Nepali BS Calendar · Late Fees · Loan EMIs

---

## Claude Context Primer

> Paste this section at the top of any new Claude conversation about cron/backend work.

**Stack:** Node.js (ESM) · Express · MongoDB + Mongoose · `nepali-datetime` library  
**Cron runner:** `node-cron` — all crons registered in `server.js` at boot  
**Timezone:** All business logic uses **NPT (UTC+5:45)**. Never use server local time.  
**Calendar:** Bikram Sambat (BS) — months are 29–32 days, no fixed pattern.  
**Paisa convention:** All monetary values stored as integers in **paisa** (1 Rs = 100 paisa). No floats in DB.  
**Single source of truth for date:** `getNepaliToday()` in `nepaliDateHelper.js` — no other file calls `new Date()` or `new NepaliDate()` for business logic.

### Key Files

| File                                         | Role                                                |
| -------------------------------------------- | --------------------------------------------------- |
| `server.js`                                  | Boot sequence — wires all crons in dependency order |
| `cron/service/master-cron.js`                | Orchestrator — fires at 00:00 NPT daily             |
| `cron/service/lateFee.cron.js`               | Late fee engine — 4 modes, runs every day           |
| `cron/service/generator.cron.js`             | Generator checks — 09:00 + 14:00 NPT                |
| `utils/nepaliDateHelper.js`                  | **All** date logic lives here                       |
| `modules/rents/rent.Model.js`                | Rent schema with pre-save hook for status           |
| `modules/rents/rent.service.js`              | `handleMonthlyRents()` — creates Rent docs          |
| `modules/systemConfig/SystemConfig.Model.js` | Stores `lateFeePolicy` config                       |

### Rent Schema Shape (key fields)

```typescript
{
  tenant, innerBlock, block, property,          // refs
  nepaliMonth: Number,  // 1-based
  nepaliYear: Number,
  englishMonth: Number, englishYear: Number,
  nepaliDate: String,   // 'YYYY-MM-DD' BS format
  nepaliDueDate: String, englishDueDate: Date,
  rentAmountPaisa: Number,   // always integer
  paidAmountPaisa: Number,
  tdsAmountPaisa: Number,
  lateFeePaisa: Number,
  lateFeeApplied: Boolean,   // idempotency guard for flat/% fees
  overdueMarkedAt: Date,     // set by master-cron step [3a]
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue',
  createdBy, lastPaidBy,     // Admin refs
  // virtual: remainingAmount
}
// Unique index: { tenant, nepaliMonth, nepaliYear }
```

### Late Fee Policy Shape (SystemConfig key='lateFeePolicy')

```typescript
{
  enabled: Boolean,
  type: 'fixed' | 'percentage' | 'simple_daily',
  amount: Number,           // Rs (not paisa) for config
  gracePeriodDays: Number,
  compounding: Boolean,     // true = compound daily, false = flat/simple
  maxLateFeeAmount: Number  // 0 = no cap
}
```

---

## 1. How the Cron System Works

### 1.1 Boot Sequence (`server.js`)

```
1. connectDB()                          // MongoDB must be live first
2. initializeSocket(server)             // socket.io for real-time admin notifications
3. initializeWebPush()                  // VAPID keys for push notifications
4. import('./cron/service/master-cron.js')  // self-registers 00:00 NPT schedule
5. scheduleGeneratorCheckCron()         // 09:00 + 14:00 NPT
6. scheduleDailyChecklistCron()         // daily check reminder
7. createAndNotifyMorning()             // morning checklist notification
```

> ⚠️ If MongoDB is not connected before step 4, any cron that fires before reconnection will throw and the error is caught only at the CronLog level — the cron process itself stays alive.

---

### 1.2 The Master Cron (`master-cron.js`)

Fires every day at **00:00 NPT**. Orchestrates every rent lifecycle step in strict order:

| Step | Label           | When Runs                | What It Does                                                                   |
| ---- | --------------- | ------------------------ | ------------------------------------------------------------------------------ |
| [1]  | Monthly Rents   | Day 1 of BS month only   | Creates Rent docs for all active tenants via `handleMonthlyRents()`            |
| [2]  | Monthly CAMs    | Day 1 of BS month only   | Creates CAM charge documents via `handleMonthlyCams()`                         |
| [3a] | Mark Overdue    | Day 1 of BS month only   | Bulk-updates PREVIOUS month's pending/partially_paid rents to `status=overdue` |
| [3b] | Late Fees       | **EVERY day**            | Calls `applyLateFees()` — idempotent for flat; grows daily for compounding     |
| [4]  | Email Tenants   | Day 1 of BS month only   | Sends rent charge emails after [3a] so status is correct                       |
| [5]  | Admin Reminders | Day (`lastDay − 7`) only | Notifies admins of still-unpaid rents with days-left countdown                 |
| [6]  | Loan EMI        | **EVERY day**            | Calls `applyLoanEmiReminders()` — tiered 7d/3d/0d/overdue notifications        |

> ⚠️ An in-process lock (`isRunning` flag) prevents overlapping runs. For multi-instance deployments this must be replaced with **Redis redlock**.

---

### 1.3 Nepali Date Logic — The Core Engine

All date decisions flow through `getNepaliToday()` in `nepaliDateHelper.js`.

```js
// getNepaliToday() — simplified
const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // 20,700,000 ms
const nptNow = new Date(Date.now() + NPT_OFFSET_MS);
// Extract using getUTC* so server TZ never interferes
const englishToday = new Date(
  Date.UTC(nptNow.getUTCFullYear(), nptNow.getUTCMonth(), nptNow.getUTCDate()),
);
const npToday = new NepaliDate(englishToday);
```

Returns: `{ englishToday, npToday, bsYear, bsMonth (1-based), bsDay }`

| Function                   | Purpose                                               | Where Used                                           |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `getNepaliToday()`         | Current NPT date — single source of truth             | master-cron, lateFee, loanEmi, generator, dailyCheck |
| `getNepaliMonthDates()`    | First/last/reminder day of a BS month                 | master-cron (reminderDay), rent.service              |
| `addNepaliMonths(date, n)` | Advance by N months with day-clamping                 | master-cron (prev month for overdue), rent.service   |
| `diffNepaliDays(d1, d2)`   | Calendar-correct day difference via English pivot     | lateFee.cron (`getEffectiveDaysLate`)                |
| `parseNepaliISO(str)`      | Parse stored `'YYYY-MM-DD'` BS string to NepaliDate   | lateFee.cron, rent model                             |
| `formatNepaliISO(npDate)`  | Serialize NepaliDate to `'YYYY-MM-DD'` for DB storage | lateFee.cron journal builder                         |

---

### 1.4 Late Fee Engine (`lateFee.cron.js`)

| Mode           | Config                               | Fires                    | Idempotency                                 | Example                         |
| -------------- | ------------------------------------ | ------------------------ | ------------------------------------------- | ------------------------------- |
| Fixed          | `type=fixed`                         | Once, day 1 past grace   | `lateFeeApplied=true` → skipped forever     | Rs 500 flat, always             |
| Flat %         | `type=percentage, compounding=false` | Once, day 1 past grace   | `lateFeeApplied=true` → skipped forever     | 2% of balance, charged once     |
| Simple Daily   | `type=simple_daily`                  | Every day — delta posted | `deltaFeePaisa=0` → same-day re-run skipped | 2%/day × 10 days = Rs 200       |
| Compound Daily | `type=percentage, compounding=true`  | Every day — delta posted | `deltaFeePaisa=0` → same-day re-run skipped | Rs1000 × (1.02^10 − 1) = Rs 219 |

> ℹ️ Compound formula: `lateFeePaisa = overdueBalance × ((1 + dailyRate)^effectiveDays − 1)`. Journal only posts the **DELTA** (today − yesterday) to avoid double-booking. Accounting journal is always self-consistent even if the cron reruns.

---

### 1.5 Generator & Daily Checklist Crons

| Cron                 | Schedule (NPT)                     | Logic                                                                                 |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| Generator morning    | 09:00 every day                    | Sends push to ALL active staff unconditionally                                        |
| Generator escalation | 14:00 every day                    | Queries `getUncheckedGenerators()` — only fires if `lastCheckedAt < today's midnight` |
| Daily checklist      | Configured in `dailyCheck.cron.js` | Push notifications for daily property checks; uses same NPT date logic                |

---

## 2. Failure Catalogue

### 2.1 Critical Bugs (Break Core Logic)

**BUG-01 · Duplicate CronLog write for Late Fees on Day 1** — `master-cron.js`
`applyLateFees()` already creates its own CronLog inside `lateFee.cron.js`. Master then creates a second CronLog for `LATE_FEE_APPLICATION` unconditionally.

> 🔴 **Fix:** Remove the `CronLog.create` block inside the lateFee step in `master-cron.js`. Canonical log lives in `applyLateFees()`. Keep only the admin notification block.

**BUG-02 · `createAndNotifyMorning()` called on every restart** — `server.js`
`server.js` calls it unconditionally at boot. Server restart mid-day sends spurious morning notifications.

> 🔴 **Fix:** Wrap in time-window check — only fire if current NPT time is 06:00–10:00, or move fully into `scheduleDailyChecklistCron()`.

**BUG-03 · Loan EMI log double-registers error objects** — `master-cron.js`
`loanResult.errors.join(' | ')` is called on `{ loanId, error }` objects → logs `[object Object] | [object Object]`.

> ⚠️ **Fix:** `errors.map(e => \`${e.loanId}: ${e.error}\`).join(' | ')` — already used correctly in the lateFee log, apply consistently.

**BUG-04 · Rent status overwritten by pre-save hook after payment** — `rent.Model.js`
Pre-save hook recalculates status from `paidAmountPaisa` on every save. If `lateFeePaisa` is saved after overdue marking, hook may reset status to `partially_paid`.

> 🔴 **Fix:**

```js
// In rent.Model.js pre-save hook
if (this.overdueMarkedAt && this.paidAmountPaisa < effectiveRentPaisa) {
  this.status = "overdue";
  return;
}
```

---

### 2.2 Race Conditions

**BUG-05 · In-process lock is not cluster-safe** — `master-cron.js`
`isRunning` flag only works for single Node.js process. PM2 cluster mode causes both instances to run at 00:00 NPT — duplicate CAM and CronLog (Rent is protected by unique index).

> ⚠️ **Fix:** Replace with `redlock` on Redis. Acquire lock TTL 120s at cron start, release in `finally` block.

**BUG-06 · Generator escalation uses English midnight, not NPT midnight** — `generator.cron.js`
`getUncheckedGenerators()` compares `lastCheckedAt` to `englishToday`. Off by 5h45m from actual Nepal midnight.

> ⚠️ **Fix:**

```js
lastCheckedAt: {
  $lt: new Date(englishToday.getTime() - (5 * 60 + 45) * 60 * 1000);
}
// OR store lastCheckedAt in NPT and use toNepalMidnight() from the helper
```

---

### 2.3 Configuration & Environment Failures

**BUG-07 · `SYSTEM_ADMIN_ID` fallback silently swallows notification failures** — `master-cron.js`
If no active admins exist and `SYSTEM_ADMIN_ID` env var is missing, `getNotifiableAdmins` returns `[]` and cron continues silently — no notifications of any kind.

> ⚠️ **Fix:** Add `CronLog.create({ type: 'CRON_ERROR', message: 'No admins found and SYSTEM_ADMIN_ID not set' })` and send alert to hardcoded ops email.

**BUG-08 · Missing `lateFeePolicy` in SystemConfig silently skips all late fees** — `lateFee.cron.js`
If `SystemConfig` doc with `key='lateFeePolicy'` doesn't exist, `loadLateFeePolicy()` returns null, `applyLateFees()` returns `processed=0`, and no CronLog is written.

> ⚠️ **Fix:** Always write a CronLog from `applyLateFees()`, even when policy is disabled — use type `LATE_FEE_SKIPPED`.

---

### 2.4 Data Integrity Issues

**BUG-09 · E11000 duplicate key not handled gracefully** — `rent.service.js`
`Rent.create()` on a forced second run throws `MongoServerError E11000`. Bubbles as `rentResult.error`, CronLog `success=false`.

> ℹ️ **Fix:** Catch duplicate key errors specifically and return `{ message: 'Already created for this period', createdCount: 0, success: true }`.

**BUG-10 · Paisa float drift via `updateMany`** — `rent.Model.js`
Pre-save hook rounds paisa to integers but `updateMany` bypasses Mongoose hooks — can write floats to DB.

> ℹ️ **Fix:** Add MongoDB `$mod` validation in DB layer or enforce `NumberInt` type in seed/migration scripts.

---

## 3. Testing Guide

### 3.1 Testing Pyramid

| Layer            | What You Test                                                                     | Tools                        | Speed          |
| ---------------- | --------------------------------------------------------------------------------- | ---------------------------- | -------------- |
| Unit             | Pure functions: `computeLateFee`, `diffNepaliDays`, `getNepaliToday`              | Jest / Vitest                | < 1ms each     |
| Integration      | DB interactions: rent creation, status updates, journal entries                   | Jest + MongoDB Memory Server | < 5s per test  |
| Contract         | API endpoints return expected shapes: `/record-payment`, `/process-monthly-rents` | Supertest + Jest             | < 10s per test |
| E2E / Cron Smoke | Full `masterCron({ forceRun: true })` against seeded test DB                      | Jest + real local MongoDB    | < 30s          |

---

### 3.2 Unit Testing Pure Functions

```js
// lateFee.unit.test.js
import { computeLateFee } from "../cron/service/lateFee.cron.js";

describe("computeLateFee", () => {
  const balance = 100_000; // Rs 1,000 in paisa

  test("fixed: always returns flat amount regardless of days", () => {
    const policy = {
      type: "fixed",
      amount: 500,
      maxLateFeeAmount: 0,
      compounding: false,
    };
    expect(computeLateFee(balance, 1, policy)).toBe(50_000); // Rs 500 in paisa
    expect(computeLateFee(balance, 30, policy)).toBe(50_000); // same after 30 days
  });

  test("simple_daily: grows linearly with days", () => {
    const policy = {
      type: "simple_daily",
      amount: 2,
      maxLateFeeAmount: 0,
      compounding: false,
    };
    expect(computeLateFee(balance, 1, policy)).toBe(2_000); // 2% × 1 day
    expect(computeLateFee(balance, 10, policy)).toBe(20_000); // 2% × 10 days
  });

  test("compound: grows exponentially", () => {
    const policy = {
      type: "percentage",
      amount: 2,
      compounding: true,
      maxLateFeeAmount: 0,
    };
    // Rs 1000 × ((1.02)^10 − 1) = Rs 218.99 → 21899 paisa
    expect(computeLateFee(balance, 10, policy)).toBe(21899);
  });

  test("maxLateFeeAmount cap is respected", () => {
    const policy = {
      type: "fixed",
      amount: 500,
      maxLateFeeAmount: 200,
      compounding: false,
    };
    expect(computeLateFee(balance, 1, policy)).toBe(20_000); // capped at Rs 200
  });
});
```

```js
// nepaliDate.unit.test.js
import {
  diffNepaliDays,
  addNepaliMonths,
  getNepaliToday,
} from "../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

test("diffNepaliDays returns correct count across month boundary", () => {
  const d1 = new NepaliDate(2081, 0, 28); // Baisakh 28
  const d2 = new NepaliDate(2081, 1, 3); // Jestha 3
  // Baisakh 2081 has 31 days → gap is (31-28) + 3 = 6 days
  expect(diffNepaliDays(d1, d2)).toBe(6);
});

test("addNepaliMonths clamps day at month end", () => {
  const d = new NepaliDate(2080, 11, 30); // Chaitra 30
  const result = addNepaliMonths(d, 1);
  expect(result.getMonth()).toBe(0); // Baisakh
  expect(result.getYear()).toBe(2081);
});

test("getNepaliToday returns correct BS date matching known English date", () => {
  // 2024-04-13 UTC → 2081-01-01 BS (Baisakh 1)
  const knownUTC = new Date("2024-04-13T00:00:00Z").getTime();
  jest.spyOn(Date, "now").mockReturnValue(knownUTC);
  const { bsYear, bsMonth, bsDay } = getNepaliToday();
  expect(bsYear).toBe(2081);
  expect(bsMonth).toBe(1);
  jest.restoreAllMocks();
});
```

---

### 3.3 Integration Testing with MongoDB Memory Server

```js
// jest.config.js
export default { preset: "@shelf/jest-mongodb", testEnvironment: "node" };

// rent.integration.test.js
import mongoose from "mongoose";
import { Rent } from "../modules/rents/rent.Model.js";
import { handleMonthlyRents } from "../modules/rents/rent.service.js";

describe("handleMonthlyRents", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URL);
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  afterEach(async () => {
    await Rent.deleteMany({});
  });

  test("creates one rent per active tenant", async () => {
    await seedTestTenants(3);
    const result = await handleMonthlyRents();
    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(3);
    expect(await Rent.find({})).toHaveLength(3);
  });

  test("is idempotent — second run does not create duplicates", async () => {
    await seedTestTenants(2);
    await handleMonthlyRents();
    await handleMonthlyRents(); // simulate forceRun
    expect(await Rent.find({})).toHaveLength(2);
  });

  test("pre-save hook sets status=pending on zero paidAmount", async () => {
    const rent = await createTestRent({
      rentAmountPaisa: 100_000,
      paidAmountPaisa: 0,
    });
    expect(rent.status).toBe("pending");
  });
});
```

---

### 3.4 Time-Travel Testing — Simulating Nepali Month Boundaries

```js
// testUtils/nepaliTimeMachine.js
import NepaliDate from "nepali-datetime";

/**
 * Freeze time to a specific Nepali date for the duration of a test.
 * @param {number} bsYear  e.g. 2081
 * @param {number} bsMonth 1-based e.g. 1 = Baisakh
 * @param {number} bsDay   1-based e.g. 1
 * @returns cleanup function — call in finally/afterEach
 */
export function freezeToNepaliDate(bsYear, bsMonth, bsDay) {
  const np = new NepaliDate(bsYear, bsMonth - 1, bsDay);
  const englishDate = np.getDateObject();
  // Subtract NPT offset so getNepaliToday() reconstructs the right NPT date
  const fakeUTC = englishDate.getTime() - (5 * 60 + 45) * 60 * 1000;
  jest.spyOn(Date, "now").mockReturnValue(fakeUTC);
  return () => jest.restoreAllMocks();
}

// Usage
test("masterCron runs rent creation on BS day 1", async () => {
  const restore = freezeToNepaliDate(2081, 5, 1); // Shrawan 1, 2081
  try {
    await masterCron({ forceRun: false });
    const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 5 });
    expect(rents.length).toBeGreaterThan(0);
  } finally {
    restore();
  }
});
```

**Key Scenarios to Cover:**

| Scenario                         | Freeze To (BS)                      | What to Assert                                                        |
| -------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| New month — day 1                | Any month, Day 1                    | Rents created, CAMs created, prev month marked overdue, emails queued |
| Late fee grace period boundary   | Due date + gracePeriodDays          | `lateFeePaisa === 0` on grace day, `> 0` the next day                 |
| Compounding fee growth           | Due+grace, then +1, then +2         | `lateFeePaisa` grows each day by the correct delta                    |
| Admin reminder day               | `lastDay − 7`                       | `RENT_REMINDER` notifications created for pending rents               |
| Month with 29 days (short month) | Chaitra, last day                   | `addNepaliMonths` clamps correctly, no date overflow crash            |
| Year boundary                    | Chaitra 30 (year end)               | Rents created for Baisakh of next BS year                             |
| Generator unchecked at 14:00     | Any day + mock `lastCheckedAt` null | Escalation push sent to all admins                                    |
| Loan EMI 7 days ahead            | EMI date − 7                        | 7-day tier notification created, no duplicate on same day             |

---

### 3.5 Smoke Testing the Full Pipeline

```js
// Only expose in non-production environments
if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/cron/run-master", protect, async (req, res) => {
    const { masterCron } = await import("./cron/service/master-cron.js");
    const result = await masterCron({ forceRun: true });
    res.json(result);
  });
}
```

```bash
curl -X POST http://localhost:3000/api/dev/cron/run-master \
  -H 'Authorization: Bearer <admin_token>' | jq .
```

> 🔴 Always run against a test database (`MONGO_URL=mongodb://localhost:27017/test-db`). Never production. Add `NODE_ENV` checks in `server.js` to prevent the dev route from registering in prod.

---

### 3.6 Late Fee Cron Isolation Test

```js
// lateFee.smoke.test.js
import { applyLateFees } from "../cron/service/lateFee.cron.js";
import { Rent } from "../modules/rents/rent.Model.js";
import { SystemConfig } from "../modules/systemConfig/SystemConfig.Model.js";

async function seedOverdueRent() {
  return Rent.create({
    tenant: testTenantId,
    block: testBlockId,
    innerBlock: testInnerBlockId,
    property: testPropertyId,
    rentAmountPaisa: 100_000,
    paidAmountPaisa: 0,
    tdsAmountPaisa: 0,
    status: "overdue",
    lateFeeApplied: false,
    nepaliDueDate: "2081-04-30",
    englishDueDate: new Date("2024-08-15"),
    nepaliMonth: 4,
    nepaliYear: 2081,
    englishMonth: 8,
    englishYear: 2024,
    nepaliDate: "2081-04-01",
    createdBy: adminId,
  });
}

test("flat fee: charged once and then idempotent", async () => {
  await SystemConfig.create({
    key: "lateFeePolicy",
    value: {
      enabled: true,
      type: "fixed",
      amount: 500,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 0,
    },
  });
  await seedOverdueRent();

  const freezeDay10 = freezeToNepaliDate(2081, 5, 10); // well past grace
  const run1 = await applyLateFees(adminId);
  expect(run1.processed).toBe(1);
  expect(run1.totalDeltaFeePaisa).toBe(50_000); // Rs 500

  const run2 = await applyLateFees(adminId); // same day, re-run
  expect(run2.processed).toBe(0);
  expect(run2.skipped).toBe(1);

  freezeDay10();
});
```

---

## 4. Industry Patterns for Non-Gregorian Calendar Systems

### 4.1 Calendar Comparison

| Calendar           | Used By                      | Avg Year Len             | Key Challenge                                                        |
| ------------------ | ---------------------------- | ------------------------ | -------------------------------------------------------------------- |
| Bikram Sambat (BS) | Nepal (your system)          | 365.25 days              | Months are 29–32 days with no fixed pattern; limited library support |
| Hijri / Islamic    | Saudi Arabia, Pakistan, Gulf | 354–355 days             | Year is ~11 days shorter than Gregorian; financial year-end drifts   |
| Hebrew             | Israel                       | 353–385 days (leap)      | 7-year leap cycle with 13th month                                    |
| Thai Solar         | Thailand                     | Gregorian + 543yr offset | Offset only — every year/date comparison must account for it         |
| Ethiopian          | Ethiopia, Eritrea            | 365 days + 13th month    | Pagume month has 5–6 days; fiscal Q4 spans two Gregorian months      |

### 4.2 Pattern 1: The Temporal Seam (most common)

Replace all calls to `Date.now()` with a testable clock abstraction. Your `nepaliDateHelper.js` is already the right abstraction layer — upgrade it:

```js
// clock.js — production
export const clock = { now: () => Date.now() };

// nepaliDateHelper.js — use the seam
import { clock } from "../clock.js";
function getNepaliToday() {
  const NPT_OFFSET_MS = 20_700_000;
  const nptNow = new Date(clock.now() + NPT_OFFSET_MS); // <-- seam here
  // ... rest of logic
}

// In tests — no global state patching, concurrent-safe
import { clock } from "../clock.js";
clock.now = () => new Date("2024-04-13T00:00:00Z").getTime(); // BS 2081-01-01
```

> This is more robust than `jest.spyOn(Date, 'now')` — doesn't patch global state, tests can run concurrently.

### 4.3 Pattern 2: Property-Based Testing (Stripe, Adyen)

Generate thousands of random valid BS dates and assert invariants always hold:

```js
import fc from "fast-check";
import { addNepaliMonths } from "../utils/nepaliDateHelper.js";

test("addNepaliMonths is always reversible", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2070, max: 2090 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }), // safe day — avoids edge months
      (year, month, day) => {
        const d = new NepaliDate(year, month, day);
        const forward = addNepaliMonths(d, 6);
        const back = addNepaliMonths(forward, -6);
        expect(back.getYear()).toBe(year);
        expect(back.getMonth()).toBe(month);
      },
    ),
  );
});
```

### 4.4 Pattern 3: Golden Reference Dataset (Saudi Aramco, Israeli banks)

```json
// fixtures/golden-bs-dates.json
[
  {
    "english": "2024-04-13",
    "bs_year": 2081,
    "bs_month": 1,
    "bs_day": 1,
    "month_name": "Baisakh"
  },
  {
    "english": "2024-07-15",
    "bs_year": 2081,
    "bs_month": 3,
    "bs_day": 31,
    "month_name": "Ashadh"
  },
  {
    "english": "2025-01-14",
    "bs_year": 2081,
    "bs_month": 10,
    "bs_day": 1,
    "month_name": "Magh"
  }
]
```

```js
// golden.test.js
import goldenDates from "./fixtures/golden-bs-dates.json" assert { type: "json" };

test.each(goldenDates)(
  "$english → BS $bs_year-$bs_month-$bs_day",
  ({ english, bs_year, bs_month, bs_day }) => {
    const np = new NepaliDate(new Date(english));
    expect(np.getYear()).toBe(bs_year);
    expect(np.getMonth() + 1).toBe(bs_month); // +1 because getMonth() is 0-based
    expect(np.getDate()).toBe(bs_day);
  },
);
```

### 4.5 Pattern 4: Month-Shape Matrix Testing

```js
// BS 2081 month lengths (from official calendar)
const BS_2081_MONTH_DAYS = [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30];
//                          Bai Jes Ash Shr Bha Ash Kar Man Pou Mag Fal Cha

describe("Month boundary: last day never overflows", () => {
  BS_2081_MONTH_DAYS.forEach((days, m) => {
    test(`BS 2081 month ${m + 1} last day is ${days}`, () => {
      const lastDay = new NepaliDate(2081, m, days);
      const eng = lastDay.getDateObject();
      eng.setDate(eng.getDate() + 1);
      const nextNp = new NepaliDate(eng);
      expect(nextNp.getMonth()).toBe((m + 1) % 12);
    });
  });
});
```

### 4.6 Pattern 5: Snapshot Testing for Notifications (eSewa, Khalti, IME Pay)

```js
test("late fee notification body matches snapshot", async () => {
  const rent = await createOverdueRentFixture({ lateFeePaisa: 50_000 });
  const notification = buildLateFeeNotification(rent);
  expect(notification).toMatchSnapshot();
  // First run: Jest writes the snapshot.
  // Subsequent runs: checks for exact match.
  // Update with: jest --updateSnapshot
});
```

### 4.7 CI/CD Integration

| Practice                              | Description                                                                                                            | Tool                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Matrix test runs                      | Run full suite against multiple frozen dates — month boundaries, year boundaries, fiscal dates                         | GitHub Actions matrix strategy    |
| Nightly regression against golden set | Validate `golden-bs-dates.json` every night against current library version — catches upstream `nepali-datetime` bugs  | GitHub Actions scheduled workflow |
| Cron dry-run in CI                    | In PR pipeline, run `masterCron({ forceRun: true })` against in-memory DB. Assert CronLog records, not just exit codes | Jest + mongodb-memory-server      |
| Chaos: random date injection          | 50 random valid BS dates per PR via property-based testing                                                             | fast-check                        |
| Calendar library pinning              | Pin `nepali-datetime` to exact version in `package-lock.json`, review upgrades manually                                | npm ci + dependabot review policy |

---

## 5. Recommended Test Suite Structure

```
tests/
  unit/
    computeLateFee.test.js          ← pure function: no mocks needed
    nepaliDateHelper.test.js        ← golden set + property-based
    rentPreSaveHook.test.js         ← Mongoose hook logic
  integration/
    handleMonthlyRents.test.js      ← full DB + idempotency
    applyLateFees.test.js           ← all 4 policy modes
    applyLoanEmiReminders.test.js   ← 3-tier notification
  smoke/
    masterCron.smoke.test.js        ← full pipeline, frozen clock
  fixtures/
    golden-bs-dates.json            ← 100 verified date pairs
    tenant.fixture.js
    rent.fixture.js
    systemConfig.fixture.js         ← lateFeePolicy variants
```

> ℹ️ Run **unit** tests on every commit (< 5s). Run **integration** and **smoke** on every PR (< 60s). Run **golden set** nightly (< 10s).

---

## 6. Priority Fix List

| Priority | Bug ID | File                | One-Line Fix                                                                                           |
| -------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------ |
| 🔴 P0    | BUG-04 | `rent.Model.js`     | Pre-save hook must preserve `'overdue'` status through partial payments                                |
| 🔴 P0    | BUG-02 | `server.js`         | `createAndNotifyMorning()` must not fire on every restart — add time-window guard                      |
| 🔴 P0    | BUG-01 | `master-cron.js`    | Remove duplicate `CronLog.create` for `LATE_FEE_APPLICATION` — already logged inside `applyLateFees()` |
| 🟡 P1    | BUG-05 | `master-cron.js`    | Replace `isRunning` flag with Redis redlock for multi-instance deployments                             |
| 🟡 P1    | BUG-06 | `generator.cron.js` | `getUncheckedGenerators()` NPT midnight boundary is 5h45m off — use `toNepalMidnight()`                |
| 🟡 P1    | BUG-08 | `lateFee.cron.js`   | Always write CronLog even when policy is disabled — use type `LATE_FEE_SKIPPED`                        |
| 🟢 P2    | BUG-07 | `master-cron.js`    | No-admins-found path must write CronLog and trigger ops email alert                                    |
| 🟢 P2    | BUG-03 | `master-cron.js`    | Loan EMI error formatting — use `.map(e => ...)`.join('\|')`not`.join` on objects                      |
| 🟢 P2    | BUG-09 | `rent.service.js`   | Catch E11000 duplicate-key in `handleMonthlyRents` and return `success: true`                          |
| 🔵 P3    | BUG-10 | `rent.Model.js`     | Enforce paisa integer fields at DB schema level to prevent float drift                                 |

---

_Document generated from live source code analysis. All bug references are to the uploaded file versions._
