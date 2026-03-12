import mongoose from "mongoose";

const { Schema } = mongoose;

const ownershipEntitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["private", "company", "head_office"],
      required: true,
    },
    pan: { type: String, trim: true },
    vatNumber: { type: String, trim: true },
    registrationNo: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      district: { type: String, trim: true },
      province: { type: String, trim: true },
    },
    contactEmail: { type: String, trim: true },
    logoUrl: { type: String },
    chartOfAccountsPrefix: { type: String, default: "PVT" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    migratedAt: { type: Date },
  },
  { timestamps: true },
);

// Only one head_office entity may exist in the system at any time
ownershipEntitySchema.index(
  { type: 1 },
  { unique: true, partialFilterExpression: { type: "head_office" } },
);

export const OwnershipEntity = mongoose.model(
  "OwnershipEntity",
  ownershipEntitySchema,
);
