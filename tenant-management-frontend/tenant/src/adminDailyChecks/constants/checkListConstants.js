/**
 * checklistConstants.js
 *
 * Shared constants, label maps, and helper functions for
 * the checklist history UI. Import from here — never hardcode
 * category names or status strings directly in components.
 */

// ── Category display map ──────────────────────────────────────────────────────

export const CATEGORY_LABELS = {
  CCTV: "CCTV",
  ELECTRICAL: "Electrical",
  SANITARY: "Sanitary",
  COMMON_AREA: "Common Area",
  PARKING: "Parking",
  FIRE: "Fire Safety",
  WATER_TANK: "Water Tank",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// ── Status display map ────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  INCOMPLETE: "Incomplete",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// ── Status → Tailwind class helpers ──────────────────────────────────────────

/**
 * Returns Tailwind classes for the left-border accent on a result card.
 * pending  → slate border
 * issues   → red border
 * ok       → emerald border
 */
export function getCardBorderClass(status, hasIssues) {
  if (status === "PENDING") return "border-l-slate-300 dark:border-l-slate-600";
  if (hasIssues) return "border-l-red-400 dark:border-l-red-500";
  return "border-l-emerald-400 dark:border-l-emerald-500";
}

/**
 * Returns Tailwind classes for the status badge pill.
 */
export function getStatusBadgeClass(status) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "PENDING":
      return "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400";
    case "IN_PROGRESS":
      return "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400";
    case "INCOMPLETE":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
  }
}

/**
 * Returns Tailwind classes for the pass-rate progress bar fill.
 */
export function getBarFillClass(status, hasIssues) {
  if (status === "PENDING") return "bg-slate-200 dark:bg-slate-700";
  if (hasIssues) return "bg-red-400 dark:bg-red-500";
  return "bg-emerald-400 dark:bg-emerald-500";
}

/**
 * Computes pass rate (0–100). Returns 0 for PENDING results.
 */
export function computePassRate(result) {
  if (!result.totalItems || result.status === "PENDING") return 0;
  return Math.round((result.passedItems / result.totalItems) * 100);
}
