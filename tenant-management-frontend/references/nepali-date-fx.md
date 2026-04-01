# Fix: `nepaliDate` / `nepaliDueDate` Type Migration

## Background

`nepaliDate` and `nepaliDueDate` are stored as `type: Date` in `rent.Model.js`.
Mongoose coerces BS strings like `"2082-12-04"` into JS Date objects, appending
a UTC timestamp: `"2082-12-04T05:33:41.864Z"`.

When `buildRentChargeJournal` (and any journal builder) calls
`new NepaliDate(rent.nepaliDate)`, the library treats the year `2082` as an
English (AD) year — far outside its supported range — and throws:

```
T [DateOutOfRangeError]: Date out of range
```

**The fix is to change both fields to `type: String` everywhere they are
declared, written, or read.** All MongoDB queries and cron logic that
previously relied on these fields as Date objects already use either
`englishDueDate` (a proper `type: Date` field) or the integer pair
`nepaliYear` / `nepaliMonth` for filtering — so no query logic breaks.

---

## Conventions to know before editing

| Convention                | Detail                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| BS string format          | Always `"YYYY-MM-DD"` e.g. `"2082-12-01"`                                     |
| Month storage             | **1-based** in DB (`nepaliMonth: 12` = Chaitra)                               |
| `NepaliDate` internal API | **0-based** months — always `+1` when reading, `-1` when constructing         |
| `parseNepaliISO(str)`     | Parses a BS `"YYYY-MM-DD"` string → `NepaliDate` instance correctly           |
| `formatNepaliISO(npDate)` | Formats a `NepaliDate` instance → `"YYYY-MM-DD"` BS string                    |
| `getNepaliMonthDates()`   | Returns `firstDayNepali` and `lastDayNepali` as pre-formatted BS strings      |
| `getNepaliToday()`        | Returns NPT-correct today — **use this in all crons instead of `new Date()`** |
| `englishDueDate`          | Stays `type: Date` — this is the MongoDB query anchor for date ranges         |

---

## File-by-file changes

---

### 1. `src/modules/rents/rent.Model.js`

Change the schema type for both Nepali date fields.

```js
// BEFORE
nepaliDate:    { type: Date,   required: true },
nepaliDueDate: { type: Date,   required: true },

// AFTER
nepaliDate:    { type: String, required: true },  // "2082-12-01" BS string
nepaliDueDate: { type: String, required: true },  // "2082-12-30" BS string
```

Also remove the supporting index on `nepaliDueDate` since you cannot do
range queries on a string date field — all range filtering already uses
`englishDueDate`:

```js
// REMOVE this line
rentSchema.index({ nepaliDueDate: 1 });
```

---

### 2. `src/modules/rents/rent.service.js` — `handleMonthlyRents`

`getNepaliMonthDates()` already returns pre-formatted BS strings.
Use them instead of the raw objects:

```js
// BEFORE
const {
  npMonth,
  npYear,
  nepaliDate, // ← now.toString() — uncontrolled format
  englishDueDate,
  lastDay, // ← NepaliDate instance, not a string
  englishMonth,
  englishYear,
} = getNepaliMonthDates();

// AFTER
const {
  npMonth,
  npYear,
  firstDayNepali, // "2082-12-01" — from formatNepaliISO, guaranteed format
  lastDayNepali, // "2082-12-30" — from formatNepaliISO, guaranteed format
  englishDueDate,
  englishMonth,
  englishYear,
} = getNepaliMonthDates();
```

Then in `rentsToInsert`:

```js
// BEFORE
nepaliDate:    nepaliDate,
nepaliDueDate: lastDay,

// AFTER
nepaliDate:    firstDayNepali,   // "2082-12-01"
nepaliDueDate: lastDayNepali,    // "2082-12-30"
```

---

### 3. `src/modules/tenant/services/tenant.create.js` — `createTenantTransaction`

Wherever a rent payload is built for a new tenant, the same two fields must
be BS strings. Find the rent object construction (it calls `createNewRent`)
and apply the same pattern:

