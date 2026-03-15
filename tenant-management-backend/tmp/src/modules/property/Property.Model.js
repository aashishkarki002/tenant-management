import mongoose from "mongoose";

const { Schema } = mongoose;

const propertySchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
  },
  { timestamps: true },
);

export default mongoose.model("Property", propertySchema);
