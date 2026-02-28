/**
 * rent.Model.js
 *
 * Changes in this revision:
 *
 * NEW INDEX — { nepaliYear, nepaliMonth, status, property }:
 *   Every filtered call to GET /api/rent/get-rents uses some combination of
 *   these four fields. Without a covering compound index MongoDB performs a
 *   full collection scan on large datasets. The index is ordered so that:
 *     1. nepaliYear + nepaliMonth together select a narrow time slice first
 *        (highest cardinality pair for a monthly-billing system).
 *     2. status further trims the slice (e.g. overdue-only view).
 *     3. property is appended last for the property-dropdown filter; queries
 *        that omit it still benefit from the first three fields.
 *
 *   The pre-existing { tenant, nepaliMonth, nepaliYear } unique index is
 *   retained — it guards idempotency in handleMonthlyRents.
 *
 * All schema fields, virtuals, pre-save hook, and instance methods are
 * unchanged from the previous revision.
 */

import mongoose from "mongoose";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";

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

    englishMonth: { type: Number, required: true, min: 1, max: 12 },
    englishYear: { type: Number, required: true },

    // Backward-compat getter only — never store via this field
    lateFee: {
      type: Number,
      get: function () {
        return this.lateFeePaisa ? paisaToRupees(this.lateFeePaisa) : 0;
      },
    },

    // ── Primary financial fields (INTEGER PAISA) ─────────────────────────
    rentAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "rentAmountPaisa must be an integer",
      },
    },
    paidAmountPaisa: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "paidAmountPaisa must be an integer",
      },
    },
    tdsAmountPaisa: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "tdsAmountPaisa must be an integer",
      },
    },
    lateFeePaisa: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "lateFeePaisa must be an integer",
      },
    },
    latePaidAmountPaisa: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "latePaidAmountPaisa must be an integer",
      },
    },

    // ── Status & metadata ────────────────────────────────────────────────
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
      { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    ],

    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear: { type: Number, required: true },
    nepaliDate: { type: Date, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    lateFeeDate: { type: Date, default: null },
    lateFeeApplied: { type: Boolean, default: false },
    lateFeeStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },

    lastPaidDate: { type: Date, default: null },
    englishDueDate: { type: Date, required: true },
    nepaliDueDate: { type: Date, required: true },

    emailReminderSent: { type: Boolean, default: false },
    lastPaidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // ── Unit breakdown ───────────────────────────────────────────────────
    unitBreakdown: [
      {
        unit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Unit",
          required: true,
        },
        rentAmountPaisa: {
          type: Number,
          required: true,
          validate: {
            validator: Number.isInteger,
            message: "rentAmountPaisa must be an integer",
          },
        },
        tdsAmountPaisa: {
          type: Number,
          default: 0,
          validate: {
            validator: Number.isInteger,
            message: "tdsAmountPaisa must be an integer",
          },
        },
        paidAmountPaisa: {
          type: Number,
          default: 0,
          validate: {
            validator: Number.isInteger,
            message: "paidAmountPaisa must be an integer",
          },
        },
        status: {
          type: String,
          enum: ["pending", "paid", "partially_paid", "overdue"],
          default: "pending",
        },
        pricePerSqft: { type: Number },
        sqft: { type: Number },
        camRate: { type: Number },
      },
    ],
    useUnitBreakdown: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

rentSchema.virtual("effectiveRentPaisa").get(function () {
  return this.rentAmountPaisa - (this.tdsAmountPaisa || 0);
});
rentSchema.virtual("effectiveRent").get(function () {
  return paisaToRupees(this.effectiveRentPaisa);
});

rentSchema.virtual("remainingAmountPaisa").get(function () {
  return (
    this.rentAmountPaisa - (this.tdsAmountPaisa || 0) - this.paidAmountPaisa
  );
});
rentSchema.virtual("remainingAmount").get(function () {
  return paisaToRupees(this.remainingAmountPaisa);
});

