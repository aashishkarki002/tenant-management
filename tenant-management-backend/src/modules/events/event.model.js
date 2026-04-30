import mongoose, { Schema } from "mongoose";

/**
 * Event — a courtyard event at Sallyan House (e.g. "Dashain Mela 2081").
 * Events contain Stalls, which contain Kiosks.
 * Revenue is recorded per kiosk; expenses are recorded per event.
 */
const eventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    entityId: { type: Schema.Types.ObjectId, ref: "OwnershipEntity", required: true },

    // Gregorian dates (for DB queries)
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },

    // Nepali calendar dates (BS "YYYY-MM-DD")
    nepaliStartDate: { type: String, default: null },
    nepaliEndDate: { type: String, default: null },

    status: {
      type: String,
      enum: ["planned", "active", "completed", "cancelled"],
      default: "planned",
    },

    description: { type: String, default: null },
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

eventSchema.index({ property: 1, status: 1 });
eventSchema.index({ startDate: -1 });

export default mongoose.model("Event", eventSchema);
