import mongoose, { Schema } from "mongoose";

/**
 * VendorPayment — records a payment to or from a vendor.
 *
 * paymentDirection = "outflow"  → we pay the vendor (AP settlement)
 *   DR  Accounts Payable / CR  Cash/Bank
 *
 * paymentDirection = "inflow"   → vendor pays us (stall rent receipt)
 *   DR  Cash/Bank / CR  Vendor Receivable
 */
const vendorPaymentSchema = new Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    contract: {
      type: Schema.Types.ObjectId,
      ref: "VendorContract",
      default: null,
    },

    amountPaisa: { type: Number, required: true, min: 1 },

    // "outflow" = we pay them (expense vendor), "inflow" = they pay us (stall vendor)
    paymentDirection: {
      type: String,
      enum: ["outflow", "inflow"],
      default: "outflow",
    },

    paymentDate: { type: Date, required: true },
    nepaliDate: { type: String, default: null }, // BS YYYY-MM-DD

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque"],
      required: true,
    },
    bankAccount: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },
    referenceNumber: { type: String, default: null },

    tdsDeductedPaisa: { type: Number, default: 0, min: 0 },

    notes: { type: String, default: null },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
);

vendorPaymentSchema.index({ vendor: 1, paymentDate: -1 });
vendorPaymentSchema.index({ contract: 1 });

export default mongoose.model("VendorPayment", vendorPaymentSchema);
