/**
 * AuditLog.Model.js
 *
 * Append-only, immutable event log for ALL accounting actions.
 * Provides IRD-compliant audit trail: who did what, when, before/after.
 *
 * IMMUTABILITY RULES:
 *  - performedAt is marked immutable (cannot be updated after insert)
 *  - No update or delete routes are ever mounted for this collection
 *  - auditService.log() is the sole write path — no direct model calls elsewhere
 *
 * Usage:
 *   import { auditService } from "../audit/audit.service.js";
 *   await auditService.log("TRANSACTION_CREATED", req.admin.id, { ... });
 */

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        "TRANSACTION_CREATED",
        "TRANSACTION_VOIDED",
        "TRANSACTION_REVERSED",
        "PERIOD_CLOSED",
        "PERIOD_REOPENED",
        "YEAR_END_CLOSED",
        "YEAR_END_REOPENED",
        "TENANT_VACATED",
        "LEDGER_LOCKED",
        "ADJUSTMENT_POSTED",
        "DEBIT_NOTE_POSTED",
        "CREDIT_NOTE_POSTED",
        "BUDGET_CREATED",
        "BUDGET_UPDATED",
        "ACCOUNT_BALANCE_REBUILT",
      ],
      required: true,
    },

    // Who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // When — immutable after insert
    performedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },

    // Which entity was affected
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
    },

    // What resource was changed
    resourceType: {
      type: String, // e.g. "Transaction", "ClosedPeriod", "Account"
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // State snapshots — plain objects, no circular refs
    before: { type: mongoose.Schema.Types.Mixed },
    after:  { type: mongoose.Schema.Types.Mixed },

    // Financial context
    amountPaisa: { type: Number },

    // Human context
    reason:    { type: String, trim: true },
    ipAddress: { type: String },
    userAgent: { type: String },

    // Nepali calendar period
    nepaliYear:  { type: Number },
    nepaliMonth: { type: Number },
  },
  {
    // No createdAt/updatedAt — performedAt is the single timestamp
    timestamps: false,
    // Prevent accidental saves of unknown fields
    strict: true,
  },
);

auditLogSchema.index({ entityId: 1, performedAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ performedBy: 1, performedAt: -1 });
auditLogSchema.index({ eventType: 1, performedAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
