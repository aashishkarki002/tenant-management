import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Normalizes the dashboard-stats API response into the shape expected by dashboard components.
 *
 * KEY RULE: The backend already produces a well-shaped `recentActivity` array via the
 * Transaction ledger (TX_TYPE_MAP). We pass it through directly instead of building a
 * synthetic list from overdueRents / maintenance — those are different data concerns
 * surfaced in their own sections (UpcomingRents, MaintenanceCard, etc.).
 *
 * Industry pattern: "normalize at the boundary, don't re-derive what the server already computed."
 */
function normalizeDashboardStats(raw) {
  if (!raw) return null;

  const rentSummary = raw.rentSummary ?? {};
  const totalCollected = rentSummary.totalCollected ?? 0;
  const totalRent = rentSummary.totalRent ?? 0;
  const totalOutstanding = rentSummary.totalOutstanding ?? 0;

  const maintenanceList = Array.isArray(raw.maintenance) ? raw.maintenance : [];
  const openMaintenance = maintenanceList.filter(
    (m) => (m.status || "").toUpperCase() === "OPEN",
  );

  const overdueRents = Array.isArray(raw.overdueRents) ? raw.overdueRents : [];

  // FIX: Backend returns remainingPaisa (unpaid balance), not amount/amountPaisa
  // (which is the total charge). Always sum the *remaining* balance for the
  // outstanding-amount widget.
  const overdueAmount = overdueRents.reduce((sum, r) => {
    if (r.remainingPaisa != null) return sum + r.remainingPaisa / 100;
    if (r.remaining != null) return sum + Number(r.remaining);
    return sum;
  }, 0);

  const firstMaintenance = openMaintenance[0] || maintenanceList[0];

  // ── Recent activity ───────────────────────────────────────────────────────
  // Use the backend-produced recentActivity array (shaped by TX_TYPE_MAP in
  // dashboard.service.js). Each item already has: { id, type, mainText, sub,
  // amount, time }. RecentActivities.jsx reads stats.recentActivity directly
  // via the `normalizeActivities` helper which checks this key first.
  //
  // We keep the legacy `recentActivities` key populated for any other
  // consumers that may still reference it, but we no longer synthesise it
  // from overdueRents — that was mixing two separate concerns.
  const recentActivity = Array.isArray(raw.recentActivity)
    ? raw.recentActivity
    : [];

  return {
    // ── Spread all raw fields first so nothing is lost ──────────────────
    ...raw,

    // ── Re-shaped nested objects used by SummaryCard / CollectionCard ───
    collection: {
      totalCollected,
      target: totalRent,
      outstandingBalance: totalOutstanding,
      rent: { collected: totalCollected, target: totalRent },
      cam: raw.collection?.cam ?? {},
      electricity: raw.collection?.electricity ?? {},
    },

    occupancy: {
      rate: raw.occupancyRate ?? 0,
      occupancyRate: raw.occupancyRate ?? 0,
      occupied: raw.occupiedUnits ?? 0,
      occupiedUnits: raw.occupiedUnits ?? 0,
      totalUnits: raw.totalUnits ?? 0,
      total: raw.totalUnits ?? 0,
      vacant: (raw.totalUnits ?? 0) - (raw.occupiedUnits ?? 0),
      vacantUnits: (raw.totalUnits ?? 0) - (raw.occupiedUnits ?? 0),
    },

    attention: {
      urgentCount: overdueRents.length + (openMaintenance.length > 0 ? 1 : 0),
      overdueCount: overdueRents.length,
      overdueAmount,
      overduePayments: overdueRents.length,
      overdueTotal: overdueAmount,
      maintenanceCount: openMaintenance.length,
      maintenanceRequests: maintenanceList.length,
      maintenanceDetail: firstMaintenance?.title ?? "—",
    },

    // ── Flat aliases kept for legacy component consumers ─────────────────
    openRequests: openMaintenance.length,
    activeTenants: raw.activeTenants ?? 0,

    // ── Activity feed — backend-produced, passed through unchanged ───────
    recentActivity,
    recentActivities: recentActivity, // legacy alias

    // ── Lists — passed through with safe fallbacks ────────────────────────
    maintenance: maintenanceList,
    upcomingMaintenance: Array.isArray(raw.upcomingMaintenance)
      ? raw.upcomingMaintenance
      : [],
    generatorsDueService: Array.isArray(raw.generatorsDueService)
      ? raw.generatorsDueService
      : [],
    upcomingRents: Array.isArray(raw.upcomingRents) ? raw.upcomingRents : [],
    overdueRents,
    contractsEndingSoon: Array.isArray(raw.contractsEndingSoon)
      ? raw.contractsEndingSoon
      : [],
  };
}

/**
 * Fetches dashboard stats from GET /api/payment/dashboard-stats.
 *
 * @returns {{
 *   stats: object | null,
 *   loading: boolean,
 *   error: string | null,
 *   refetch: () => Promise<void>
 * }}
 */
export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/payment/dashboard-stats");
      const raw = response.data?.data ?? response.data ?? null;
      setStats(normalizeDashboardStats(raw));
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch dashboard stats";
      setError(message);
      setStats(null);
      console.error("Error fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export default useStats;
