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
    englishMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    englishYear: {
      type: Number,
      required: true,
    },
    rentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
      default: "pending",
    },
    units: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Unit",
        required: true,
      },
    ],
    nepaliMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    nepaliYear: {
      type: Number,
      required: true,
    },
    nepaliDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    lateFeeDate: {
      type: Date,
      default: null,
    },
    lateFeeApplied: {
      type: Boolean,
      default: false,
    },

    lateFeeStatus: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
      default: "pending",
    },
    lastPaidDate: {
      type: Date,
      default: null,
    },
    englishDueDate: {
      type: Date,
      required: true,
    },
    nepaliDueDate: {
      type: Date,
      required: true,
    },

    lastPaidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

rentSchema.virtual("remainingAmount").get(function () {
  return this.rentAmount - this.paidAmount;
});
rentSchema.set("toJSON", { virtuals: true });
rentSchema.set("toObject", { virtuals: true });

rentSchema.pre("save", function () {
  if (this.paidAmount > this.rentAmount) {
    throw new Error("Paid amount cannot be greater than rent amount");
  }
  if (this.paidAmount === 0) this.status = "pending";
  else if (this.paidAmount < this.rentAmount) this.status = "partially_paid";
  else this.status = "paid";
});

rentSchema.index(
  { tenant: 1, nepaliMonth: 1, nepaliYear: 1 },
  { unique: true }
);
rentSchema.index({ nepaliDueDate: 1 });
rentSchema.index({ tenant: 1, status: 1 });
rentSchema.index({ englishYear: 1, englishMonth: 1 });
export const Rent = mongoose.model("Rent", rentSchema);
