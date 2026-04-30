/**
 * Shared formatting utilities — single source of truth for display.
 *
 * Rule: backend sends raw canonical data (paisa, ISO dates, enum strings).
 *       These helpers are the ONLY place that converts them for display.
 *
 * Money note: UseStats.js normalizes paisa → rupees for internal arithmetic.
 *   Components that receive stats.kpi.* values pass rupees to formatRupees/
 *   formatRupeesCompact. Components that receive raw API paisa pass to formatPaisa.
 */

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Full rupee display with 2 decimal places.
 * Input: already-divided rupee value (e.g. from UseStats normalization).
 *
 * formatRupees(1050) → "रू 1,050.00"
 */
export function formatRupees(rupees) {
  if (rupees == null || rupees === "") return "—";
  const n = Number(rupees);
  if (Number.isNaN(n)) return "—";
  return `रू ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact rupee display for KPI cards and chart labels (Indian suffixes).
 * Input: already-divided rupee value.
 *
 * formatRupeesCompact(1_50_00_000) → "रू 1.5Cr"
 * formatRupeesCompact(3_50_000)    → "रू 3.5L"
 * formatRupeesCompact(12_000)      → "रू 12k"
 * formatRupeesCompact(850)         → "रू 850"
 */
export function formatRupeesCompact(rupees) {
  if (rupees == null || rupees === "") return "—";
  const n = Number(rupees);
  if (Number.isNaN(n)) return "—";
  if (n >= 1_00_00_000) return `रू ${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `रू ${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `रू ${(n / 1_000).toFixed(0)}k`;
  return `रू ${n.toLocaleString("en-IN")}`;
}

/**
 * Format raw paisa from the API (divides by 100, then full display).
 * Use for amounts that have NOT been pre-divided (raw API responses).
 *
 * formatPaisa(105000) → "रू 1,050.00"
 */
export function formatPaisa(paisa) {
  if (paisa == null) return "—";
  return formatRupees(Number(paisa) / 100);
}

/**
 * Compact display for raw paisa from the API.
 *
 * formatPaisaCompact(35000000) → "रू 3.5L"
 */
export function formatPaisaCompact(paisa) {
  if (paisa == null) return "—";
  return formatRupeesCompact(Number(paisa) / 100);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Map raw status enum to display label.
 * formatStatus("PARTIALLY_PAID") → "Partial"
 */
export function formatStatus(status) {
  return (
    {
      PAID: "Paid",
      PARTIALLY_PAID: "Partial",
      UNPAID: "Unpaid",
      OVERDUE: "Overdue",
    }[status] ?? status
  );
}
