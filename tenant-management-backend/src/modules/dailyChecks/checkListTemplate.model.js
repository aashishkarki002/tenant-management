/**
 * ChecklistTemplate.Model.js
 *
 * Static definition of WHAT to check for a given property × block × category.
 * Created once (manually or via seed/admin UI) and reused every day.
 * Never duplicated into daily result documents.
 *
 * Shape mirrors the old DailyChecklist.sections[] array — the same
 * buildChecklistSections() factory populates it. The difference is this
 * document lives forever; daily results only store the outcome delta.
 */

import mongoose from "mongoose";

// ─── Template item sub-schema ─────────────────────────────────────────────────
// Pure definition: label + quantity. No isOk / notes / linkedMaintenanceId
// here — those belong on the result document.

const templateItemSchema = new mongoose.Schema(
  {
    // Stable identifier so result itemResults[] can reference it by _id.
    // Mongoose auto-generates _id for sub-documents, which we use as itemId.
    label: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0, default: null },
  },
  { _id: true }, // keep _id — used as foreign key in ChecklistResult.itemResults
);

// ─── Template section sub-schema ─────────────────────────────────────────────

const templateSectionSchema = new mongoose.Schema(
  {
    sectionKey: { type: String, required: true, trim: true },
    sectionLabel: { type: String, required: true, trim: true },
    items: [templateItemSchema],
  },
  { _id: true },
);

// ─── Main ChecklistTemplate schema ───────────────────────────────────────────

const checklistTemplateSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    // Optional — if null, template applies to all blocks under the property
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

    // Drives which extra items are included (e.g. WATER_TANK weekly vs monthly)
    checklistType: {
      type: String,
      enum: ["DAILY", "WEEKLY_TWICE", "WEEKLY", "MONTHLY"],
      required: true,
      default: "DAILY",
    },

    // Human-readable name (e.g. "Block A – Electrical Daily")
    name: { type: String, trim: true, default: "" },

    // The full section + item tree — built once from checkListTemplate.js factory
    sections: [templateSectionSchema],

    // Denormalized count so result documents can set totalItems without a join
    totalItems: { type: Number, default: 0 },

    // Whether this template is still in use. Soft-delete instead of hard delete
    // so existing result documents keep a valid reference.
    isActive: { type: Boolean, default: true },

    // Building-specific asset config that was used to generate sections.
    // Stored here so admins can regenerate/update sections later without
    // manually knowing the config again.
    buildingConfig: { type: mongoose.Schema.Types.Mixed, default: {} },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    lastRebuiltAt: { type: Date, default: null },
    lastRebuiltBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Pre-save: keep totalItems in sync ───────────────────────────────────────
checklistTemplateSchema.pre("save", function () {
  this.totalItems = this.sections.reduce(
    (sum, sec) => sum + sec.items.length,
    0,
  );
});

// ─── Unique constraint: one active template per property × block × category × type
checklistTemplateSchema.index(
  { property: 1, block: 1, category: 1, checklistType: 1 },
  { unique: true },
);

checklistTemplateSchema.index({ property: 1, isActive: 1 });
checklistTemplateSchema.index({ block: 1, category: 1 });

export const ChecklistTemplate = mongoose.model(
  "ChecklistTemplate",
  checklistTemplateSchema,
);
