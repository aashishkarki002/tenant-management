import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";

/**
 * useChecklistCalendar
 *
 * Fetches per-day summary data for the calendar view.
 * One API call per month — no pagination, no filters.
 *
 * Returns:
 *   dayMap         Map<nepaliDate, DaySummary>   — O(1) lookup by date string
 *   nepaliYear     number
 *   nepaliMonth    number
 *   goToPrevMonth  () → void
 *   goToNextMonth  () → void
 *   isLoading      boolean
 *   error          string | null
 *
 * DaySummary shape:
 *   { nepaliDate, englishDate, total, completed, pending, withIssues, passRate }
 */
function useChecklistCalendar(propertyId, initialYear, initialMonth) {
  const now = new Date();
  // Fallback: use current year/month if not provided (caller should pass
  // the current Nepali year+month from a NepaliDate utility)
  const [nepaliYear, setNepaliYear] = useState(
    initialYear ?? now.getFullYear(),
  );
  const [nepaliMonth, setNepaliMonth] = useState(
    initialMonth ?? now.getMonth() + 1,
  );

  const [dayMap, setDayMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMonth = useCallback(
    async (year, month) => {
      if (!propertyId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get("/api/checklists/calendar", {
          params: { propertyId, nepaliYear: year, nepaliMonth: month },
        });

        if (response.data.success) {
          const days = response.data.data ?? [];
          const map = new Map(days.map((d) => [d.nepaliDate, d]));
          setDayMap(map);
        } else {
          throw new Error(response.data.message || "Failed to fetch calendar");
        }
      } catch (err) {
        const message = err.message || "Failed to load calendar data";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [propertyId],
  );

  useEffect(() => {
    fetchMonth(nepaliYear, nepaliMonth);
  }, [propertyId, nepaliYear, nepaliMonth, fetchMonth]);

  function goToPrevMonth() {
    setNepaliYear((y) => (nepaliMonth === 1 ? y - 1 : y));
    setNepaliMonth((m) => (m === 1 ? 12 : m - 1));
  }

  function goToNextMonth() {
    setNepaliYear((y) => (nepaliMonth === 12 ? y + 1 : y));
    setNepaliMonth((m) => (m === 12 ? 1 : m + 1));
  }

  return {
    dayMap,
    nepaliYear,
    nepaliMonth,
    goToPrevMonth,
    goToNextMonth,
    isLoading,
    error,
  };
}

export default useChecklistCalendar;
