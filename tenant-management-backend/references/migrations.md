# Multi-Mode Architecture Implementation Plan

## Private → Company → Merged Migration System

> **For Claude Code:** This document is the complete implementation plan for adding multi-entity/multi-mode support to the Tenant Management System. Follow phases in order. Each phase is independently deployable and backward-compatible. Do NOT skip the seed script in Phase 1 — it is what keeps the existing system working during the transition.

---

## Context & Goal

The system currently runs in implicit "Private" mode (single owner, 4 buildings). The goal is to introduce three explicit operating modes:

| Mode      | Description                                                 |
| --------- | ----------------------------------------------------------- |
| `private` | Current state — single individual owns all buildings        |
| `company` | All buildings under a registered company entity             |
| `merged`  | Per-building entity assignment (some private, some company) |

The owner needs to be able to migrate individual buildings (not all at once) from private to company, controlled by a Super Admin settings UI.

**Key constraint:** Zero regression to existing functionality. The system must work identically to today after Phase 1 is deployed.

---

## Existing Stack (Do Not Change)

- **Backend:** Node.js + Express v5, MongoDB + Mongoose, ES Modules (`import/export`)
- **Frontend:** React 18 + Vite, React Router DOM v7, shadcn/ui, Tailwind CSS v4, Axios, Socket.io
- **Auth:** JWT, roles: `admin`, `super_admin`, `staff`
- **Monetary values:** Always stored in **paisa** (integer). Never use floats.
- **Dates:** Nepali calendar used throughout. Use existing date helpers.
- **Ledger:** Double-entry via `ledger.service.js` and `journal-builders/`
- **Crons:** `master-cron.js` runs daily at 00:00 NPT

---

## Phase 1 — Foundation Layer (Start Here)

**Goal:** Add the entity layer invisibly. System behavior unchanged after this phase.

### 1.1 — Create `OwnershipEntity` Model

**File to create:** `tenant-management-backend/src/modules/ownership/OwnershipEntity.Model.js`

```javascript
// Schema fields:
{
  name: { type: String, required: true },           // "Ram Prasad Sharma" or "ABC Properties Pvt. Ltd."
  type: { type: String, enum: ['private', 'company'], required: true },
  pan: { type: String },                             // Individual or company PAN
  vatNumber: { type: String },                       // Company only
  registrationNo: { type: String },                  // Company registration number
  address: {
    street: String,
    city: String,
    district: String,
    province: String,
  },
  contactEmail: { type: String },
  logoUrl: { type: String },                         // Cloudinary URL for letterhead
  chartOfAccountsPrefix: { type: String, default: 'PVT' }, // 'PVT' or 'CO'
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  migratedAt: { type: Date },
},
{ timestamps: true }
```

### 1.2 — Update `Property` Model

**File to edit:** `tenant-management-backend/src/modules/property/property.Model.js` (find the actual filename)

Add these fields to the existing schema:

```javascript
ownershipEntityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // NOT required — will be populated by seed script
},
migrationHistory: [{
  fromEntityId: { type: Schema.Types.ObjectId, ref: 'OwnershipEntity' },
  toEntityId: { type: Schema.Types.ObjectId, ref: 'OwnershipEntity' },
  migratedAt: { type: Date },
  migratedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}]
```

### 1.3 — Update `SystemConfig` Model

**File to edit:** Find the SystemConfig model (likely `src/modules/config/` or similar)

Add these fields:

```javascript
systemMode: {
  type: String,
  enum: ['private', 'company', 'merged'],
  default: 'private'
},
defaultEntityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity'
},
allowPartialPayments: { type: Boolean, default: true },
partialPaymentThresholdPct: { type: Number, default: 0 }, // 0 = no minimum
```

### 1.4 — Update `LedgerEntry` Model

**File to edit:** `tenant-management-backend/src/modules/ledger/Ledger.Model.js`

Add:

```javascript
entityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // optional — null means legacy private entry (backward compatible)
}
```

