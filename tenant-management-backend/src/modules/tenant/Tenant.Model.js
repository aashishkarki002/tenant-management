import mongoose from "mongoose";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";

const tenantSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC INFO
    // =========================
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },

    // =========================
    // DOCUMENTS
    // =========================
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

    // =========================
    // UNITS & LEASE DETAILS
    // =========================
    units: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Unit",
        required: true,
      },
    ],
    pricePerSqft: { type: Number, required: true }, // in rupees
    leasedSquareFeet: { type: Number, required: true },
    camRatePerSqft: { type: Number, required: true },

    dateOfAgreementSigned: { type: Date, required: true },
    dateOfAgreementSignedNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    leaseStartDate: { type: Date, required: true },
    leaseStartDateNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    leaseEndDate: { type: Date, required: true },
    leaseEndDateNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    keyHandoverDate: { type: Date, required: true },
    keyHandoverDateNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    spaceHandoverDate: { type: Date, default: null },
    spaceHandoverDateNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    spaceReturnedDate: { type: Date, default: null },
    spaceReturnedDateNepali: { type: String, default: null }, // "YYYY-MM-DD" BS

    // =========================
    // FINANCIALS (STORED IN PAISA)
    // =========================
    tdsPaisa: { type: Number, default: 0 },
    rentalRatePaisa: { type: Number, default: 0 },
    grossAmountPaisa: { type: Number, default: 0 },
    totalRentPaisa: { type: Number, default: 0 },
    camChargesPaisa: { type: Number, default: 0 },
    netAmountPaisa: { type: Number, default: 0 },
    securityDepositPaisa: { type: Number, required: true },
    quarterlyRentAmountPaisa: { type: Number, default: 0 },

    // Additional paisa conversions
    pricePerSqftPaisa: { type: Number, required: true },
    camRatePerSqftPaisa: { type: Number, required: true },

    tdsPercentage: { type: Number, default: 10 },

    rentPaymentFrequency: {
      type: String,
      enum: ["monthly", "quarterly"],
      default: "monthly",
      required: true,
    },
    nextRentDueDate: { type: Date },
    lastRentChargedDate: { type: Date },
    rentFrequencyChangedAt: { type: Date },
    rentFrequencyChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    rentFrequencyChangedReason: { type: String },
    rentEscalation: {
      // Master switch
      enabled: { type: Boolean, default: false },

      // How often does escalation trigger (in months, e.g. 12 = yearly)
      intervalMonths: { type: Number, default: 12 },

      // Percentage increase per interval (e.g. 5 = 5%)
      percentageIncrease: { type: Number, default: 0 },

      // What the escalation applies to
      appliesTo: {
        type: String,
        enum: ["rent_only", "cam_only", "both"],
        default: "rent_only",
      },

      // ── English Date (JS Date) — used for MongoDB index + cron queries ──
      nextEscalationDate: { type: Date, default: null },

      // ── Nepali ISO string "YYYY-MM-DD" — used for display and history ──
      nextEscalationNepaliDate: { type: String, default: null },

      // When did the last escalation fire?
      lastEscalatedAt: { type: Date, default: null },
      lastEscalatedNepaliDate: { type: String, default: null },

      // Full audit trail
      history: [
        {
          // When it happened
          escalatedAt: { type: Date, required: true },
          escalatedNepaliDate: { type: String, required: true }, // "YYYY-MM-DD"
          nepaliYear: { type: Number, required: true },
          nepaliMonth: { type: Number, required: true }, // 1-based
          quarter: { type: Number, required: true }, // 1-4

          escalatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
          },

          // Before snapshot (paisa)
          previousPricePerSqftPaisa: { type: Number, required: true },
          previousCamRatePerSqftPaisa: { type: Number, required: true },
          previousGrossAmountPaisa: { type: Number, required: true },
          previousTotalRentPaisa: { type: Number, required: true },
          previousCamChargesPaisa: { type: Number, required: true },

          // After snapshot (paisa)
          newPricePerSqftPaisa: { type: Number, required: true },
          newCamRatePerSqftPaisa: { type: Number, required: true },
          newGrossAmountPaisa: { type: Number, required: true },
          newTotalRentPaisa: { type: Number, required: true },
          newCamChargesPaisa: { type: Number, required: true },

          percentageApplied: { type: Number, required: true },
          note: { type: String, default: "" },
        },
      ],
    },

    // =========================
    // STATUS
    // =========================
    status: {
      type: String,
      enum: ["active", "inactive", "vacated"],
      default: "active",
    },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // =========================
    // REFERENCES
    // =========================
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

