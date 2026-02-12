import mongoose from "mongoose";
import { paisaToRupees } from "../../utils/moneyUtil.js";

const bankAccountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },

    // ============================================
    // FINANCIAL FIELDS - STORED AS PAISA (INTEGERS)
    // ============================================
    balancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    // Backward compatibility getter
    balance: {
      type: Number,
      get: function () {
        return this.balancePaisa ? paisaToRupees(this.balancePaisa) : 0;
      },
    },

    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

bankAccountSchema.pre("save", function () {
  // Ensure balance is an integer
  if (!Number.isInteger(this.balancePaisa)) {
    throw new Error(
      `Bank account balance must be integer paisa, got: ${this.balancePaisa}`,
    );
  }
});

export default mongoose.model("BankAccount", bankAccountSchema);
