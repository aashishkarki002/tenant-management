import mongoose from "mongoose";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";
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
    securityDeposit: { type: Number, required: false },
    tdsPaisa: {
      type: Number, // Integer paisa
      default: 0,
      get: paisaToRupees, // Auto-convert to rupees when reading
    },

    // Rental rate after TDS per sqft in paisa
    rentalRatePaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // Gross amount before TDS in paisa
    grossAmountPaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // Total rent after TDS, before CAM in paisa
    totalRentPaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // CAM charges in paisa
    camChargesPaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // Net amount (total tenant pays) in paisa
    netAmountPaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // Security deposit in paisa
    securityDepositPaisa: {
      type: Number,
      required: true,
      get: paisaToRupees,
    },

    // Quarterly rent amount in paisa
    quarterlyRentAmountPaisa: {
      type: Number,
      default: 0,
      get: paisaToRupees,
    },

    // Price per sqft in paisa
    pricePerSqftPaisa: {
      type: Number,
      required: true,
      get: paisaToRupees,
    },

    // CAM rate per sqft in paisa
    camRatePerSqftPaisa: {
      type: Number,
      required: true,
      get: paisaToRupees,
    },

    // TDS percentage (still a percentage, not money)
    tdsPercentage: {
      type: Number,
      default: 10,
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
  { toJSON: { getters: true }, toObject: { getters: true } },
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
tenantSchema.virtual("monthlyTotalPaisa").get(function () {
  // Access raw values without getters to avoid conversion errors
  const totalRentPaisaRaw = this.get("totalRentPaisa", null, { getters: false }) || 0;
  const camChargesPaisaRaw = this.get("camChargesPaisa", null, { getters: false }) || 0;
  return totalRentPaisaRaw + camChargesPaisaRaw;
});

tenantSchema.virtual("monthlyTotal").get(function () {
  const monthlyTotalPaisa = this.monthlyTotalPaisa;
  if (monthlyTotalPaisa === undefined || monthlyTotalPaisa === null) {
    return 0;
  }
  return paisaToRupees(monthlyTotalPaisa);
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
      gross: formatMoney(this.grossAmountPaisa),
      tds: formatMoney(this.tdsPaisa * this.leasedSquareFeet),
      rentNet: formatMoney(this.totalRentPaisa),
      cam: formatMoney(this.camChargesPaisa),
      total: formatMoney(this.netAmountPaisa),
    },
    quarterly:
      this.rentPaymentFrequency === "quarterly"
        ? {
            rent: formatMoney(this.quarterlyRentAmountPaisa),
            cam: formatMoney(this.camChargesPaisa * 3),
            total: formatMoney(
              this.quarterlyRentAmountPaisa + this.camChargesPaisa * 3,
            ),
          }
        : null,
    rates: {
      grossPerSqft: formatMoney(this.pricePerSqftPaisa),
      tdsPerSqft: formatMoney(this.tdsPaisa),
      netPerSqft: formatMoney(this.rentalRatePaisa),
      camPerSqft: formatMoney(this.camRatePerSqftPaisa),
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
