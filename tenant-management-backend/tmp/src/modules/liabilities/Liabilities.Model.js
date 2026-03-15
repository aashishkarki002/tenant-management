/**
 * Liabilities.Model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks operational liabilities: what the business owes and to whom.
 *
 * CHANGE: Added "LOAN" to referenceType enum so loan-originated liabilities
 *         can be tracked here. Also added loanStatus field for lifecycle.
 *
 * HOW LOANS FIT:
 *   - One Liability document is created when a loan is disbursed.
 *   - referenceType = "LOAN", referenceId = Loan._id
 *   - payeeType = "EXTERNAL" (we owe the bank, not a tenant)
 *   - status: RECORDED → SYNCED when fully repaid (loanStatus = CLOSED)
 *   - amountPaisa tracks the CURRENT outstanding balance (updated on each EMI)
 *
 * WHY BOTH Liability doc AND Account 2200?
 *   Account 2200 (LOAN_LIABILITY) is the double-entry balance sheet account —
 *   it drives the P&L and Trial Balance. The Liability document is the
 *   operational tracker used by the Liabilities UI page, vendor/lender lists,
 *   and cash-flow forecasting. They stay in sync: 2200 balance === sum of all
 *   active Liability.amountPaisa where referenceType === "LOAN".
 */

import mongoose from "mongoose";

const liabilitySchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiabilitySource", // e.g. LiabilitySource{ code: "LOAN" }
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    }, // Outstanding amount — decreases on each EMI principal payment

    originalAmountPaisa: {
      type: Number,
      default: null,
    }, // Immutable principal at disbursement — used to compute completion %

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
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

    payeeType: {
      type: String,
      enum: ["TENANT", "EXTERNAL"],
      required: true,
    }, // TENANT = we owe a tenant (refund); EXTERNAL = vendor/bank/lender

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function () {
        return this.payeeType === "TENANT";
      },
    },

    referenceType: {
      type: String,
      // ── ADDED "LOAN" ──────────────────────────────────────────────────────
      enum: [
        "RENT_EXPENSE",
        "CAM",
        "SALARY",
        "MANUAL",
        "SECURITY_DEPOSIT",
        "LOAN", // ← new: loan disbursement / outstanding balance
      ],
      default: "MANUAL",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return ["RENT_EXPENSE", "SALARY", "SECURITY_DEPOSIT", "LOAN"].includes(
          this.referenceType,
        );
      },
    }, // Points to Loan._id when referenceType === "LOAN"

    // ── Loan-specific lifecycle ────────────────────────────────────────────
    loanStatus: {
      type: String,
      enum: ["ACTIVE", "CLOSED", "DEFAULTED", null],
      default: null,
    }, // Mirrors Loan.status; null for non-loan liabilities

    status: {
      type: String,
      enum: ["RECORDED", "SYNCED"],
      default: "RECORDED",
    },

    notes: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
liabilitySchema.index({ referenceType: 1, referenceId: 1 }, { unique: true });
liabilitySchema.index({ loanStatus: 1 });
liabilitySchema.index({ npYear: 1, npMonth: 1 });

export const Liability = mongoose.model("Liability", liabilitySchema);
