/**
 * ChecklistResult.Model.js
 *
 * One document per daily check run. Tiny by design — it stores ONLY:
 *   1. A reference to the ChecklistTemplate (which holds the full item tree)
 *   2. The outcome delta: only items that failed OR were explicitly noted
 *   3. Aggregate counters for fast dashboard queries
 *
 * Items where isOk=true and notes="" are NOT stored — they are the default
 * assumed state. The frontend reconstructs the full view by merging the
 * template sections with the itemResults delta.
 *
 * Storage profile (vs old approach):
 *   Old DailyChecklist (full embed): ~8–15 KB per document
 *   ChecklistResult (delta only):    ~300–800 bytes per document
 *   Saving: ~95% reduction over 1 year
 */

import mongoose from "mongoose";

// ─── Item result sub-schema ───────────────────────────────────────────────────
// Stores ONLY the items the checker explicitly marked or noted.
// isOk defaults to true — if it's in this array it almost certainly is false,
// but we store it explicitly for the rare "all-ok with a note" case.

const itemResultSchema = new mongoose.Schema(
  {
    // References templateItem._id — used to join back to the template for label/quantity
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // The section this item belongs to (denormalized for query convenience)
    sectionKey: { type: String, required: true, trim: true },

    // FALSE = fault found. Only items with isOk=false or non-empty notes are stored.
    isOk: { type: Boolean, default: false },

    // Checker's note: "2 bulbs fused", "CCTV lens dirty", etc.
    notes: { type: String, trim: true, default: "" },

    // Auto-created Maintenance task if isOk = false
    linkedMaintenanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Maintenance",
      default: null,
    },
  },
  { _id: false }, // no _id needed — itemId is the identifier
);

// ─── Main ChecklistResult schema ──────────────────────────────────────────────

const checklistResultSchema = new mongoose.Schema(
  {
    // ── Template reference ────────────────────────────────────────────────────
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChecklistTemplate",
      required: true,
    },

    // Denormalized for filtering without joining template — avoids lookup in cron
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
    checklistType: {
      type: String,
      enum: ["DAILY", "WEEKLY_TWICE", "WEEKLY", "MONTHLY"],
      required: true,
      default: "DAILY",
    },

    // ── Date fields ───────────────────────────────────────────────────────────
    checkDate: { type: Date, required: true },
    nepaliDate: { type: String, default: null }, // "2082-04-15"
    nepaliMonth: { type: Number, min: 1, max: 12, default: null },
    nepaliYear: { type: Number, default: null },

    // ── Outcome delta — ONLY items that failed or were explicitly noted ────────
    // Empty array = perfect run (all items passed, no notes).
    itemResults: [itemResultSchema],

    // ── Aggregate counters ────────────────────────────────────────────────────
    // totalItems is copied from template.totalItems at result creation time
    // so queries never need a join to get the denominator.
    totalItems: { type: Number, default: 0 },
    passedItems: { type: Number, default: 0 },
    failedItems: { type: Number, default: 0 },
    hasIssues: { type: Boolean, default: false },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "INCOMPLETE"],
      default: "PENDING",
    },

    overallNotes: { type: String, trim: true, default: "" },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
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

// ─── Virtual: pass rate % ─────────────────────────────────────────────────────
checklistResultSchema.virtual("passRate").get(function () {
  if (!this.totalItems) return null;
  return Math.round((this.passedItems / this.totalItems) * 100);
});

// ─── Pre-save: recompute counters from itemResults delta ──────────────────────
// passedItems = totalItems − failedItems
// failedItems = count of itemResults where isOk = false
// This is correct because itemResults only stores explicit outcomes.
// Items NOT in itemResults are implicitly isOk = true.
checklistResultSchema.pre("save", function () {
  if (this.status === "PENDING") {
    // Not yet submitted — counters are not meaningful yet.
    // passedItems stays 0 so the UI can show "0 / N checked".
    this.failedItems = 0;
    this.hasIssues = false;
    return;
  }

  const failed = this.itemResults.filter((r) => !r.isOk).length;
  this.failedItems = failed;
  this.passedItems = this.totalItems - failed;
  this.hasIssues = failed > 0;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Idempotency guard in cron: (property, category, checkDate)
checklistResultSchema.index({ property: 1, category: 1, checkDate: -1 });
checklistResultSchema.index({ block: 1, checkDate: -1 });
checklistResultSchema.index({ nepaliYear: 1, nepaliMonth: 1, category: 1 });
checklistResultSchema.index({ hasIssues: 1, status: 1 });
checklistResultSchema.index({ template: 1, checkDate: -1 });

// ─── Optional TTL: auto-expire results after 2 years ─────────────────────────
// Remove or adjust to match your retention policy. The template is never expired.
// checklistResultSchema.index(
//   { checkDate: 1 },
//   { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 }
// );

export const ChecklistResult = mongoose.model(
  "ChecklistResult",
  checklistResultSchema,
);
