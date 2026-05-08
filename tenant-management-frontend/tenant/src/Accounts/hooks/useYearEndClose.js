import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Year-end close status and history for an entity.
 *
 * @param {string} entityId
 * @param {number} fiscalYear
 */
export function useYearEndClose(entityId, fiscalYear) {
  const [status, setStatus]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!entityId || !fiscalYear) return;
    setLoading(true);
    setError(null);
    try {
      const [statusRes, historyRes] = await Promise.all([
        api.get("/api/year-end-close/status", { params: { entityId, fiscalYear } }),
        api.get("/api/year-end-close/history", { params: { entityId } }),
      ]);
      setStatus(statusRes.data?.data ?? null);
      setHistory(historyRes.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [entityId, fiscalYear]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const closeYear = useCallback(async ({ closeNote } = {}) => {
    const res = await api.post("/api/year-end-close/close", {
      entityId,
      fiscalYear,
      closeNote,
    });
    await fetchStatus();
    return res.data;
  }, [entityId, fiscalYear, fetchStatus]);

  const reopenYear = useCallback(async ({ reopenNote }) => {
    const res = await api.post("/api/year-end-close/reopen", {
      entityId,
      fiscalYear,
      reopenNote,
    });
    await fetchStatus();
    return res.data;
  }, [entityId, fiscalYear, fetchStatus]);

  return { status, history, loading, error, refetch: fetchStatus, closeYear, reopenYear };
}
