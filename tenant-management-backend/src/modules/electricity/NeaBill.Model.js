/**
 * NeaBill.Model.js
 *
 * Stores the monthly NEA utility bill that the property owner receives.
 * Uploaded as a PDF to FTP and linked to a property + billing period.
 *
 * Reconciliation:
 *   The sum of Electricity.neaCostPaisa for the same property/month can be compared
 *   against totalAmountPaisa here to see if the owner is over-/under-billing tenants
 *   for NEA electricity costs.
 */

import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

const neaBillSchema = new mongoose.Schema(
  {
    /** Property this NEA bill belongs to */
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "property is required"],
      index: true,
    },

    /** BS billing period */
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear:  { type: Number, required: true },

    /** FTP path where the uploaded PDF lives */
    ftpPath: { type: String, required: true },

    /** What NEA charged the owner this month (stored in paisa) */
    totalAmountPaisa: { type: Number, required: true, min: 0 },

    /** Admin who uploaded this bill */
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    notes: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  },
);

// One NEA bill per property per month
neaBillSchema.index(
  { property: 1, nepaliYear: 1, nepaliMonth: 1 },
  { unique: true, name: "unique_nea_bill_per_month" },
);

// Rupee virtual
neaBillSchema.virtual("totalAmount").get(function () {
  return this.totalAmountPaisa != null ? paisaToRupees(this.totalAmountPaisa) : null;
});

export const NeaBill = mongoose.model("NeaBill", neaBillSchema);
