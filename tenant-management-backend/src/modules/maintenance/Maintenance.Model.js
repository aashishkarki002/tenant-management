import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Block",
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["Repair", "Maintenance", "Inspection", "Other"],
      default: "Maintenance",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "OPEN",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    amount: { type: Number, default: 0, min: 0 },

    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "paid"],
      default: "pending",
    },
    lastPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    attachments: [{ filename: String, url: String, mimetype: String }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    completedAt: Date,
    completionNotes: String,
    recurring: { type: Boolean, default: false },
    recurringIntervalDays: Number,
  },
  { timestamps: true },
);

// Helpful indexes for querying maintenance tasks
maintenanceSchema.index({ status: 1, priority: 1, scheduledDate: -1 });
maintenanceSchema.index({ tenant: 1 });
maintenanceSchema.index({ property: 1, unit: 1 });

export const Maintenance = mongoose.model("Maintenance", maintenanceSchema);
