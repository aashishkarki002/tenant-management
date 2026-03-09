/**
 * useStaffStats — production-grade data hook for StaffDashboard
 *
 * Key changes vs the original:
 *
 * 1. Server-side filter: hits GET /api/maintenance/my-tasks (authenticated,
 *    staffId from JWT) instead of fetching ALL tasks and filtering client-side.
 *    This prevents sending other staff members' task data to the browser.
 *
 * 2. AbortController: in-flight requests are cancelled on unmount / user
 *    change, preventing setState-on-unmounted-component warnings and race
 *    conditions when the user navigates away mid-fetch.
 *
 * 3. Stable refetch identity: fetchData is memoised with useCallback on
 *    user._id so it doesn't re-create on unrelated renders, yet refreshes
 *    correctly whenever the authenticated user changes.
 *
 * 4. Derived stats are pure computations at the bottom — no extra state,
 *    no useEffect, impossible to get out of sync.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../plugins/axios";

export function useStaffStats(user) {
  const [maintenance, setMaintenance] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track the AbortController for the current in-flight fetch so we can
  // cancel it when the component unmounts or the user changes.
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    const userId = user?.id ?? user?._id;
    if (!userId) {
      setLoading(false);
      return;
    }

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // ── Parallel fetch ─────────────────────────────────────────────────────
      // /my-tasks: server filters by req.admin.id (from JWT) — never sends
      //            another staff member's data to this client.
      // /generator/all: staff need to see all generators for status overview.
      const [maintenanceRes, generatorRes] = await Promise.all([
        api.get("/api/maintenance/my-tasks", {
          signal: controller.signal,
        }),
        api.get("/api/maintenance/generator/all", {
          signal: controller.signal,
        }),
      ]);

      // Defensive: guard against unexpected shapes from the API
      const myTasks = Array.isArray(maintenanceRes.data?.maintenance)
        ? maintenanceRes.data.maintenance
        : [];

      const allGenerators = Array.isArray(generatorRes.data?.data)
        ? generatorRes.data.data
        : [];

      setMaintenance(myTasks);
      setGenerators(allGenerators);
    } catch (err) {
      // Ignore AbortError — it is not a real error, just request cancellation
      if (err.name === "CanceledError" || err.name === "AbortError") return;

      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to load staff dashboard data";
      setError(message);
      console.error("[useStaffStats] fetch failed:", err);
    } finally {
      // Only clear loading if this controller wasn't aborted (i.e. it's
      // still the "current" fetch — not a superseded one)
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [user?.id, user?._id]);

  useEffect(() => {
    fetchData();

    // On unmount (or before the next effect run), cancel the in-flight request
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  // ── Derived stats — pure, always in sync with `maintenance` ───────────────
  // These are computed on every render; they're cheap array filters.
  // Do NOT put these in state — that creates a synchronisation problem.

  const openTasks = maintenance.filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status),
  );

  const urgentTasks = openTasks.filter((t) =>
    ["High", "Urgent"].includes(t.priority),
  );

  const completedTasks = maintenance.filter((t) => t.status === "COMPLETED");

  const cancelledTasks = maintenance.filter((t) => t.status === "CANCELLED");

  // A generator "has issues" when it's low on fuel, overdue for service, or faulted
  const generatorsWithIssues = generators.filter(
    (g) =>
      g.currentFuelPercent <= (g.lowFuelThresholdPercent ?? 20) ||
      (g.nextServiceDate && new Date(g.nextServiceDate) <= new Date()) ||
      g.status === "FAULT",
  );

  return {
    // Raw data
    maintenance, // all tasks assigned to this staff member
    generators, // all active generators

    // Derived — ready to display, no further filtering needed in components
    openTasks, // OPEN + IN_PROGRESS
    urgentTasks, // High + Urgent priority, open only
    completedTasks, // COMPLETED
    cancelledTasks, // CANCELLED
    generatorsWithIssues,

    // Request state
    loading,
    error,
    refetch: fetchData,
  };
}

export default useStaffStats;
