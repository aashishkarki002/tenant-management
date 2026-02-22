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
  },
  {
    timestamps: true, // gives you createdAt + updatedAt automatically
  },
);

export const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
