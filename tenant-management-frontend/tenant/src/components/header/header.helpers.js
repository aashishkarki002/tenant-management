import {
  Bell,
  CheckCheck,
  Wrench,
  CreditCard,
  AlertCircle,
  Clock,
  Users,
  Receipt,
  BookOpen,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

export const NOTIFICATION_CONFIG = {
  PAYMENT_NOTIFICATION: { icon: CreditCard, colorVar: "var(--color-success)", bgVar: "var(--color-success-bg)", borderVar: "var(--color-success-border)", label: "Payment", labelBg: "var(--color-success-bg)", labelColor: "var(--color-success)" },
  LATE_FEE_NOTIFICATION: { icon: AlertCircle, colorVar: "var(--color-warning)", bgVar: "var(--color-warning-bg)", borderVar: "var(--color-warning-border)", label: "Late Fee", labelBg: "var(--color-warning-bg)", labelColor: "var(--color-warning)" },
  RENT_OVERDUE: { icon: Clock, colorVar: "var(--color-danger)", bgVar: "var(--color-danger-bg)", borderVar: "var(--color-danger-border)", label: "Overdue", labelBg: "var(--color-danger-bg)", labelColor: "var(--color-danger)" },
  RENT_PARTIALLY_PAID: { icon: CreditCard, colorVar: "var(--color-warning)", bgVar: "var(--color-warning-bg)", borderVar: "var(--color-warning-border)", label: "Partial", labelBg: "var(--color-warning-bg)", labelColor: "var(--color-warning)" },
  RENT_PAID: { icon: CreditCard, colorVar: "var(--color-success)", bgVar: "var(--color-success-bg)", borderVar: "var(--color-success-border)", label: "Paid", labelBg: "var(--color-success-bg)", labelColor: "var(--color-success)" },
  RENT_REMINDER: { icon: Bell, colorVar: "var(--color-info)", bgVar: "var(--color-info-bg)", borderVar: "var(--color-info-border)", label: "Reminder", labelBg: "var(--color-info-bg)", labelColor: "var(--color-info)" },
  MAINTENANCE_CREATED: { icon: Wrench, colorVar: "var(--color-warning)", bgVar: "var(--color-warning-bg)", borderVar: "var(--color-warning-border)", label: "Maintenance", labelBg: "var(--color-warning-bg)", labelColor: "var(--color-warning)" },
  MAINTENANCE_ASSIGNED: { icon: Wrench, colorVar: "var(--color-info)", bgVar: "var(--color-info-bg)", borderVar: "var(--color-info-border)", label: "Assigned", labelBg: "var(--color-info-bg)", labelColor: "var(--color-info)" },
  MAINTENANCE_COMPLETED: { icon: Wrench, colorVar: "var(--color-success)", bgVar: "var(--color-success-bg)", borderVar: "var(--color-success-border)", label: "Done", labelBg: "var(--color-success-bg)", labelColor: "var(--color-success)" },
  MAINTENANCE_CANCELLED: { icon: Wrench, colorVar: "var(--color-text-sub)", bgVar: "var(--color-surface)", borderVar: "var(--color-border)", label: "Cancelled", labelBg: "var(--color-surface)", labelColor: "var(--color-text-sub)" },
  DAILY_CHECKLIST_MORNING: { icon: CheckCheck, colorVar: "var(--color-info)", bgVar: "var(--color-info-bg)", borderVar: "var(--color-info-border)", label: "Checklist", labelBg: "var(--color-info-bg)", labelColor: "var(--color-info)" },
  DAILY_CHECKLIST_ESCALATION: { icon: AlertCircle, colorVar: "var(--color-warning)", bgVar: "var(--color-warning-bg)", borderVar: "var(--color-warning-border)", label: "Pending Check", labelBg: "var(--color-warning-bg)", labelColor: "var(--color-warning)" },
  DAILY_CHECKLIST_EOD_WARNING: { icon: Clock, colorVar: "var(--color-danger)", bgVar: "var(--color-danger-bg)", borderVar: "var(--color-danger-border)", label: "Incomplete", labelBg: "var(--color-danger-bg)", labelColor: "var(--color-danger)" },
};

export const DEFAULT_NOTIFICATION_CONFIG = {
  icon: Bell,
  colorVar: "var(--color-text-sub)",
  bgVar: "var(--color-surface)",
  borderVar: "var(--color-border)",
  label: "Notification",
  labelBg: "var(--color-surface)",
  labelColor: "var(--color-text-sub)",
};

export const TYPE_ICON = { tenant: Users, rent: Receipt, ledger: BookOpen };

export const TYPE_LABEL_STYLE = {
  tenant: { bg: "var(--color-info-bg)", color: "var(--color-info)" },
  rent: { bg: "var(--color-success-bg)", color: "var(--color-success)" },
  ledger: { bg: "var(--color-warning-bg)", color: "var(--color-warning)" },
};

export const STATUS_DOT_COLOR = {
  active: "var(--color-success)",
  inactive: "var(--color-text-sub)",
  pending: "var(--color-warning)",
  paid: "var(--color-success)",
  overdue: "var(--color-danger)",
  partially_paid: "var(--color-warning)",
};

export const SEARCH_QUICK_ACTIONS = [
  { label: "Record a payment", icon: Receipt, route: "/rent-payment?action=new" },
  { label: "Add new tenant", icon: UserPlus, route: "/tenants?action=new" },
  { label: "Log maintenance", icon: Wrench, route: "/maintenance?action=new" },
  { label: "View all units", icon: BookOpen, route: "/units" },
];

export const iconBtnBase = `
  relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0
  border transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30
`.trim();

const TOAST_CONFIG = {
  PAYMENT_NOTIFICATION: toast.success,
  RENT_PAID: toast.success,
  RENT_OVERDUE: toast.error,
  LATE_FEE_NOTIFICATION: toast.warning,
  MAINTENANCE_COMPLETED: toast.success,
  MAINTENANCE_ASSIGNED: toast.info,
  MAINTENANCE_CREATED: toast.info,
  MAINTENANCE_CANCELLED: toast.warning,
  RENT_PARTIALLY_PAID: toast.warning,
  RENT_REMINDER: toast.info,
  DAILY_CHECKLIST_MORNING: toast.info,
  DAILY_CHECKLIST_ESCALATION: toast.warning,
  DAILY_CHECKLIST_EOD_WARNING: toast.error,
};

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function showNotificationToast(notification) {
  const fn = TOAST_CONFIG[notification?.type] ?? toast;
  fn(notification?.title, {
    description: notification?.message,
    duration: 5000,
  });
}
