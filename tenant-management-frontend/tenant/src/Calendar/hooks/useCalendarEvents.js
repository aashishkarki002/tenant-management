import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Fetches unified calendar events for the given date range.
 * Re-fetches automatically whenever start/end changes.
 *
 * @param {{ start: Date, end: Date } | null} dateRange
 */
export function useCalendarEvents(dateRange) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (start, end) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/api/calendar/events", {
        params: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        },
      });
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load calendar events");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dateRange?.start && dateRange?.end) {
      fetchEvents(dateRange.start, dateRange.end);
    }
  }, [dateRange?.start, dateRange?.end, fetchEvents]);

  return { events, isLoading, error };
}
