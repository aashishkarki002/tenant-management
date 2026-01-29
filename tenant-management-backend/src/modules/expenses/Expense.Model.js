import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseSource",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    EnglishDate: {
      type: Date,
      default: Date.now,
    },
    nepaliDate: {
      type: Date,
      required: true,
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

    payeeType: {
      type: String,
      enum: ["TENANT", "EXTERNAL"],
      required: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function () {
        return this.payeeType === "TENANT";
      },
    },
    referenceType: {
      type: String,
      enum: [
        "MAINTENANCE",
        "UTILITY",
        "SALARY",
    
        "MANUAL",
      ],
      default: "MANUAL",
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return ["MAINTENANCE", "UTILITY", "SALARY"]
          .includes(this.referenceType);
      },
    },
    status: {
      type: String,
      enum: ["RECORDED", "SYNCED"],
      default: "RECORDED",
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

// indexes
expenseSchema.index({ date: -1 });
expenseSchema.index({ source: 1 });
expenseSchema.index({ tenant: 1 });

expenseSchema.pre("validate", function () {
  if (this.payeeType === "EXTERNAL") {
    this.tenant = undefined;
  }
 
});

export const Expense = mongoose.model("Expense", expenseSchema);
