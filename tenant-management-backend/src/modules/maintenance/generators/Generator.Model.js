import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const fuelRefillSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    litersAdded: { type: Number, required: true, min: 0.1 },
    costPaisa: { type: Number, default: 0, min: 0 }, // stored as paisa
    fuelLevelAfterPercent: { type: Number, min: 0, max: 100 },
    supplier: { type: String, trim: true },
    invoiceRef: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { _id: true },
);

const dailyCheckSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    fuelPercent: { type: Number, required: true, min: 0, max: 100 },
    runningHours: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["NORMAL", "LOW_FUEL", "FAULT", "OFFLINE"],
      default: "NORMAL",
    },
    notes: { type: String, trim: true },
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { _id: true },
);

const serviceLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: [
        "OilChange",
        "FilterChange",
        "FullService",
        "Inspection",
        "Repair",
        "Other",
      ],
      required: true,
    },
    description: { type: String, trim: true },
    costPaisa: { type: Number, default: 0, min: 0 },
    technician: { type: String, trim: true },
    nextServiceDate: { type: Date },
    nextServiceHours: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { _id: true },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const generatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    capacityKva: { type: Number },
    tankCapacityLiters: { type: Number, required: true, min: 1 },

    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block" },
    location: { type: String, trim: true },

    status: {
      type: String,
      enum: ["RUNNING", "IDLE", "MAINTENANCE", "FAULT", "DECOMMISSIONED"],
      default: "IDLE",
    },

    // Live snapshot — updated on each daily check
    currentFuelPercent: { type: Number, default: 100, min: 0, max: 100 },
    lastCheckedAt: { type: Date },

    // Alert thresholds
    lowFuelThresholdPercent: { type: Number, default: 20 },
    criticalFuelThresholdPercent: { type: Number, default: 10 },

    // Upcoming scheduled service
    nextServiceDate: { type: Date },
    nextServiceHours: { type: Number },

    fuelRefills: [fuelRefillSchema],
    dailyChecks: [dailyCheckSchema],
    serviceLogs: [serviceLogSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

generatorSchema.index({ property: 1, status: 1 });
generatorSchema.index({ nextServiceDate: 1 });

export const Generator = mongoose.model("Generator", generatorSchema);
