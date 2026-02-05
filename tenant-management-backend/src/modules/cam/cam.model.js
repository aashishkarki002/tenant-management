import mongoose from "mongoose";

const camSchema = new mongoose.Schema(
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
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
      default: "pending",
    },
    paidDate: { type: Date, default: null },
    notes: { type: String, default: "" },
    emailReminderSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate CAM entries for same tenant + month/year
camSchema.index({ tenant: 1, nepaliMonth: 1, nepaliYear: 1 }, { unique: true });
camSchema.virtual("remainingAmount").get(function () {
  return this.amount - this.paidAmount;
});
camSchema.pre("save", function () {
  if (this.paidAmount > this.amount) {
    throw new Error("Paid amount cannot exceed CAM amount");
  }

  if (this.paidAmount === 0) {
    this.status = "pending";
  } else if (this.paidAmount >= this.amount) {
    this.status = "paid";
  } else {
    this.status = "partially_paid";
  }
});


export const Cam = mongoose.model("Cam", camSchema);
