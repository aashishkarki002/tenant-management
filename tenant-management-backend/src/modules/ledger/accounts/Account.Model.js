import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["ASSET", "LIABILITY", "REVENUE", "EXPENSE", "EQUITY"],
      required: true,
    },
    parentAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Note: code field already has unique: true which creates an index
accountSchema.index({ type: 1, isActive: 1 });

export const Account = mongoose.model("Account", accountSchema);
