# EasyManage — Multi-Entity Migration Architecture Guide

> Complete implementation reference for the Private → Company → Merged ownership system.
> Covers backend changes, frontend architecture, product design decisions, and the
> cross-entity outstanding balance pattern agreed upon in design review.

---

## Core Design Decisions (Read This First)

### Decision 1 — Merged is the default view

The accounting page always shows all entities combined. Entity filtering is a
drill-down for tax/reporting purposes, not a day-to-day toggle. The owner thinks
in buildings, not legal entities.

### Decision 2 — Migration never requires balanced books

Blocking migration on outstanding balances makes the feature unusable in practice.
Instead, outstanding balances stay in the originating entity's books until paid.
The preflight check **warns** about outstanding balances but does not block.

### Decision 3 — Money follows the charge, not the migration date

A payment always belongs to the entity that generated the original charge.
If a tenant owes Rs. 8,000 from before migration (private entity) and pays
after migration, that payment closes the private-entity receivable. New charges
after migration date go to the company entity.

### Decision 4 — Oldest debt first allocation rule

When a tenant has outstanding balances across multiple entities, payments are
allocated oldest-debt-first regardless of which entity owns the charge.
`TenantBalance` handles this naturally since it is tenant-scoped, not entity-scoped.

### Decision 5 — No historical data backfill

`backfillLedgerTags` from the original migration plan should be **skipped**.
Historical LedgerEntries with `entityId: null` are implicitly private-entity.
The merged view includes them. This eliminates migration risk with zero
accounting impact since the owner sees merged by default anyway.

---

## Architecture Overview

```
SystemConfig.systemMode  ('private' | 'company' | 'merged')
        ↓ fetched once on app load
   EntityContext
     ├── systemMode
     ├── entities[]
     ├── defaultEntityId
     └── activeEntityId       ← null means "show all" (merged default)
             ↓
      useEntityMode() hook     ← consumed by all components
             ↓
   AccountingPage / LedgerPage
     → ?entityId=xxx           ← appended when activeEntityId is set
     → /api/accounting/consolidated  ← used when isMergedView is true
```

---

## Backend Changes

### 1. `OwnershipEntity.Model.js` — CREATE

**Path:** `src/modules/ownership/OwnershipEntity.Model.js`

New model. No changes to existing files.

```javascript
{
  name: String,                    // "Ram Prasad Sharma" or "ABC Properties Pvt. Ltd."
  type: { enum: ['private', 'company'] },
  pan: String,
  vatNumber: String,               // company only
  registrationNo: String,          // company only
  address: { street, city, district, province },
  contactEmail: String,
  logoUrl: String,                 // Cloudinary URL — used on company invoices
  chartOfAccountsPrefix: String,   // 'PVT' or 'CO' — cosmetic in Phase 1
  isActive: { default: true },
  createdBy: ObjectId → User,
  migratedAt: Date,
}
```

---

### 2. `property.Model.js` — EDIT

**Path:** `src/modules/property/property.Model.js`

Add two fields only. Do not change anything else.

```javascript
ownershipEntityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // NOT required — seed script fills this for existing properties
},
migrationHistory: [{
  fromEntityId: ObjectId → OwnershipEntity,
  toEntityId:   ObjectId → OwnershipEntity,
  migratedAt:   Date,
  migratedBy:   ObjectId → User,
  notes:        String,
}]
```

---

### 3. `SystemConfig` model — EDIT

**Path:** Find in `src/modules/config/` or wherever SystemConfig lives.

Add these fields:

```javascript
systemMode: {
  type: String,
  enum: ['private', 'company', 'merged'],
  default: 'private'
},
defaultEntityId: { type: ObjectId, ref: 'OwnershipEntity' },
allowPartialPayments: { type: Boolean, default: true },
partialPaymentThresholdPct: { type: Number, default: 0 },
```

---

### 4. `Ledger.Model.js` — EDIT

**Path:** `src/modules/ledger/Ledger.Model.js`

Add one optional field:

```javascript
entityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // null = legacy private entry — backward compatible
}
```

**Do not make this required.** All existing ledger entries will have `entityId: null`
and will be treated as private-entity entries in reporting queries.

---

### 5. `Account.Model.js` — EDIT

**Path:** `src/modules/ledger/accounts/Account.Model.js`

Add one optional field:

```javascript
entityId: {
  type: Schema.Types.ObjectId,
  ref: 'OwnershipEntity',
  // null = belongs to default private entity
}
```

---

### 6. `ledger.service.js` — EDIT

**Path:** `src/modules/ledger/ledger.service.js`

