/**
 * Adjustment.Model.js
 *
 * Stores accountant correction notes:
 *  - DEBIT_NOTE    — increases tenant AR (missed billing, underbilling)
 *  - CREDIT_NOTE   — decreases tenant AR (billing error, goodwill)
 *  - MANUAL_JOURNAL — free-form double-entry correction
 *
 * Every adjustment must have a mandatory reason for audit trail.
 * Adjustments reference the original transaction they are correcting (optional but recommended).
 */

import mongoose from "mongoose";

const adjustmentSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["DEBIT_NOTE", "CREDIT_NOTE", "MANUAL_JOURNAL"],
      required: true,
    },

    // The original transaction this adjustment corrects (optional but recommended)
    originalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    // Mandatory documentation
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Nepali calendar
    nepaliDate:  { type: String }, // "YYYY-MM-DD" BS
    nepaliMonth: { type: Number, min: 1, max: 12 },
    nepaliYear:  { type: Number },
    transactionDate: { type: Date },

    // Amount (for DEBIT_NOTE and CREDIT_NOTE)
    amountPaisa: { type: Number },

    // For MANUAL_JOURNAL — store the raw entries for audit
    manualEntries: [
      {
        accountCode:       { type: String },
        debitAmountPaisa:  { type: Number },
        creditAmountPaisa: { type: Number },
        description:       { type: String },
      },
    ],

    // Revenue account used (for DEBIT_NOTE/CREDIT_NOTE)
    revenueAccountCode: { type: String },

    // The resulting Transaction posted
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    // Approval state
    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "REJECTED"],
      default: "APPROVED",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // Optional scope
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
);

adjustmentSchema.index({ entityId: 1, createdAt: -1 });
adjustmentSchema.index({ tenant: 1, createdAt: -1 });
adjustmentSchema.index({ type: 1, entityId: 1 });

export const Adjustment = mongoose.model("Adjustment", adjustmentSchema);
