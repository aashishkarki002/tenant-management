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
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    rentAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);
rentSchema.index({ tenant: 1, month: 1, year: 1 }, { unique: true });
export const Rent = mongoose.model("Rent", rentSchema);
