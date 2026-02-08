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
    tdsAmount: {
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
    rentFrequency: {
      type: String,
      enum: ["monthly", "quarterly"],
      default: "monthly",
      required: true,
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
    emailReminderSent: {
      type: Boolean,
      default: false,
    },
    unitBreakdown: [
      {
        unit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Unit",
          required: true,
        },
        // Rent details for this specific unit
        rentAmount: { type: Number, required: true },
        tdsAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },

        // Status for this unit
        status: {
          type: String,
          enum: ["pending", "paid", "partially_paid", "overdue"],
          default: "pending",
        },

        // Lease snapshot at time of rent generation
        pricePerSqft: { type: Number },
        sqft: { type: Number },
        camRate: { type: Number },
      },
    ],

    //  Flag to indicate if this uses new unit-based system
    useUnitBreakdown: { type: Boolean, default: false },

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
  if (this.paidAmount > this.rentAmount - this.tdsAmount) {
    throw new Error("Paid amount cannot be greater than rent amount after tds");
  }
  const effectiveRentAmount = this.rentAmount - (this.tdsAmount || 0);
  if (this.paidAmount === 0) {
    this.status = "pending";
  } else if (this.paidAmount >= effectiveRentAmount) {
    this.status = "paid";
  } else {
    this.status = "partially_paid";
  }

  if (this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    this.unitBreakdown.forEach((ub) => {
      const effectiveAmount = ub.rentAmount - (ub.tdsAmount || 0);
      if (ub.paidAmount === 0) {
        ub.status = "pending";
      } else if (ub.paidAmount >= effectiveAmount) {
        ub.status = "paid";
      } else {
        ub.status = "partially_paid";
      }
    });
  }
});

rentSchema.index(
  { tenant: 1, nepaliMonth: 1, nepaliYear: 1 },
  { unique: true }
);
rentSchema.index({ nepaliDueDate: 1 });
rentSchema.index({ tenant: 1, status: 1 });
rentSchema.index({ englishYear: 1, englishMonth: 1 });
rentSchema.index({ "unitBreakdown.unit": 1 });
rentSchema.index({ useUnitBreakdown: 1 });
rentSchema.methods.applyPayment = function (
  amount,
  paymentDate,
  receivedBy,
  unitPayments = null
) {
  this.paidAmount += amount;
  this.lastPaidDate = paymentDate;
  this.lastPaidBy = receivedBy;

  // If unit payments specified and we're using breakdown
  if (unitPayments && this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    unitPayments.forEach(({ unitId, amount: unitAmount }) => {
      const unitEntry = this.unitBreakdown.find(
        (ub) => ub.unit.toString() === unitId.toString()
      );
      if (unitEntry) {
        unitEntry.paidAmount += unitAmount;
      }
    });
  }
};

// 👇 NEW METHOD: Get payment status for specific unit
rentSchema.methods.getUnitPaymentStatus = function (unitId) {
  if (!this.useUnitBreakdown || !this.unitBreakdown?.length) {
    return null;
  }

  const unitEntry = this.unitBreakdown.find(
    (ub) => ub.unit.toString() === unitId.toString()
  );

  if (!unitEntry) {
    return null;
  }

  const effectiveAmount = unitEntry.rentAmount - (unitEntry.tdsAmount || 0);

  return {
    status: unitEntry.status,
    paidAmount: unitEntry.paidAmount,
    remainingAmount: effectiveAmount - unitEntry.paidAmount,
    rentAmount: unitEntry.rentAmount,
    tdsAmount: unitEntry.tdsAmount,
  };
};
export const Rent = mongoose.model("Rent", rentSchema);
