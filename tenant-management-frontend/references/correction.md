# Architecture Correction: Block-Level Ownership

## Patch to: `MULTI_MODE_IMPLEMENTATION_PLAN.md` + `REVENUE_EXPENSE_SCOPE_ADDENDUM.md`

> **For Claude Code:** This file corrects a fundamental assumption in the previous two plan files.
> The word "building" in those files maps to the `Block` model — NOT the `Property` model.
> Apply every correction in this file before implementing anything from the base plan.

---

## The Correction

The base plan assumed the hierarchy was:

```
Property (= one building) → Units
```

The actual hierarchy in this codebase is:

```
Property (= the whole estate / compound)
  └── Block (= one physical building)  ← THIS is what "building" means everywhere
        └── InnerBlock
              └── Unit (= one rentable space)
```

There is **one Property** document in the database. The 4 buildings are 4 **Block** documents, each with `block.property` pointing to that single Property.

**Consequence:** Every place the base plan says "add `ownershipEntityId` to Property" must instead say "add `ownershipEntityId` to Block". The Property model does NOT get `ownershipEntityId`.

---

## Corrected Block Model

**File to edit:** `tenant-management-backend/src/modules/` — find the Block model file (uploaded as `Block.Model.js`)

```javascript
import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    // ── NEW FIELDS ──────────────────────────────────────────────
    ownershipEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      // NOT required at schema level — seed script will populate all existing blocks
    },

    migrationHistory: [
      {
        fromEntityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OwnershipEntity",
        },
        toEntityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OwnershipEntity",
        },
        migratedAt: { type: Date },
        migratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: { type: String },
      },
    ],
    // ── END NEW FIELDS ───────────────────────────────────────────
  },
  { timestamps: true },
);

export const Block = mongoose.model("Block", blockSchema);
```

**Do NOT add `ownershipEntityId` to the Property model.** Property stays unchanged.

---

## Corrected Seed Script

**File to create:** `tenant-management-backend/src/seeds/seedOwnershipEntity.js`

```javascript
import mongoose from "mongoose";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { Block } from "../modules/tenant/blocks/Block.Model.js"; // adjust path to actual location
import SystemConfig from "../modules/config/SystemConfig.Model.js"; // adjust path

await mongoose.connect(process.env.MONGODB_URI);

// ── Step 1: Create private entity if not already present ──────────────────────
let privateEntity = await OwnershipEntity.findOne({ type: "private" });
if (!privateEntity) {
  privateEntity = await OwnershipEntity.create({
    name: "Owner", // Super Admin should update this name from Settings UI later
    type: "private",
    chartOfAccountsPrefix: "PVT",
    isActive: true,
  });
  console.log("Created private entity:", privateEntity._id);
} else {
  console.log("Private entity already exists:", privateEntity._id);
}

// ── Step 2: Create Head Office entity if not already present ─────────────────
let hqEntity = await OwnershipEntity.findOne({ type: "head_office" });
if (!hqEntity) {
  hqEntity = await OwnershipEntity.create({
    name: "Head Office",
    type: "head_office",
    chartOfAccountsPrefix: "HQ",
    isActive: true,
  });
  console.log("Created head office entity:", hqEntity._id);
} else {
  console.log("Head office entity already exists:", hqEntity._id);
}

// ── Step 3: Assign ownershipEntityId to ALL blocks that don't have one ────────
// These are your 4 buildings — each Block gets the private entity by default
const unassignedBlocks = await Block.find({
  $or: [{ ownershipEntityId: { $exists: false } }, { ownershipEntityId: null }],
});

if (unassignedBlocks.length > 0) {
  await Block.updateMany(
    { _id: { $in: unassignedBlocks.map((b) => b._id) } },
    { $set: { ownershipEntityId: privateEntity._id } },
  );
  console.log(
    `Assigned private entity to ${unassignedBlocks.length} blocks:`,
    unassignedBlocks.map((b) => b.name),
  );
} else {
  console.log("All blocks already have an ownershipEntityId — skipping.");
}

// ── Step 4: Update SystemConfig ───────────────────────────────────────────────
const config = await SystemConfig.findOne();
if (config) {
  await SystemConfig.updateOne(
    { _id: config._id },
    {
      $set: {
        systemMode: config.systemMode ?? "private", // don't overwrite if already set
        defaultEntityId: config.defaultEntityId ?? privateEntity._id,
        allowPartialPayments: config.allowPartialPayments ?? true,
        partialPaymentThresholdPct: config.partialPaymentThresholdPct ?? 0,
      },
    },
  );
  console.log("SystemConfig updated.");
} else {
  console.warn("No SystemConfig document found — create one manually.");
}

console.log("Seed complete.");
await mongoose.disconnect();
```

