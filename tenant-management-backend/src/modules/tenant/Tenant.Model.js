import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    // Basic tenant info
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },

    // Documents
    documents: [
      {
        type: {
          type: String,
          required: true,
        },
        files: [
          {
            url: String,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],

    // Units and pricing
    units: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Unit",
        required: true,
      },
    ],
    pricePerSqft: { type: Number, required: true },
    leasedSquareFeet: { type: Number, required: true },
    camRatePerSqft: { type: Number, required: true },

    // Dates
    dateOfAgreementSigned: { type: Date, required: true },
    leaseStartDate: { type: Date, required: true },
    leaseEndDate: { type: Date, required: true },
    keyHandoverDate: { type: Date, required: true },
    spaceHandoverDate: { type: Date, default: null },
    spaceReturnedDate: { type: Date, default: null },

    // Financials
    tds: { type: Number, default: 0 },
    rentalRate: { type: Number, default: 0 }, // rent after TDS per sqft
    grossAmount: { type: Number, default: 0 }, // rent before TDS
    totalRent: { type: Number, default: 0 }, // rent after TDS, before CAM
    camCharges: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 }, // total tenant pays including CAM
    securityDeposit: { type: Number, required: true },
    tdsPercentage: {
      type: Number,
      default: 10, // %
    },

    rentPaymentFrequency: {
      type: String,
      enum: ["monthly", "quarterly"],
      default: "monthly",
      required: true,
    },
    quarterlyRentAmount: {
      type: Number,
      default: 0,
    },
    nextRentDueDate: {
      type: Date,
      required: false,
    },
    lastRentChargedDate: {
      type: Date,
      required: false,
    },
    rentFrequencyChangedAt: {
      type: Date,
      required: false,
    },
    rentFrequencyChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false,
    },
    rentFrequencyChangedReason: {
      type: String,
      required: false,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "vacated"],
      default: "active",
    },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // References
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
  },
  { timestamps: true },
);
tenantSchema.pre("save", function () {
  // Only set defaults, no calculations

  // Ensure cam.ratePerSqft matches camRatePerSqft for backward compatibility
  if (this.camRatePerSqft && !this.cam?.ratePerSqft) {
    this.cam = { ratePerSqft: this.camRatePerSqft };
  }

  // Validate quarterly amount consistency
  if (this.rentPaymentFrequency === "quarterly") {
    const expectedQuarterly = this.totalRent * 3;
    if (Math.abs(this.quarterlyRentAmount - expectedQuarterly) > 0.01) {
      console.warn(
        `⚠️  Quarterly amount mismatch. Expected: ${expectedQuarterly}, Got: ${this.quarterlyRentAmount}`,
      );
    }
  }
});

// ============================================
// VIRTUAL FIELDS
// ============================================
// Provide calculated fields for queries/responses
tenantSchema.virtual("monthlyTotal").get(function () {
  return this.totalRent + this.camCharges;
});

tenantSchema.virtual("effectiveRatePerSqft").get(function () {
  return this.leasedSquareFeet > 0 ? this.totalRent / this.leasedSquareFeet : 0;
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Recalculate financials using the calculator service
 * Use this when updating lease terms
 */
tenantSchema.methods.recalculateFinancials = async function (
  calculatorService,
) {
  // This would be called from a service when updating tenant
  // e.g., when changing sqft or rates

  // For now, this is a placeholder showing the pattern
  throw new Error("Use tenant.service.updateTenantFinancials() instead");
};

/**
 * Get breakdown for reporting
 */
tenantSchema.methods.getFinancialSummary = function () {
  return {
    monthly: {
      gross: this.grossAmount,
      tds: this.tds * this.leasedSquareFeet,
      rentNet: this.totalRent,
      cam: this.camCharges,
      total: this.netAmount,
    },
    quarterly:
      this.rentPaymentFrequency === "quarterly"
        ? {
            rent: this.quarterlyRentAmount,
            cam: this.camCharges * 3,
            total: this.quarterlyRentAmount + this.camCharges * 3,
          }
        : null,
    rates: {
      grossPerSqft: this.pricePerSqft,
      tdsPerSqft: this.tds,
      netPerSqft: this.rentalRate,
      camPerSqft: this.camRatePerSqft,
    },
    area: {
      sqft: this.leasedSquareFeet,
      units: this.units.length,
    },
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find tenants with upcoming rent due
 */
tenantSchema.statics.findUpcomingDue = function (daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    status: "active",
    nextRentDueDate: {
      $gte: new Date(),
      $lte: futureDate,
    },
  });
};

/**
 * Find overdue tenants
 */
tenantSchema.statics.findOverdue = function () {
  return this.find({
    status: "active",
    nextRentDueDate: {
      $lt: new Date(),
    },
  });
};

// ============================================
// INDEXES
// ============================================
tenantSchema.index({ email: 1 });
tenantSchema.index({ status: 1, isDeleted: 1 });
tenantSchema.index({ property: 1, block: 1, innerBlock: 1 });
tenantSchema.index({ nextRentDueDate: 1 });
tenantSchema.index({ rentPaymentFrequency: 1 });

export const Tenant =
  mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
