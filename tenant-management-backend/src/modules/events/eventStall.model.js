import mongoose, { Schema } from "mongoose";

/**
 * EventStall — a stall within an Event.
 * A stall can be subdivided into multiple Kiosks.
 * e.g. "Stall A1", "Food Court B", "Handicraft Zone"
 */
const eventStallSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    stallNumber: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    floor: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

eventStallSchema.index({ event: 1 });

export default mongoose.model("EventStall", eventStallSchema);
