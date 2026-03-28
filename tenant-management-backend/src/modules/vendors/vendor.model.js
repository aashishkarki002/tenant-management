import mongoose, { Schema } from "mongoose";

/**
 * Vendor — external service providers (e.g. Garud Securities, cleaning agencies).
 * Vendors are NOT users of the system — no auth, no JWT.
 * Payments to vendors go through VendorInvoice (AP flow), NOT payroll.
 */
const vendorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "Garud Securities Pvt. Ltd."
    serviceType: {
      type: String,
      enum: [
        "security",
        "cleaning",
        "maintenance",
        "electrical",
        "plumbing",
        "it",
        "courtyard_vendor",
        "other",
      ],
      required: true,
    },

    // Primary contact person at the vendor
    contactPerson: { type: String, default: null },
    phone: { type: String, required: true },
    email: { type: String, default: null },
    address: { type: String, default: null },

    // For accounting / tax compliance (PAN/VAT)
    panNumber: { type: String, default: null },
    vatRegistered: { type: Boolean, default: false },

    // Bank details for payment
    bankDetails: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      branchName: { type: String, default: null },
    },

    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

vendorSchema.index({ serviceType: 1, isActive: 1 });

export default mongoose.model("Vendor", vendorSchema);
