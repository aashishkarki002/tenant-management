import mongoose from "mongoose";

// ─── Reusable item sub-schema ─────────────────────────────────────────────────
// Each checklist item has a label, optional quantity (e.g. "12 bulbs"),
// a checked/ok flag, and a free-text note. If not ok → a linked maintenance
// task can be created automatically.

const checkItemSchema = new mongoose.Schema(
  {
    // The specific fixture/item being checked (e.g. "Bulb – Staircase 1A")
    label: { type: String, required: true, trim: true },

    // Quantity context — e.g. total bulbs installed so the checker knows
    // what to verify. Purely informational, stored in the template.
    quantity: { type: Number, min: 0, default: null },

    // TRUE = working / ok. FALSE = fault / issue found.
    isOk: { type: Boolean, default: true },

    // Free text: "2 bulbs fused", "CCTV lens dirty", etc.
    notes: { type: String, trim: true, default: "" },

    // Auto-created Maintenance task when isOk = false (optional linkage)
    linkedMaintenanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Maintenance",
      default: null,
    },
  },
  { _id: true },
);

// ─── Section sub-schema ───────────────────────────────────────────────────────
// Groups related items (e.g. "Basement 1 Parking", "Overhead Tank")

const checkSectionSchema = new mongoose.Schema(
  {
    sectionKey: { type: String, required: true, trim: true }, // e.g. "PARKING_B1"
    sectionLabel: { type: String, required: true, trim: true }, // e.g. "Parking – Basement 1"
    items: [checkItemSchema],
  },
  { _id: true },
);

// ─── Main DailyChecklist schema ───────────────────────────────────────────────

const dailyChecklistSchema = new mongoose.Schema(
  {
    // Which building / block this checklist covers
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      default: null,
    },

    // ── Frequency / schedule type ─────────────────────────────────────────────
    // DAILY  → every day
    // WEEKLY_TWICE → Monday + Thursday (or whichever two days are configured)
    // WEEKLY  → once a week
    // MONTHLY → once a month (e.g. de-sludging)
    checklistType: {
      type: String,
      enum: ["DAILY", "WEEKLY_TWICE", "WEEKLY", "MONTHLY"],
      required: true,
      default: "DAILY",
    },

    // ── Category ──────────────────────────────────────────────────────────────
    // Drives which sections the template populates.
    category: {
      type: String,
      enum: [
        "CCTV",
        "ELECTRICAL",
        "SANITARY",
        "COMMON_AREA",
        "PARKING",
        "FIRE",
        "WATER_TANK",
      ],
      required: true,
    },

    // ── Execution date (English + Nepali) ─────────────────────────────────────
    checkDate: { type: Date, required: true },
    nepaliDate: { type: String, default: null }, // "2081-04-15" BS string
    nepaliMonth: { type: Number, min: 1, max: 12, default: null },
    nepaliYear: { type: Number, default: null },

    // ── Checklist sections + items ────────────────────────────────────────────
    sections: [checkSectionSchema],

    // ── Summary flags ─────────────────────────────────────────────────────────
    // Derived at save time for quick dashboard filtering
    hasIssues: { type: Boolean, default: false }, // any isOk = false
    totalItems: { type: Number, default: 0 },
    passedItems: { type: Number, default: 0 },
    failedItems: { type: Number, default: 0 },

    // ── Overall checklist status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "INCOMPLETE"],
      default: "PENDING",
    },

    // General notes for the whole checklist (e.g. "Power outage during check")
    overallNotes: { type: String, trim: true, default: "" },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    submittedAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtual: pass rate % ────────────────────────────────────────────────────
dailyChecklistSchema.virtual("passRate").get(function () {
  if (!this.totalItems) return null;
  return Math.round((this.passedItems / this.totalItems) * 100);
});

// ─── Pre-save: recompute summary counters ────────────────────────────────────
dailyChecklistSchema.pre("save", function () {
  let total = 0;
  let passed = 0;

  for (const section of this.sections) {
    for (const item of section.items) {
      total++;
      if (item.isOk) passed++;
    }
  }

  this.totalItems = total;
  this.passedItems = passed;
  this.failedItems = total - passed;
  this.hasIssues = this.failedItems > 0;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
dailyChecklistSchema.index({ property: 1, checkDate: -1 });
dailyChecklistSchema.index({ property: 1, category: 1, checkDate: -1 });
dailyChecklistSchema.index({ nepaliYear: 1, nepaliMonth: 1, category: 1 });
dailyChecklistSchema.index({ hasIssues: 1, status: 1 });
dailyChecklistSchema.index({ block: 1, checkDate: -1 });

export const DailyChecklist = mongoose.model(
  "DailyChecklist",
  dailyChecklistSchema,
);