### 1.5 — Update `Account` Model (Chart of Accounts)

**File to edit:** `tenant-management-backend/src/modules/ledger/accounts/Account.Model.js`

Add:

```javascript
entityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // optional — null means belongs to default private entity
}
```

### 1.6 — Seed Script (CRITICAL — Run Before Anything Else)

**File to create:** `tenant-management-backend/src/seeds/seedOwnershipEntity.js`

This script must:

1. Create one `OwnershipEntity` with `type: 'private'`, `chartOfAccountsPrefix: 'PVT'`
2. Find all existing `Property` documents where `ownershipEntityId` is null/undefined
3. Set `ownershipEntityId` to the new entity's `_id` on all of them
4. Find the existing `SystemConfig` and set `defaultEntityId` to the new entity's `_id`
5. Set `systemMode: 'private'` on SystemConfig
6. Be idempotent — safe to run multiple times

```bash
# Run with:
node src/seeds/seedOwnershipEntity.js
```

### 1.7 — `ownership.service.js`

**File to create:** `tenant-management-backend/src/modules/ownership/ownership.service.js`

Functions to implement:

```javascript
// Get entity for a given propertyId (used by middleware)
export const getEntityForProperty = async (propertyId) => { ... }

// CRUD
export const createEntity = async (data, createdBy) => { ... }
export const getAllEntities = async () => { ... }
export const updateEntity = async (id, data) => { ... }
export const getEntityById = async (id) => { ... }
```

### 1.8 — `ownership.controller.js` + Routes

**File to create:** `tenant-management-backend/src/modules/ownership/ownership.controller.js`
**File to create:** `tenant-management-backend/src/modules/ownership/ownership.route.js`

Routes (all require `super_admin` role):

```
GET    /api/ownership          → getAllEntities
POST   /api/ownership          → createEntity
GET    /api/ownership/:id      → getEntityById
PATCH  /api/ownership/:id      → updateEntity
```

Register in `app.js`:

```javascript
import ownershipRoutes from "./modules/ownership/ownership.route.js";
app.use("/api/ownership", protect, authorize("super_admin"), ownershipRoutes);
```

### Phase 1 Verification Checklist

- [ ] Seed script runs without errors
- [ ] All existing properties have `ownershipEntityId` set
- [ ] SystemConfig has `systemMode: 'private'` and `defaultEntityId`
- [ ] All existing API endpoints work exactly as before
- [ ] `GET /api/ownership` returns the seeded private entity

---

## Phase 2 — Entity-Aware Backend

**Goal:** All new transactions are tagged with entityId. Existing data is untouched.

### 2.1 — `resolveEntity` Middleware

**File to create:** `tenant-management-backend/src/middleware/resolveEntity.js`

```javascript
// Logic:
// 1. Extract propertyId from req.query.propertyId OR req.body.propertyId OR req.params.propertyId
// 2. If no propertyId found → use SystemConfig.defaultEntityId → attach to req.entity
// 3. If propertyId found → call getEntityForProperty(propertyId) → attach to req.entity
// 4. req.entity = { _id, type, chartOfAccountsPrefix, ... }
// 5. Cache entity lookups in-memory (Map) with 5-minute TTL to avoid repeated DB hits

export const resolveEntity = async (req, res, next) => { ... }
```

Apply this middleware to these route files (after `protect`):

- `tenant.route.js`
- `rents/rent.route.js`
- `payment/payment.route.js`
- `accounting/accounting.route.js`
- `ledger/ledger.route.js`
- `revenue/revenue.route.js`
- `banks/bank.route.js`

### 2.2 — Update `ledger.service.js`

**File to edit:** `tenant-management-backend/src/modules/ledger/ledger.service.js`

Update `postJournalEntry` to accept and store `entityId`:

```javascript
// Change signature from:
export const postJournalEntry = async (entries, session) => { ... }
// To:
export const postJournalEntry = async (entries, session, entityId = null) => {
  // Add entityId to each LedgerEntry document being created
}
```

