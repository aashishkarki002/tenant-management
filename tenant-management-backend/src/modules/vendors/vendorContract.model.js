import mongoose, { Schema } from "mongoose";

/**
 * VendorContract — a service or stall-lease contract linked to a Vendor.
 *
 * contractType = "service"     → we pay the vendor (expense)
 *   Journal: DR expenseAccountCode / CR Accounts Payable
 *
 * contractType = "stall_lease" → vendor pays us (revenue)
 *   Journal: DR Vendor Receivable / CR revenueAccountCode
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

    // "service" = expense (cleaning, security, etc.)
    // "stall_lease" = revenue (vendor pays us for a stall / event space)
    contractType: {
      type: String,
      enum: ["service", "stall_lease"],
      default: "service",
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

    // ── Expense side (service contracts) ──────────────────────────────────────
    /**
     * expenseAccountCode: maps to Account.code in your chart of accounts.
     * e.g. "6100-SECURITY-GARUD". Required when contractType = "service".
     */
    expenseAccountCode: { type: String, default: null },

    // ── Revenue side (stall_lease contracts) ──────────────────────────────────
    /**
     * revenueAccountCode: revenue account to credit when stall rent is received.
     * e.g. "4200-STALL-RENT". Required when contractType = "stall_lease".
     */
    revenueAccountCode: { type: String, default: null },

    /** Which stall / space is being leased (e.g. "Stall A3 - Ground Floor") */
    stallDescription: { type: String, default: null },

    /** Event or purpose (e.g. "Dashain Fair 2081") */
    eventName: { type: String, default: null },

    /** Number of days the stall is leased for (used for one_time billing) */
    leaseDays: { type: Number, default: null, min: 1 },

    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },

    // Internal staff (Operational Manager) responsible for overseeing this contract
    managedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

vendorContractSchema.index({ vendor: 1, property: 1 });
vendorContractSchema.index({ isActive: 1 });

export default mongoose.model("VendorContract", vendorContractSchema);