Change `postJournalEntry` signature only. Logic stays the same, just stamp `entityId`.

```javascript
// Before:
export const postJournalEntry = async (entries, session) => { ... }

// After:
export const postJournalEntry = async (entries, session, entityId = null) => {
  // add entityId to each entry document before insert
}
```

---

### 7. All Journal Builders — EDIT

**Path:** `src/modules/ledger/journal-builders/*.js`

Files to edit:

- `rentCharge.builder.js`
- `paymentReceived.builder.js`
- `camCharge.builder.js`
- `camPaymentReceived.builder.js`
- `lateFee.builder.js`
- `electricity.builder.js`
- `expense.builder.js`

For each one: add `entityId = null` as the last parameter and pass it through
to `postJournalEntry`. No other changes.

---

### 8. `rent.payment.service.js` — EDIT

**Path:** `src/modules/rents/rent.payment.service.js`

Two additions:

**A) Accept entityId, pass to journal builders:**

```javascript
// Accept entityId, fall back to SystemConfig.defaultEntityId if not provided
export const processPayment = async (...existingParams, entityId = null) => {
  const resolvedEntityId =
    entityId ?? (await SystemConfig.findOne()).defaultEntityId;
  // pass resolvedEntityId to all builder calls
};
```

**B) Partial payment allocation — oldest debt first rule:**

```javascript
// When allocating a payment across multiple open rent records:
// 1. Fetch all open rents for tenant, sorted by nepaliDueDate ASC
// 2. Allocate payment amount to oldest first
// 3. This naturally handles cross-entity debt — no special entity logic needed
```

---

### 9. `resolveEntity.js` middleware — CREATE

**Path:** `src/middleware/resolveEntity.js`

```javascript
// Logic:
// 1. Extract propertyId from req.query / req.body / req.params
// 2. If no propertyId → use SystemConfig.defaultEntityId
// 3. If propertyId → call getEntityForProperty(propertyId)
// 4. Attach result to req.entity
// 5. Cache in-memory Map with 5-minute TTL
// IMPORTANT: Never throw — silently fall back to default entity
```

Apply this middleware (after `protect`) to:

- `tenant.route.js`
- `rents/rent.route.js`
- `payment/payment.route.js`
- `accounting/accounting.route.js`
- `ledger/ledger.route.js`
- `revenue/revenue.route.js`
- `banks/bank.route.js`

---

### 10. `ownership.service.js` — CREATE

**Path:** `src/modules/ownership/ownership.service.js`

```javascript
export const getEntityForProperty = async (propertyId) => { ... }
export const createEntity         = async (data, createdBy) => { ... }
export const getAllEntities        = async () => { ... }
export const updateEntity         = async (id, data) => { ... }
export const getEntityById        = async (id) => { ... }
```

---

### 11. `ownership.controller.js` + `ownership.route.js` — CREATE

**Path:** `src/modules/ownership/`

Routes (all require `super_admin`):

```
GET    /api/ownership        → getAllEntities
POST   /api/ownership        → createEntity
GET    /api/ownership/:id    → getEntityById
PATCH  /api/ownership/:id    → updateEntity
```

Register in `app.js`:

```javascript
import ownershipRoutes from "./modules/ownership/ownership.route.js";
app.use("/api/ownership", protect, authorize("super_admin"), ownershipRoutes);
```

---

### 12. `MigrationSnapshot.Model.js` — CREATE

**Path:** `src/modules/migration/MigrationSnapshot.Model.js`

```javascript
{
  propertyId:            ObjectId → Property,
  fromEntityId:          ObjectId → OwnershipEntity,
  toEntityId:            ObjectId → OwnershipEntity,
  status:                { enum: ['pending', 'completed', 'rolled_back'] },
  snapshotData:          Object,   // { tenantCount, rentCount, outstandingPaisa }
  migratedBy:            ObjectId → User,
  completedAt:           Date,
  rollbackEligibleUntil: Date,     // completedAt + 48 hours
  rollbackedAt:          Date,
  rollbackedBy:          ObjectId → User,
}
// TTL index: { rollbackEligibleUntil: 1 }, { expireAfterSeconds: 0 }
```

---

### 13. `migration.service.js` — CREATE

**Path:** `src/modules/migration/migration.service.js`

**Key change from original plan:** `preflightCheck` returns warnings, not blockers,
for outstanding balances. Only hard-blocks on truly unsafe states.