### 2.3 — Update All Journal Builders

**Files to edit** (all in `src/modules/ledger/journal-builders/`):

- `rentCharge.builder.js`
- `paymentReceived.builder.js`
- `camCharge.builder.js`
- `camPaymentReceived.builder.js`
- `lateFee.builder.js`
- `electricity.builder.js`
- `expense.builder.js`
- All others found in this directory

For each builder, add `entityId` as an optional last parameter and pass it through to `postJournalEntry`.

### 2.4 — Update `rent.payment.service.js`

**File to edit:** `tenant-management-backend/src/modules/rents/rent.payment.service.js`

- Accept `entityId` parameter
- Pass to all journal builder calls
- If `entityId` is not provided, use `SystemConfig.defaultEntityId` as fallback

### 2.5 — Update `master-cron.js`

**File to edit:** `tenant-management-backend/src/cron/service/master-cron.js`

Change the processing loop to be entity-aware:

```javascript
// Instead of processing all properties at once:
// 1. Fetch all active OwnershipEntity documents
// 2. For each entity, fetch its properties (Property.find({ ownershipEntityId: entity._id }))
// 3. Pass entityId to rent generation, CAM, late fee steps
// 4. Log entity name in CronLog for debugging
```

### 2.6 — Update `lateFee.cron.js`

**File to edit:** `tenant-management-backend/src/cron/service/lateFee.cron.js`

Same entity-loop pattern as master-cron. Each late fee journal post must include `entityId`.

### 2.7 — Update `SystemConfig` Controller/Route

Add endpoint:

```
PATCH /api/config/system-mode
Body: { systemMode: 'private' | 'company' | 'merged' }
Requires: super_admin role
Action: Update SystemConfig.systemMode, clear entity resolution cache
```

### Phase 2 Verification Checklist

- [ ] New rent payments have `entityId` on their LedgerEntries
- [ ] Cron runs without errors, logs show entity name
- [ ] Old LedgerEntries (entityId: null) still appear in accounting reports
- [ ] `PATCH /api/config/system-mode` changes the mode correctly

---

## Phase 3 — Complete Partial Payments

**Goal:** Full accounting-compliant partial payment support.

### 3.1 — Update `Payment` Model

**File to edit:** `tenant-management-backend/src/modules/payment/payment.model.js`

Add fields:

```javascript
paymentType: {
  type: String,
  enum: ['full', 'partial', 'advance'],
  default: 'full'
},
partialPaymentSequence: { type: Number, default: 1 }, // 1st, 2nd, 3rd installment
linkedPaymentIds: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],
// On the allocations.rent sub-object, add:
// allocations.rent.outstandingPaisa: Number (remaining after this payment)
// allocations.rent.partialFlag: Boolean
```

### 3.2 — Update `Rent` Model

**File to edit:** `tenant-management-backend/src/modules/rents/rent.Model.js`

Add/verify these fields exist:

```javascript
paidAmountPaisa: { type: Number, default: 0 },      // Already exists — verify
partialPayments: [{ type: Schema.Types.ObjectId, ref: 'Payment' }], // Track all partial payments
outstandingPaisa: { type: Number },                 // Computed: totalDuePaisa - paidAmountPaisa
```

Add a virtual:

```javascript
rentSchema.virtual("outstandingPaisa").get(function () {
  return (this.totalDuePaisa || 0) - (this.paidAmountPaisa || 0);
});
```

### 3.3 — Update `rent.payment.service.js` for Partial Logic

**File to edit:** `tenant-management-backend/src/modules/rents/rent.payment.service.js`

When `paymentType === 'partial'`:

