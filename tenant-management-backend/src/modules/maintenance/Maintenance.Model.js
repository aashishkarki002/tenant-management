import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
    },

    // ============================================
    // ENTITY TRACING
    // Denormalized at write time by walking unit → InnerBlock → Block → OwnershipEntity.
    // Stored here so expense creation and reporting never need to re-walk the hierarchy.
    // ============================================
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      // Not required — legacy tasks created before entity migration will be null.
      // The expense service handles null gracefully via resolveTransactionScope.
    },
    // ── Scope — what level of the property hierarchy this task covers ─────────────
    // Auto-derived in createMaintenance() from which refs are populated.
    // Can be set explicitly for COMMON_AREA tasks (hallways, lobbies, parking).
    scope: {
      type: String,
      enum: ["UNIT", "BLOCK", "PROPERTY", "COMMON_AREA"],
      default: "UNIT",
    },
    // ── Origin tracing — what created this task ──────────────────────────────────
    // MANUAL       → created by an admin/staff directly
    // CHECKLIST    → auto-spawned by dailyChecksList submitResult()
    // GENERATOR    → spawned from a generator service log
    // RECURRING    → spawned by the recurrence cron from a previous completed task
    sourceType: {
      type: String,
      enum: ["MANUAL", "CHECKLIST", "GENERATOR", "RECURRING"],
      default: "MANUAL",
    },
    // Points to ChecklistResult._id, Generator._id, or parent Maintenance._id
    // depending on sourceType. Null for MANUAL.
    sourceRef: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "sourceRefModel",
      default: null,
    },
    // Companion discriminator for populate() to resolve the right collection
    sourceRefModel: {
      type: String,
      enum: ["ChecklistResult", "Generator", "Maintenance"],
      default: null,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["Repair", "Maintenance", "Inspection", "Other"],
      default: "Maintenance",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "PENDING_SETTLEMENT",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "OPEN",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    amountPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmountPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "paid", "overpaid"],
      default: "pending",
    },
    lastPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    attachments: [{ filename: String, url: String, mimetype: String }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    // The external party who physically performs the work.
    // assignedTo is the internal staff who oversees — contractor is who gets paid.
    contractor: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      type: {
        type: String,
        enum: ["VENDOR", "CONTRACTOR", "UTILITY", "OTHER"],
        default: "CONTRACTOR",
      },
    },
    completedAt: Date,
    completionNotes: String,
    recurring: { type: Boolean, default: false },
    recurringIntervalDays: Number,
    // Standard top-level BS date fields (matches convention across all other models)
    nepaliMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    nepaliYear: {
      type: Number,
    },
    scheduledNepaliMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    scheduledNepaliYear: {
      type: Number,
    },
    scheduledNepaliDate: {
      type: Date,
    },
    completionNepaliDate: {
      type: Date,
    },
    completionNepaliMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    completionNepaliYear: {
      type: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtual fields — rupee views of the paisa storage ────────────────────────
// Read-only derived fields. Never write `amount` or `paidAmount` directly —
// always write `amountPaisa` / `paidAmountPaisa` in the service.
maintenanceSchema.virtual("amount").get(function () {
  return (this.amountPaisa ?? 0) / 100;
});

maintenanceSchema.virtual("paidAmount").get(function () {
  return (this.paidAmountPaisa ?? 0) / 100;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound index for the most common dashboard query: status + priority + date
maintenanceSchema.index({ status: 1, priority: 1, scheduledDate: -1 });
// Tenant and property lookups
maintenanceSchema.index({ tenant: 1 });
maintenanceSchema.index({ entityId: 1, scheduledDate: -1 });
maintenanceSchema.index({ property: 1, unit: 1 });
maintenanceSchema.index({ scope: 1, property: 1, status: 1 });
maintenanceSchema.index({ sourceType: 1, sourceRef: 1 });
maintenanceSchema.index({ nepaliYear: 1, nepaliMonth: 1 });
maintenanceSchema.index({ scheduledNepaliYear: 1, scheduledNepaliMonth: 1 });
maintenanceSchema.index({ completionNepaliYear: 1, completionNepaliMonth: 1 });

// ── Pre-save hook ─────────────────────────────────────────────────────────────
maintenanceSchema.pre("save", function () {
  // Enforce integer paisa storage
  if (this.amountPaisa && !Number.isInteger(this.amountPaisa)) {
    throw new Error(
      `Maintenance amount must be integer paisa, got: ${this.amountPaisa}`,
    );
  }
  if (this.paidAmountPaisa && !Number.isInteger(this.paidAmountPaisa)) {
    throw new Error(
      `Paid amount must be integer paisa, got: ${this.paidAmountPaisa}`,
    );
  }

  // NOTE: findByIdAndUpdate bypasses this hook, so the service layer must
  // enforce the overpayment guard independently (see maintenance.service.js).
  if (this.paidAmountPaisa > this.amountPaisa) {
    throw new Error("Paid amount cannot exceed maintenance amount");
  }
});

export const Maintenance = mongoose.model("Maintenance", maintenanceSchema);
