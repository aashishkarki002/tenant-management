/**
 * ChequeDraft.Model.js
 *
 * Tracks the lifecycle of cheques from issuance/receipt to bank clearance.
 *
 * Status flow:
 *   PENDING → DEPOSITED  (accountant marks bank processed it)
 *   PENDING → BOUNCED    (bank returned the cheque)
 *   PENDING → CANCELLED  (voided before presenting to bank)
 *
 * Direction:
 *   ISSUED   — we wrote a cheque to pay someone (expense / loan EMI)
 *   RECEIVED — we received a cheque from someone (revenue)
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const ChequeDraftSchema = new Schema(
  {
    chequeNumber: {
      type: String,
      required: [true, "chequeNumber is required"],
      trim: true,
    },

    chequeDate: {
      type: Date,
      required: [true, "chequeDate is required"],
    },

    /** From entity perspective: ISSUED = we paid, RECEIVED = we were paid */
    direction: {
      type: String,
      enum: ["ISSUED", "RECEIVED"],
      required: [true, "direction is required"],
    },

    status: {
      type: String,
      enum: ["PENDING", "DEPOSITED", "BOUNCED", "CANCELLED"],
      default: "PENDING",
    },

    /** Integer paisa — never float */
    amountPaisa: {
      type: Number,
      required: [true, "amountPaisa is required"],
      validate: {
        validator: (v) => Number.isInteger(v) && v > 0,
        message: "amountPaisa must be a positive integer",
      },
    },

    /**
     * Target bank sub-account code (e.g. "1010-NABIL").
     * For ISSUED cheques: money exits this bank on deposit.
     * For RECEIVED cheques: money enters this bank on deposit.
     * Used to post the second (deposit) journal entry.
     */
    bankAccountCode: {
      type: String,
      required: [true, "bankAccountCode is required"],
    },

    /**
     * Original expense / revenue account code (e.g. "5200", "4000").
     * Stored so the bounce/cancel reversal journal can credit/debit the
     * correct account without re-fetching the referenced document.
     */
    referenceAccountCode: {
      type: String,
      default: null,
    },

    referenceType: {
      type: String,
      enum: ["Expense", "Revenue", "LoanPayment", "AdvanceRent"],
      default: null,
    },

    referenceId: {
      type: Schema.Types.ObjectId,
      refPath: "referenceType",
      default: null,
    },

    entityId: {
      type: Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: [true, "entityId is required"],
      index: true,
    },

    /** Payee (for ISSUED) or payer (for RECEIVED) display name */
    partyName: {
      type: String,
      default: null,
    },

    // ── Nepali date ────────────────────────────────────────────────────────────
    nepaliDate: { type: String, default: null },   // "YYYY-MM-DD" BS string
    nepaliMonth: { type: Number, default: null },
    nepaliYear: { type: Number, default: null },

    // ── Deposit fields ─────────────────────────────────────────────────────────
    /** LedgerTransaction._id created by the deposit journal */
    clearingTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "LedgerTransaction",
      default: null,
    },

    depositedAt: { type: Date, default: null },

    depositedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    depositNotes: { type: String, default: null },

    // ── Bounce / cancel fields ─────────────────────────────────────────────────
    bounceReason: { type: String, default: null },

    /** LedgerTransaction._id created by the reversal journal */
    reversalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "LedgerTransaction",
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "createdBy is required"],
    },
  },
  {
    timestamps: true,
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────
ChequeDraftSchema.index({ entityId: 1, status: 1 });
ChequeDraftSchema.index({ referenceType: 1, referenceId: 1 });
ChequeDraftSchema.index({ chequeNumber: 1, direction: 1, entityId: 1 });

export const ChequeDraft = mongoose.model("ChequeDraft", ChequeDraftSchema);
