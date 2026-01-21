import mongoose from "mongoose";

const sdSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    },
    innerBlock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InnerBlock",
      required: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
  nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
  nepaliYear: { type: Number, required: true },
  nepaliDate: { type: Date, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "overdue"],
      default: "pending",
    },
    paidDate: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate SD entries for same tenant + month/year
sdSchema.index({ tenant: 1, nepaliMonth: 1, nepaliYear: 1 }, { unique: true });

export const Sd = mongoose.model("Sd", sdSchema);
