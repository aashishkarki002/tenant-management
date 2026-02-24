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
      enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
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
    completedAt: Date,
    completionNotes: String,
    recurring: { type: Boolean, default: false },
    recurringIntervalDays: Number,

    // ============================================
    // DENORMALIZED NEPALI DATE FIELDS
    // Industry pattern: store derived Nepali year/month alongside the
    // English Date so you can do indexed month-range queries without
    // a runtime conversion on every read.
    //
    // Naming convention matches Expense model for consistency.
    // All months are 1-based (1 = Baisakh … 12 = Chaitra).
    // ============================================

    // ── Scheduled date in Nepali calendar ───────────────────────────────────
    // Set at creation time from scheduledDate. Used for "tasks due this
    // Nepali month" dashboards and cron-based reminders.
    scheduledNepaliMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    scheduledNepaliYear: {
      type: Number,
    },

    // ── Completion date in Nepali calendar ──────────────────────────────────
    // Set when status transitions to COMPLETED. Used for expense
    // reconciliation reports filtered by Nepali fiscal month.
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
maintenanceSchema.index({ property: 1, unit: 1 });
// Nepali calendar filters — the primary reason for denormalizing these fields.
// Allows O(log n) queries like: find all tasks completed in Baisakh 2082.
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
