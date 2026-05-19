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
      required: true,
      /**
       * Allowed transaction types.
       *
       * The enum is validated via a custom validator (not Mongoose `enum`) so that
       * reversal entries (any known type + "_REVERSAL" suffix) are automatically
       * accepted without enumerating every variant explicitly.
       *
       * Known base types (for reference / documentation):
       *   RENT_CHARGE, CAM_CHARGE, RENT_PAYMENT_RECEIVED, SECURITY_DEPOSIT,
       *   MAINTENANCE_EXPENSE, REVENUE_STREAM, UTILITY_EXPENSE, OTHER_INCOME,
       *   OTHER_EXPENSE, ADJUSTMENT, ELECTRICITY_CHARGE, ELECTRICITY_PAYMENT,
       *   CAM_PAYMENT_RECEIVED, LATE_FEE_CHARGE, LATE_FEE_PAYMENT_RECEIVED,
       *   LOAN_DISBURSEMENT, LOAN_PAYMENT, SECURITY_DEPOSIT_REFUND,
       *   ELECTRICITY_NEA_COST, TDS_WITHHELD, TDS_PAID_TO_GOVT,
       *   SD_REFUND_CASH_REFUND, SD_REFUND_MAINTENANCE_ADJUSTMENT,
       *   SD_REFUND_MAINTENANCE_EXPENSE_OFFSET, SD_REFUND_RENT_ADJUSTMENT,
       *   SD_REFUND_CAM_ADJUSTMENT, SD_REFUND_ELECTRICITY_ADJUSTMENT, SD_REFUND_COMPOUND,
       *   CHEQUE_RECEIPT, CHEQUE_DEPOSIT, CHEQUE_BOUNCE, CHEQUE_CANCEL,
       *   CHEQUE_CANCELLATION (compat), CHEQUE_DRAFT,
       *   NEA_PAYMENT, OPENING_BALANCE,
       *   YEAR_END_CLOSE_REVENUE, YEAR_END_CLOSE_EXPENSE, YEAR_END_CLOSE_RETAINED,
       *   YEAR_END_CLOSE_REVERSAL,
       *   RENT_CHARGE_PRORATED, CAM_CHARGE_PRORATED, BAD_DEBT_WRITEOFF,
       *   DEBIT_NOTE, CREDIT_NOTE, MANUAL_JOURNAL,
       *   ADVANCE_RENT_DISBURSEMENT, ADVANCE_RENT_RECOGNITION, ADVANCE_RENT_REFUND
       *
       * Any of the above with a "_REVERSAL" suffix is also valid.
       */
      validate: {
        validator(v) {
          const BASE_TYPES = new Set([
            "RENT_CHARGE", "CAM_CHARGE", "RENT_PAYMENT_RECEIVED", "SECURITY_DEPOSIT",
            "MAINTENANCE_EXPENSE", "REVENUE_STREAM", "UTILITY_EXPENSE", "OTHER_INCOME",
            "OTHER_EXPENSE", "ADJUSTMENT", "ELECTRICITY_CHARGE", "ELECTRICITY_PAYMENT",
            "CAM_PAYMENT_RECEIVED", "LATE_FEE_CHARGE", "LATE_FEE_PAYMENT_RECEIVED",
            "LOAN_DISBURSEMENT", "LOAN_PAYMENT", "SECURITY_DEPOSIT_REFUND",
            "ELECTRICITY_NEA_COST", "ELECTRICITY_COMMON_EXPENSE", "ELECTRICITY_DEMAND_CHARGE",
            "TDS_WITHHELD", "TDS_PAID_TO_GOVT",
            "SD_REFUND_CASH_REFUND", "SD_REFUND_MAINTENANCE_ADJUSTMENT",
            "SD_REFUND_MAINTENANCE_EXPENSE_OFFSET", "SD_REFUND_RENT_ADJUSTMENT",
            "SD_REFUND_CAM_ADJUSTMENT", "SD_REFUND_ELECTRICITY_ADJUSTMENT",
            "SD_REFUND_COMPOUND",
            "CHEQUE_RECEIPT", "CHEQUE_DEPOSIT", "CHEQUE_BOUNCE",
            "CHEQUE_CANCEL", "CHEQUE_CANCELLATION", "CHEQUE_DRAFT",
            "NEA_PAYMENT", "NEA_BILL_ENERGY_COST", "OPENING_BALANCE",
            "YEAR_END_CLOSE_REVENUE", "YEAR_END_CLOSE_EXPENSE",
            "YEAR_END_CLOSE_RETAINED", "YEAR_END_CLOSE_REVERSAL",
            "RENT_CHARGE_PRORATED", "CAM_CHARGE_PRORATED", "BAD_DEBT_WRITEOFF",
            "DEBIT_NOTE", "CREDIT_NOTE", "MANUAL_JOURNAL",
            "ADVANCE_RENT_DISBURSEMENT", "ADVANCE_RENT_RECOGNITION", "ADVANCE_RENT_REFUND",
            "ADVANCE_RENT_RECEIPT",
            // Upfront-billing + accrual deferral
            "RENT_ONBOARDING", "RENT_DEFERRAL_INITIAL", "RENT_DEFERRAL_RECOGNITION",
          ]);
          // Accept base types and any base type + "_REVERSAL" suffix
          if (BASE_TYPES.has(v)) return true;
          if (v.endsWith("_REVERSAL")) {
            const base = v.slice(0, -9); // strip "_REVERSAL"
            return BASE_TYPES.has(base);
          }
          return false;
        },
        message: (props) => `"${props.value}" is not a valid transaction type`,
      },
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
        "NeaBill",
        "SdRefund",
        "ChequeDeposit",
        "ChequeBounce",
        "ChequeDraft",
        "ChequeCancellation",
        "FiscalYearClose",
        "VacateSettlement",
        "Adjustment",
        "RentDeferralSchedule",
        "AdvanceRent",
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

    /** Timestamp when this transaction was posted to the ledger. */
    postedAt: {
      type: Date,
      default: null,
    },

    /** Admin who posted this transaction (may differ from createdBy). */
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // ─────────────────────────────────────────────────
    // VOUCHER NUMBERING — ERP-style sequential numbers
    // ─────────────────────────────────────────────────

    /**
     * Human-readable voucher number assigned at post time.
     * Format: {TYPE}-{sequence padded to 4 digits}
     * Examples: RINV-0001, CAM-0042, JV-0007, SD-0003
     * Null for transaction types not in the voucher type map.
     */
    voucherNo: {
      type: String,
      default: null,
      index: true,
    },

    /**
     * Voucher category derived from transactionType.
     * RINV=Rent Invoice, CAM=CAM Invoice, EINV=Electricity Invoice,
     * RV=Receipt Voucher, PV=Payment Voucher, SD=Security Deposit,
     * CV=Cheque Voucher, JV=Journal Voucher.
     */
    voucherType: {
      type: String,
      enum: ["RINV", "CAM", "EINV", "RV", "PV", "SD", "CV", "JV", null],
      default: null,
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
// Voucher number lookup: unique per entity (sparse — null voucherNo rows excluded)
transactionSchema.index({ entityId: 1, voucherNo: 1 }, { sparse: true });
transactionSchema.index({ entityId: 1, voucherType: 1, transactionDate: -1 });
transactionSchema.index(
  { description: "text" },
  { name: "transaction_text_search" },
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
