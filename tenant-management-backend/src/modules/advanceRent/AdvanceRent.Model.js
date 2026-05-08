import mongoose from "mongoose";

const advanceRentSchema = new mongoose.Schema(
  {
    entityId:  { type: mongoose.Schema.Types.ObjectId, ref: "OwnershipEntity", required: true, index: true },
    tenant:    { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    amountPaisa: {
      type: Number, required: true, min: 1,
      validate: { validator: Number.isInteger, message: "amountPaisa must be an integer" },
    },
    recognizedAmountPaisa: { type: Number, default: 0, min: 0 },
    paymentMethod:  { type: String, enum: ["cash","bank_transfer","cheque"], required: true },
    bankAccount:    { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null },
    bankAccountCode:{ type: String, default: null },
    receiptDate:    { type: Date, required: true },
    nepaliDate:     { type: String, default: null },
    nepaliMonth:    { type: Number, required: true },
    nepaliYear:     { type: Number, required: true },
    description:    { type: String, default: null },
    status: {
      type: String,
      enum: ["ACTIVE","FULLY_RECOGNIZED","REFUNDED"],
      default: "ACTIVE",
    },
    receiptTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

export const AdvanceRent = mongoose.model("AdvanceRent", advanceRentSchema);
