import mongoose, { Schema } from "mongoose";

/**
 * EventRevenue — a payment received from a kiosk lessee.
 *
 * Journal on creation:
 *   DR  Cash/Bank              amountPaisa   (ASSET ↑)
 *   CR  revenueAccountCode     amountPaisa   (REVENUE ↑)
 */
const eventRevenueSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    entityId: { type: Schema.Types.ObjectId, ref: "OwnershipEntity", required: true },
    stall: { type: Schema.Types.ObjectId, ref: "EventStall", default: null },
    kiosk: { type: Schema.Types.ObjectId, ref: "EventKiosk", required: true },

    amountPaisa: { type: Number, required: true, min: 1 },
    paymentDate: { type: Date, required: true },
    nepaliDate: { type: String, default: null },  // BS "YYYY-MM-DD"

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque"],
      required: true,
    },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount", default: null },
    referenceNumber: { type: String, default: null },
    notes: { type: String, default: null },

    recordedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    journalId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
  },
  { timestamps: true },
);

eventRevenueSchema.index({ event: 1, paymentDate: -1 });
eventRevenueSchema.index({ kiosk: 1 });

export default mongoose.model("EventRevenue", eventRevenueSchema);
