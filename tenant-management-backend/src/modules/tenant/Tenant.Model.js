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

// Pre-save hook to calculate rent amounts
tenantSchema.pre("save", async function () {
  // Only calculate if new or relevant fields changed
  if (
    !this.isNew &&
    !(
      this.isModified("leasedSquareFeet") ||
      this.isModified("pricePerSqft") ||
      this.isModified("camRatePerSqft")
    )
  )
    return;

  const baseRate = this.pricePerSqft;

  // TDS = 10% of baseRate
  this.tds = baseRate * 0.1;

  // Rent per sqft after TDS
  this.rentalRate = baseRate - this.tds;

  // Gross amount = total rent before TDS
  this.grossAmount = baseRate * this.leasedSquareFeet;

  // Total rent after TDS but before CAM
  this.totalRent = this.rentalRate * this.leasedSquareFeet;

  // CAM charges
  this.camCharges = this.camRatePerSqft * this.leasedSquareFeet;

  // Net amount tenant pays
  this.netAmount = this.totalRent + this.camCharges;
});

export const Tenant =
  mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
