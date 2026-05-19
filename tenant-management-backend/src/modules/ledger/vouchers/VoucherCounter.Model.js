import mongoose from "mongoose";

/**
 * VoucherCounter — atomic sequential numbering per (entityId, voucherType).
 *
 * Uses findOneAndUpdate + $inc for MongoDB-atomic counter increments.
 * No two concurrent postings for the same entity+type can receive the same number.
 *
 * Format: {VOUCHER_TYPE}-{sequence padded to 4 digits}
 *   e.g. RINV-0001, CAM-0042, JV-0007
 */

export const VOUCHER_TYPES = [
  "RINV",  // Rent Invoice
  "CAM",   // CAM Invoice
  "EINV",  // Electricity Invoice
  "RV",    // Receipt Voucher (cash/bank in)
  "PV",    // Payment Voucher (cash/bank out)
  "SD",    // Security Deposit
  "CV",    // Cheque Voucher
  "JV",    // Journal Voucher (adjustments, year-end, manual)
];

/**
 * Maps base transaction types to voucher types.
 * _REVERSAL suffix is stripped before lookup.
 */
export const TRANSACTION_TO_VOUCHER_TYPE = {
  // Rent invoices
  RENT_CHARGE: "RINV",
  RENT_CHARGE_PRORATED: "RINV",

  // CAM invoices
  CAM_CHARGE: "CAM",
  CAM_CHARGE_PRORATED: "CAM",

  // Electricity invoices
  ELECTRICITY_CHARGE: "EINV",
  ELECTRICITY_NEA_COST: "EINV",
  NEA_BILL_ENERGY_COST: "EINV",
  ELECTRICITY_COMMON_EXPENSE: "EINV",
  ELECTRICITY_DEMAND_CHARGE: "EINV",

  // Receipt vouchers (money in)
  RENT_PAYMENT_RECEIVED: "RV",
  CAM_PAYMENT_RECEIVED: "RV",
  ELECTRICITY_PAYMENT: "RV",
  LATE_FEE_PAYMENT_RECEIVED: "RV",
  ADVANCE_RENT_DISBURSEMENT: "RV",
  OTHER_INCOME: "RV",
  REVENUE_STREAM: "RV",

  // Payment vouchers (money out)
  MAINTENANCE_EXPENSE: "PV",
  UTILITY_EXPENSE: "PV",
  OTHER_EXPENSE: "PV",
  NEA_PAYMENT: "PV",
  LOAN_DISBURSEMENT: "PV",
  LOAN_PAYMENT: "PV",
  ADVANCE_RENT_REFUND: "PV",
  TDS_PAID_TO_GOVT: "PV",

  // Security deposit
  SECURITY_DEPOSIT: "SD",
  SECURITY_DEPOSIT_REFUND: "SD",
  SD_REFUND_CASH_REFUND: "SD",
  SD_REFUND_MAINTENANCE_ADJUSTMENT: "SD",
  SD_REFUND_MAINTENANCE_EXPENSE_OFFSET: "SD",
  SD_REFUND_RENT_ADJUSTMENT: "SD",
  SD_REFUND_CAM_ADJUSTMENT: "SD",
  SD_REFUND_ELECTRICITY_ADJUSTMENT: "SD",
  SD_REFUND_COMPOUND: "SD",

  // Cheque vouchers
  CHEQUE_RECEIPT: "CV",
  CHEQUE_DEPOSIT: "CV",
  CHEQUE_BOUNCE: "CV",
  CHEQUE_CANCEL: "CV",
  CHEQUE_CANCELLATION: "CV",
  CHEQUE_DRAFT: "CV",

  // Deferral accounting (upfront-billing + accrual)
  RENT_ONBOARDING: "RINV",
  RENT_DEFERRAL_INITIAL: "JV",
  RENT_DEFERRAL_RECOGNITION: "JV",

  // Advance rent receipt (fix existing omission)
  ADVANCE_RENT_RECEIPT: "RV",

  // Journal vouchers (catch-all: adjustments, close entries, manual)
  ADJUSTMENT: "JV",
  DEBIT_NOTE: "JV",
  CREDIT_NOTE: "JV",
  MANUAL_JOURNAL: "JV",
  OPENING_BALANCE: "JV",
  YEAR_END_CLOSE_REVENUE: "JV",
  YEAR_END_CLOSE_EXPENSE: "JV",
  YEAR_END_CLOSE_RETAINED: "JV",
  YEAR_END_CLOSE_REVERSAL: "JV",
  BAD_DEBT_WRITEOFF: "JV",
  ADVANCE_RENT_RECOGNITION: "JV",
  TDS_WITHHELD: "JV",
  LATE_FEE_CHARGE: "JV",
};

const voucherCounterSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
    },
    voucherType: {
      type: String,
      enum: VOUCHER_TYPES,
      required: true,
    },
    lastSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

voucherCounterSchema.index({ entityId: 1, voucherType: 1 }, { unique: true });

export const VoucherCounter = mongoose.model("VoucherCounter", voucherCounterSchema);
