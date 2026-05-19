import mongoose from "mongoose";

/**
 * TdsQuarterlyPayment — quarterly bucket for TDS remittance tracking.
 *
 * Nepal IRD requires TDS deducted monthly to be remitted quarterly.
 * This model groups 3 monthly rents into one quarterly payment record,
 * stores the IRD certificate(s) received from the tenant, and tracks
 * the verification state.
 *
 * One bucket per (tenant, fiscalYear, quarter). Unique index enforces this.
 */
const tdsQuarterlyPaymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    fiscalYear: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },

    months: [
      {
        nepaliYear: { type: Number, required: true },
        nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
        rentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Rent",
          required: true,
        },
        tdsAmountPaisa: { type: Number, required: true, default: 0 },
      },
    ],

    totalTdsPaisa: {
      type: Number,
      required: true,
      default: 0,
      validate: { validator: Number.isInteger, message: "totalTdsPaisa must be integer" },
    },

    status: {
      type: String,
      enum: ["pending", "certificate_received", "verified"],
      default: "pending",
    },

    // FTP paths of IRD certificates/challan uploaded by tenant — array supports
    // multiple files (e.g. deposit slip + official certificate separately)
    certificateUrls: [{ type: String }],

    challanNumber: { type: String, default: null },
    paymentDate: { type: Date, default: null },
    nepaliPaymentDate: { type: String, default: null },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

tdsQuarterlyPaymentSchema.index(
  { tenant: 1, fiscalYear: 1, quarter: 1 },
  { unique: true },
);
tdsQuarterlyPaymentSchema.index({ status: 1 });
tdsQuarterlyPaymentSchema.index({ property: 1, fiscalYear: 1 });

export const TdsQuarterlyPayment = mongoose.model(
  "TdsQuarterlyPayment",
  tdsQuarterlyPaymentSchema,
);
