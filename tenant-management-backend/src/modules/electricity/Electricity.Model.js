import mongoose from "mongoose";
import { paisaToRupees, rupeesToPaisa } from "../../utils/moneyUtil.js";

const electricitySchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    // Previous meter reading
    previousReading: {
      type: Number,
      required: true,
      min: 0,
    },
    // Current meter reading
    currentReading: {
      type: Number,
      required: true,
      min: 0,
    },
    // Calculated consumption
    consumption: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    // Rate per unit in paisa
    ratePerUnitPaisa: {
      type: Number,
      required: true,
      min: 0,
      get: paisaToRupees,
    },
    
    // Total amount to be charged in paisa
    totalAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
      get: paisaToRupees,
    },
    
    // Paid amount in paisa
    paidAmountPaisa: {
      type: Number,
      default: 0,
      min: 0,
      get: paisaToRupees,
    },
    
    // Backward compatibility getters
    ratePerUnit: {
      type: Number,
      get: function () {
        return this.ratePerUnitPaisa ? paisaToRupees(this.ratePerUnitPaisa) : 0;
      },
    },
    totalAmount: {
      type: Number,
      get: function () {
        return this.totalAmountPaisa ? paisaToRupees(this.totalAmountPaisa) : 0;
      },
    },
    paidAmount: {
      type: Number,
      get: function () {
        return this.paidAmountPaisa ? paisaToRupees(this.paidAmountPaisa) : 0;
      },
    },
    // Nepali date information
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
      type: String,
      required: true,
    },
    // English date information
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
    // Reading date
    readingDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Payment status
    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue"],
      default: "pending",
    },
    paidDate: {
      type: Date,
    },
    // Payment receipt image
    receipt: {
      url: String,
      publicId: String,
      generatedAt: Date,
    },
    // Notes or remarks
    notes: {
      type: String,
      default: "",
    },
    // Flag to indicate if this is the first reading for a new tenant
    isInitialReading: {
      type: Boolean,
      default: false,
    },
    // Reference to previous electricity record (for tenant transition tracking)
    previousRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Electricity",
    },
    // Flag for tenant transition
    isTenantTransition: {
      type: Boolean,
      default: false,
    },
    // Previous tenant (if applicable)
    previousTenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
);

// Validation: Current reading must be >= previous reading
electricitySchema.pre("save", async function () {
  if (this.currentReading < this.previousReading) {
    throw new Error("Current reading cannot be less than previous reading");
  }

  // Calculate consumption
  this.consumption = this.currentReading - this.previousReading;

  // Ensure ratePerUnitPaisa is set (convert if needed)
  if (!this.ratePerUnitPaisa && this.ratePerUnit) {
    this.ratePerUnitPaisa = rupeesToPaisa(this.ratePerUnit);
  }

  // Calculate total amount in paisa: consumption * ratePerUnitPaisa
  if (this.ratePerUnitPaisa && this.consumption) {
    this.totalAmountPaisa = Math.round(this.consumption * this.ratePerUnitPaisa);
  }

  // Ensure amounts are integers
  if (this.ratePerUnitPaisa && !Number.isInteger(this.ratePerUnitPaisa)) {
    throw new Error(
      `Rate per unit must be integer paisa, got: ${this.ratePerUnitPaisa}`,
    );
  }
  if (this.totalAmountPaisa && !Number.isInteger(this.totalAmountPaisa)) {
    throw new Error(
      `Total amount must be integer paisa, got: ${this.totalAmountPaisa}`,
    );
  }
  if (this.paidAmountPaisa && !Number.isInteger(this.paidAmountPaisa)) {
    throw new Error(
      `Paid amount must be integer paisa, got: ${this.paidAmountPaisa}`,
    );
  }

  // Validate paid amount doesn't exceed total (in paisa)
  if (this.paidAmountPaisa > this.totalAmountPaisa) {
    throw new Error("Paid amount cannot exceed total amount");
  }
});

// Indexes for efficient querying
electricitySchema.index({ tenant: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ unit: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ property: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ status: 1, readingDate: -1 });

export const Electricity = mongoose.model("Electricity", electricitySchema);
