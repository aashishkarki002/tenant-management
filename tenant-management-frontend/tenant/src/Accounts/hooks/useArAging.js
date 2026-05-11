import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useArAging(entityId = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/ledger/ar-aging", { params });
      setData(res.data?.data ?? null);
    } catch (err) {
      console.error("[useArAging] fetch failed", err);
      setError(err.response?.data?.message ?? "Failed to load AR aging report");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
