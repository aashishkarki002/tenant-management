import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "RENT_OVERDUE",
        "RENT_PARTIALLY_PAID",
        "RENT_PAID",
        "RENT_REMINDER",
        "PAYMENT_NOTIFICATION",
        "LATE_FEE_NOTIFICATION",
        "MAINTENANCE_CREATED",
        "MAINTENANCE_ASSIGNED",
        "MAINTENANCE_COMPLETED",
        "MAINTENANCE_CANCELLED",
        "LOAN_EMI_REMINDER",
        "DAILY_CHECKLIST_MORNING",
        "DAILY_CHECKLIST_ESCALATION",
        "DAILY_CHECKLIST_EOD_WARNING",
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Object,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
