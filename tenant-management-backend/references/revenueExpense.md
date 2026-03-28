# Revenue & Expense Scope Addendum

## Patch to: `MULTI_MODE_IMPLEMENTATION_PLAN.md`

> **For Claude Code:** Read this file alongside `MULTI_MODE_IMPLEMENTATION_PLAN.md`. This addendum supersedes any revenue/expense recording logic described there. It resolves a core accounting design gap: how to handle money that does not belong to a single building.

---

## The Problem

The base plan tags every transaction to one `ownershipEntityId` (a building's entity). This breaks for:

- **Generator fuel** shared across Buildings A, B, C → which entity pays?
- **Parking fees** collected from a lot that serves multiple buildings → which entity receives?
- **Accountant salary** paid by the company as a whole → no building should bear 100% of this

---

## The Three Transaction Scopes

Every revenue and expense entry in the system must declare one of three scopes. This is the foundational rule — everything else follows from it.

| Scope                  | `transactionScope` value | Who owns it                                 | Example                                                     |
| ---------------------- | ------------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| Building-specific      | `building`               | One building's entity                       | Rent, CAM, late fee, unit electricity, building-only repair |
| Split across buildings | `split`                  | Multiple building entities (user-defined %) | Generator fuel, shared roof repair, parking fees            |
| Head Office overhead   | `head_office`            | A special HQ entity (never a building)      | Accountant salary, office rent, company registration fee    |

---

## Change 1 — Add `head_office` to `OwnershipEntity.type`

**File to edit:** `tenant-management-backend/src/modules/ownership/OwnershipEntity.Model.js`

Change the `type` enum from:

```javascript
type: { type: String, enum: ['private', 'company'], required: true }
```

To:

```javascript
type: { type: String, enum: ['private', 'company', 'head_office'], required: true }
```

**Seed script addition** — add to `seedOwnershipEntity.js`:

After creating the private entity, also create a Head Office entity if one does not already exist:

```javascript
const existingHQ = await OwnershipEntity.findOne({ type: "head_office" });
if (!existingHQ) {
  await OwnershipEntity.create({
    name: "Head Office",
    type: "head_office",
    chartOfAccountsPrefix: "HQ",
    isActive: true,
    createdBy: systemUserId, // use the super_admin user's _id
  });
}
```

**Rules for `head_office` entity:**

- Only one `head_office` entity exists in the system at any time (enforce unique index)
- A `head_office` entity can never be assigned to a Property (`ownershipEntityId` on Property must always point to `private` or `company`)
- It has its own chart of accounts (`HQ-` prefix) and its own ledger entries
- It appears in the consolidated P&L report as a separate column/section

---

## Change 2 — Add `transactionScope` to Revenue and Expense Models

### 2a — Revenue Model

**File to edit:** `tenant-management-backend/src/modules/revenue/Revenue.Model.js`

Add these fields:

```javascript
transactionScope: {
  type: String,
  enum: ['building', 'split', 'head_office'],
  required: true,
  default: 'building',
},

// Populated when transactionScope === 'building'
entityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // required when transactionScope === 'building'
},
propertyId: {
  type: Schema.Types.ObjectId,
  ref: 'Property',
  // required when transactionScope === 'building'
},

// Populated when transactionScope === 'split'
splitAllocations: [{
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  entityId: { type: Schema.Types.ObjectId, ref: 'OwnershipEntity', required: true },
  percentage: { type: Number, required: true },   // e.g. 40 = 40%
  amountPaisa: { type: Number, required: true },  // pre-computed: totalAmountPaisa * percentage / 100
  ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry' }, // posted journal ref
}],

// Populated when transactionScope === 'head_office'
headOfficeEntityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // set automatically to the head_office entity _id
},
```

**Validation rule to enforce in the service (not schema):**

- `building`: `entityId` and `propertyId` must be present. `splitAllocations` must be empty.
- `split`: `splitAllocations` must have ≥ 2 entries. Percentages must sum to exactly 100. `entityId` must be absent.
- `head_office`: `headOfficeEntityId` must be set. `entityId` and `splitAllocations` must be absent.

### 2b — Expense Model

**File to edit:** `tenant-management-backend/src/modules/expenses/` — find the Expense model file

Add the exact same fields as Revenue above:

```javascript
(transactionScope, entityId, propertyId, splitAllocations, headOfficeEntityId);
```

The validation rules are identical.

---

## Change 3 — `revenue.service.js` — Scope-Aware Recording

**File to edit:** `tenant-management-backend/src/modules/revenue/revenue.service.js`

Replace or extend the existing `createRevenue` function with scope-aware logic:

```javascript
export const createRevenue = async (data, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionScope, totalAmountPaisa, splitAllocations, ...rest } =
      data;

    if (transactionScope === "building") {
      // --- EXISTING FLOW (unchanged) ---
      // Post one journal entry to data.entityId's ledger
      // DR: Bank/Cash Account
      // CR: Revenue Account (e.g. parking income, other income)
      // Create one Revenue document
      await postEntityJournal(
        data.entityId,
        buildRevenueJournal(data),
        session,
      );
      await Revenue.create([{ ...data, transactionScope: "building" }], {
        session,
      });
    } else if (transactionScope === "split") {
      // --- NEW: SPLIT FLOW ---
      // Validate percentages sum to 100
      const totalPct = splitAllocations.reduce(
        (sum, a) => sum + a.percentage,
        0,
      );
      if (Math.round(totalPct) !== 100)
        throw new Error("Split percentages must sum to 100");

      // Compute amountPaisa per allocation (handle rounding: add remainder to first entry)
      let allocated = 0;
      const enriched = splitAllocations.map((alloc, i) => {
        const amount =
          i === splitAllocations.length - 1
            ? totalAmountPaisa - allocated
            : Math.floor((totalAmountPaisa * alloc.percentage) / 100);
        allocated += amount;
        return { ...alloc, amountPaisa: amount };
      });

      // Post one journal entry per building, each to that building's entity ledger
      for (const alloc of enriched) {
        const entry = await postEntityJournal(
          alloc.entityId,
          buildRevenueJournal({
            ...rest,
            amountPaisa: alloc.amountPaisa,
            propertyId: alloc.propertyId,
          }),
          session,
        );
        alloc.ledgerEntryId = entry._id;
      }

      // Create one Revenue document with all allocations embedded
      await Revenue.create(
        [
          {
            ...rest,
            totalAmountPaisa,
            transactionScope: "split",
            splitAllocations: enriched,
          },
        ],
        { session },
      );
    } else if (transactionScope === "head_office") {
      // --- NEW: HEAD OFFICE FLOW ---
      const hqEntity = await OwnershipEntity.findOne({ type: "head_office" });
      if (!hqEntity) throw new Error("No Head Office entity configured");
      await postEntityJournal(hqEntity._id, buildRevenueJournal(data), session);
      await Revenue.create(
        [
          {
            ...data,
            transactionScope: "head_office",
            headOfficeEntityId: hqEntity._id,
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
```

### Expense Service — Same Pattern

**File to edit:** expense service (find it in `src/modules/expenses/`)

Apply the exact same three-branch pattern (`building` / `split` / `head_office`) to `createExpense`. The journal directions reverse:

```
// Expense journal (any scope):
DR: Expense Account (e.g. fuel, repairs, salaries)
CR: Bank/Cash Account
```

---

## Change 4 — Parking Fee Revenue — Specific Handling

Parking fees are the primary "split" revenue type in this system. When recording parking revenue:

- `revenueCategory` = `'parking'`
- `transactionScope` = `'split'` (if the parking lot serves multiple buildings) OR `'building'` (if the lot is exclusive to one building)
- The user selects which buildings benefit from the parking lot and sets the split %

**No special model needed** — parking is just a revenue entry with `revenueCategory: 'parking'` and `transactionScope: 'split'`.

Add `parking` to the revenue category enum if not already present:

```javascript
// In Revenue.Model.js — find the category/source enum and add:
revenueCategory: {
  type: String,
  enum: ['rent', 'cam', 'late_fee', 'electricity', 'parking', 'security_deposit', 'other'],
}
```

---

## Change 5 — Auto-Scope for System-Generated Entries

Rent, CAM, late fees, and electricity are always `transactionScope: 'building'` — they are always unit-specific and therefore always belong to one building's entity.

**Files to edit:** all journal builders in `src/modules/ledger/journal-builders/`

In each builder, hardcode `transactionScope: 'building'` on the Revenue/Expense document they create. These builders should never produce `split` or `head_office` entries — those are always manually recorded by a user.

| Journal Builder                 | Forced Scope |
| ------------------------------- | ------------ |
| `rentCharge.builder.js`         | `building`   |
| `paymentReceived.builder.js`    | `building`   |
| `camCharge.builder.js`          | `building`   |
| `camPaymentReceived.builder.js` | `building`   |
| `lateFee.builder.js`            | `building`   |
| `electricity.builder.js`        | `building`   |

---

## Change 6 — Accounting Reports: Scope-Aware Queries

**File to edit:** `tenant-management-backend/src/modules/accounting/accounting.controller.js` (and its service)

### Per-building report (`GET /api/accounting?entityId=X`)

Query must include entries from ALL three scopes that touch this entity:

```javascript
// Building's own entries
const buildingRevenue = await Revenue.find({
  entityId: req.query.entityId,
  transactionScope: "building",
});

// This building's share of split entries
const splitRevenue = await Revenue.find({
  transactionScope: "split",
  "splitAllocations.entityId": req.query.entityId,
});
// From splitRevenue, only use the allocation amount for this entity:
// alloc.amountPaisa where alloc.entityId === req.query.entityId

// Head office entries are EXCLUDED from per-building reports
// (HQ costs are only visible in the consolidated report)
```

Combine both sets for the building's P&L. The split allocation `amountPaisa` (not the total) is what shows in this building's report.

### Consolidated report (`GET /api/accounting/consolidated`) — Merged/Company mode only

Return four sections side by side:

```javascript
// Structure:
{
  buildings: [
    {
      entityId, entityName, entityType,
      revenue: { total, breakdown: { rent, cam, parking, lateFee, ... } },
      expenses: { total, breakdown: { ... } },
      netIncome,
      includesSplitShare: true  // flag that split allocations are included
    },
    // ... one per building entity
  ],
  headOffice: {
    entityName: 'Head Office',
    revenue: { total, breakdown: {} },
    expenses: { total, breakdown: { salaries, officeRent, ... } },
    netIncome,
  },
  consolidated: {
    totalRevenue,
    totalExpenses,
    netIncome,
    // Note: split amounts are NOT double-counted — they appear once across all buildings
  }
}
```

**Anti-double-counting rule for split entries:**

- In per-building reports: include only that building's `splitAllocations.amountPaisa`
- In consolidated total: sum all `splitAllocations.amountPaisa` across all buildings (equals the original `totalAmountPaisa` — no double count)
- Never include `Revenue.totalAmountPaisa` directly in any per-entity sum when `transactionScope === 'split'`

---

## Change 7 — Frontend: Revenue/Expense Recording Forms

### 7a — Scope Selector Widget

**Add to both the Add Revenue and Add Expense forms:**

```
Scope: [● This Building]  [○ Split Across Buildings]  [○ Head Office]
```

- Default: "This Building" (maps to `transactionScope: 'building'`)
- Only show "Head Office" option when `SystemConfig.systemMode !== 'private'`

### 7b — Building Selector (scope = `building`)

When "This Building" is selected:

- Show a dropdown: select which building/property this revenue or expense belongs to
- Pre-fill with the currently active building if the user is scoped to one
- This sets `propertyId` and `entityId` in the payload

### 7c — Split Allocation Widget (scope = `split`)

**Component to create:** `src/components/SplitAllocationWidget.jsx`

When "Split Across Buildings" is selected, render:

```
┌─────────────────────────────────────────────────┐
│  Building A          [40]%   Rs. 2,000          │
│  Building B          [35]%   Rs. 1,750          │
│  Building C          [25]%   Rs. 1,250          │
│                      ────                        │
│  Total:              100%    Rs. 5,000  ✓        │
└─────────────────────────────────────────────────┘
```

Widget behavior:

- Lists all active buildings (fetched from `/api/property/get-property`)
- Each row has a percentage input (number, 0–100)
- `amountPaisa` per row = `totalAmountPaisa * pct / 100` — computed live, display only
- Running total shown at bottom — must equal 100% before form can submit
- If total ≠ 100%: show red warning "Percentages must add up to 100%", disable submit button
- "Even split" button: divides 100% equally across all selected buildings

Props:

```javascript
// <SplitAllocationWidget
//   buildings={[]}          // array of { _id, name, ownershipEntityId }
//   totalAmountPaisa={0}    // from the main form amount field
//   onChange={(allocations) => {}}  // called with array of { propertyId, entityId, percentage, amountPaisa }
// />
```

### 7d — Head Office Option (scope = `head_office`)

When "Head Office" is selected:

- Hide building selector entirely
- Show a simple note: "This expense will be recorded under Head Office overhead"
- Send `transactionScope: 'head_office'` in the payload — backend resolves HQ entity automatically

### 7e — Accounting Page Entity Filter

**File to edit:** `src/Accounts/AccountingPage.jsx` (find actual filename)

Add a filter row at the top:

```
View: [All (Consolidated)]  [Building A]  [Building B]  [Building C]  [Building D]  [Head Office]
```

- "All" calls `GET /api/accounting/consolidated`
- A specific building calls `GET /api/accounting?entityId=X&propertyId=Y`
- "Head Office" calls `GET /api/accounting?entityId=<hqEntityId>`
- Only show this filter when `systemMode !== 'private'`

---

## Change 8 — New API Endpoints for This Addendum

Add to the routes registered in `app.js`:

```
GET  /api/revenue?scope=split               → returns all split revenue entries
GET  /api/revenue?scope=head_office         → returns HQ revenue entries
GET  /api/expenses?scope=split              → returns all split expense entries
GET  /api/expenses?scope=head_office        → returns HQ expense entries
GET  /api/accounting/consolidated           → full cross-entity P&L (already in base plan, now includes HQ section)
GET  /api/ownership/head-office             → returns the HQ entity details (for UI display)
```

---

## New Files Summary (This Addendum Only)

```
Frontend:
  src/components/SplitAllocationWidget.jsx   ← new component
```

No new backend files — all changes are to existing models, services, and controllers.

---

## Modified Files Summary (This Addendum Only)

```
Backend:
  src/modules/ownership/OwnershipEntity.Model.js    — add 'head_office' to type enum
  src/modules/revenue/Revenue.Model.js              — add transactionScope, splitAllocations, headOfficeEntityId
  src/modules/expenses/[Expense model]              — same fields as Revenue
  src/modules/revenue/revenue.service.js            — three-branch scope logic
  src/modules/expenses/[expense service]            — three-branch scope logic (mirrored)
  src/modules/accounting/accounting.controller.js   — scope-aware queries, HQ section in consolidated
  src/modules/ledger/journal-builders/*.js          — hardcode transactionScope: 'building'
  src/seeds/seedOwnershipEntity.js                 — also seed the HQ entity

Frontend:
  src/[Revenue form component]                      — add scope selector, split widget, building dropdown
  src/[Expense form component]                      — same
  src/Accounts/[AccountingPage]                     — entity filter, HQ section in consolidated view
```

---

## Key Rules — Repeat for Emphasis

1. **`transactionScope` is required on every Revenue and Expense document.** System-generated entries (rent, CAM, late fee, electricity) always get `'building'`. Manual entries default to `'building'` but can be changed.

2. **Never sum `Revenue.totalAmountPaisa` for split entries in a per-entity report.** Always use `splitAllocations[i].amountPaisa` where `splitAllocations[i].entityId` matches the entity being reported on.

3. **The Head Office entity has no buildings.** It never appears in `Property.ownershipEntityId`. It only appears in Revenue/Expense records and the consolidated report.

4. **Split percentages must sum to exactly 100 at write time.** Validate in the service, not just the frontend. Throw a 400 error if they don't.

5. **Rounding on split amounts:** Always use `Math.floor` for all allocations except the last one, which gets the remainder (`totalAmountPaisa - sum of all others`). This ensures no paisa is lost or created.

6. **In private mode** (single entity, no company): The scope selector UI is hidden. All entries are `transactionScope: 'building'` silently. The `split` and `head_office` scopes only become available in UI when `systemMode` is `'company'` or `'merged'`.
