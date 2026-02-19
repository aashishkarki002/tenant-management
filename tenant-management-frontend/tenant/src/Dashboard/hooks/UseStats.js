import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Normalizes the dashboard-stats API response into the shape expected by dashboard components.
 * API shape: totalTenants, activeTenants, totalUnits, occupiedUnits, occupancyRate,
 * rentSummary: { totalCollected, totalRent, totalOutstanding }, totalRevenue,
 * overdueRents[], upcomingRents[], maintenance[], contractsEndingSoon[]
 */
function normalizeDashboardStats(raw) {
  if (!raw) return null;
  const rentSummary = raw.rentSummary ?? {};
  const totalCollected = rentSummary.totalCollected ?? raw.totalRevenue ?? 0;
  const totalRent = rentSummary.totalRent ?? 0;
  const totalOutstanding = rentSummary.totalOutstanding ?? 0;

  const maintenanceList = Array.isArray(raw.maintenance) ? raw.maintenance : [];
  const openMaintenance = maintenanceList.filter((m) => (m.status || "").toUpperCase() === "OPEN");
  const overdueRents = Array.isArray(raw.overdueRents) ? raw.overdueRents : [];
  const overdueAmount = overdueRents.reduce(
    (sum, r) => sum + (Number(r.amount) || Number(r.amountPaisa) / 100 || 0),
    0
  );

  const firstMaintenance = openMaintenance[0] || maintenanceList[0];
  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const recentActivities = [];
  overdueRents.slice(0, 3).forEach((r, i) => {
    const date = r.dueDate ? new Date(r.dueDate).getTime() : 0;
    recentActivities.push({
      id: `overdue-${i}`,
      type: "payment",
      mainText: r.tenantName ? `Overdue: ${r.tenantName}` : "Overdue payment",
      details: r.dueDate ? `Due ${formatDate(r.dueDate)}` : (r.amount ? `₹${Number(r.amount).toLocaleString()}` : ""),
      _sort: date,
    });
  });
  maintenanceList.slice(0, 5).forEach((m, i) => {
    const date = m.createdAt ? new Date(m.createdAt).getTime() : 0;
    recentActivities.push({
      id: m._id || `m-${i}`,
      type: "maintenance",
      mainText: m.title || "Maintenance",
      details: m.scheduledDate ? formatDate(m.scheduledDate) : (m.description || "").slice(0, 40),
      _sort: date,
    });
  });
  (raw.upcomingRents || []).slice(0, 2).forEach((r, i) => {
    const date = r.dueDate ? new Date(r.dueDate).getTime() : 0;
    recentActivities.push({
      id: `upcoming-${i}`,
      type: "rent",
      mainText: r.tenantName ? `Upcoming: ${r.tenantName}` : "Upcoming rent",
      details: r.dueDate ? `Due ${formatDate(r.dueDate)}` : "",
      _sort: date,
    });
  });
  recentActivities.sort((a, b) => (b._sort || 0) - (a._sort || 0));
  const recentActivitiesSlice = recentActivities.slice(0, 8).map(({ _sort, ...a }) => a);

  return {
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
    recentActivities: recentActivitiesSlice,
    maintenance: maintenanceList,
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
