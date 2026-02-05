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
  { timestamps: true }
);
tenantSchema.pre("save", function () {
  // Only calculate if new or relevant fields changed
  if (
    !this.isNew &&
    !(
      this.isModified("leasedSquareFeet") ||
      this.isModified("pricePerSqft") ||
      this.isModified("camRatePerSqft") ||
      this.isModified("tdsPercentage") ||
      this.isModified("rentPaymentFrequency")
    )
  ) {
    return;
  }

  const A = this.leasedSquareFeet; // Area in sqft
  const P = this.pricePerSqft; // Gross price per sqft (includes TDS)
  const rate = this.tdsPercentage / 100; // TDS rate (0.10 for 10%)

  // TDS Calculation (Reverse method)
  // T = P - (P / (1 + rate))
  // This calculates TDS when P is the gross amount (includes TDS)
  this.tds = P - P / (1 + rate);

  // Rental Rate per sqft (Net to landlord after TDS)
  // RR = P - T
  this.rentalRate = P - this.tds;

  // Gross Amount (what tenant pays BEFORE TDS deduction)
  // GA = A × P
  this.grossAmount = A * P;

  // MONTHLY Total Rent (Net to landlord after TDS)
  // RA = A × RR
  // This is ALWAYS monthly rent
  this.totalRent = A * this.rentalRate;

  // Quarterly Rent Amount (for quarterly tenants only)
  if (this.rentPaymentFrequency === "quarterly") {
    this.quarterlyRentAmount = this.totalRent * 3;
  } else {
    this.quarterlyRentAmount = 0;
  }

  //  MONTHLY CAM Charges (always monthly for all tenants)
  this.camCharges = this.camRatePerSqft * A;

  // MONTHLY Net Amount (total to landlord monthly)
  // NA = RA + CAM
  this.netAmount = this.totalRent + this.camCharges;
});

export const Tenant =
  mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
