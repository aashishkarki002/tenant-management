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

    // ============================================
    // MULTI-ENTITY SCOPE FIELDS
    // ============================================
    transactionScope: {
      type: String,
      enum: ["building", "split", "head_office"],
      required: true,
      default: "building",
    },

    // Always required — identifies the owning entity regardless of scope.
    // head_office → HQ/general entity
    // building    → private or company entity that owns the block
    // split       → primary entity (others listed in splitAllocations)
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
    },

    // Required when transactionScope === 'building' or 'split'.
    // NULL for head_office revenue (parking vendors, ads, shared facilities)
    // because those are not tied to any single block.
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: function () {
        return ["building", "split"].includes(this.transactionScope);
      },
      default: null,
    },

    // Populated when transactionScope === 'split'
    splitAllocations: [
      {
        // Which block this slice belongs to.
        // Required per allocation — split revenue always comes from specific blocks.
        blockId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Block",
          required: true,
        },
        entityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OwnershipEntity",
          required: true,
        },
        percentage: { type: Number, required: true },
        amountPaisa: { type: Number, required: true },
        ledgerEntryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LedgerEntry",
        },
      },
    ],
  },

  { timestamps: true },
);

export const Revenue = mongoose.model("Revenue", revenueSchema);
revenueSchema.index({ npYear: 1, npMonth: 1 });
revenueSchema.index({ entityId: 1, npYear: 1, npMonth: 1 });
revenueSchema.index({ blockId: 1, npYear: 1, npMonth: 1 });
