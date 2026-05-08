import { useState, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * Vacate settlement: compute preview and execute.
 */
export function useVacateSettlement(entityId) {
  const [preview, setPreview]     = useState(null);
  const [computing, setComputing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError]         = useState(null);

  const compute = useCallback(async (params) => {
    setComputing(true);
    setError(null);
    try {
      const res = await api.post("/api/vacate/compute", { ...params, entityId });
      setPreview(res.data?.data ?? null);
      return res.data?.data;
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setComputing(false);
    }
  }, [entityId]);

  const execute = useCallback(async (params) => {
    setExecuting(true);
    setError(null);
    try {
      const res = await api.post("/api/vacate/execute", { ...params, entityId });
      setPreview(null);
      return res.data?.data;
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setExecuting(false);
    }
  }, [entityId]);

  return { preview, computing, executing, error, compute, execute };
}

/**
 * List all settlements for an entity.
 *
 * @param {string} entityId
 * @param {string} [status]
 */
export function useVacateList(entityId, status) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading]         = useState(false);

  const fetch = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const params = { entityId };
      if (status) params.status = status;
      const res = await api.get("/api/vacate", { params });
      setSettlements(res.data?.data ?? []);
    } catch {
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, status]);

  return { settlements, loading, refetch: fetch };
}