```javascript
export const preflightCheck = async (propertyId) => {
  const issues   = [];   // hard blockers — migration cannot proceed
  const warnings = [];   // soft warnings — migration proceeds with acknowledgment

  // HARD BLOCK: pending cheque payments (payment processing in flight)
  // HARD BLOCK: open migration already in progress for this property

  // WARNING ONLY (not a blocker):
  //   tenants with outstanding rent balances → show total outstanding paisa
  //   partial-status rents for current month → show count

  return { canMigrate: issues.length === 0, issues, warnings };
};

export const takeSnapshot     = async (propertyId, fromEntityId, toEntityId, userId) => { ... }
export const executeSwitch    = async (propertyId, toEntityId, snapshotId, userId, session) => { ... }
export const rollbackMigration = async (snapshotId, userId) => { ... }

// backfillLedgerTags — SKIP THIS FUNCTION
// Historical entries with entityId: null are treated as private implicitly.
// No backfill needed since merged view is the default.
```

---

### 14. `migration.controller.js` + `migration.route.js` — CREATE

**Path:** `src/modules/migration/`

```
POST /api/migration/preflight/:propertyId   → preflightCheck
POST /api/migration/start                   → { propertyId, targetEntityId, acknowledgedWarnings: true }
POST /api/migration/rollback/:snapshotId    → rollbackMigration
GET  /api/migration/status/:propertyId      → current entity + migration history
GET  /api/migration/audit-log               → all events (super_admin only)
```

---

### 15. Accounting endpoints — EDIT

**Path:** `src/modules/accounting/accounting.controller.js`

**A) Add optional `?entityId=` filter to all existing endpoints:**

```javascript
// If entityId provided → filter LedgerEntry.entityId === entityId
// If not provided → in merged mode, return all; in private/company, use req.entity
// Entries with entityId: null are always included when filtering private entity
```

**B) Add consolidated endpoint:**

```javascript
// GET /api/accounting/consolidated
// Only available when systemMode is 'merged' or 'company'
// Returns revenue, expenses, P&L per entity + combined totals
// Query params: nepaliYear, nepaliMonth (optional)
```

---

### 16. Seed Script — CREATE (RUN FIRST)

**Path:** `src/seeds/seedOwnershipEntity.js`

Must be idempotent (safe to run multiple times):

1. Create one `OwnershipEntity` with `type: 'private'`, `chartOfAccountsPrefix: 'PVT'`
2. Find all `Property` where `ownershipEntityId` is null → set to new entity `_id`
3. Find `SystemConfig` → set `defaultEntityId` and `systemMode: 'private'`

```bash
node src/seeds/seedOwnershipEntity.js
```

---

### 17. `master-cron.js` — EDIT

**Path:** `src/cron/service/master-cron.js`

Change processing loop to be entity-aware:

```javascript
// 1. Fetch all active OwnershipEntity documents
// 2. For each entity → Property.find({ ownershipEntityId: entity._id })
// 3. Pass entityId through to rent generation, CAM, late fee steps
// 4. Log entity name in CronLog
```

Same pattern for `lateFee.cron.js`.

---

### 18. `TenantBalance` — EDIT for cross-entity tracking

**Path:** Wherever TenantBalance model/service lives.

Add a field to track entity-split outstanding for display purposes:

```javascript
entityBreakdown: [{
  entityId:         ObjectId → OwnershipEntity,
  outstandingPaisa: Number,
  oldestUnpaidDate: String,   // BS date string e.g. "2081-09-01"
}]
```

This powers the "legacy balance" indicator on the tenant profile page.
It is a read-model — recomputed by the nightly reconciliation cron, not
updated transactionally.

---

## Frontend Changes

### 1. `EntityContext.jsx` — CREATE

**Path:** `src/context/EntityContext.jsx`

```javascript
// State:
{
  systemMode:      'private' | 'company' | 'merged',
  entities:        OwnershipEntity[],
  defaultEntityId: string,
  activeEntityId:  string | null,   // null = show all (merged default)
}

// Derived (computed, not stored):
// canSwitchEntity  = systemMode !== 'private'
// isMergedView     = systemMode === 'merged' && activeEntityId === null

// Actions:
// setActiveEntityId(id | null)
// setSystemMode(mode) → PATCH /api/config/system-mode → refetch entities
// refreshEntities()

// Fetches GET /api/ownership on mount only if user.role === 'super_admin'
// Wrap app in <EntityContext.Provider> inside App.jsx
```

---

### 2. `useEntityMode.js` hook — CREATE

**Path:** `src/hooks/useEntityMode.js`

Single hook consumed by all components. Prevents systemMode checks scattered
across the codebase.

