import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export function useStaffStats(user) {
  const [maintenance, setMaintenance] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // If there's no user yet, don't stay stuck in "loading"
    if (!user?._id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parallel fetch — fail fast if either throws
      const [maintenanceRes, generatorRes] = await Promise.all([
        api.get("/api/maintenance/all"),
        api.get("/api/generator/all"),
      ]);

      const allMaintenance = Array.isArray(maintenanceRes.data?.maintenance)
        ? maintenanceRes.data.maintenance
        : [];

      const allGenerators = Array.isArray(generatorRes.data?.data)
        ? generatorRes.data.data
        : [];

      // Filter maintenance to tasks assigned to this staff member.
      // assignedTo is populated as { _id, name } by the backend.
      const myTasks = allMaintenance.filter((task) => {
        const assignedId =
          task.assignedTo?._id?.toString() ??
          task.assignedTo?.toString() ??
          null;
        return assignedId === user._id.toString();
      });

      setMaintenance(myTasks);
      setGenerators(allGenerators);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to load staff dashboard data";
      setError(message);
      console.error("[useStaffStats] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const openTasks = maintenance.filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status),
  );

  const urgentTasks = openTasks.filter((t) =>
    ["High", "Urgent"].includes(t.priority),
  );

  const generatorsWithIssues = generators.filter(
    (g) =>
      g.currentFuelPercent <= (g.lowFuelThresholdPercent ?? 20) ||
      (g.nextServiceDate && new Date(g.nextServiceDate) <= new Date()) ||
      g.status === "FAULT",
  );

  return {
    maintenance, // all tasks assigned to this staff member
    openTasks, // OPEN + IN_PROGRESS only
    urgentTasks, // High + Urgent priority open tasks
    generators, // all active generators
    generatorsWithIssues,
    loading,
    error,
    refetch: fetchData,
  };
}

export default useStaffStats;