---

## Corrected `resolveEntity` Middleware

**File to create:** `tenant-management-backend/src/middleware/resolveEntity.js`

The middleware now resolves entity from `blockId`, not `propertyId`.

```javascript
import { Block } from "../modules/tenant/blocks/Block.Model.js"; // adjust path
import SystemConfig from "../modules/config/SystemConfig.Model.js"; // adjust path

// Simple in-memory cache: blockId (string) → entity object
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const resolveEntity = async (req, res, next) => {
  try {
    // Extract blockId from wherever it appears in the request
    const blockId =
      req.query.blockId || req.body?.blockId || req.params?.blockId || null;

    if (!blockId) {
      // No blockId — fall back to system default entity
      const config = await SystemConfig.findOne().lean();
      req.entity = config?.defaultEntityId
        ? {
            _id: config.defaultEntityId,
            type: "private",
            chartOfAccountsPrefix: "PVT",
          }
        : null;
      return next();
    }

    // Cache check
    const cacheKey = blockId.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      req.entity = cached.entity;
      return next();
    }

    // DB lookup
    const block = await Block.findById(blockId)
      .populate("ownershipEntityId")
      .lean();

    if (!block || !block.ownershipEntityId) {
      // Block found but no entity assigned yet — use default
      const config = await SystemConfig.findOne().lean();
      req.entity = config?.defaultEntityId ?? null;
      return next();
    }

    const entity = block.ownershipEntityId; // populated object
    cache.set(cacheKey, { entity, expiresAt: Date.now() + CACHE_TTL_MS });
    req.entity = entity;
    next();
  } catch (err) {
    // Never block a request due to entity resolution failure
    console.error("resolveEntity middleware error:", err.message);
    next();
  }
};

// Call this to invalidate a block's cached entity (e.g. after migration)
export const bustEntityCache = (blockId) => {
  cache.delete(blockId.toString());
};
```

---

## Corrected `ownership.service.js` — `getEntityForBlock`

**File to create:** `tenant-management-backend/src/modules/ownership/ownership.service.js`

Rename `getEntityForProperty` → `getEntityForBlock`:

```javascript
import { Block } from "../tenant/blocks/Block.Model.js"; // adjust path
import { OwnershipEntity } from "./OwnershipEntity.Model.js";

// Resolve which entity owns a given block
export const getEntityForBlock = async (blockId) => {
  const block = await Block.findById(blockId)
    .populate("ownershipEntityId")
    .lean();
  if (!block) throw new Error(`Block not found: ${blockId}`);
  return block.ownershipEntityId ?? null;
};

// Get all blocks for a given entity (used in migration and reporting)
export const getBlocksForEntity = async (entityId) => {
  return Block.find({ ownershipEntityId: entityId }).lean();
};

export const createEntity = async (data, createdBy) => {
  return OwnershipEntity.create({ ...data, createdBy });
};

export const getAllEntities = async () => {
  return OwnershipEntity.find({ isActive: true }).lean();
};

export const updateEntity = async (id, data) => {
  return OwnershipEntity.findByIdAndUpdate(id, data, { new: true });
};

export const getEntityById = async (id) => {
  return OwnershipEntity.findById(id).lean();
};
```