```javascript
export const useEntityMode = () => {
  const { systemMode, activeEntityId, entities } = useContext(EntityContext);

  return {
    isPrivate: systemMode === "private",
    isCompany: systemMode === "company",
    isMerged: systemMode === "merged",
    showEntitySwitcher: systemMode !== "private",
    showConsolidatedView: systemMode === "merged" && !activeEntityId,
    activeEntity: entities.find((e) => e._id === activeEntityId) ?? null,
  };
};
```

---

### 3. `EntitySwitcher.jsx` — CREATE

**Path:** `src/components/EntitySwitcher.jsx`

Dropdown injected into the accounting page header slot. Only rendered when
`showEntitySwitcher` is true.

```
Options:
  [ All Entities ]     ← default, activeEntityId = null
  [ Private — Ram Prasad Sharma ]
  [ Company — ABC Properties Pvt. Ltd. ]
```

When selection changes → `setActiveEntityId(id | null)` in context →
accounting queries automatically refetch with new `?entityId=` param.

---

### 4. `EntityBadge.jsx` — CREATE

**Path:** `src/components/EntityBadge.jsx`

Small badge. Visible only to `super_admin`.

```javascript
// Props: { entityType: 'private' | 'company', size?: 'sm' | 'md' }
// private → green badge
// company → blue badge (petrol)
```

Add to: building cards on dashboard, building rows in settings.

---

### 5. `AccountingPage.jsx` — EDIT

**Path:** `src/accounting/AccountingPage.jsx` (or wherever it lives)

Three changes:

**A) Inject EntitySwitcher into header slot:**

```javascript
const { setHeaderSlot } = useHeaderSlot();
const { showEntitySwitcher } = useEntityMode();

useEffect(() => {
  if (showEntitySwitcher) {
    setHeaderSlot(<EntitySwitcher />);
  }
  return () => setHeaderSlot(null);
}, [showEntitySwitcher]);
```

**B) Pass entityId to all accounting API calls:**

```javascript
const { activeEntityId } = useContext(EntityContext);
// Append ?entityId=activeEntityId to all fetch calls when activeEntityId is set
```

**C) Show consolidated view when isMergedView:**

```javascript
const { showConsolidatedView } = useEntityMode();
// When true → fetch /api/accounting/consolidated
// Render side-by-side entity KPI cards above the normal summary strip
// When false → render normal single-entity view
```

---

### 6. `AccountingLedgerPage.jsx` — EDIT

**Path:** Wherever the ledger page lives.

Add entity filter chip row below the existing BS date filters:

```
[ All Entities ]  [ Private ]  [ Company ]
```

This maps to `?entityId=` on the ledger API call. Default is All.
Only visible when `showEntitySwitcher` is true (i.e. not in private mode).

---

### 7. Settings — `Admin.jsx` — EDIT

**Path:** `src/Settings/Admin.jsx`

Add these tabs, visible only to `super_admin`:

| Tab                 | Component                   | Purpose                              |
| ------------------- | --------------------------- | ------------------------------------ |
| Entities            | `EntityManagementTab.jsx`   | Create/edit/toggle entities          |
| Building Assignment | `BuildingAssignmentTab.jsx` | Assign buildings to entities         |
| Migration           | `MigrationWizard.jsx`       | Step-by-step migration with warnings |
| System Mode         | `SystemModeTab.jsx`         | Mode toggle with status banner       |
| Audit Log           | `MigrationAuditLog.jsx`     | Full migration history table         |

---

### 8. `MigrationWizard.jsx` — CREATE

**Path:** `src/Settings/components/MigrationWizard.jsx`

Key product design change: Step 3 (preflight) shows warnings differently from
blockers.

```
Step 1: Select building
Step 2: Select target entity
Step 3: Preflight results
  — Hard blockers (red):  "Cannot proceed — 2 payments pending clearance"
  — Warnings (amber):     "3 tenants have outstanding balances totalling Rs. 24,000.
                           These will remain in the Private ledger until paid."
  — If only warnings: show "I understand, proceed anyway" checkbox
  — If blockers: disable Proceed button
Step 4: Confirmation (type building name to confirm)
Step 5: Progress
Step 6: Success + rollback button (visible 48h)
```

---

### 9. `SystemModeTab.jsx` — CREATE

**Path:** `src/Settings/components/SystemModeTab.jsx`

Always show current mode as a prominent status banner at the top:

```
┌─────────────────────────────────────────────────┐
│  🔒  Current Mode: PRIVATE                       │
│  All buildings operate under personal ownership  │
└─────────────────────────────────────────────────┘
```

