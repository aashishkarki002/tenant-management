import mongoose from "mongoose";
const ledgerEntrySchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    debitAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      required: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    nepaliMonth: {
      type: Number,
      required: true,
    },
    nepaliYear: {
      type: Number,
      required: true,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// Ensure either debit or credit is present, not both
// Using async function for better compatibility with Mongoose sessions
ledgerEntrySchema.pre("save", async function () {
  // Validate that either debit or credit is present, but not both
  if (this.debitAmount > 0 && this.creditAmount > 0) {
    throw new Error("Entry cannot have both debit and credit amounts");
  }
  if (this.debitAmount === 0 && this.creditAmount === 0) {
    throw new Error("Entry must have either debit or credit amount");
  }
});
ledgerEntrySchema.index({ nepaliMonth: 1, nepaliYear: 1 });
ledgerEntrySchema.index({ transaction: 1, account: 1 });
ledgerEntrySchema.index({ tenant: 1, transactionDate: -1 });
ledgerEntrySchema.index({ property: 1, transactionDate: -1 });

export const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);
