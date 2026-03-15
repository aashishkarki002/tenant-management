/**
 * LoanPayment.Model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One document per EMI payment. Stores the principal/interest split so the
 * ledger service can post:
 *
 *   DR  Loan Principal Liability (2200)   principalPaisa
 *   DR  Loan Interest Expense    (5100)   interestPaisa
 *   CR  Bank Account             (1010-x) totalPaisa
 */

import mongoose from "mongoose";
import { safePaisaToRupees } from "../../utils/moneyUtil.js";

const loanPaymentSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    // ── EMI Breakdown — all PAISA ─────────────────────────────────────────────
    totalPaisa: {
      type: Number,
      required: true,
      min: 1,
    },
    principalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    interestPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    /** Snapshot of Loan.outstandingPaisa BEFORE this payment */
    outstandingBeforePaisa: {
      type: Number,
      required: true,
    },
    /** Snapshot of Loan.outstandingPaisa AFTER this payment */
    outstandingAfterPaisa: {
      type: Number,
      required: true,
    },

    // ── When ──────────────────────────────────────────────────────────────────
    paymentDate: {
      type: Date,
      required: true,
    },
    nepaliDate: {
      type: String,
      default: null,
    },
    nepaliMonth: {
      type: Number,
    },
    nepaliYear: {
      type: Number,
    },

    // ── How ───────────────────────────────────────────────────────────────────
    bankAccountCode: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "mobile_wallet"],
      required: true,
    },

    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    notes: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /** Back-reference to the Transaction created by ledgerService */
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
loanPaymentSchema.index({ loan: 1, installmentNumber: 1 });
loanPaymentSchema.index({ paymentDate: -1 });
loanPaymentSchema.index({ entityId: 1, nepaliYear: 1, nepaliMonth: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
loanPaymentSchema.virtual("totalRupees").get(function () {
  return safePaisaToRupees(this.totalPaisa ?? 0);
});
loanPaymentSchema.virtual("principalRupees").get(function () {
  return safePaisaToRupees(this.principalPaisa ?? 0);
});
loanPaymentSchema.virtual("interestRupees").get(function () {
  return safePaisaToRupees(this.interestPaisa ?? 0);
});

// ── Pre-save validation ───────────────────────────────────────────────────────
loanPaymentSchema.pre("save", function () {
  const diff = Math.abs(
    this.totalPaisa - (this.principalPaisa + this.interestPaisa),
  );
  if (diff > 1) {
    // Allow 1 paisa rounding tolerance
    throw new Error(
      `LoanPayment: totalPaisa (${this.totalPaisa}) must equal ` +
        `principalPaisa (${this.principalPaisa}) + interestPaisa (${this.interestPaisa})`,
    );
  }
});

export const LoanPayment = mongoose.model("LoanPayment", loanPaymentSchema);