rentSchema.virtual("remainingLateFeePaisa").get(function () {
  return (this.lateFeePaisa || 0) - (this.latePaidAmountPaisa || 0);
});
rentSchema.virtual("remainingLateFee").get(function () {
  return paisaToRupees(this.remainingLateFeePaisa);
});

rentSchema.virtual("totalDuePaisa").get(function () {
  return (
    Math.max(0, this.remainingAmountPaisa) +
    Math.max(0, this.remainingLateFeePaisa)
  );
});
rentSchema.virtual("totalDue").get(function () {
  return paisaToRupees(this.totalDuePaisa);
});

rentSchema.virtual("rentAmountFormatted").get(function () {
  return formatMoney(this.rentAmountPaisa);
});
rentSchema.virtual("tdsAmountFormatted").get(function () {
  return formatMoney(this.tdsAmountPaisa);
});
rentSchema.virtual("paidAmountFormatted").get(function () {
  return formatMoney(this.paidAmountPaisa);
});

rentSchema.set("toJSON", { virtuals: true, getters: false });
rentSchema.set("toObject", { virtuals: true, getters: false });

// ── Pre-save hook ─────────────────────────────────────────────────────────────

rentSchema.pre("save", function () {
  // Coerce to integers (safety net)
  for (const field of [
    "rentAmountPaisa",
    "tdsAmountPaisa",
    "paidAmountPaisa",
    "lateFeePaisa",
    "latePaidAmountPaisa",
  ]) {
    if (this[field] != null && !Number.isInteger(this[field])) {
      this[field] = Math.round(this[field]);
    }
  }

  // Sync root fields from unit breakdown
  if (this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    this.rentAmountPaisa = this.unitBreakdown.reduce(
      (s, u) => s + (u.rentAmountPaisa || 0),
      0,
    );
    this.paidAmountPaisa = this.unitBreakdown.reduce(
      (s, u) => s + (u.paidAmountPaisa || 0),
      0,
    );
    this.tdsAmountPaisa = this.unitBreakdown.reduce(
      (s, u) => s + (u.tdsAmountPaisa || 0),
      0,
    );

    this.unitBreakdown.forEach((ub) => {
      const effectiveUnit = ub.rentAmountPaisa - (ub.tdsAmountPaisa || 0);
      if (ub.paidAmountPaisa === 0) ub.status = "pending";
      else if (ub.paidAmountPaisa >= effectiveUnit) ub.status = "paid";
      else ub.status = "partially_paid";
    });
  }

  // Rent status
  const effectiveRentPaisa = this.rentAmountPaisa - (this.tdsAmountPaisa || 0);
  if (this.paidAmountPaisa === 0) this.status = "pending";
  else if (this.paidAmountPaisa >= effectiveRentPaisa) this.status = "paid";
  else this.status = "partially_paid";

  // Late fee status
  const remainingLateFee =
    (this.lateFeePaisa || 0) - (this.latePaidAmountPaisa || 0);

  if (!this.lateFeePaisa || this.lateFeePaisa === 0) {
    this.lateFeeStatus = "pending";
    this.lateFeeApplied = false;
  } else {
    this.lateFeeStatus = remainingLateFee <= 0 ? "paid" : "pending";
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Idempotency guard for monthly rent creation
rentSchema.index(
  { tenant: 1, nepaliMonth: 1, nepaliYear: 1 },
  { unique: true },
);

/**
 * NEW — compound index for filtered GET /api/rent/get-rents queries.
 *
 * Field order rationale:
 *   nepaliYear + nepaliMonth  → narrow to a single billing period first
 *                               (highest combined selectivity in normal use)
 *   status                    → further trims the slice for status filter
 *   property                  → appended for property-dropdown filter;
 *                               prefix queries (year+month or year+month+status)
 *                               still benefit from the index
 *
 * This replaces what would otherwise be a full collection scan for every
 * page load of the Rent tab.
 */
rentSchema.index({ nepaliYear: 1, nepaliMonth: 1, status: 1, property: 1 });

// Supporting indexes (retained from previous revision)
rentSchema.index({ nepaliDueDate: 1 });
rentSchema.index({ tenant: 1, status: 1 });
rentSchema.index({ englishYear: 1, englishMonth: 1 });
rentSchema.index({ "unitBreakdown.unit": 1 });
rentSchema.index({ useUnitBreakdown: 1 });
rentSchema.index({ status: 1, lateFeeApplied: 1 }); // lateFee.cron queries

// ── Instance methods ──────────────────────────────────────────────────────────

rentSchema.methods.applyPayment = function (
  amountPaisa,
  paymentDate,
  receivedBy,
  unitPayments = null,
) {
  this.paidAmountPaisa += amountPaisa;
  this.lastPaidDate = paymentDate;
  this.lastPaidBy = receivedBy;

  if (unitPayments && this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    unitPayments.forEach(({ unitId, amountPaisa: unitAmt }) => {
      const ub = this.unitBreakdown.find(
        (u) => u.unit.toString() === unitId.toString(),
      );
      if (ub) ub.paidAmountPaisa += unitAmt;
    });
  }
  // Status sync happens in pre-save hook
};

rentSchema.methods.applyLateFeePayment = function (
  amountPaisa,
  paymentDate,
  receivedBy,
) {
  this.latePaidAmountPaisa = (this.latePaidAmountPaisa || 0) + amountPaisa;
  this.lastPaidDate = paymentDate;
  this.lastPaidBy = receivedBy;
  // lateFeeStatus derived in pre-save
};

rentSchema.methods.getUnitPaymentStatus = function (unitId) {
  if (!this.useUnitBreakdown || !this.unitBreakdown?.length) return null;
  const ub = this.unitBreakdown.find(
    (u) => u.unit.toString() === unitId.toString(),
  );
  if (!ub) return null;

  const effective = ub.rentAmountPaisa - (ub.tdsAmountPaisa || 0);
  const remaining = effective - ub.paidAmountPaisa;

  return {
    status: ub.status,
    paidAmountPaisa: ub.paidAmountPaisa,
    remainingAmountPaisa: remaining,
    rentAmountPaisa: ub.rentAmountPaisa,
    tdsAmountPaisa: ub.tdsAmountPaisa,
    paidAmount: paisaToRupees(ub.paidAmountPaisa),
    remainingAmount: paisaToRupees(remaining),
    rentAmount: paisaToRupees(ub.rentAmountPaisa),
    tdsAmount: paisaToRupees(ub.tdsAmountPaisa),
  };
};

rentSchema.methods.getFinancialSummary = function () {
  return {
    paisa: {
      rentAmount: this.rentAmountPaisa,
      tdsAmount: this.tdsAmountPaisa,
      effectiveRent: this.effectiveRentPaisa,
      paidAmount: this.paidAmountPaisa,
      remainingAmount: this.remainingAmountPaisa,
      lateFee: this.lateFeePaisa || 0,
      latePaid: this.latePaidAmountPaisa || 0,
      remainingLateFee: this.remainingLateFeePaisa,
      totalDue: this.totalDuePaisa,
    },
    formatted: {
      rentAmount: formatMoney(this.rentAmountPaisa),
      tdsAmount: formatMoney(this.tdsAmountPaisa),
      effectiveRent: formatMoney(this.effectiveRentPaisa),
      paidAmount: formatMoney(this.paidAmountPaisa),
      remainingAmount: formatMoney(this.remainingAmountPaisa),
      lateFee: formatMoney(this.lateFeePaisa || 0),
      latePaid: formatMoney(this.latePaidAmountPaisa || 0),
      remainingLateFee: formatMoney(this.remainingLateFeePaisa),
      totalDue: formatMoney(this.totalDuePaisa),
    },
    status: this.status,
    lateFeeStatus: this.lateFeeStatus,
    rentFrequency: this.rentFrequency,
  };
};

export const Rent = mongoose.model("Rent", rentSchema);
