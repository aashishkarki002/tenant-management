import mongoose, { Schema } from "mongoose";

/**
 * VendorContract — a service contract between EasyManage and a Vendor.
 * One vendor can have multiple contracts (different properties, different service periods).
 *
 * Accounting: each contract maps to an expense account in the chart of accounts.
 * When a VendorInvoice is raised against this contract, the journal entry is:
 *   DR  expenseAccountCode (e.g. "6100-SECURITY")
 *   CR  Accounts Payable
 */
const vendorContractSchema = new Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    property: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    serviceType: { type: String, required: true }, // mirrors vendor.serviceType for denorm
    description: { type: String, default: null }, // "24hr guard deployment — 2 guards"

    // Billing
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "one_time"],
      default: "monthly",
    },
    contractAmountPaisa: { type: Number, required: true, min: 0 },

    // Contract duration
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null }, // null = open-ended
    autoRenew: { type: Boolean, default: false },

    /**
     * expenseAccountCode: maps to Account.code in your chart of accounts.
     * e.g. "6100-SECURITY-GARUD" — used when posting VendorInvoice to ledger.
     * Must be created in Account model first.
     */
    expenseAccountCode: { type: String, required: true },

    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

vendorContractSchema.index({ vendor: 1, property: 1 });
vendorContractSchema.index({ isActive: 1 });

export default mongoose.model("VendorContract", vendorContractSchema);