---

## Corrected Migration Service

**File to create:** `tenant-management-backend/src/modules/migration/migration.service.js`

All references to `propertyId` become `blockId`:

```javascript
import { Block } from "../tenant/blocks/Block.Model.js";
import { OwnershipEntity } from "../ownership/OwnershipEntity.Model.js";
import { MigrationSnapshot } from "./MigrationSnapshot.Model.js";
import { bustEntityCache } from "../../middleware/resolveEntity.js";
import mongoose from "mongoose";

export const preflightCheck = async (blockId) => {
  const issues = [];

  // Check: no partial rents for tenants in this block this month
  // (Adjust query to match your Rent model's block reference field)
  const openPartialRents = await mongoose.model("Rent").countDocuments({
    block: blockId,
    status: { $in: ["partial", "pending"] },
  });
  if (openPartialRents > 0) {
    issues.push(
      `${openPartialRents} unpaid or partial rent(s) exist for this block in the current period.`,
    );
  }

  // Check: no pending cheques linked to this block's tenants
  // Add more checks here as needed

  return { canMigrate: issues.length === 0, issues };
};

export const takeSnapshot = async (
  blockId,
  fromEntityId,
  toEntityId,
  userId,
) => {
  const block = await Block.findById(blockId).lean();
  const snapshot = await MigrationSnapshot.create({
    blockId, // NOTE: was propertyId in base plan — now blockId
    fromEntityId,
    toEntityId,
    status: "pending",
    snapshotData: {
      blockName: block.name,
      // add counts of tenants, rents, etc. here for the audit log
    },
    migratedBy: userId,
  });
  return snapshot;
};

export const executeSwitch = async (
  blockId,
  toEntityId,
  snapshotId,
  userId,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic re-point: Block now belongs to new entity
    await Block.findByIdAndUpdate(
      blockId,
      {
        $set: { ownershipEntityId: toEntityId },
        $push: {
          migrationHistory: {
            fromEntityId: (await MigrationSnapshot.findById(snapshotId).lean())
              .fromEntityId,
            toEntityId,
            migratedAt: new Date(),
            migratedBy: userId,
          },
        },
      },
      { session },
    );

    const rollbackEligibleUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await MigrationSnapshot.findByIdAndUpdate(
      snapshotId,
      { status: "completed", completedAt: new Date(), rollbackEligibleUntil },
      { session },
    );

    await session.commitTransaction();

    // Bust cache so resolveEntity picks up the new entity immediately
    bustEntityCache(blockId);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const rollbackMigration = async (snapshotId, userId) => {
  const snapshot = await MigrationSnapshot.findById(snapshotId);
  if (!snapshot) throw new Error("Snapshot not found");
  if (snapshot.rollbackEligibleUntil < new Date())
    throw new Error("Rollback window expired");

  await Block.findByIdAndUpdate(snapshot.blockId, {
    $set: { ownershipEntityId: snapshot.fromEntityId },
  });

  await MigrationSnapshot.findByIdAndUpdate(snapshotId, {
    status: "rolled_back",
    rollbackedAt: new Date(),
    rollbackedBy: userId,
  });

  bustEntityCache(snapshot.blockId.toString());
};
```

---

## Corrected `MigrationSnapshot` Model

**File to create:** `tenant-management-backend/src/modules/migration/MigrationSnapshot.Model.js`

Change `propertyId` → `blockId`:

```javascript
import mongoose from "mongoose";

const migrationSnapshotSchema = new mongoose.Schema(
  {
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    }, // was propertyId
    fromEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
    },
    toEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "rolled_back"],
      default: "pending",
    },
    snapshotData: { type: Object },
    migratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    rollbackEligibleUntil: { type: Date },
    rollbackedAt: { type: Date },
    rollbackedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Auto-expire snapshot documents 48h after rollback window closes
migrationSnapshotSchema.index(
  { rollbackEligibleUntil: 1 },
  { expireAfterSeconds: 0 },
);

export const MigrationSnapshot = mongoose.model(
  "MigrationSnapshot",
  migrationSnapshotSchema,
);
```