// ============================================
// PRE-SAVE HOOK
// ============================================
tenantSchema.pre("save", function () {
  // Validate quarterly amount consistency
  if (this.rentPaymentFrequency === "quarterly") {
    const expectedQuarterly = this.totalRentPaisa * 3;
    if (Math.abs(this.quarterlyRentAmountPaisa - expectedQuarterly) > 1) {
      console.warn(
        `⚠️ Quarterly rent mismatch. Expected: ${expectedQuarterly}, Got: ${this.quarterlyRentAmountPaisa}`,
      );
    }
  }
});

// ============================================
// VIRTUALS
// ============================================

// Monthly total including CAM
tenantSchema.virtual("monthlyTotalPaisa").get(function () {
  return (this.totalRentPaisa || 0) + (this.camChargesPaisa || 0);
});
tenantSchema.virtual("monthlyTotal").get(function () {
  return paisaToRupees(this.monthlyTotalPaisa);
});

// Quarterly total including CAM
tenantSchema.virtual("quarterlyTotalPaisa").get(function () {
  if (this.rentPaymentFrequency === "quarterly") {
    return (
      (this.quarterlyRentAmountPaisa || 0) + (this.camChargesPaisa || 0) * 3
    );
  }
  return 0;
});
tenantSchema.virtual("quarterlyTotal").get(function () {
  return paisaToRupees(this.quarterlyTotalPaisa);
});

// Monetary fields formatted
[
  "tdsPaisa",
  "rentalRatePaisa",
  "grossAmountPaisa",
  "totalRentPaisa",
  "camChargesPaisa",
  "netAmountPaisa",
  "securityDepositPaisa",
  "quarterlyRentAmountPaisa",
  "pricePerSqftPaisa",
  "camRatePerSqftPaisa",
].forEach((field) => {
  tenantSchema
    .virtual(`${field.replace("Paisa", "")}Formatted`)
    .get(function () {
      return formatMoney(this[field]);
    });
});

// ============================================
// INSTANCE METHODS
// ============================================
tenantSchema.methods.getFinancialSummary = function () {
  return {
    monthly: {
      gross: formatMoney(this.grossAmountPaisa),
      tds: formatMoney(this.tdsPaisa),
      rentNet: formatMoney(this.totalRentPaisa),
      cam: formatMoney(this.camChargesPaisa),
      total: formatMoney(this.monthlyTotalPaisa),
    },
    quarterly:
      this.rentPaymentFrequency === "quarterly"
        ? {
            rent: formatMoney(this.quarterlyRentAmountPaisa),
            cam: formatMoney(this.camChargesPaisa * 3),
            total: formatMoney(this.quarterlyTotalPaisa),
          }
        : null,
    rates: {
      grossPerSqft: formatMoney(this.pricePerSqftPaisa),
      tdsPerSqft: formatMoney(this.tdsPaisa),
      netPerSqft: formatMoney(this.rentalRatePaisa),
      camPerSqft: formatMoney(this.camRatePerSqftPaisa),
    },
    escalation: this.rentEscalation?.enabled
      ? {
          nextDateNepali: this.rentEscalation.nextEscalationNepaliDate,
          daysAway: this.daysUntilEscalation,
          percentage: this.rentEscalation.percentageIncrease,
          appliesTo: this.rentEscalation.appliesTo,
          totalEscalations: this.rentEscalation.history?.length || 0,
          lastEscalatedNepali: this.rentEscalation.lastEscalatedNepaliDate,
        }
      : null,
  };
};

// ============================================
// STATIC METHODS
// ============================================
tenantSchema.statics.findUpcomingDue = function (daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  return this.find({
    status: "active",
    nextRentDueDate: { $gte: new Date(), $lte: futureDate },
  });
};

tenantSchema.statics.findOverdue = function () {
  return this.find({
    status: "active",
    nextRentDueDate: { $lt: new Date() },
  });
};
// Cron query — uses the English Date index for performance
tenantSchema.statics.findDueForEscalation = function (asOf = new Date()) {
  return this.find({
    status: "active",
    isDeleted: false,
    "rentEscalation.enabled": true,
    "rentEscalation.nextEscalationDate": { $lte: asOf },
  });
};
// ============================================
// INDEXES
// ============================================
tenantSchema.index({ status: 1, isDeleted: 1 });
tenantSchema.index({ property: 1, block: 1, innerBlock: 1 });
tenantSchema.index({ nextRentDueDate: 1 });
tenantSchema.index({ rentPaymentFrequency: 1 });
tenantSchema.index({ "rentEscalation.nextEscalationDate": 1 });

// JSON / Object output
tenantSchema.set("toJSON", { virtuals: true, getters: false });
tenantSchema.set("toObject", { virtuals: true, getters: false });
tenantSchema.index(
  { name: "text", email: "text", phone: "text" },
  {
    weights: { name: 10, email: 5, phone: 3 },
    name: "tenant_text_search",
  },
);
export const Tenant =
  mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