1. Validate paid amount > 0 and ≤ outstanding amount
2. Update `Rent.paidAmountPaisa += paidAmountPaisa`
3. If `paidAmountPaisa >= totalDuePaisa` → status = `paid`; else status = `partial`
4. Post journal: Debit `Bank Account`, Credit `Accounts Receivable` (amount paid only)
5. The `Accounts Receivable` account maintains the running outstanding balance
6. Add payment to `Rent.partialPayments[]`
7. Set `Payment.partialPaymentSequence` = count of existing partial payments + 1

**Accounts Receivable journal pattern:**

```
On rent charge (month start):
  DR  Accounts Receivable    [full rent amount]
  CR  Rental Income          [full rent amount]

On each partial payment:
  DR  Bank Account           [amount paid]
  CR  Accounts Receivable    [amount paid]

// A/R balance always = total outstanding across all tenants
```

### 3.4 — Update `rent.payment.service.js` — Minimum Threshold

Check `SystemConfig.allowPartialPayments` and `partialPaymentThresholdPct` before processing:

```javascript
if (paymentType === "partial") {
  const config = await SystemConfig.findOne();
  if (!config.allowPartialPayments)
    throw new Error("Partial payments are disabled");
  const minAmount = Math.floor(
    rent.totalDuePaisa * (config.partialPaymentThresholdPct / 100),
  );
  if (paidAmountPaisa < minAmount)
    throw new Error(`Minimum payment is ${minAmount} paisa`);
}
```

### 3.5 — Frontend: Update `PaymentDialog`

**File to edit:** `tenant-management-frontend/tenant/src/RentPaymentDashboard/PaymentDialog.jsx` (find actual path)

Changes:

- Add a `paymentType` toggle: "Full Payment" (default) / "Partial Payment"
- When partial: show "Amount to Pay" input field (pre-filled with outstanding, editable)
- Show outstanding balance display: "Outstanding: Rs. X,XXX"
- Show installment history if `Rent.partialPayments.length > 0`
- Send `paymentType` and actual `amountPaisa` in request body

### 3.6 — Frontend: Payment History Display

Update payment history tables to show:

- "Partial (1/3)" style labels using `partialPaymentSequence`
- Outstanding amount column
- Link between related partial payments

### Phase 3 Verification Checklist

- [ ] Can record a partial payment; rent status becomes `partial`
- [ ] Second partial payment adds to first; status becomes `paid` when fully settled
- [ ] LedgerEntries show correct A/R balance
- [ ] Partial payments disabled toggle in SystemConfig works
- [ ] Payment history shows partial installment labels

---

## Phase 4 — Migration Service

**Goal:** Allow Super Admin to migrate a specific building from private to company entity.

### 4.1 — `MigrationSnapshot` Model

**File to create:** `tenant-management-backend/src/modules/migration/MigrationSnapshot.Model.js`

```javascript
{
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  fromEntityId: { type: Schema.Types.ObjectId, ref: 'OwnershipEntity' },
  toEntityId: { type: Schema.Types.ObjectId, ref: 'OwnershipEntity' },
  status: { type: String, enum: ['pending', 'completed', 'rolled_back'], default: 'pending' },
  snapshotData: { type: Object }, // Pre-migration state: { property, tenantCount, rentCount }
  migratedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  rollbackEligibleUntil: { type: Date }, // completedAt + 48 hours
  rollbackedAt: { type: Date },
  rollbackedBy: { type: Schema.Types.ObjectId, ref: 'User' },
},
{ timestamps: true }
// Add TTL index: MigrationSnapshotSchema.index({ rollbackEligibleUntil: 1 }, { expireAfterSeconds: 0 })
```

### 4.2 — `migration.service.js`

**File to create:** `tenant-management-backend/src/modules/migration/migration.service.js`

Implement these functions:

