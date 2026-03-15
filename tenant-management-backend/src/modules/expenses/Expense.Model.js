import mongoose from "mongoose";

/**
 * Expense.Model.js — v2 (multi-entity)
 *
 * Changes:
 *  - payeeType extended to TENANT | EXTERNAL | INTERNAL
 *  - externalPayee sub-doc (name, type, contactInfo)
 *  - staffPayee sub-doc (staffId, role, department, payPeriod) for INTERNAL
 *  - nepaliDate stored as "YYYY-MM-DD" BS string (not a Date)
 *  - transactionScope: "building" | "split" | "head_office"
 *  - entityId always required when transactionScope === "building" or "head_office"
 */
const expenseSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseSource",
      required: true,
    },

    // ─────────────────────────────────────────────────
    // FINANCIAL — stored as PAISA (integer)
    // ─────────────────────────────────────────────────
    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    // ─────────────────────────────────────────────────
    // DATES
    // ─────────────────────────────────────────────────
    EnglishDate: {
      type: Date,
      default: Date.now,
    },
    // "YYYY-MM-DD" BS string — NOT a Date object (avoids UTC+5:45 timezone shift)
    nepaliDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    nepaliMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    nepaliYear: {
      type: Number,
      required: true,
    },

    // ─────────────────────────────────────────────────
    // PAYEE
    // ─────────────────────────────────────────────────
    payeeType: {
      type: String,
      enum: ["TENANT", "EXTERNAL", "INTERNAL"],
      required: true,
    },

    // TENANT payee
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function () {
        return this.payeeType === "TENANT";
      },
    },

    // EXTERNAL payee (vendor, contractor, utility company, etc.)
    externalPayee: {
      name: { type: String, trim: true },
      // What kind of external party
      type: {
        type: String,
        enum: ["VENDOR", "CONTRACTOR", "UTILITY", "GOVERNMENT", "OTHER"],
      },
      contactInfo: { type: String, trim: true },
    },

    // INTERNAL payee (staff salary, advance, reimbursement)
    staffPayee: {
      staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      role: { type: String, trim: true },
      department: { type: String, trim: true },
      payPeriod: {
        month: {
          type: Number,
          required: function () {
            return this.payeeType === "INTERNAL";
          },
          min: 1,
          max: 12,
        },
        year: {
          type: Number,
          required: function () {
            return this.payeeType === "INTERNAL";
          },
        },
      },
    },

    // ─────────────────────────────────────────────────
    // REFERENCE
    // ─────────────────────────────────────────────────
    referenceType: {
      type: String,
      enum: ["MAINTENANCE", "UTILITY", "SALARY", "ADVANCE", "MANUAL"],
      default: "MANUAL",
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return ["MAINTENANCE", "UTILITY", "SALARY"].includes(
          this.referenceType,
        );
      },
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "mobile_wallet"], // must match paymentAccountUtils.PAYMENT_METHODS
      required: true,
    },

    status: {
      type: String,
      enum: ["RECORDED", "SYNCED"],
      default: "RECORDED",
    },
    notes: { type: String, trim: true },

    // Ledger account code override (e.g. "5000" for maintenance)
    expenseCode: { type: String, trim: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // ─────────────────────────────────────────────────
    // MULTI-ENTITY SCOPE
    // ─────────────────────────────────────────────────
    transactionScope: {
      type: String,
      enum: ["building", "split", "head_office"],
      required: true,
      default: "building",
    },

    // Always required — identifies the owning entity regardless of scope
    // (building → property entity, head_office → HQ entity, split → primary entity)
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
    },
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: function () {
        return ["building", "split"].includes(this.transactionScope);
      },
      default: null,
    },

    // Used when transactionScope === "split"
    splitAllocations: [
      {
        blockId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Block",
          required: true,
        },
        entityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OwnershipEntity",
          required: true,
        },
        percentage: { type: Number, required: true, min: 0, max: 100 },
        amountPaisa: { type: Number, required: true, min: 0 },
        ledgerEntryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LedgerEntry",
        },
      },
    ],
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
expenseSchema.index({ EnglishDate: -1 });
expenseSchema.index({ source: 1 });
expenseSchema.index({ tenant: 1 });
expenseSchema.index({ entityId: 1, EnglishDate: -1 });
expenseSchema.index({ nepaliYear: 1, nepaliMonth: 1 });
expenseSchema.index({ "staffPayee.staffId": 1, nepaliYear: 1, nepaliMonth: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE
// ─────────────────────────────────────────────────────────────────────────────
expenseSchema.pre("validate", function () {
  // Enforce paisa is integer
  if (this.amountPaisa && !Number.isInteger(this.amountPaisa)) {
    throw new Error(
      `Expense amount must be integer paisa, got: ${this.amountPaisa}`,
    );
  }

  // Clear irrelevant payee sub-docs
  if (this.payeeType === "EXTERNAL") {
    this.tenant = undefined;
    this.staffPayee = undefined;
  } else if (this.payeeType === "TENANT") {
    this.externalPayee = undefined;
    this.staffPayee = undefined;
  } else if (this.payeeType === "INTERNAL") {
    this.tenant = undefined;
    this.externalPayee = undefined;
  }

  // entityId is required on every expense regardless of scope
  if (!this.entityId) {
    throw new Error("entityId is required on all expenses");
  }
  if (this.transactionScope === "split") {
    if (!this.splitAllocations?.length) {
      throw new Error(
        'splitAllocations is required when transactionScope is "split"',
      );
    }
    const totalPct = this.splitAllocations.reduce(
      (s, a) => s + (a.percentage || 0),
      0,
    );
    if (Math.round(totalPct) !== 100) {
      throw new Error(
        `Split allocations must sum to 100%, got ${totalPct.toFixed(2)}%`,
      );
    }
  }
});

export const Expense = mongoose.model("Expense", expenseSchema);
