import mongoose from "mongoose";

const camSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
      required: true,
    },
    innerBlock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InnerBlock",
      required: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear: { type: Number, required: true },
    nepaliDate: { type: String, required: true },
    year: { type: Number, required: true },

    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmountPaisa: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
      default: "pending",
    },
    englishDueDate: { type: Date, default: null },
    nepaliDueDate: { type: String, default: null },
    paidDate: { type: Date, default: null },
    notes: { type: String, default: "" },
    emailReminderSent: {
      type: Boolean,
      default: false,
    },

    documentNumber: {
      type: String,
      default: null,
      index: { sparse: true },
    },

    // ── Frequency ────────────────────────────────────────────────────────────
    camFrequency: {
      type: String,
      enum: ["monthly", "quarterly"],
      default: "monthly",
      required: true,
    },

    // For quarterly CAM records: the ending BS month/year of the quarter.
    // e.g. a Baisakh-Jestha-Ashadh quarter has nepaliMonth=1, nepaliMonthEnd=3.
    nepaliMonthEnd: { type: Number, min: 1, max: 12, default: null },
    nepaliYearEnd:  { type: Number, default: null },
  },
  { timestamps: true },
);

// Unique index: one CAM record per tenant per billing period start month/year
camSchema.index({ tenant: 1, nepaliMonth: 1, nepaliYear: 1 }, { unique: true });
camSchema.index({ camFrequency: 1 });

camSchema.virtual("remainingAmountPaisa").get(function () {
  return this.amountPaisa - this.paidAmountPaisa;
});

// Round paisa before validation runs
camSchema.pre("validate", function () {
  if (this.amountPaisa != null && !Number.isInteger(this.amountPaisa)) {
    this.amountPaisa = Math.round(this.amountPaisa);
  }
  if (this.paidAmountPaisa != null && !Number.isInteger(this.paidAmountPaisa)) {
    this.paidAmountPaisa = Math.round(this.paidAmountPaisa);
  }
});

camSchema.pre("save", function () {
  // Ensure amounts are integers (guard — pre-validate already rounded)
  if (!Number.isInteger(this.amountPaisa)) {
    this.amountPaisa = Math.round(this.amountPaisa);
  }
  if (!Number.isInteger(this.paidAmountPaisa)) {
    this.paidAmountPaisa = Math.round(this.paidAmountPaisa);
  }

  // Validate paid amount doesn't exceed CAM amount (in paisa)
  if (this.paidAmountPaisa > this.amountPaisa) {
    throw new Error("Paid amount cannot exceed CAM amount");
  }

  // Update status based on payment (using paisa values)
  if (this.paidAmountPaisa === 0) {
    this.status = "pending";
  } else if (this.paidAmountPaisa >= this.amountPaisa) {
    this.status = "paid";
  } else {
    this.status = "partially_paid";
  }
});

export const Cam = mongoose.model("Cam", camSchema);
