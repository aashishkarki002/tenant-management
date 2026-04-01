import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../plugins/axios";

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeSafety(rawSafety) {
  const completed = Number(rawSafety?.completed ?? 0) || 0;
  const total = Number(rawSafety?.total ?? 0) || 0;
  const pending =
    rawSafety?.pending != null
      ? Number(rawSafety.pending) || 0
      : Math.max(0, total - completed);
  const issues = Number(rawSafety?.issues ?? 0) || 0;

  const completionRate =
    rawSafety?.completionRate != null
      ? clampPercent(rawSafety.completionRate)
      : total > 0
        ? clampPercent((completed / total) * 100)
        : 0;

  return {
    completionRate,
    completed,
    total,
    pending,
    issues,
  };
}

function normalizeStaffStats(raw) {
  return {
    maintenance: Array.isArray(raw?.maintenance) ? raw.maintenance : [],
    generators: Array.isArray(raw?.generators) ? raw.generators : [],
    safety: normalizeSafety(raw?.safety),
  };
}

export function useStaffStats(user) {
  const [stats, setStats] = useState(() =>
    normalizeStaffStats({ maintenance: [], generators: [], safety: {} }),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    const userId = user?.id ?? user?._id;
    if (!userId) {
      setStats(
        normalizeStaffStats({ maintenance: [], generators: [], safety: {} }),
      );
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const [maintenanceRes, generatorRes, dashboardRes] = await Promise.all([
        api.get("/api/maintenance/my-tasks", { signal: controller.signal }),
        api.get("/api/maintenance/generator/all", { signal: controller.signal }),
        api.get("/api/payment/dashboard-stats", { signal: controller.signal }),
      ]);

      const maintenance = Array.isArray(maintenanceRes.data?.maintenance)
        ? maintenanceRes.data.maintenance
        : [];
      const generators = Array.isArray(generatorRes.data?.data)
        ? generatorRes.data.data
        : [];
      const dashboardData = dashboardRes.data?.data ?? dashboardRes.data ?? {};
      const safety = normalizeSafety(dashboardData?.safety);

      setStats(normalizeStaffStats({ maintenance, generators, safety }));
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;

      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to load staff dashboard data";
      setError(message);
      console.error("[useStaffStats] fetch failed:", err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [user?.id, user?._id]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const maintenance = stats.maintenance;
  const generators = stats.generators;
  const safety = stats.safety;

  const openTasks = maintenance.filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status),
  );
  const urgentTasks = openTasks.filter((t) =>
    ["High", "Urgent"].includes(t.priority),
  );
  const completedTasks = maintenance.filter((t) => t.status === "COMPLETED");
  const cancelledTasks = maintenance.filter((t) => t.status === "CANCELLED");

  const generatorsWithIssues = generators.filter(
    (g) =>
      g.currentFuelPercent <= (g.lowFuelThresholdPercent ?? 20) ||
      (g.nextServiceDate && new Date(g.nextServiceDate) <= new Date()) ||
      g.status === "FAULT",
  );

  return {
    maintenance,
    generators,
    safety,
    openTasks,
    urgentTasks,
    completedTasks,
    cancelledTasks,
    generatorsWithIssues,
    loading,
    error,
    refetch: fetchData,
  };
}

export default useStaffStats;
