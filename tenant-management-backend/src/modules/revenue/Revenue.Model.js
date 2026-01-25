import mongoose from "mongoose";
const revenueSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RevenueSource",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    payerType: {
      type: String,
      enum: ["TENANT", "EXTERNAL"],
      required: true,
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function () {
        return this.payerType === "TENANT";
      },
    },

    referenceType: {
      type: String,
      enum: ["RENT", "PARKING", "AD", "CAM", "MANUAL" ],
      default: "MANUAL",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return ["RENT", "PARKING", "AD", "CAM"].includes(this.referenceType);
      },
    },

    status: {
      type: String,
      enum: ["RECORDED", "SYNCED"],
      default: "RECORDED",
    },

    notes: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);
export const Revenue = mongoose.model("Revenue", revenueSchema);