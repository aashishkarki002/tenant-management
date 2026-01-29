import mongoose from "mongoose";

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
    // Rate per unit
    ratePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    // Total amount to be charged
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
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
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
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

  // Calculate total amount
  this.totalAmount = this.consumption * this.ratePerUnit;

  // Validate paid amount doesn't exceed total
  if (this.paidAmount > this.totalAmount) {
    throw new Error("Paid amount cannot exceed total amount");
  }
});

// Indexes for efficient querying
electricitySchema.index({ tenant: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ unit: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ property: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ status: 1, readingDate: -1 });

export const Electricity = mongoose.model("Electricity", electricitySchema);
