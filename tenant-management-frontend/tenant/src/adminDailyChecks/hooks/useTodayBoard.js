import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";

/**
 * useTodayBoard
 *
 * Fetches all checklist results for today (or a given nepaliDate).
 * Groups them into a compact summary structure for the TodayBoard view.
 *
 * Returns:
 *   results        ChecklistResult[]   — raw list, sorted category → block
 *   summary        { total, completed, pending, inProgress, withIssues }
 *   nepaliDate     string              — the date being shown
 *   isLoading      boolean
 *   error          string | null
 *   refetch        () → void
 */
export function useTodayBoard(propertyId, overrideNepaliDate = null) {
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [nepaliDate, setNepaliDate] = useState(overrideNepaliDate ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchToday = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = { propertyId };
      if (overrideNepaliDate) params.nepaliDate = overrideNepaliDate;

      const response = await api.get("/api/checklists/today", { params });

      if (response.data.success) {
        const data = response.data.data ?? [];
        setResults(data);
        setNepaliDate(response.data.meta?.nepaliDate ?? "");

        // Compute summary counters from results
        const s = data.reduce(
          (acc, r) => {
            acc.total++;
            if (r.status === "COMPLETED") acc.completed++;
            if (r.status === "PENDING") acc.pending++;
            if (r.status === "IN_PROGRESS") acc.inProgress++;
            if (r.status === "INCOMPLETE") acc.incomplete++;
            if (r.hasIssues) acc.withIssues++;
            return acc;
          },
          {
            total: 0,
            completed: 0,
            pending: 0,
            inProgress: 0,
            incomplete: 0,
            withIssues: 0,
          },
        );
        setSummary(s);
      } else {
        throw new Error(
          response.data.message || "Failed to fetch today's results",
        );
      }
    } catch (err) {
      const message = err.message || "Failed to load today's checklist";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, overrideNepaliDate]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  return {
    results,
    summary,
    nepaliDate,
    isLoading,
    error,
    refetch: fetchToday,
  };
}

export default useTodayBoard;