```js
// BEFORE — any variant that produces a Date object
nepaliDate:    new Date(),               // wrong
nepaliDate:    someNepaliDateInstance,   // wrong — Mongoose coerces to Date
nepaliDueDate: lastDay,                  // wrong if lastDay is a NepaliDate

// AFTER
import { getNepaliMonthDates } from "../../../utils/nepaliDateHelper.js";
const { firstDayNepali, lastDayNepali } = getNepaliMonthDates();

nepaliDate:    firstDayNepali,   // "2082-12-01"
nepaliDueDate: lastDayNepali,    // "2082-12-30"
```

---

### 4. `src/modules/ledger/journal-builders/rentCharge.js`

Remove the `new NepaliDate(rent.nepaliDate)` wrapper — it is what causes the
crash. `rent.nepaliDate` is now already a correctly-formatted BS string.

```js
// BEFORE — crashes: new NepaliDate treats "2082-12-04" as AD year 2082
const nepaliDate = formatNepaliISO(new NepaliDate(rent.nepaliDate));

// AFTER — slice to guarantee no time component, fall back to today if missing
const nepaliDate =
  typeof rent.nepaliDate === "string" &&
  /^\d{4}-\d{2}-\d{2}/.test(rent.nepaliDate)
    ? rent.nepaliDate.slice(0, 10)
    : formatNepaliISO(getNepaliToday().npToday);
```

Also remove the two `console.log` debug lines below it that were added
while investigating:

```js
// REMOVE these two lines
console.log("rent.nepaliDate", rent.nepaliDate);
console.log("nepaliDate", nepaliDate);
```

---

### 5. `src/modules/rents/rent.controller.js` — `recordRentPaymentController`

The controller receives a BS date string from the frontend and currently
converts it to a JS Date object, destroying the BS year:

```js
// BEFORE — "2082-12-04" becomes a Date object → broken downstream
nepaliDate: nepaliDate ? new Date(nepaliDate) : undefined,

// AFTER — pass through as string; Payment model needs type: String too (see #6)
nepaliDate: nepaliDate ?? undefined,
```

---

### 6. `src/modules/payment/payment.model.js`

Check this model. If `nepaliDate` is declared as `type: Date`, change it:

```js
// BEFORE
nepaliDate: { type: Date },

// AFTER
nepaliDate: { type: String },   // "2082-12-04" BS string
```

Apply the same check to any other model that has a `nepaliDate` field
(e.g. `Expense`, `Cam`, `LateFee` if it exists as its own collection).

---

### 7. `src/cron/lateFee.cron.js` — `getEffectiveDaysLate`

This is the **only place** in all cron files where `nepaliDueDate` is
actually read. One line change:

```js
// BEFORE — new NepaliDate(string) treats BS year as AD year → DateOutOfRangeError
function getEffectiveDaysLate(nepaliDueDate, gracePeriodDays) {
  const dueDateNp = new NepaliDate(nepaliDueDate);
  const todayNp = new NepaliDate();
  // ...
}

// AFTER
import {
  parseNepaliISO,
  getNepaliToday,
} from "../../utils/nepaliDateHelper.js";
// (parseNepaliISO is already imported — just add getNepaliToday if not present)

function getEffectiveDaysLate(nepaliDueDate, gracePeriodDays) {
  if (!nepaliDueDate) throw new Error("nepaliDueDate is required");
  const dueDateNp = parseNepaliISO(nepaliDueDate); // BS string → NepaliDate correctly
  const { npToday } = getNepaliToday(); // NPT-correct today
  const totalDaysLate = diffNepaliDays(dueDateNp, npToday);
  if (totalDaysLate <= 0) return 0;
  return Math.max(0, totalDaysLate - gracePeriodDays);
}
```

Also fix the `lateFeeDoc` inside `processOneRent` — `nepaliDate` is being
stored as a JS Date object but should be a BS string:

