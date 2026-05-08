import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Fetches paginated audit log entries.
 *
 * @param {Object} filters
 * @param {string} [filters.entityId]
 * @param {string} [filters.eventType]
 * @param {string} [filters.performedBy]
 * @param {string} [filters.startDate]
 * @param {string} [filters.endDate]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 */
export function useAuditLog(filters = {}) {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.entityId)    params.entityId    = filters.entityId;
      if (filters.eventType)   params.eventType   = filters.eventType;
      if (filters.performedBy) params.performedBy = filters.performedBy;
      if (filters.startDate)   params.startDate   = filters.startDate;
      if (filters.endDate)     params.endDate     = filters.endDate;
      if (filters.page)        params.page        = filters.page;
      if (filters.limit)       params.limit       = filters.limit;

      const res = await api.get("/api/audit", { params });
      const d = res.data?.data;
      setLogs(d?.logs ?? []);
      setTotal(d?.total ?? 0);
      setPages(d?.pages ?? 0);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [
    filters.entityId, filters.eventType, filters.performedBy,
    filters.startDate, filters.endDate, filters.page, filters.limit,
  ]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, total, pages, loading, error, refetch: fetchLogs };
}

export function useAuditEventTypes() {
  const [eventTypes, setEventTypes] = useState([]);

  useEffect(() => {
    api.get("/api/audit/event-types")
      .then(r => setEventTypes(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  return eventTypes;
}
