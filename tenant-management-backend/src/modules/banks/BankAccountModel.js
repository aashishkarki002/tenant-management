import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },
    balance: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export default mongoose.model("BankAccount", bankAccountSchema);
