// ─── Status style maps (visual only — driven by backend status strings) ───────

export const GEN_STATUS_STYLE = {
  RUNNING: {
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  IDLE: { pill: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-400" },
  MAINTENANCE: {
    pill: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  FAULT: { pill: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  DECOMMISSIONED: {
    pill: "bg-gray-100 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
  },
};

export const CHECK_STATUS_STYLE = {
  NORMAL: "bg-green-50 text-green-700 border-green-200",
  LOW_FUEL: "bg-amber-50 text-amber-700 border-amber-200",
  FAULT: "bg-red-50 text-red-700 border-red-200",
  OFFLINE: "bg-gray-50 text-gray-500 border-gray-200",
};

export const SERVICE_TYPES = [
  "OilChange",
  "FilterChange",
  "FullService",
  "Inspection",
  "Repair",
  "Other",
];

export const SERVICE_TYPE_LABELS = {
  OilChange: "Oil Change",
  FilterChange: "Filter Change",
  FullService: "Full Service",
  Inspection: "Inspection",
  Repair: "Repair",
  Other: "Other",
};

// ─── Pure formatting helpers ──────────────────────────────────────────────────

export const fmt = {
  date: (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
  time: (d) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  rupees: (paisa) =>
    paisa != null && paisa > 0
      ? `₹${(paisa / 100).toLocaleString("en-IN")}`
      : "—",
  pct: (n) => `${n ?? 0}%`,
};