Mode change requires at least one company entity to exist before
'company' or 'merged' can be selected.

---

### 10. Tenant profile page — EDIT

Wherever the tenant detail/profile page is.

Add a "Legacy Balance" indicator when `entityBreakdown` has more than one entry:

```
⚠️  Rs. 8,000 outstanding from before building migration (Private Entity)
    This amount will be settled from the tenant's next payment.
```

Only visible to admin/super_admin. Helps the owner understand split-entity debt
without needing to open the ledger.

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
  resolveEntity.js

src/seeds/
  seedOwnershipEntity.js
```

### Modified Backend Files

```
src/modules/property/[model]          add ownershipEntityId, migrationHistory
src/modules/ledger/Ledger.Model.js    add entityId (optional)
src/modules/ledger/accounts/Account.Model.js    add entityId (optional)
src/modules/ledger/ledger.service.js  accept entityId in postJournalEntry
src/modules/ledger/journal-builders/* pass entityId through (all files)
src/modules/rents/rent.payment.service.js   entityId + oldest-debt-first allocation
src/modules/rents/rent.Model.js       add partialPayments[], verify paidAmountPaisa
src/modules/payment/payment.model.js  add paymentType, partialPaymentSequence
src/modules/auth/User.Model.js        add accountant, manager roles
src/middleware/authorize.js           add role permissions matrix
src/cron/service/master-cron.js       entity-loop pattern
src/cron/service/lateFee.cron.js      entity context
src/app.js                            register ownership + migration routes
[SystemConfig model]                  add systemMode, defaultEntityId, partial settings
[accounting controller]               entityId filter + consolidated endpoint
[TenantBalance model/service]         add entityBreakdown[]
```

### New Frontend Files

```
src/context/EntityContext.jsx
src/hooks/useEntityMode.js
src/components/EntitySwitcher.jsx
src/components/EntityBadge.jsx
src/Settings/components/MigrationWizard.jsx
src/Settings/components/EntityManagementTab.jsx
src/Settings/components/BuildingAssignmentTab.jsx
src/Settings/components/MigrationAuditLog.jsx
src/Settings/components/SystemModeTab.jsx
```

### Modified Frontend Files

```
src/App.jsx                           wrap with EntityContext.Provider
src/Settings/Admin.jsx                add 5 super_admin tabs
src/accounting/AccountingPage.jsx     header slot EntitySwitcher + entityId params
src/accounting/AccountingLedgerPage.jsx   entity filter chips
src/context/AuthContext.jsx           expose role for conditional rendering
[Tenant profile page]                 legacy balance indicator
[RentPaymentDashboard/PaymentDialog]  partial payment toggle
```

---

## Implementation Order

```
Phase 1  Foundation
  → seedOwnershipEntity.js (run immediately after)
  → OwnershipEntity model + ownership service/controller/routes
  → Property model additions
  → SystemConfig additions
  → Verify all existing endpoints unchanged

Phase 2  Entity-Aware Backend
  → resolveEntity middleware
  → ledger.service.js + all journal builders
  → rent.payment.service.js
  → master-cron + lateFee.cron entity-loop

Phase 3  Partial Payments
  → Payment model additions
  → Rent model additions
  → rent.payment.service partial logic
  → PaymentDialog frontend

Phase 4  Migration Service
  → MigrationSnapshot model
  → migration.service.js (preflight as warning, not blocker)
  → migration controller + routes

Phase 5  Frontend
  → EntityContext + useEntityMode hook
  → EntitySwitcher + EntityBadge
  → AccountingPage edits
  → Settings tabs + MigrationWizard
  → Tenant profile legacy balance indicator

Phase 6  Company Features
  → Expanded roles (accountant, manager)
  → Consolidated accounting endpoint
  → Company invoice template (logo, VAT)
  → TenantBalance entityBreakdown
```

---

## Critical Rules (Do Not Forget)

1. All monetary values in **paisa** (integer). Never rupees in DB.
2. All dates in **Nepali BS** format (`"2081-09-15"` as String, not Date type).
3. `resolveEntity` middleware must **never throw** — always silently fall back.
4. `backfillLedgerTags` is **skipped** — no historical data migration.
5. Preflight check **warns** on outstanding balances, never hard-blocks.
6. `activeEntityId: null` means **show all** — this is the accounting page default.
7. All new backend files use **ES Module syntax** (`import`/`export`).
8. MongoDB sessions required for `executeSwitch` and any cross-collection writes.
9. Seed script must be **idempotent** — safe to run multiple times.
10. Phase 1 seed script must run **before** any other phase is deployed.
