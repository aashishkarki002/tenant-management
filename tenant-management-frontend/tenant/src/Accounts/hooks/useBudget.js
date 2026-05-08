import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useBudget(entityId = null, fiscalYear = null) {
  const [lines, setLines]     = useState([]);
  const [vsActual, setVsActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchLines = useCallback(async () => {
    if (!entityId || !fiscalYear) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/budget", { params: { entityId, fiscalYear } });
      setLines(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load budget");
    } finally {
      setLoading(false);
    }
  }, [entityId, fiscalYear]);

  const fetchVsActual = useCallback(async () => {
    if (!entityId || !fiscalYear) return;
    try {
      const res = await api.get("/api/budget/vs-actual", { params: { entityId, fiscalYear } });
      setVsActual(res.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load budget vs actual");
    }
  }, [entityId, fiscalYear]);

  useEffect(() => {
    fetchLines();
    fetchVsActual();
  }, [fetchLines, fetchVsActual]);

  const upsert = useCallback(async (payload) => {
    await api.post("/api/budget", payload);
    await fetchLines();
    await fetchVsActual();
  }, [fetchLines, fetchVsActual]);

  const remove = useCallback(async (entityId, fiscalYear, accountCode) => {
    await api.delete("/api/budget", { params: { entityId, fiscalYear, accountCode } });
    await fetchLines();
    await fetchVsActual();
  }, [fetchLines, fetchVsActual]);

  return { lines, vsActual, loading, error, refetch: fetchLines, upsert, remove };
}
