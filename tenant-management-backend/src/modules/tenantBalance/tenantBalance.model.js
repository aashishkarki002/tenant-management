/**
 * tenant-balance.model.js
 *
 * Denormalized snapshot of a tenant's current outstanding balance.
 * One document per tenant. Updated atomically inside the same Mongoose
 * session as every payment / charge write.
 *
 * Source of truth for:
 *   – Dashboard "total due" chip
 *   – Property-level outstanding balance sort
 *   – Overdue tenant list
 *
 * The ledger (double-entry) remains the accountant-grade source of truth.
 * This model is the operational fast-read layer.
 */

import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const tenantBalanceSchema = new Schema(
  {
    tenant: {
      type: Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true, // one doc per tenant, always upserted
    },
    property: {
      type: Types.ObjectId,
      ref: "Property",
    },
    block: {
      type: Types.ObjectId,
      ref: "Block",
    },

    // ── Outstanding balances (INTEGER PAISA) ──────────────────────────────
    rentDuePaisa: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Must be integer paisa",
      },
    },
    camDuePaisa: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Must be integer paisa",
      },
    },
    lateFeeDuePaisa: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Must be integer paisa",
      },
    },

    // ── Denormalized total (rentDue + camDue + lateFeeDue) ────────────────
    // Set in pre-save; never written directly by callers.
    totalDuePaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Oldest unpaid period — for "overdue since" badge in UI ────────────
    oldestOverdueNepaliYear: { type: Number, default: null },
    oldestOverdueNepaliMonth: { type: Number, default: null },

    // ── Carry-forward metadata (informational only) ───────────────────────
    // How many months the tenant has had a non-zero balance consecutively.
    consecutiveUnpaidMonths: { type: Number, default: 0 },

    // ── Cross-entity breakdown (read-model, recomputed by nightly cron) ──────
    // Only populated when the tenant has outstanding balances across >1 entity
    // (e.g. after a block migration with unpaid pre-migration charges).
    // Used by the tenant profile "Legacy Balance" indicator.
    entityBreakdown: [
      {
        entityId: { type: Types.ObjectId, ref: "OwnershipEntity" },
        outstandingPaisa: { type: Number, default: 0 },
        oldestUnpaidDate: { type: String }, // BS date string "2081-09-01"
      },
    ],

    // ── Sync tracking ─────────────────────────────────────────────────────
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Pre-save: always derive totalDuePaisa ────────────────────────────────────
tenantBalanceSchema.pre("save", function () {
  this.totalDuePaisa =
    (this.rentDuePaisa || 0) +
    (this.camDuePaisa || 0) +
    (this.lateFeeDuePaisa || 0);
});

// ── Indexes ──────────────────────────────────────────────────────────────────
// Powers the property dashboard: "show tenants sorted by amount owed"
tenantBalanceSchema.index({ property: 1, totalDuePaisa: -1 });
// Powers overdue tenant list
tenantBalanceSchema.index({ totalDuePaisa: 1 });
// Support per-tenant lookup
tenantBalanceSchema.index({ tenant: 1 });

export const TenantBalance = model("TenantBalance", tenantBalanceSchema);
