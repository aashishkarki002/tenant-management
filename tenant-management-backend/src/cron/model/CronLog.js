import mongoose from "mongoose";

const cronLogSchema = new mongoose.Schema({
  runId:   { type: String, index: true },   // groups all steps from one masterCron() call
  type:    { type: String, required: true, index: true },
  ranAt:   { type: Date, default: Date.now, index: true },
  message: String,
  count:   Number,
  success: Boolean,
  error:   String,
  details: { type: mongoose.Schema.Types.Mixed }, // arbitrary step data (emails, errors, etc.)
});

export const CronLog = mongoose.model("CronLog", cronLogSchema);
