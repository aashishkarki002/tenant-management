import mongoose from "mongoose";

/** Allowed `type` values — keep in sync with callers (crons, services, frontend). */
export const NOTIFICATION_TYPES = [
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
  "MAINTENANCE_SETTLED",
  "CHECKLIST_ISSUES_FOUND",
  "CHECKLIST_SUBMITTED",
  "MAINTENANCE_PENDING_SETTLEMENT",
  "MAINTENANCE_DUE_UNASSIGNED",
  "MAINTENANCE_STAFF_REMINDER",
  "MAINTENANCE_OVERDUE_ESCALATION",
  "ELECTRICITY_READING_CREATED",
  "ELECTRICITY_PAYMENT_RECEIVED",
  "ELECTRICITY_BILLS_OVERDUE",
];

const notificationSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
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
