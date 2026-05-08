/**
 * NeaBill.Model.js
 *
 * Stores the monthly NEA utility bill that the property owner receives.
 * Optionally uploaded as a PDF to FTP and linked to a property + billing period.
 *
 * Fields:
 *   totalUnits          → total kWh purchased from NEA (for loss/surplus detection)
 *   energyChargeAmountPaisa → energy charge component (optional breakdown)
 *   demandChargePaisa   → demand charge (booked as building operating expense)
 *   totalAmountPaisa    → total NEA bill (energyCharge + demandCharge + taxes)
 *   status              → draft | finalized | paid
 *
 * Reconciliation:
 *   totalUnits   vs  sum(Electricity.consumption for unit readings)  → unit loss/surplus
 *   totalAmountPaisa vs  sum(Electricity.neaCostPaisa)               → cost reconciliation
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

    /** Date printed on the NEA bill */
    billDate: { type: Date, default: null },

    /** FTP path where the uploaded PDF lives — optional (manual entry without PDF allowed) */
    ftpPath: { type: String, default: null },

    /** Total kWh purchased from NEA — used for loss/surplus detection */
    totalUnits: { type: Number, default: null, min: 0 },

    /** Energy charge component (paisa) — optional breakdown */
    energyChargeAmountPaisa: { type: Number, default: null, min: 0 },

    /** Demand charge (paisa) — booked as Electricity Demand Charge Expense (building operating expense) */
    demandChargePaisa: { type: Number, default: null, min: 0 },

    /** Total NEA charge = energy + demand + taxes (paisa) */
    totalAmountPaisa: { type: Number, required: true, min: 0 },

    /** Workflow status */
    status: {
      type: String,
      enum: ["draft", "finalized", "paid"],
      default: "finalized",
      index: true,
    },

    /** Admin who uploaded / entered this bill */
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

// Rupee virtuals
neaBillSchema.virtual("totalAmount").get(function () {
  return this.totalAmountPaisa != null ? paisaToRupees(this.totalAmountPaisa) : null;
});
neaBillSchema.virtual("demandCharge").get(function () {
  return this.demandChargePaisa != null ? paisaToRupees(this.demandChargePaisa) : null;
});
neaBillSchema.virtual("energyChargeAmount").get(function () {
  return this.energyChargeAmountPaisa != null ? paisaToRupees(this.energyChargeAmountPaisa) : null;
});

export const NeaBill = mongoose.model("NeaBill", neaBillSchema);
