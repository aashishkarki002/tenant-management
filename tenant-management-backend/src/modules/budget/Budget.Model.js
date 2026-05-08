import mongoose from "mongoose";

/**
 * Budget — planned amounts per account per fiscal year.
 * Unique constraint: (entityId, fiscalYear, accountCode) — one budget line per account per year.
 */
const budgetSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },
    fiscalYear: { type: Number, required: true },           // BS year e.g. 2081
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"], required: true },
    budgetedAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "budgetedAmountPaisa must be an integer" },
    },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

budgetSchema.index({ entityId: 1, fiscalYear: 1, accountCode: 1 }, { unique: true });

export const Budget = mongoose.model("Budget", budgetSchema);
