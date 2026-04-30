import mongoose, { Schema } from "mongoose";

/**
 * EventExpense — money we spend to run an event (stage, decorations, security, etc.).
 *
 * Journal on creation:
 *   DR  expenseAccountCode   amountPaisa   (EXPENSE ↑)
 *   CR  Cash/Bank            amountPaisa   (ASSET ↓)
 */
const eventExpenseSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    entityId: { type: Schema.Types.ObjectId, ref: "OwnershipEntity", required: true },
    description: { type: String, required: true, trim: true },

    amountPaisa: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true },
    nepaliDate: { type: String, default: null },  // BS "YYYY-MM-DD"
    nepaliMonth: { type: Number, default: null },
    nepaliYear: { type: Number, default: null },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque"],
      required: true,
    },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount", default: null },

    // Defaults to EVENT_EXPENSE ("5450"); override with a more specific expense code if needed
    expenseAccountCode: { type: String, default: "5450" },

    referenceNumber: { type: String, default: null },
    notes: { type: String, default: null },

    recordedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    journalId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
  },
  { timestamps: true },
);

eventExpenseSchema.index({ event: 1, expenseDate: -1 });

export default mongoose.model("EventExpense", eventExpenseSchema);
