/**
 * Maintenance Feature Constants
 *
 * Updated to reflect backend v2:
 *  - PENDING_SETTLEMENT status added to the lifecycle
 *  - scope field (UNIT / BLOCK / PROPERTY / COMMON_AREA)
 *  - contractor type options
 *  - COMPLETED is terminal and only reachable via /settle — it is intentionally
 *    excluded from STATUS_OPTIONS so no UI dropdown can send it to /status.
 */

export const PRIORITY_OPTIONS = [
  { value: "Low", dot: "bg-gray-400", label: "Low" },
  { value: "Medium", dot: "bg-amber-500", label: "Medium" },
  { value: "High", dot: "bg-orange-500", label: "High" },
  { value: "Urgent", dot: "bg-red-500", label: "Urgent" },
];

// Used in status-change dropdowns (cards / table).
// COMPLETED is NOT here — it can only be reached through /settle.
export const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING_SETTLEMENT", label: "Pending Settlement" },
  { value: "CANCELLED", label: "Cancelled" },
];

// Used in the filter popover. Includes COMPLETED for read-only filtering.
export const STATUS_FILTERS = [
  "All",
  "OPEN",
  "IN_PROGRESS",
  "PENDING_SETTLEMENT",
  "COMPLETED",
  "CANCELLED",
];

export const PRIORITY_FILTERS = ["All", "Urgent", "High", "Medium", "Low"];

// ── Scope ─────────────────────────────────────────────────────────────────────
export const SCOPE_OPTIONS = [
  { value: "UNIT", label: "Unit", description: "Specific unit / room" },
  {
    value: "BLOCK",
    label: "Block",
    description: "Entire block / building wing",
  },
  { value: "PROPERTY", label: "Property", description: "Whole property" },
  {
    value: "COMMON_AREA",
    label: "Common Area",
    description: "Hallways, lobby, parking, etc.",
  },
];

// ── Contractor types ──────────────────────────────────────────────────────────
export const CONTRACTOR_TYPE_OPTIONS = [
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "VENDOR", label: "Vendor" },
  { value: "UTILITY", label: "Utility" },
  { value: "OTHER", label: "Other" },
];

// ── Source type labels ────────────────────────────────────────────────────────
export const SOURCE_TYPE_LABELS = {
  MANUAL: { label: "Manual", color: "bg-muted-fill text-text-sub" },
  CHECKLIST: { label: "Checklist", color: "bg-muted-fill text-text-strong" },
  GENERATOR: { label: "Generator", color: "bg-muted-fill text-text-strong" },
  RECURRING: { label: "Recurring", color: "bg-muted-fill text-text-strong" },
};

// ── Card sections (grouped view) ──────────────────────────────────────────────
export const SECTION_CONFIG = [
  {
    key: "overdue",
    label: "Overdue",
    dot: "bg-red-500",
    textColor: "text-red-700",
  },
  {
    key: "urgent",
    label: "Urgent Priority",
    dot: "bg-orange-500",
    textColor: "text-orange-700",
  },
  {
    key: "open",
    label: "Open",
    dot: "bg-slate-400",
    textColor: "text-slate-700",
  },
  {
    key: "inProgress",
    label: "In Progress",
    dot: "bg-blue-500",
    textColor: "text-blue-700",
  },
  {
    key: "pendingSettlement",
    label: "Pending Settlement",
    dot: "bg-violet-500",
    textColor: "text-violet-700",
  },
  {
    key: "completed",
    label: "Completed",
    dot: "bg-emerald-500",
    textColor: "text-emerald-700",
  },
];

export const CATEGORY_OPTIONS = [
  { value: "repair", label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
];

export const CATEGORY_MAP = {
  repair: "Repair",
  maintenance: "Maintenance",
  inspection: "Inspection",
  other: "Other",
};

// ── Style helpers ─────────────────────────────────────────────────────────────

export const getPriorityStyle = (priority) => {
  const p = (priority || "").toUpperCase();
  if (p === "URGENT") return "bg-red-100 text-red-700";
  if (p === "HIGH") return "bg-orange-100 text-orange-700";
  if (p === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
};

export const getStatusStyle = (status) => {
  const s = (status || "OPEN").toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (s === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  if (s === "PENDING_SETTLEMENT") return "bg-violet-100 text-violet-700";
  if (s === "CANCELLED") return "bg-gray-100 text-gray-500";
  return "bg-slate-100 text-slate-700"; // OPEN
};

// Used in card/table inline status selects
export const STATUS_SELECT_COLORS = {
  OPEN: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_SETTLEMENT: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
// constants/maintenance.constants.ts — add this
export const SCHEDULE_PRESETS = [
  { label: "Today", days: 0, color: "text-green-700" },
  { label: "Tomorrow", days: 1, color: "text-blue-700" },
  { label: "2 days", days: 2, color: "text-blue-700" },
  { label: "3 days", days: 3, color: "text-blue-700" },
  { label: "1 week", days: 7, color: "text-violet-700" },
  { label: "2 weeks", days: 14, color: "text-violet-700" },
  { label: "1 month", days: 30, color: "text-amber-700" },
  { label: "3 months", days: 90, color: "text-amber-700" },
];