```js
// BEFORE
const lateFeeDoc = {
  // ...
  nepaliDate: new Date(), // ← wrong type
};

// AFTER
import {
  formatNepaliISO,
  getNepaliToday,
} from "../../utils/nepaliDateHelper.js";

const lateFeeDoc = {
  // ...
  nepaliDate: formatNepaliISO(getNepaliToday().npToday), // "2082-12-01"
  chargedAt: new Date(), // ← audit timestamp, stays as Date
};
```

---

### 8. `src/utils/nepaliDateHelper.js` — add `getNepaliToday` and fix `diffNepaliDays`

Add the new `getNepaliToday` utility at the bottom of the timezone section,
and export it. This is the NPT-safe replacement for `new NepaliDate()` in
all cron files:

```js
/**
 * Get a stable "today in Nepal" context correct regardless of server timezone.
 * All crons must call this instead of new Date() or new NepaliDate() directly.
 *
 * Chain:
 *   UTC now → add fixed +5:45 offset → extract Y/M/D via getUTC* methods
 *   (server TZ never involved) → reconstruct UTC midnight → convert to BS
 *
 * @returns {{
 *   englishToday: Date,    // UTC midnight of Nepal's calendar today — use for DB queries
 *   npToday:      NepaliDate,
 *   bsYear:       number,  // 1-based
 *   bsMonth:      number,  // 1-based, matches DB storage
 *   bsDay:        number,
 * }}
 */
function getNepaliToday() {
  const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // 20_700_000 ms — Nepal UTC+5:45

  const nptNow = new Date(Date.now() + NPT_OFFSET_MS);
  const y = nptNow.getUTCFullYear();
  const m = nptNow.getUTCMonth(); // 0-based
  const d = nptNow.getUTCDate();

  // English midnight of Nepal's today, in UTC terms
  const englishToday = new Date(Date.UTC(y, m, d));

  // BS conversion — pass the UTC midnight Date, not new Date()
  const npToday = new NepaliDate(englishToday);

  return {
    englishToday,
    npToday,
    bsYear: npToday.getYear(),
    bsMonth: npToday.getMonth() + 1,
    bsDay: npToday.getDate(),
  };
}
```

Fix `diffNepaliDays` to normalize both sides to UTC midnight before
diffing, so a time component on either date never causes an off-by-one:

```js
// BEFORE — time component can cause off-by-one
function diffNepaliDays(npDate1, npDate2) {
  validateNepaliDateInstance(npDate2);
  const date2 = npDate2.getDateObject();
  const diffMs = date2.getTime() - npDate1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// AFTER — both sides normalized to UTC midnight
function diffNepaliDays(npDate1, npDate2) {
  validateNepaliDateInstance(npDate1);
  validateNepaliDateInstance(npDate2);
  const e1 = npDate1.getDateObject();
  const e2 = npDate2.getDateObject();
  const d1 = Date.UTC(e1.getFullYear(), e1.getMonth(), e1.getDate());
  const d2 = Date.UTC(e2.getFullYear(), e2.getMonth(), e2.getDate());
  return Math.round((d2 - d1) / 86_400_000);
}
```

Add `getNepaliToday` to the exports block at the bottom of the file:

```js
export {
  // ... existing exports ...
  getNepaliToday, // ← ADD
};
```

---

### 9. `src/cron/master-cron.js` — `getTodayNepali`

Replace the `new NepaliDate()` call with `getNepaliToday()`:

```js
// BEFORE
function getTodayNepali() {
  const today = new NepaliDate(); // ← UTC — wrong for first 5h45m of every Nepal day
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getYear();
  const lastDayOfMonth = NepaliDate.getDaysOfMonth(todayYear, today.getMonth());
  const reminderDay = lastDayOfMonth - 7;
  return {
    today,
    todayDay,
    todayMonth,
    todayYear,
    lastDayOfMonth,
    reminderDay,
  };
}

// AFTER
import {
  getNepaliMonthDates,
  addNepaliMonths,
  getNepaliToday,
} from "../../utils/nepaliDateHelper.js";

function getTodayNepali() {
  const { npToday, bsYear, bsMonth, bsDay } = getNepaliToday(); // NPT-correct
  const lastDayOfMonth = NepaliDate.getDaysOfMonth(bsYear, npToday.getMonth());
  const reminderDay = lastDayOfMonth - 7;
  return {
    today: npToday,
    todayDay: bsDay,
    todayMonth: bsMonth,
    todayYear: bsYear,
    lastDayOfMonth,
    reminderDay,
  };
}
```