```javascript
// Step 1: Validate migration is safe to proceed
export const preflightCheck = async (propertyId) => {
  // Check: no rents with status 'partial' for current nepali month
  // Check: no payments with status 'pending' (cheques in transit)
  // Check: no open maintenance requests marked 'critical' (optional)
  // Return: { canMigrate: boolean, issues: string[] }
};

// Step 2: Take snapshot (not a full data copy — just metadata for audit/rollback)
export const takeSnapshot = async (
  propertyId,
  fromEntityId,
  toEntityId,
  userId,
) => {
  // Count tenants, rents, payments for this property
  // Create MigrationSnapshot document
  // Return snapshot _id
};

// Step 3: Atomic property re-point (the actual migration)
export const executeSwitch = async (
  propertyId,
  toEntityId,
  snapshotId,
  userId,
  session,
) => {
  // In MongoDB session/transaction:
  // 1. Property.findByIdAndUpdate(propertyId, { ownershipEntityId: toEntityId })
  // 2. Push to Property.migrationHistory
  // 3. MigrationSnapshot.findByIdAndUpdate(snapshotId, { status: 'completed', completedAt: now, rollbackEligibleUntil: now+48h })
  // 4. Clear entity resolution cache for this propertyId
};

// Step 4: Background ledger backfill (async — do NOT await in the migration flow)
export const backfillLedgerTags = async (propertyId, toEntityId) => {
  // Find all tenants for this property
  // Find all LedgerEntries linked to those tenants
  // Update entityId in batches of 100 (use bulkWrite)
  // Log progress to CronLog
};

// Step 5: Rollback
export const rollbackMigration = async (snapshotId, userId) => {
  // Verify snapshot.rollbackEligibleUntil > now
  // Re-point Property.ownershipEntityId back to fromEntityId
  // Update snapshot status to 'rolled_back'
  // Clear entity resolution cache
  // Note: Post-migration payments are NOT reversed — they stay under new entity
};
```

### 4.3 — `migration.controller.js` + Routes

**File to create:** `tenant-management-backend/src/modules/migration/migration.controller.js`
**File to create:** `tenant-management-backend/src/modules/migration/migration.route.js`

```
POST /api/migration/preflight/:propertyId  → preflightCheck
POST /api/migration/start                  → body: { propertyId, targetEntityId }  → executeSwitch
POST /api/migration/rollback/:snapshotId   → rollbackMigration
GET  /api/migration/status/:propertyId     → current entity, migration history, rollback eligibility
GET  /api/migration/audit-log              → all migration events (super_admin only)
```

Register in `app.js`:

```javascript
import migrationRoutes from "./modules/migration/migration.route.js";
app.use("/api/migration", protect, authorize("super_admin"), migrationRoutes);
```

### Phase 4 Verification Checklist

- [ ] Preflight check returns issues when unpaid rents exist
- [ ] Migration switches `ownershipEntityId` on the property atomically
- [ ] New transactions after migration use the new entity's ledger
- [ ] Rollback re-points property back; existing data intact
- [ ] Rollback blocked after 48-hour window

---

## Phase 5 — Super Admin Frontend UI

**Goal:** Super Admin can manage entities, assign buildings, and trigger migrations from Settings.

### 5.1 — `EntityContext`

**File to create:** `tenant-management-frontend/tenant/src/context/EntityContext.jsx`

```javascript
// State:
// - systemMode: 'private' | 'company' | 'merged'
// - entities: OwnershipEntity[]
// - defaultEntityId: string
//
// Actions:
// - refreshEntities()
// - setSystemMode(mode)  → calls PATCH /api/config/system-mode
//
// Fetches from GET /api/ownership on mount (only if user.role === 'super_admin')
// Provide via <EntityContext.Provider> wrapping the app in App.jsx
```

### 5.2 — Super Admin Settings — New Tabs

**File to edit:** `tenant-management-frontend/tenant/src/Settings/Admin.jsx`

Add these tabs (visible only to `super_admin` role):

#### Tab 1: "Entities"

- List all OwnershipEntity records with type badge (Private / Company)
- "Add Entity" button → modal with fields: name, type, PAN, VAT, registrationNo, contactEmail, logo upload
- Edit and toggle active/inactive per entity

#### Tab 2: "Building Assignment"

