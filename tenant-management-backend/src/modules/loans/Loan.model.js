/**
 * Loan.Model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks property owner loans from banks/lenders.
 *
 * Double-entry on disbursement:
 *   DR  Bank Account (1010-x)            ← asset increases (money received)
 *   CR  Loan Principal Liability (2200)  ← liability increases (we owe lender)
 *
 * See LoanPayment.Model.js for EMI payment entries.
 */

import mongoose from "mongoose";
import { safePaisaToRupees } from "../../utils/moneyUtil.js";

const loanSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },

    // ── Lender info ───────────────────────────────────────────────────────────
    lender: {
      type: String,
      required: true,
      trim: true,
    }, // e.g. "Nabil Bank", "NMB Bank"
    loanAccountNumber: {
      type: String,
      trim: true,
      default: null,
    },
    loanType: {
      type: String,
      enum: ["HOME_LOAN", "MORTGAGE", "PERSONAL", "OVERDRAFT", "BUSINESS"],
      required: true,
    },

    // ── Amounts — stored as PAISA ─────────────────────────────────────────────
    principalPaisa: {
      type: Number,
      required: true,
      min: 1,
    },
    outstandingPaisa: {
      type: Number,
      required: true,
      min: 0,
    }, // Decreases on each EMI

    // ── Terms ─────────────────────────────────────────────────────────────────
    interestRateAnnual: {
      type: Number,
      required: true,
      min: 0,
    }, // Percentage, e.g. 11.5
    tenureMonths: {
      type: Number,
      required: true,
      min: 1,
    },
    emiPaisa: {
      type: Number,
      default: 0,
    }, // Calculated: P * r*(1+r)^n / ((1+r)^n - 1)
    installmentsPaid: {
      type: Number,
      default: 0,
    },

    // ── Dates ─────────────────────────────────────────────────────────────────
    disbursedDate: {
      type: Date,
      required: true,
    },
    firstEmiDate: {
      type: Date,
      default: null,
    },
    nepaliDisbursedDate: {
      type: String,
      default: null,
    }, // "2081-04-15"
    nepaliMonth: {
      type: Number,
    },
    nepaliYear: {
      type: Number,
    },

    // ── Ledger link ───────────────────────────────────────────────────────────
    /** Account code of the bank sub-account that received the disbursement */
    bankAccountCode: {
      type: String,
      required: true,
    }, // e.g. "1010-NABIL"

    /** Transaction._id for the disbursement journal entry */
    disbursementTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED", "DEFAULTED", "PENDING"],
      default: "ACTIVE",
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
loanSchema.index({ entityId: 1, status: 1 });
loanSchema.index({ property: 1 });
loanSchema.index({ disbursedDate: -1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
loanSchema.virtual("principalRupees").get(function () {
  return safePaisaToRupees(this.principalPaisa ?? 0);
});
loanSchema.virtual("outstandingRupees").get(function () {
  return safePaisaToRupees(this.outstandingPaisa ?? 0);
});
loanSchema.virtual("emiRupees").get(function () {
  return safePaisaToRupees(this.emiPaisa ?? 0);
});
loanSchema.virtual("paidPrincipalPaisa").get(function () {
  return (this.principalPaisa ?? 0) - (this.outstandingPaisa ?? 0);
});
loanSchema.virtual("completionPercent").get(function () {
  if (!this.principalPaisa) return 0;
  return (
    ((this.principalPaisa - this.outstandingPaisa) / this.principalPaisa) *
    100
  ).toFixed(1);
});

// ── Static: Calculate EMI ─────────────────────────────────────────────────────
/**
 * Standard EMI formula: P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = monthly interest rate (annual / 12 / 100)
 * Returns integer paisa.
 */
loanSchema.statics.calculateEmiPaisa = function (
  principalPaisa,
  annualRatePct,
  tenureMonths,
) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return Math.round(principalPaisa / tenureMonths);
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principalPaisa * r * factor) / (factor - 1);
  return Math.round(emi); // integer paisa
};

/**
 * Build full amortization schedule (array of installments).
 * Each row: { installment, principalPaisa, interestPaisa, totalPaisa, outstandingAfterPaisa }
 */
loanSchema.statics.buildAmortizationSchedule = function (
  principalPaisa,
  annualRatePct,
  tenureMonths,
) {
  const r = annualRatePct / 12 / 100;
  const emiPaisa = this.calculateEmiPaisa(
    principalPaisa,
    annualRatePct,
    tenureMonths,
  );
  let outstandingPaisa = principalPaisa;
  const schedule = [];

  for (let i = 1; i <= tenureMonths; i++) {
    const interestPaisa = Math.round(outstandingPaisa * r);
    let principalPortionPaisa = emiPaisa - interestPaisa;

    // Final installment: clear any rounding residue
    if (i === tenureMonths) {
      principalPortionPaisa = outstandingPaisa;
    }

    outstandingPaisa -= principalPortionPaisa;
    schedule.push({
      installment: i,
      principalPaisa: principalPortionPaisa,
      interestPaisa,
      totalPaisa: principalPortionPaisa + interestPaisa,
      outstandingAfterPaisa: Math.max(0, outstandingPaisa),
    });
  }

  return schedule;
};

export const Loan = mongoose.model("Loan", loanSchema);
