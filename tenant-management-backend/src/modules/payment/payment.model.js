import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

const paymentSchema = new mongoose.Schema({
  rent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rent",
    required: false,
  },
  cam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cam",
    required: false,
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BankAccount",
    required: false,
  },
  
  // ============================================
  // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
  // ============================================
  amountPaisa: {
    type: Number,
    required: true,
    min: 0,
    get: paisaToRupees,
  },
  
  // Backward compatibility getter
  amount: {
    type: Number,
    get: function () {
      return this.amountPaisa ? paisaToRupees(this.amountPaisa) : 0;
    },
  },
  
  paymentDate: {
    type: Date,
    required: true,
  },
  nepaliDate: {
    type: Date,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["cheque", "bank_transfer", "cash"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "partially_paid", "overdue", "cancelled"],
    default: "pending",
  },
  receipt: {
    url: String,
    publicId: String,
    generatedAt: Date,
  },
  bankVerifiedDate: {
    type: Date,
    required: false,
  },
  receiptGeneratedDate: {
    type: Date,
    required: false,
  },
  note: {
    type: String,
    required: false,
  },
  transactionRef: {
    type: String,
    required: false,
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: false,
  },
  allocations: {
    rent: {
      rentId: mongoose.Schema.Types.ObjectId,
      amountPaisa: Number, // Amount in paisa
      amount: { // Backward compatibility
        type: Number,
        get: function () {
          return this.amountPaisa ? paisaToRupees(this.amountPaisa) : 0;
        },
      },
    },
    cam: {
      camId: mongoose.Schema.Types.ObjectId,
      paidAmountPaisa: Number, // Paid amount in paisa
      paidAmount: { // Backward compatibility
        type: Number,
        get: function () {
          return this.paidAmountPaisa ? paisaToRupees(this.paidAmountPaisa) : 0;
        },
      },
      amount: { // Keep for backward compatibility
        type: Number,
        get: function () {
          return this.paidAmountPaisa ? paisaToRupees(this.paidAmountPaisa) : 0;
        },
      },
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
});

paymentSchema.pre("save", function () {
  // Ensure amount is an integer
  if (!Number.isInteger(this.amountPaisa)) {
    throw new Error(
      `Payment amount must be integer paisa, got: ${this.amountPaisa}`,
    );
  }
});

export const Payment = mongoose.model("Payment", paymentSchema);
