import mongoose, { Schema } from "mongoose";

/**
 * EventKiosk — a kiosk within an EventStall.
 * Revenue is recorded at this level (kiosk lessee pays us for their space).
 *
 * Lessee info is stored inline (no Vendor reference needed for event kiosks).
 */
const eventKioskSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },   // denormalized
    stall: { type: Schema.Types.ObjectId, ref: "EventStall", required: true },
    kioskNumber: { type: String, required: true, trim: true },
    description: { type: String, default: null },

    // ── Lessee info (standalone — no Vendor ref) ──────────────────────────────
    lesseeName: { type: String, default: null },
    lesseePhone: { type: String, default: null },
    lesseePAN: { type: String, default: null },

    // ── Lease terms ───────────────────────────────────────────────────────────
    leaseAmountPaisa: { type: Number, min: 0, default: 0 },
    leaseStartDate: { type: Date, default: null },
    leaseEndDate: { type: Date, default: null },
    billingCycle: {
      type: String,
      enum: ["one_time", "monthly"],
      default: "one_time",
    },

    // Revenue account to credit on payment (defaults to 4400)
    revenueAccountCode: { type: String, default: "4400" },

    // ── Payment tracking ──────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending",
    },
    paidAmountPaisa: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

eventKioskSchema.index({ event: 1, stall: 1 });
eventKioskSchema.index({ paymentStatus: 1 });

export default mongoose.model("EventKiosk", eventKioskSchema);