- Table of all 4 buildings
- Each row shows: Building name, Current Entity (dropdown to change), Entity type badge, Last migrated date
- Changing entity here triggers the Migration Wizard (see Tab 3)

#### Tab 3: "Migration"

**Component to create:** `tenant-management-frontend/tenant/src/Settings/components/MigrationWizard.jsx`

Step-by-step wizard:

```
Step 1: Select building to migrate
Step 2: Select target entity (must be different from current)
Step 3: Run preflight check → show results
  - If issues: show list, block "Proceed" button
  - If clear: show green checkmark, enable "Proceed"
Step 4: Confirmation screen
  - "You are migrating [Building Name] from [Private Entity] to [Company Entity]"
  - "This will affect all future transactions for this building"
  - "You have 48 hours to rollback"
  - Confirm button with typing confirmation (type building name)
Step 5: Progress indicator while migration runs
Step 6: Success screen with rollback button (visible for 48h)
```

#### Tab 4: "System Mode"

- Current mode display with description
- Mode selector: Private / Company / Merged
- Warning modal before changing
- Only enabled if at least one company entity exists

#### Tab 5: "Migration Audit Log"

- Table: Building | From Entity | To Entity | Date | By | Status | Rollback action
- Filter by building, date range

### 5.3 — Mode-Aware UI Components

**File to create:** `tenant-management-frontend/tenant/src/components/EntityBadge.jsx`

```javascript
// Props: { entityType: 'private' | 'company', size?: 'sm' | 'md' }
// Renders: Green badge for 'private', Blue badge for 'company'
// Only visible to super_admin users
```

Add `EntityBadge` to:

- Building/property selector dropdowns
- Dashboard building cards
- Settings building list

### Phase 5 Verification Checklist

- [ ] Super Admin can create a Company entity
- [ ] Migration Wizard runs preflight and shows issues
- [ ] Successful migration shows rollback button for 48h
- [ ] Rollback button disappears after 48h
- [ ] EntityBadge shows on relevant components
- [ ] System mode change reflected in EntityContext

---

## Phase 6 — Company Mode Features

**Goal:** Full company-mode accounting features once a building is migrated.

### 6.1 — Expanded Roles (Backend)

**File to edit:** `tenant-management-backend/src/middleware/authorize.js`

Add new roles: `accountant`, `manager`

Role permissions matrix:

```javascript
const permissions = {
  super_admin: ["*"], // Everything
  admin: [
    "tenant:*",
    "rent:*",
    "payment:*",
    "accounting:*",
    "maintenance:*",
    "staff:read",
  ],
  accountant: [
    "accounting:*",
    "payment:*",
    "ledger:*",
    "revenue:*",
    "rent:read",
  ], // company mode only
  manager: ["tenant:*", "rent:read", "payment:read", "maintenance:*"], // company mode only
  staff: ["tenant:read", "payment:read", "maintenance:read", "rent:read"],
};
// accountant and manager roles only activate when SystemConfig.systemMode !== 'private'
```

**File to edit:** `tenant-management-backend/src/modules/auth/` — Update User model to accept new role values.

### 6.2 — Consolidated Accounting Endpoint

**File to edit:** `tenant-management-backend/src/modules/accounting/accounting.controller.js`

Add endpoint: `GET /api/accounting/consolidated`

- Only accessible in `merged` or `company` mode
- Returns: revenue, expenses, P&L for each entity side by side
- Also returns combined totals
- Query params: `nepaliYear`, `nepaliMonth` (optional — defaults to current)

### 6.3 — Entity-Filtered Accounting

**File to edit:** existing accounting endpoints

All accounting endpoints should accept optional `?entityId=` query param:

- If provided: filter LedgerEntries by `entityId`
- If not provided: use `req.entity` from resolveEntity middleware (default behavior)
- In merged mode without entityId: return all entities combined

### 6.4 — Company Invoice Template

**File to edit/create:** PDF generation for receipts (find the PDFKit usage in the codebase)

