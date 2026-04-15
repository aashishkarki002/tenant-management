import mongoose from "mongoose";

const migrationSnapshotSchema = new mongoose.Schema(
  {
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    },
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
    snapshotData: {
      type: Object,
      // { blockName, tenantCount, rentCount, outstandingPaisa }
    },
    migratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    completedAt: { type: Date },
    rollbackEligibleUntil: { type: Date }, // completedAt + 48h
    rollbackedAt: { type: Date },
    rollbackedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

// Auto-expire snapshot documents after rollback window closes
migrationSnapshotSchema.index(
  { rollbackEligibleUntil: 1 },
  { expireAfterSeconds: 0 },
);

export const MigrationSnapshot = mongoose.model(
  "MigrationSnapshot",
  migrationSnapshotSchema,
);
