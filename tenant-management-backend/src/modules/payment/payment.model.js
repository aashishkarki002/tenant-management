import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema({
  rent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rent",
    required: true,
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BankAccount",
    required: false,
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    required: true,
  },
  nepaliDate: {
    type: Date,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["cheque", "bank_transfer", "cash"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
    default: "pending",
  },
  receipt: {
    url: String,
    publicId: String,
    generatedAt: Date,
  },
  bankVerifiedDate: {
    type: Date,
    required: false,
  },
  receiptGeneratedDate: {
    type: Date,
    required: false,
  },
  note: {
    type: String,
    required: false,
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
});
export const Payment = mongoose.model("Payment", paymentSchema);
