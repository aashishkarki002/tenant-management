import mongoose from "mongoose";

const ownerDistributionSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: "OwnershipEntity", required: true, index: true },
    amountPaisa: {
      type: Number, required: true, min: 1,
      validate: { validator: Number.isInteger, message: "amountPaisa must be an integer" },
    },
    paymentMethod: { type: String, enum: ["cash","bank_transfer","cheque"], required: true },
    bankAccount:   { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null },
    bankAccountCode: { type: String, default: null },
    distributionDate: { type: Date, required: true },
    nepaliDate:       { type: String, default: null },
    nepaliMonth:      { type: Number, required: true, min: 1, max: 12 },
    nepaliYear:       { type: Number, required: true },
    description:      { type: String, default: null },
    transactionId:    { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

export const OwnerDistribution = mongoose.model("OwnerDistribution", ownerDistributionSchema);
