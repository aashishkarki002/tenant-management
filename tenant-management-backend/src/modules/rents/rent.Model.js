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
    //
    // NAMING CONVENTION — important:
    //   grossRentAmountPaisa = GROSS rent (net + TDS). Used as the AR debit in
    //                          the RENT_CHARGE journal. Always ≥ tdsAmountPaisa.
    //   tdsAmountPaisa       = TDS withheld by tenant and remitted to government.
    //   netRentAmountPaisa (virtual) = grossRentAmountPaisa − tdsAmountPaisa
    //                        = NET cash the tenant pays to the landlord.
    //   paidAmountPaisa      = cash actually received (tracks against netRentAmountPaisa).
    //
    // Ledger flow:
    //   RENT_CHARGE:   DR AR = GROSS,  CR Revenue = GROSS
    //   TDS_WITHHELD:  DR TDS_Recoverable = TDS, CR AR = TDS  → net AR = NET
    //   PAYMENT:       DR Bank = NET,  CR AR = NET             → AR = 0
    //
    grossRentAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "grossRentAmountPaisa must be an integer",
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
    nepaliDate: { type: String, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    lateFeeDate: { type: Date, default: null },
    nepaliLateFeeDate: { type: String, default: null },
    lateFeeApplied: { type: Boolean, default: false },
    lateFeeStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },

    lastPaidDate: { type: Date, default: null },
    englishDueDate: { type: Date, required: true },
    nepaliDueDate: { type: String, required: true },

    emailReminderSent: { type: Boolean, default: false },

    /**
     * Guards against duplicate TDS withheld ledger entries.
     * Set to true after the non-cash TDS journal entry is successfully posted.
     * recordTdsLedgerEntry() checks this flag before posting.
     */
    tdsRecordedInLedger: { type: Boolean, default: false },

    /**
     * Tracks whether TDS payment to government has been verified.
     * When true, indicates tenant has confirmed payment to government authority.
     */
    tdsPaidToGovernment: { type: Boolean, default: false },

    /**
     * Date when TDS was paid to government (English/AD date).
     */
    tdsPaidDate: { type: Date, default: null },

    /**
     * Nepali BS date when TDS was paid to government (ISO format YYYY-MM-DD).
     */
    nepaliTdsPaidDate: { type: String, default: null },

    /**
     * Admin who verified the TDS payment to government.
     */
    tdsPaidVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    /**
     * Optional notes, receipt number, or reference for TDS government payment.
     */
    tdsPaidNotes: { type: String, default: null },

    /**
     * FTP path to the uploaded TDS receipt document.
     * Stores the remote path on FTP server (e.g., "/bills/{tenantId}/tds-{rentId}-{timestamp}.pdf").
     * Only populated when TDS payment to government is verified with document upload.
     */
    tdsReceiptUrl: { type: String, default: null },

    /**
     * Reference to the TdsQuarterlyPayment bucket this rent belongs to.
     * Set automatically when the TDS_WITHHELD journal is posted.
     * Null for rents with no TDS, or before migration runs.
     */
    tdsQuarterlyPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TdsQuarterlyPayment",
      default: null,
    },

    lastPaidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    carryForwardBalancePaisa: { type: Number, default: 0 },
    carryForwardFromRentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rent",
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
        grossRentAmountPaisa: {
          type: Number,
          required: true,
          validate: {
            validator: Number.isInteger,
            message: "grossRentAmountPaisa must be an integer",
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

    // ── Document numbering ─────────────────────────────────────────────────
    /**
     * Human-readable invoice number. Generated by documentNumber.service.js.
     * Format: INV-{FISCAL_YEAR}-{SEQ}  e.g. "INV-2082-000001"
     * null on legacy records (backfill via migration 002).
     */
    documentNumber: {
      type: String,
      default: null,
      index: { sparse: true },
    },

    // ── Ledger posting audit ───────────────────────────────────────────────
    /**
     * Ledger posting lifecycle status:
     *   DRAFT   — rent created but RENT_CHARGE journal not yet posted
     *   POSTED  — RENT_CHARGE + TDS_WITHHELD journals successfully posted
     *   VOIDED  — reversed via journal reversal entries; original immutable
     */
    postingStatus: {
      type: String,
      enum: ["DRAFT", "POSTED", "VOIDED"],
      default: "POSTED",
      index: true,
    },

    /** Timestamp when the RENT_CHARGE journal was posted. */
    postedAt: {
      type: Date,
      default: null,
    },

    /** Admin who triggered the ledger post. */
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    /** Timestamp if this rent bill was voided. */
    voidedAt: {
      type: Date,
      default: null,
    },

    /** Admin who voided this rent bill. */
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    /** Reason for voiding. */
    voidReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

rentSchema.virtual("netRentAmountPaisa").get(function () {
  return this.grossRentAmountPaisa - (this.tdsAmountPaisa || 0);
});
rentSchema.virtual("netRentAmount").get(function () {
  return paisaToRupees(this.netRentAmountPaisa);
});

rentSchema.virtual("remainingAmountPaisa").get(function () {
  return (
    this.grossRentAmountPaisa - (this.tdsAmountPaisa || 0) - this.paidAmountPaisa
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

rentSchema.virtual("grossRentAmountFormatted").get(function () {
  return formatMoney(this.grossRentAmountPaisa);
});
rentSchema.virtual("tdsAmountFormatted").get(function () {
  return formatMoney(this.tdsAmountPaisa);
});
rentSchema.virtual("paidAmountFormatted").get(function () {
  return formatMoney(this.paidAmountPaisa);
});

rentSchema.set("toJSON", { virtuals: true, getters: false });
rentSchema.set("toObject", { virtuals: true, getters: false });

// ── Pre-validate hook ─────────────────────────────────────────────────────────
// BUG-10 FIX: Round paisa values BEFORE validation runs
rentSchema.pre("validate", function () {
  for (const field of [
    "grossRentAmountPaisa",
    "tdsAmountPaisa",
    "paidAmountPaisa",
    "lateFeePaisa",
    "latePaidAmountPaisa",
  ]) {
    if (this[field] != null && !Number.isInteger(this[field])) {
      this[field] = Math.round(this[field]);
    }
  }

  // Also round unit breakdown paisa values
  if (this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    this.unitBreakdown.forEach((ub) => {
      for (const field of [
        "grossRentAmountPaisa",
        "tdsAmountPaisa",
        "paidAmountPaisa",
      ]) {
        if (ub[field] != null && !Number.isInteger(ub[field])) {
          ub[field] = Math.round(ub[field]);
        }
      }
    });
  }
});

// ── Pre-save hook ─────────────────────────────────────────────────────────────

rentSchema.pre("save", function () {
  // Sync root fields from unit breakdown
  if (this.useUnitBreakdown && this.unitBreakdown?.length > 0) {
    this.grossRentAmountPaisa = this.unitBreakdown.reduce(
      (s, u) => s + (u.grossRentAmountPaisa || 0),
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
      const effectiveUnit = ub.grossRentAmountPaisa - (ub.tdsAmountPaisa || 0);
      if (ub.paidAmountPaisa === 0) ub.status = "pending";
      else if (ub.paidAmountPaisa >= effectiveUnit) ub.status = "paid";
      else ub.status = "partially_paid";
    });
  }

  // BUG-04 FIX: Calculate rent status but handle 'overdue' carefully
  const effectiveRentPaisa = this.grossRentAmountPaisa - (this.tdsAmountPaisa || 0);
  const remainingRentPaisa = effectiveRentPaisa - this.paidAmountPaisa;
  const remainingLateFee =
    (this.lateFeePaisa || 0) - (this.latePaidAmountPaisa || 0);
  const totalDue = remainingRentPaisa + remainingLateFee;

  // Calculate the new status based on payment state
  if (totalDue <= 0) {
    // Everything paid (rent + late fees)
    this.status = "paid";
  } else if (this.paidAmountPaisa === 0 && this.status !== "overdue") {
    // Nothing paid yet and not already marked overdue
    this.status = "pending";
  } else if (
    this.status === "overdue" &&
    remainingRentPaisa > 0 &&
    this.paidAmountPaisa === 0
  ) {
    // BUG-04: Preserve 'overdue' when no payment has been made on an overdue rent
    // (keep status as 'overdue')
  } else if (remainingRentPaisa > 0) {
    // Some rent still unpaid but some payment made
    this.status = this.status === "overdue" ? "overdue" : "partially_paid";
  } else if (remainingLateFee > 0) {
    // Rent fully paid but late fees remain
    this.status = "partially_paid";
  }

  // Late fee status
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
rentSchema.index({ tenant: 1, status: 1 });
rentSchema.index({ englishYear: 1, englishMonth: 1 });
rentSchema.index({ englishDueDate: 1 });
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

  const effective = ub.grossRentAmountPaisa - (ub.tdsAmountPaisa || 0);
  const remaining = effective - ub.paidAmountPaisa;

  return {
    status: ub.status,
    paidAmountPaisa: ub.paidAmountPaisa,
    remainingAmountPaisa: remaining,
    grossRentAmountPaisa: ub.grossRentAmountPaisa,
    tdsAmountPaisa: ub.tdsAmountPaisa,
    paidAmount: paisaToRupees(ub.paidAmountPaisa),
    remainingAmount: paisaToRupees(remaining),
    grossRentAmount: paisaToRupees(ub.grossRentAmountPaisa),
    tdsAmount: paisaToRupees(ub.tdsAmountPaisa),
  };
};

rentSchema.methods.getFinancialSummary = function () {
  return {
    paisa: {
      grossRentAmount: this.grossRentAmountPaisa,
      tdsAmount: this.tdsAmountPaisa,
      netRentAmount: this.netRentAmountPaisa,
      paidAmount: this.paidAmountPaisa,
      remainingAmount: this.remainingAmountPaisa,
      lateFee: this.lateFeePaisa || 0,
      latePaid: this.latePaidAmountPaisa || 0,
      remainingLateFee: this.remainingLateFeePaisa,
      totalDue: this.totalDuePaisa,
    },
    formatted: {
      grossRentAmount: formatMoney(this.grossRentAmountPaisa),
      tdsAmount: formatMoney(this.tdsAmountPaisa),
      netRentAmount: formatMoney(this.netRentAmountPaisa),
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
/**
 * Get rents due within an English date range that still have an outstanding balance.
 *
 * Unlike getRentsDueWithinPeriod (Nepali calendar), this queries englishDueDate
 * directly — no Nepali date conversion needed at the call site.
 *
 * @param {Date} startDate  - start of window, time zeroed (midnight)
 * @param {Date} endDate    - end of window, time set to 23:59:59.999
 * @param {number} limit    - max results (default 10)
 * @returns {Promise<Array>}
 */
rentSchema.statics.getRentsDueWithinEnglishPeriod = async function (
  startDate,
  endDate,
  limit = 10,
) {
  return this.aggregate([
    {
      $match: {
        englishDueDate: { $gte: startDate, $lte: endDate },
        $expr: {
          $gt: [{ $subtract: ["$grossRentAmountPaisa", "$paidAmountPaisa"] }, 0],
        },
      },
    },
    { $sort: { englishDueDate: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant",
        foreignField: "_id",
        as: "tenant",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        remainingPaisa: {
          $subtract: [
            {
              $subtract: [
                "$grossRentAmountPaisa",
                { $ifNull: ["$tdsAmountPaisa", 0] },
              ],
            },
            "$paidAmountPaisa",
          ],
        },
      },
    },
    {
      $project: {
        tenant: 1,
        property: 1,
        grossRentAmountPaisa: 1,
        paidAmountPaisa: 1,
        tdsAmountPaisa: 1,
        englishDueDate: 1,
        nepaliDueDate: 1,
        nepaliMonth: 1,
        nepaliYear: 1,
        englishMonth: 1,
        englishYear: 1,
        status: 1,
        remainingPaisa: 1,
      },
    },
  ]);
};

export const Rent = mongoose.model("Rent", rentSchema);
