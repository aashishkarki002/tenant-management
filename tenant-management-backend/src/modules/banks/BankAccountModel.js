/**
 * BankAccountModel.js  (FIXED)
 *
 * FIX — Added accountCode field.
 *
 * WHY IT'S NEEDED:
 *   The double-entry ledger (paymentAccountUtil.getDebitAccountForPayment)
 *   routes bank payments to a SPECIFIC account code — e.g. "1010-NABIL" —
 *   not a generic "BANK" bucket. Without accountCode on this document, the
 *   journal builder throws:
 *     "bankAccountCode is required for payment method bank_transfer"
 *
 * INDUSTRY STANDARD:
 *   Each physical bank account maps 1:1 to a chart-of-accounts code (sub-ledger).
 *   The accountCode here IS that chart-of-accounts code.
 *   Examples: "1010-NABIL", "1011-GLOBAL-IME", "1012-NIC-ASIA"
 *   They all sit under the 1010-1099 asset range.
 */

import mongoose from "mongoose";
import { safePaisaToRupees, formatMoney } from "../../utils/moneyUtil.js";

const bankAccountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },

    /**
     * Chart-of-accounts code for this physical bank account.
     * Used by journal builders to route the DR/CR to the correct ledger account.
     * Must be unique across all BankAccount documents.
     * Convention: "1010-{BANK_ABBREVIATION}"
     * Examples:   "1010-NABIL", "1011-GLOBAL-IME", "1012-NIC-ASIA"
     */
    accountCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // ── Financial — stored as paisa (integer) ─────────────────────────────
    balancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Pre-save guards ───────────────────────────────────────────────────────────

bankAccountSchema.pre("save", function () {
  if (!Number.isInteger(this.balancePaisa)) {
    throw new Error(
      `Bank account balance must be integer paisa, got: ${this.balancePaisa}`,
    );
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bankAccountSchema.index({ accountNumber: 1, isDeleted: 1 });
bankAccountSchema.index({ accountCode: 1 }, { unique: true });

// ── Virtuals ──────────────────────────────────────────────────────────────────

bankAccountSchema.virtual("balance").get(function () {
  return safePaisaToRupees(this.balancePaisa ?? 0);
});

bankAccountSchema.virtual("balanceFormatted").get(function () {
  const paisa = this.balancePaisa ?? 0;
  return typeof paisa === "number" && Number.isInteger(paisa)
    ? formatMoney(paisa)
    : "Rs. 0.00";
});

bankAccountSchema.set("toJSON", { virtuals: true, getters: false });
bankAccountSchema.set("toObject", { virtuals: true, getters: false });

export default mongoose.model("BankAccount", bankAccountSchema);
