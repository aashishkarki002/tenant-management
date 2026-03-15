import mongoose, { Schema } from "mongoose";

/**
 * AssignedPersonnel — individual people deployed by a vendor (e.g. individual guards).
 * These are NOT system users. No auth, no salary from EasyManage.
 * Used for: building entry logs, shift tracking, compliance records.
 */
const assignedPersonnelSchema = new Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    contract: {
      type: Schema.Types.ObjectId,
      ref: "VendorContract",
      required: true,
    },

    name: { type: String, required: true },
    phone: { type: String, default: null },

    // Identity verification (for building security compliance)
    idType: {
      type: String,
      enum: ["citizenship", "passport", "driving_license", "other"],
      default: "citizenship",
    },
    idNumber: { type: String, default: null },

    shift: {
      type: String,
      enum: ["day", "night", "rotating"],
      default: "day",
    },

    // Deployment period at this property
    assignedFrom: { type: Date, required: true },
    assignedTo: { type: Date, default: null }, // null = currently deployed

    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

assignedPersonnelSchema.index({ vendor: 1, contract: 1 });
assignedPersonnelSchema.index({ isActive: 1 });

export default mongoose.model("AssignedPersonnel", assignedPersonnelSchema);
