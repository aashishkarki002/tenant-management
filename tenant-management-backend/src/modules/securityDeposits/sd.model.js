import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

const sdSchema = new mongoose.Schema(
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

    month: { type: Number, required: true, min: 1, max: 12 },
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear: { type: Number, required: true },
    nepaliDate: { type: Date, required: true },
    year: { type: Number, required: true },
    
    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
      get: paisaToRupees,
    },
    
    // Backward compatibility getter
    amount: {
      type: Number,
      get: function () {
        return this.amountPaisa ? paisaToRupees(this.amountPaisa) : 0;
      },
    },
    mode: {
      type: String,
      enum: ["cash", "cheque", "bank_transfer", "bank_guarantee"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "held_as_bg", "refunded", "adjusted"],
      default: "pending",
    },
    paidDate: { type: Date, default: null },
    chequeDetails: {
      chequeNumber: {
        type: String,
        required: false,
      },
      chequeDate: {
        type: Date,
        required: false,
      },
      bankName: {
        type: String,
        required: false,
      },
    },
    bankGuaranteeDetails: {
      bgNumber: {
        type: String,
        required: false,
      },
      bankName: {
        type: String,
        required: false,
      },
      issueDate: {
        type: Date,
        required: false,
      },
      expiryDate: {
        type: Date,
        required: false,
      },
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["cheque", "bank_guarantee"],
          required: true,
        },
        files: [
          {
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate SD entries for same tenant + month/year
sdSchema.index({ tenant: 1, nepaliMonth: 1, nepaliYear: 1 }, { unique: true });

sdSchema.pre("save", function () {
  // Ensure amount is an integer
  if (this.amountPaisa && !Number.isInteger(this.amountPaisa)) {
    throw new Error(
      `Security deposit amount must be integer paisa, got: ${this.amountPaisa}`,
    );
  }
});

export const Sd = mongoose.model("Sd", sdSchema);
