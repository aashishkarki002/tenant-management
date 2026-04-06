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

    englishDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // "YYYY-MM-DD" BS string — NOT a Date object (avoids UTC+5:45 timezone shift)
    nepaliDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    nepaliYear: {
      type: Number,
      index: true,
    },
    nepaliMonth: {
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

    // EXTERNAL payee (bank/lender/vendor) — mirrors Expense.externalPayee
    externalPayee: {
      name: { type: String, trim: true },
      type: {
        type: String,
        enum: ["VENDOR", "CONTRACTOR", "BANK", "GOVERNMENT", "OTHER"],
      },
      contactInfo: { type: String, trim: true },
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

    // ── Payment method (for settled liabilities) ───────────────────────────
    // Only required for EXTERNAL payees (vendor/bank payments).
    // TENANT liabilities (security deposit refunds) get payment method
    // when they're actually settled via SdRefund.
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "mobile_wallet"],
      required: function () {
        return this.payeeType === "EXTERNAL";
      },
    },

    status: {
      type: String,
      enum: ["RECORDED", "SYNCED", "REVERSED"],
      default: "RECORDED",
    },

    notes: String,

    // Reversal fields — mirrors Revenue's reversal pattern
    reversalReason: { type: String },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    reversedAt: { type: Date },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // ── Multi-entity scope (mirrors Revenue and Expense) ─────────────────────
    transactionScope: {
      type: String,
      enum: ["building", "split", "head_office"],
      default: "building",
    },

    // Always set — identifies the owning entity
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
    },

    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      default: null,
    },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
liabilitySchema.index({ referenceType: 1, referenceId: 1 }, { unique: true });
liabilitySchema.index({ loanStatus: 1 });
liabilitySchema.index({ nepaliYear: 1, nepaliMonth: 1 });
liabilitySchema.index({ entityId: 1, nepaliYear: 1, nepaliMonth: 1 });

export const Liability = mongoose.model("Liability", liabilitySchema);