When building is in company mode (`req.entity.type === 'company'`):

- Add company logo (from `entity.logoUrl`) to receipt header
- Replace individual name with company name
- Add VAT number if present
- Add company registration number
- Change "Receipt" to "Tax Invoice" if VAT-registered

### Phase 6 Verification Checklist

- [ ] Accountant role can access accounting but not tenant edit
- [ ] Manager role can manage tenants but not accounting
- [ ] Consolidated endpoint returns per-entity breakdown
- [ ] Company invoices show logo and VAT number
- [ ] Accounting page entity filter works

---

## File Creation Summary

### New Backend Files

```
src/modules/ownership/
  OwnershipEntity.Model.js
  ownership.service.js
  ownership.controller.js
  ownership.route.js

src/modules/migration/
  MigrationSnapshot.Model.js
  migration.service.js
  migration.controller.js
  migration.route.js

src/middleware/
  resolveEntity.js          (new)

src/seeds/
  seedOwnershipEntity.js    (new)
```

### Modified Backend Files

```
src/modules/property/[property model file]     — add ownershipEntityId, migrationHistory
src/modules/ledger/Ledger.Model.js             — add entityId
src/modules/ledger/accounts/Account.Model.js   — add entityId
src/modules/ledger/ledger.service.js           — accept entityId in postJournalEntry
src/modules/ledger/journal-builders/*.js       — pass entityId through
src/modules/rents/rent.Model.js                — add partialPayments, verify paidAmountPaisa
src/modules/rents/rent.payment.service.js      — entity context + partial payment logic
src/modules/payment/payment.model.js           — add paymentType, sequence, linkedPaymentIds
src/modules/auth/User.Model.js                 — add accountant, manager to role enum
src/middleware/authorize.js                    — add new role permissions
src/cron/service/master-cron.js               — entity-loop pattern
src/cron/service/lateFee.cron.js              — entity context
src/app.js                                    — register new routes
[SystemConfig model]                           — add systemMode, defaultEntityId, partial payment settings
[accounting controller]                        — entity filter + consolidated endpoint
```

### New Frontend Files

```
src/context/EntityContext.jsx
src/components/EntityBadge.jsx
src/Settings/components/MigrationWizard.jsx
src/Settings/components/EntityManagementTab.jsx
src/Settings/components/BuildingAssignmentTab.jsx
src/Settings/components/MigrationAuditLog.jsx
src/Settings/components/SystemModeTab.jsx
```

### Modified Frontend Files

```
src/App.jsx                          — wrap with EntityContext.Provider
src/Settings/Admin.jsx               — add new super_admin tabs
src/RentPaymentDashboard/PaymentDialog.jsx  — partial payment toggle + amount input
src/context/AuthContext.jsx          — expose role for conditional rendering
```

---

## Important Notes for Claude Code

1. **Always use ES Module syntax** (`import`/`export`) — the backend uses `"type": "module"` in package.json

2. **Monetary values in paisa** — never use rupees directly in DB operations. `1 rupee = 100 paisa`

3. **MongoDB sessions for atomic operations** — the migration `executeSwitch` and any operation that touches both Property and LedgerEntry must use a Mongoose session

4. **Do not break existing API contracts** — all existing endpoints must work unchanged. New behavior is additive only

5. **Nepali date handling** — use existing date utilities already in the codebase for any new date operations

6. **The `resolveEntity` middleware is additive** — if `propertyId` is missing from a request, silently fall back to `defaultEntityId`. Never throw an error for missing entity context

7. **Phase 1 must be deployed and seed script run before any other phase**

8. **Test the seed script on a copy of the database first** before running on production

9. **The `chartOfAccountsPrefix` on OwnershipEntity is cosmetic** in Phase 1 — it becomes functional in Phase 2 when new accounts are provisioned for company entities

10. **Socket.io notifications** — when a migration completes or is rolled back, emit a `migration:complete` or `migration:rolledback` event to the super_admin's socket room
