/**
 * FiscalYearClose.Model.js
 *
 * Tracks year-end close events per entity per fiscal year.
 * One document per (entityId, fiscalYear) — unique constraint enforced.
 *
 * Nepal fiscal year numbering:
 *   FY 2081 = Shrawan 2081 (month 4) → Ashad 2082 (month 3)
 *
 * A COMPLETED close means:
 *  - All 12 monthly periods for the FY are closed
 *  - Revenue (4xxx) and Expense (5xxx) accounts are zeroed
 *  - Net income/loss has been transferred to Retained Earnings (3100)
 *  - Income Summary (3500) is zero
 */

import mongoose from "mongoose";

const fiscalYearCloseSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    // e.g. 2081 for FY Shrawan 2081 → Ashad 2082
    fiscalYear: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },

    // Amounts computed and stored at close time — immutable after COMPLETED
    totalRevenuePaisa: { type: Number, default: 0 },
    totalExpensePaisa: { type: Number, default: 0 },
    netIncomePaisa:    { type: Number, default: 0 }, // positive = income, negative = loss

    // References to the three closing transactions posted
    revenueCloseTxId:        { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    expenseCloseTxId:        { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    retainedEarningsTxId:    { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    // When all 12 monthly periods were confirmed closed
    allPeriodsClosedAt: { type: Date },

    // Closing audit trail
    closedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    closedAt:  { type: Date },
    closeNote: { type: String, trim: true },

    // Reopen audit trail (if the close is reversed for corrections)
    reopenedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    reopenedAt:  { type: Date },
    reopenNote:  { type: String, trim: true },

    // Error details if status = FAILED
    failureReason: { type: String },
  },
  { timestamps: true },
);

// One close per entity per fiscal year
fiscalYearCloseSchema.index(
  { entityId: 1, fiscalYear: 1 },
  { unique: true },
);

export const FiscalYearClose = mongoose.model("FiscalYearClose", fiscalYearCloseSchema);
