import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useCamReconciliation(entityId = null, nepaliYear = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!entityId || !nepaliYear) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/ledger/cam-reconciliation", { params: { entityId, nepaliYear } });
      setData(res.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load CAM reconciliation");
    } finally {
      setLoading(false);
    }
  }, [entityId, nepaliYear]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
