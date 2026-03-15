import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    // ── Ownership fields ──────────────────────────────────────────────────────
    ownershipEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      // NOT required at schema level — seed script populates all existing blocks
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
    // ── End ownership fields ──────────────────────────────────────────────────
  },
  { timestamps: true },
);

export const Block = mongoose.model("Block", blockSchema);
