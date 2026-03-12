import mongoose, { Schema } from "mongoose";

/**
 * StaffProfile — employment & payroll data for internal staff (role: "staff").
 * Auth identity lives in the Admin model. This is the HR/payroll record.
 *
 * Convention: all monetary values stored in paisa (integer), matching the
 * rest of EasyManage (rent, CAM, ledger entries, etc.).
 */
const salaryHistorySchema = new Schema(
  {
    amountPaisa: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    reason: { type: String, default: null }, // e.g. "Annual increment", "Promotion"
  },
  { _id: false },
);

const staffProfileSchema = new Schema(
  {
    // 1-to-1 link to Admin (auth identity)
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true,
    },

    // Org structure
    department: {
      type: String,
      enum: [
        "accounts",
        "security",
        "operations",
        "management",
        "maintenance",
        "other",
      ],
      required: true,
    },
    designation: { type: String, required: true }, // "Senior Accountant", "Property Manager"
    reportsTo: { type: Schema.Types.ObjectId, ref: "Admin", default: null },

    /**
     * accessLevel: fine-grained permission tier WITHIN the "staff" JWT role.
     * 1 = read-only, 2 = data entry, 3 = approve, 4 = manager, 5 = full
     * Checked server-side from StaffProfile; keeps JWT clean.
     */
    accessLevel: { type: Number, min: 1, max: 5, default: 1 },

    // Employment dates
    joiningDate: { type: Date, required: true },
    leavingDate: { type: Date, default: null }, // null = currently active

    // Salary — current
    salaryType: {
      type: String,
      enum: ["monthly", "daily", "hourly"],
      default: "monthly",
    },
    salaryAmountPaisa: { type: Number, required: true, min: 0 },

    // Salary history — required for payroll audit trail.
    // When salary changes, push current value here BEFORE updating salaryAmountPaisa.
    salaryHistory: { type: [salaryHistorySchema], default: [] },

    // Bank details for salary disbursement
    bankDetails: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      branchName: { type: String, default: null },
    },

    // Notes (admin-only remarks, not shown to staff)
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

// Indexes for common queries
staffProfileSchema.index({ admin: 1 });
staffProfileSchema.index({ department: 1 });
staffProfileSchema.index({ reportsTo: 1 });

export default mongoose.model("StaffProfile", staffProfileSchema);
