import mongoose from "mongoose";
const innerBlockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  pricePerSqft: { type: Number, required: true, default: 0}, 
});

export default mongoose.model("InnerBlock", innerBlockSchema);
