import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * normalizeDashboardStats
 *
 * BUILDINGS normalization:
 * Backend returns raw.buildings — an array of per-Block KPI objects where
 * each Block corresponds to what the UI calls a "Building"
 * (e.g. "Narendra Sadhan", "Birendra Sadhan").
 *
 * Rates are computed server-side; we only apply safe fallbacks here in case
 * of partial data. Never re-derive what the server already computed.
 *
 * Normalized shape per building:
 *   {
 *     _id: string,
 *     name: string,                           ← Block.name e.g. "Narendra Sadhan"
 *     occupancy:  { occupied, total, rate },  ← from Unit.block aggregation
 *     collection: { collected, target, rate },← from Rent.block this npMonth
 *     revenue: number,                        ← = collection.collected (rent paid)
 *     overdueAmount: number,                  ← overdue rent balance for this block
 *   }
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

  const overdueAmount = overdueRents.reduce((sum, r) => {
    if (r.remainingPaisa != null) return sum + r.remainingPaisa / 100;
    if (r.remaining != null) return sum + Number(r.remaining);
    return sum;
  }, 0);

  const firstMaintenance = openMaintenance[0] || maintenanceList[0];

  const recentActivity = Array.isArray(raw.recentActivity)
    ? raw.recentActivity
    : [];

  // ── Buildings normalization ───────────────────────────────────────────────
  // Each entry is one Block document ("Building" in UI).
  // We normalize defensively but trust server-computed rates.
  const buildings = Array.isArray(raw.buildings)
    ? raw.buildings.map((b) => {
        const occTotal = b.occupancy?.total ?? 0;
        const occOccupied = b.occupancy?.occupied ?? 0;
        const collTarget = b.collection?.target ?? 0;
        const collCollected = b.collection?.collected ?? 0;

        return {
          _id: b._id ?? null,
          name: b.name ?? "Unknown Block",

          occupancy: {
            occupied: occOccupied,
            total: occTotal,
            // Prefer server-computed rate; fall back to client derivation
            rate:
              b.occupancy?.rate ??
              (occTotal > 0 ? Math.round((occOccupied / occTotal) * 100) : 0),
          },

          collection: {
            collected: collCollected,
            target: collTarget,
            rate:
              b.collection?.rate ??
              (collTarget > 0
                ? Math.min(100, Math.round((collCollected / collTarget) * 100))
                : 0),
          },

          // Revenue this month = collected rent for this block this period
          revenue: b.revenue ?? collCollected,

          overdueAmount: b.overdueAmount ?? 0,
        };
      })
    : [];

  return {
    // Spread all raw fields first so nothing is lost
    ...raw,

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

    openRequests: openMaintenance.length,
    activeTenants: raw.activeTenants ?? 0,

    recentActivity,
    recentActivities: recentActivity, // legacy alias

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

    // Per-Block building performance array — empty for single-block setups.
    // BuildingPerformanceGrid returns null when buildings.length === 0.
    buildings,
  };
}

/**
 * useStats — fetches and normalizes dashboard stats from
 * GET /api/payment/dashboard-stats.
 *
 * @returns {{ stats, loading, error, refetch }}
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
