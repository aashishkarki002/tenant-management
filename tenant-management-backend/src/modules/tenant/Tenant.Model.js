import mongoose from "mongoose";
import InnerBlock from "./InnerBlock.Model.js";

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },

    image: { type: String, required: true },
    pdfAgreement: { type: String, required: true },

    unitNumber: { type: String, required: true },

    dateOfAgreementSigned: { type: Date, required: true },
    leaseStartDate: { type: Date, required: true },
    leaseEndDate: { type: Date, required: true },
    keyHandoverDate: { type: Date, required: true },
    spaceHandoverDate: { type: Date, default: null },
    spaceReturnedDate: { type: Date, default: null },

    leasedSquareFeet: { type: Number, required: true },

    securityDeposit: { type: Number, required: true },

    status: {
      type: String,
      enum: ["active", "inactive", "vacated"],
      default: "active",
    },

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
    isDeleted: { type: Boolean, default: false },
    tds: { type: Number, default: 0 },
    rentalRate: { type: Number, default: 0 },
    totalRent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

try {
  tenantSchema.pre("save", async function () {
    // Only recalc if leasedSquareFeet or innerBlock changed
    if (!this.isModified("leasedSquareFeet") && !this.isModified("innerBlock"))
      return;

    const tenant = this;
    const innerBlock = await InnerBlock.findById(tenant.innerBlock);
    if (!innerBlock) throw new Error("InnerBlock not found");

    const baseRate = innerBlock.pricePerSqft;
    tenant.tds = baseRate * 0.1;
    tenant.rentalRate = baseRate - tenant.tds;
    tenant.totalRent = tenant.rentalRate * tenant.leasedSquareFeet;
  });
} catch (error) {
  console.log(error);
}

export default mongoose.model("Tenant", tenantSchema);
