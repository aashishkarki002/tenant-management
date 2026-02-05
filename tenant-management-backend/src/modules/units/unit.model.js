import mongoose from "mongoose";

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Unit A1"
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
  block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true },
  innerBlock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InnerBlock",
    required: true,
  },
  isOccupied: { type: Boolean, default: false }, // optional, to filter available units
});

export const Unit = mongoose.models.Unit || mongoose.model("Unit", unitSchema);
