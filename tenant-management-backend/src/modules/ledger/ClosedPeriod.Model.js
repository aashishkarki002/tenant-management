/**
 * ClosedPeriod.Model.js
 *
 * Tracks which BS month/year periods are locked for an OwnershipEntity.
 * A closed period rejects new journal postings, ensuring historical numbers
 * cannot be altered after sign-off.
 *
 * Closing is per-entity so different entities can be on different close schedules.
 * Reopening is allowed (with audit log) for corrections under admin authorization.
 */

import mongoose from "mongoose";

const closedPeriodSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },
    nepaliYear: {
      type: Number,
      required: true,
    },
    nepaliMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    isClosed: {
      type: Boolean,
      default: true,
    },
    // Who closed the period
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    closedAt: {
      type: Date,
      default: Date.now,
    },
    closeNote: {
      type: String,
      trim: true,
    },
    // Last reopen record (overwritten each reopen)
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reopenedAt: {
      type: Date,
    },
    reopenNote: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// One record per (entity, year, month) — upserted on close/reopen
closedPeriodSchema.index(
  { entityId: 1, nepaliYear: 1, nepaliMonth: 1 },
  { unique: true },
);

export const ClosedPeriod = mongoose.model("ClosedPeriod", closedPeriodSchema);
