import mongoose from "mongoose";
const transactionSchema = new mongoose.Schema(
  {
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    nepaliDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "RENT_CHARGE",
        "CAM_CHARGE",
        "PAYMENT_RECEIVED",
        "SECURITY_DEPOSIT",
        "MAINTENANCE_EXPENSE",
        "REVENUE_STREAM",
        "UTILITY_EXPENSE",
        "OTHER_INCOME",
        "OTHER_EXPENSE",
        "ADJUSTMENT",
        "CAM_PAYMENT_RECEIVED",
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "POSTED", "VOIDED"],
      default: "POSTED",
    },
    referenceType: {
      type: String,
      enum: [
        "Rent",
        "Cam",
        "SecurityDeposit",
        "CamPayment",
        "Payment",
        "Maintenance",
        "Revenue",
        "Adjustment",
        "Other",
      ],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "referenceType",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    voidedAt: {
      type: Date,
    },
    voidReason: {
      type: String,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ transactionDate: 1, type: 1 });
transactionSchema.index({ referenceType: 1, referenceId: 1 });
transactionSchema.index({ status: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
