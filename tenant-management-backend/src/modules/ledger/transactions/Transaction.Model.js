import mongoose from "mongoose";
import { paisaToRupees } from "../../../utils/moneyUtil.js";

const transactionSchema = new mongoose.Schema(
  {
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    nepaliDate: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "RENT_CHARGE",
        "CAM_CHARGE",
        "RENT_PAYMENT_RECEIVED",
        "SECURITY_DEPOSIT",
        "MAINTENANCE_EXPENSE",
        "REVENUE_STREAM",
        "UTILITY_EXPENSE",
        "OTHER_INCOME",
        "OTHER_EXPENSE",
        "ADJUSTMENT",
        "ELECTRICITY_CHARGE",
        "ELECTRICITY_PAYMENT",
        "CAM_PAYMENT_RECEIVED",
        "LATE_FEE_CHARGE",
        "LATE_FEE_PAYMENT_RECEIVED",
        "LOAN_DISBURSEMENT",
        "LOAN_PAYMENT",
        "SECURITY_DEPOSIT_REFUND",
        "ELECTRICITY_NEA_COST",
        "TDS_WITHHELD",
        "TDS_PAID_TO_GOVT",
        "SD_REFUND_CASH_REFUND",
        "SD_REFUND_MAINTENANCE_ADJUSTMENT",
        "SD_REFUND_MAINTENANCE_EXPENSE_OFFSET",
        "SD_REFUND_RENT_ADJUSTMENT",
        "SD_REFUND_CAM_ADJUSTMENT",
        "SD_REFUND_ELECTRICITY_ADJUSTMENT",
        "SD_REFUND_COMPOUND",
        "CHEQUE_DEPOSIT",
        "CHEQUE_BOUNCE",
        "CHEQUE_CANCELLATION",
        "CHEQUE_DRAFT",
        "NEA_PAYMENT",
        "OPENING_BALANCE",
        // ── Year-end close ──────────────────────────────────────────────────
        "YEAR_END_CLOSE_REVENUE",
        "YEAR_END_CLOSE_EXPENSE",
        "YEAR_END_CLOSE_RETAINED",
        "YEAR_END_CLOSE_REVERSAL",
        // ── Vacate settlement ───────────────────────────────────────────────
        "RENT_CHARGE_PRORATED",
        "CAM_CHARGE_PRORATED",
        "BAD_DEBT_WRITEOFF",
        // ── Adjustments ─────────────────────────────────────────────────────
        "DEBIT_NOTE",
        "CREDIT_NOTE",
        "MANUAL_JOURNAL",
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "POSTED", "VOIDED"],
      default: "POSTED",
    },
    referenceType: {
      type: String,
      enum: [
        "Rent",
        "Cam",
        "SecurityDeposit",
        "CamPayment",
        "Payment",
        "Maintenance",
        "Revenue",
        "Expense",
        "Adjustment",
        "Electricity",
        "Other",
        "RentPayment",
        "LateFee",
        "LateFeePayment",
        "LoanDisbursement",
        "LoanPayment",
        "Loan",
        "SecurityDepositRefund",
        "ElectricityNeaCost",
        "SdRefund",
        "ChequeDeposit",
        "ChequeBounce",
        "ChequeDraft",
        "ChequeCancellation",
        "FiscalYearClose",
        "VacateSettlement",
        "Adjustment",
      ],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "referenceType",
    },

    // ─────────────────────────────────────────────────
    // ENTITY SCOPE — every transaction belongs to one OwnershipEntity
    // ─────────────────────────────────────────────────
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    totalAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
      get: paisaToRupees,
    },

    // Backward compatibility getter
    totalAmount: {
      type: Number,
      get: function () {
        return this.totalAmountPaisa ? paisaToRupees(this.totalAmountPaisa) : 0;
      },
    },
    // Indicates whether the underlying charge is monthly or quarterly.
    // This is especially useful for rent transactions so we can
    // differentiate them easily in reports.
    billingFrequency: {
      type: String,
      enum: ["monthly", "quarterly"],
      default: "monthly",
    },
    // Optional quarter number (1-4) for quarterly transactions.
    // For monthly transactions this will typically be null/undefined.
    quarter: {
      type: Number,
      min: 1,
      max: 4,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    voidedAt: {
      type: Date,
    },
    voidReason: {
      type: String,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ transactionDate: 1, type: 1 });
transactionSchema.index({ referenceType: 1, referenceId: 1 });
transactionSchema.index({ status: 1 });
// Idempotency query index — mirrors the findOne guard in ledger.service.js
transactionSchema.index({ entityId: 1, type: 1, referenceType: 1, referenceId: 1 });
transactionSchema.index(
  { description: "text" },
  { name: "transaction_text_search" },
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
