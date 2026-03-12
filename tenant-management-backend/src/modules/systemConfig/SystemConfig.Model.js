import mongoose from "mongoose";

/**
 * SystemConfig — Generic key-value store for app-level settings.
 *
 * Usage:
 *   await SystemConfig.findOneAndUpdate(
 *     { key: "rentEscalationDefaults" },
 *     { key: "rentEscalationDefaults", value: { enabled: true, percentageIncrease: 5 } },
 *     { upsert: true, new: true }
 *   );
 *
 * Ownership / multi-mode fields live on the document with key "ownershipConfig".
 */
const systemConfigSchema = new mongoose.Schema(
  {
    // Unique identifier for this setting, e.g. "rentEscalationDefaults"
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // The actual config payload — can be any shape
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Optional: who last changed this setting
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // ── Ownership / multi-mode fields (only populated on key="ownershipConfig") ──
    systemMode: {
      type: String,
      enum: ["private", "company", "merged"],
      default: "private",
    },
    defaultEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      default: null,
    },
    allowPartialPayments: {
      type: Boolean,
      default: true,
    },
    partialPaymentThresholdPct: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