---

### 10. `src/cron/loanEmi.cron.js` — Nepali today block

```js
// BEFORE
const today = new Date();
today.setHours(0, 0, 0, 0); // ← server-TZ dependent
const nd = new NepaliDate(today);
const nepaliYear = nd.getYear();
const nepaliMonth = nd.getMonth() + 1;
const todayMeta = { today, nepaliYear, nepaliMonth };

// AFTER
import { getNepaliToday } from "../../utils/nepaliDateHelper.js";

const { englishToday, bsYear, bsMonth } = getNepaliToday();
const todayMeta = {
  today: englishToday, // UTC midnight of Nepal's today — diffDays() now correct
  nepaliYear: bsYear,
  nepaliMonth: bsMonth,
};
```

---

### 11. `src/cron/generatorCheck.cron.js` — `getUncheckedGenerators`

```js
// BEFORE
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0); // ← server-TZ midnight

// AFTER
import { getNepaliToday } from "../../utils/nepaliDateHelper.js";
const { englishToday: startOfToday } = getNepaliToday(); // NPT midnight in UTC
```

---

## Search terms — find any remaining stragglers

After making the above changes, grep the codebase for these patterns to
catch anything missed:

```bash
# Any remaining BS string being passed into NepaliDate constructor
grep -rn "new NepaliDate(rent\." src/
grep -rn "new NepaliDate(.*nepaliDate" src/
grep -rn "new NepaliDate(.*nepaliDue" src/

# Any nepaliDate field still typed as Date in a Mongoose schema
grep -rn "nepaliDate.*type.*Date" src/
grep -rn "nepaliDueDate.*type.*Date" src/

# Any controller still converting a nepaliDate string to a Date object
grep -rn "new Date(nepaliDate)" src/
grep -rn "new Date(.*nepaliDate)" src/

# Any cron still calling new NepaliDate() with no arguments (UTC-dependent)
grep -rn "new NepaliDate()" src/cron/
```

All `new NepaliDate()` calls with no arguments inside cron files should be
replaced with `getNepaliToday().npToday`. `new NepaliDate()` with no
argument is fine only in `nepaliDateHelper.js` itself (inside
`getNepaliMonthDates`) because that function is called from non-cron
contexts where NPT correctness is not critical.

---

## What does NOT change

- `englishDueDate: { type: Date }` — stays as-is, it is the MongoDB date anchor
- `nepaliYear: { type: Number }` — stays as-is
- `nepaliMonth: { type: Number }` — stays as-is
- All MongoDB queries in cron files — none of them query `nepaliDueDate`
- `lateFee.cron.js` overdue query — `{ status: "overdue" }` is unaffected
- `master-cron.js` overdue marking — queries `nepaliYear` / `nepaliMonth` integers
- `master-cron.js` reminder step — queries `nepaliYear` / `nepaliMonth` integers

---

## Verification after changes

```bash
# 1. Start the server — should boot without errors
# 2. Trigger rent creation manually
POST /api/rent/process-monthly-rents

# 3. Check the created rent document in MongoDB — confirm field types
db.rents.findOne({}, { nepaliDate: 1, nepaliDueDate: 1, englishDueDate: 1 })
# Expected:
#   nepaliDate:    "2082-12-01"          ← string
#   nepaliDueDate: "2082-12-30"          ← string
#   englishDueDate: ISODate("2026-03-14") ← Date object, unchanged

# 4. Trigger late fee cron manually and confirm no DateOutOfRangeError
POST /api/cron/trigger-late-fees   (or however you expose it)

# 5. Create a new tenant — confirm no DateOutOfRangeError on journal posting
POST /api/tenant/create-tenant
```