---

## Corrected API Routes

Everywhere the base plan says `/api/migration/preflight/:propertyId` and `/api/migration/status/:propertyId`, replace with `:blockId`:

```
POST /api/migration/preflight/:blockId    → preflightCheck(blockId)
POST /api/migration/start                 → body: { blockId, targetEntityId }
POST /api/migration/rollback/:snapshotId  → rollbackMigration(snapshotId)
GET  /api/migration/status/:blockId       → current entity, migration history, rollback eligibility
GET  /api/migration/audit-log             → all events
```

---

## Corrected master-cron Loop

**File to edit:** `tenant-management-backend/src/cron/service/master-cron.js`

The cron now loops over Blocks (not Properties):

```javascript
// CORRECTED entity-aware loop for master-cron:

const allEntities = await OwnershipEntity.find({
  isActive: true,
  type: { $ne: "head_office" },
});

for (const entity of allEntities) {
  const blocks = await Block.find({ ownershipEntityId: entity._id });

  for (const block of blocks) {
    // Pass both blockId and entityId to each cron step
    await generateMonthlyRents({ blockId: block._id, entityId: entity._id });
    await generateMonthlyCAMs({ blockId: block._id, entityId: entity._id });
    await applyLateFees({ blockId: block._id, entityId: entity._id });
    // etc.
  }
}
// Head Office entity is excluded from cron — it never generates rents or CAMs
```

---

## Corrected Revenue/Expense Scope Queries

In the revenue/expense addendum, everywhere it says `propertyId` in queries, use `blockId`:

```javascript
// CORRECTED — per-block report query:
const buildingRevenue = await Revenue.find({
  blockId: req.query.blockId, // was propertyId
  transactionScope: "building",
});

const splitRevenue = await Revenue.find({
  transactionScope: "split",
  "splitAllocations.blockId": req.query.blockId, // was propertyId
});
```

Update Revenue and Expense models: replace `propertyId` field name with `blockId` in `splitAllocations` array items and in the top-level building-scope field.

---

## Corrected Frontend: Migration Wizard

**File to edit:** `src/Settings/components/MigrationWizard.jsx`

Step 1 now fetches and displays **Blocks** (not Properties):

```javascript
// Fetch blocks to show in the "select building to migrate" dropdown:
GET / api / blocks / get - blocks; // or whatever your existing block list endpoint is

// Each block card shows:
// - block.name  (e.g. "Narendra Block")
// - Current entity name + type badge (Private / Company)
// - Last migrated date from block.migrationHistory
```

---

## Summary: Find & Replace for Claude Code

When reading `MULTI_MODE_IMPLEMENTATION_PLAN.md` and `REVENUE_EXPENSE_SCOPE_ADDENDUM.md`, apply these substitutions mentally before implementing:

| What the plan says                                 | What to actually do                       |
| -------------------------------------------------- | ----------------------------------------- |
| Add `ownershipEntityId` to **Property** model      | Add it to **Block** model instead         |
| `getEntityForProperty(propertyId)`                 | `getEntityForBlock(blockId)`              |
| Loop over `Property.find(...)` in cron             | Loop over `Block.find(...)` in cron       |
| `MigrationSnapshot.propertyId`                     | `MigrationSnapshot.blockId`               |
| API param `:propertyId` in migration routes        | `:blockId`                                |
| `resolveEntity` reads `req.*.propertyId`           | Reads `req.*.blockId`                     |
| `splitAllocations[].propertyId` in Revenue/Expense | `splitAllocations[].blockId`              |
| Frontend "select building" fetches Properties      | Fetches Blocks                            |
| "4 buildings = 4 Properties"                       | "4 buildings = 4 Blocks under 1 Property" |
