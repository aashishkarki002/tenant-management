import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

const revenueSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RevenueSource",
      required: true,
    },

    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // ============================================
    // NEPALI DATE FIELDS — denormalized at write time.
    // Never derive at read time; aggregating across thousands of
    // records with JS-side date conversion kills performance.
    // ============================================
    npYear: {
      type: Number,
      index: true,
    },
    npMonth: {
      type: Number, // 1-based (1 = Baisakh … 12 = Chaitra)
      min: 1,
      max: 12,
      index: true,
    },

    payerType: {
      type: String,
      enum: ["TENANT", "EXTERNAL"],
      required: true,
    },

    // For tenant payments
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function () {
        return this.payerType === "TENANT";
      },
    },

    // For external payments
    externalPayer: {
      name: {
        type: String,
        required: function () {
          return this.payerType === "EXTERNAL";
        },
        trim: true,
      },
      type: {
        type: String,
        enum: ["PERSON", "COMPANY"],
        required: function () {
          return this.payerType === "EXTERNAL";
        },
      },
      contact: {
        type: String, // phone / email (optional)
      },
    },

    referenceType: {
      type: String,
      enum: [
        "RENT",
        "PARKING",
        "AD",
        "CAM",
        "ELECTRICITY",
        "MANUAL",
        "LATE_FEE",
      ],
      default: "MANUAL",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return [
          "RENT",
          "PARKING",
          "AD",
          "CAM",
          "ELECTRICITY",
          "LATE_FEE",
        ].includes(this.referenceType);
      },
    },

    status: {
      type: String,
      enum: ["RECORDED", "SYNCED", "REVERSED"],
      default: "RECORDED",
    },

    notes: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    reversalReason: {
      type: String,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reversedAt: {
      type: Date,
    },
    // On a corrected (amended) doc: points back to the original
    originalRevenue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Revenue",
    },

    // On the original doc after amendment: points to the corrected doc
    amendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Revenue",
    },
  },

  { timestamps: true },
);

export const Revenue = mongoose.model("Revenue", revenueSchema);
