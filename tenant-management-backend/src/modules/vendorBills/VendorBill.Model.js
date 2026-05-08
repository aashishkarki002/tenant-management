import mongoose from "mongoose";

const vendorBillSchema = new mongoose.Schema(
  {
    entityId:    { type: mongoose.Schema.Types.ObjectId, ref: "OwnershipEntity", required: true, index: true },
    vendor:      { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName:  { type: String, required: true, trim: true },
    billNumber:  { type: String, default: null, trim: true },
    billDate:    { type: Date, required: true },
    dueDate:     { type: Date, default: null },
    nepaliDate:  { type: String, default: null },
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear:  { type: Number, required: true },
    amountPaisa: {
      type: Number, required: true, min: 1,
      validate: { validator: Number.isInteger, message: "amountPaisa must be an integer" },
    },
    expenseAccountCode: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    paidAmountPaisa:   { type: Number, default: 0, min: 0 },
    tdsDeductedPaisa:  { type: Number, default: 0, min: 0 },
    paymentMethod:     { type: String, enum: ["cash","bank_transfer","cheque"], default: null },
    bankAccount:       { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null },
    bankAccountCode:   { type: String, default: null },
    paidAt:            { type: Date, default: null },
    paidBy:            { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    notes:             { type: String, default: null },
    createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    billTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    paymentTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
  },
  { timestamps: true },
);

vendorBillSchema.index({ entityId: 1, status: 1 });
vendorBillSchema.index({ entityId: 1, nepaliYear: 1, nepaliMonth: 1 });

export const VendorBill = mongoose.model("VendorBill", vendorBillSchema);
