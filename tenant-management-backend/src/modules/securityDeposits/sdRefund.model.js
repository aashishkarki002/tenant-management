/**
 * SdRefund.Model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks every settlement event against a Security Deposit document.
 *
 * One SdRefund document = one settlement action (may contain multiple line
 * items — e.g. "refund Rs. 20k cash + deduct Rs. 5k maintenance + apply
 * Rs. 3k to rent arrears" is a single SdRefund with 3 lineItems).
 *
 * STATUS LIFECYCLE:
 *   DRAFT → CONFIRMED → POSTED (double-entry ledger written)
 *                     ↓
 *                  REVERSED   (admin reversal within 24h)
 *
 * REVERSAL POLICY:
 *   - Allowed within 24h of posting by super_admin only.
 *   - Creates a new SdRefund with status REVERSED, referencing this doc.
 *   - The original LedgerEntry journal is reversed via ledgerService.reverseJournalEntry().
 *
 * All monetary fields in PAISA (integers).
 * All Nepali dates stored as String "YYYY-MM-DD" (BS).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

// ─────────────────────────────────────────────────────────────────────────────
// LINE ITEM SCHEMA
// Represents one "leg" of a compound settlement
// ─────────────────────────────────────────────────────────────────────────────

const lineItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "CASH_REFUND",
        "MAINTENANCE_ADJUSTMENT",
        "MAINTENANCE_EXPENSE_OFFSET",
        "RENT_ADJUSTMENT",
        "CAM_ADJUSTMENT",
        "ELECTRICITY_ADJUSTMENT",
      ],
      required: true,
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "lineItem.amountPaisa must be an integer",
      },
    },

    // Only for CASH_REFUND
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", null],
      default: null,
    },

    // Only for CASH_REFUND via bank
    bankAccountCode: { type: String, default: null },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },

    // Only for MAINTENANCE_* — links to a maintenance request for audit
    maintenanceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Maintenance",
      default: null,
    },

    // Only for RENT/CAM/ELECTRICITY — links to the rent/cam/electricity doc
    referenceDocId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceDocType: {
      type: String,
      enum: ["Rent", "Cam", "Electricity", null],
      default: null,
    },

    // Free-text note for this line (e.g. "Broken window repair — invoice #INV-2082-04")
    note: { type: String, default: "" },

    // Override description for the ledger entry
    description: { type: String, default: null },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// SD REFUND SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const sdRefundSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    sd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sd",
      required: true,
      index: true,
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    // ── Settlement details ────────────────────────────────────────────────────
    lineItems: {
      type: [lineItemSchema],
      validate: {
        validator: (v) => v && v.length > 0,
        message: "At least one line item is required",
      },
    },

    // Total of all line items (convenience — recomputed on save)
    totalAmountPaisa: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "totalAmountPaisa must be an integer",
      },
    },

    // ── Dates ─────────────────────────────────────────────────────────────────
    refundDate: { type: Date, required: true },
    nepaliDate: { type: String, required: true }, // "YYYY-MM-DD" (BS)
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear: { type: Number, required: true },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "POSTED", "REVERSED"],
      default: "DRAFT",
      index: true,
    },

    // Linked Transaction _id after posting (set by service after postJournalEntry)
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },

    // ── Reversal tracking ─────────────────────────────────────────────────────
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: null },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SdRefund",
      default: null,
    }, // Set on the reversal doc, points to original

    // ── Metadata ──────────────────────────────────────────────────────────────
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    internalNotes: { type: String, default: "" },

    // Snapshot of SD state at time of refund (for audit trail integrity)
    sdSnapshot: {
      amountPaisa: Number,
      remainingPaisa: Number,
      mode: String,
      status: String,
    },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE — recompute totalAmountPaisa from line items
// ─────────────────────────────────────────────────────────────────────────────

sdRefundSchema.pre("save", function () {
  if (this.lineItems?.length) {
    this.totalAmountPaisa = this.lineItems.reduce(
      (sum, item) => sum + (item.amountPaisa || 0),
      0,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

sdRefundSchema.virtual("totalAmount").get(function () {
  return paisaToRupees(this.totalAmountPaisa);
});

sdRefundSchema.virtual("isReversible").get(function () {
  if (this.status !== "POSTED") return false;
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  return Date.now() - this.createdAt.getTime() < WINDOW_MS;
});

sdRefundSchema.virtual("adjustmentSummary").get(function () {
  const byType = {};
  for (const item of this.lineItems ?? []) {
    byType[item.type] = (byType[item.type] ?? 0) + item.amountPaisa;
  }
  return byType;
});

sdRefundSchema.set("toJSON", { virtuals: true });
sdRefundSchema.set("toObject", { virtuals: true });

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

sdRefundSchema.index({ sd: 1, status: 1 });
sdRefundSchema.index({ tenant: 1, nepaliYear: 1, nepaliMonth: 1 });
sdRefundSchema.index({ entityId: 1, status: 1 });
sdRefundSchema.index({ refundDate: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// STATICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total amount already settled against a given SD (excludes REVERSED).
 */
sdRefundSchema.statics.totalSettledForSd = async function (sdId) {
  const result = await this.aggregate([
    {
      $match: {
        sd: new mongoose.Types.ObjectId(String(sdId)),
        status: { $ne: "REVERSED" },
      },
    },
    { $group: { _id: null, total: { $sum: "$totalAmountPaisa" } } },
  ]);
  return result[0]?.total ?? 0;
};

export const SdRefund = mongoose.model("SdRefund", sdRefundSchema);
