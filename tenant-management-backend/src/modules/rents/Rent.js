import mongoose from "mongoose";
const rentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    innerBlock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InnerBlock",
      required: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    rentAmount: { type: Number, required: true },
    paidAmount: { type: Number, required: true },
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      required: true,
    },
    month: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "partially_paid"],
      default: "pending",
    },
    paymentDate: { type: Date, required: true },
    note: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    paymentmethod: {
      type: String,
      enum: ["cash", "bank", "cheque"],
      default: "cash",
    },
    paymentProof: { type: String, required: true },
  },
  { timestamps: true }
);
export default mongoose.model("Rent", rentSchema);
