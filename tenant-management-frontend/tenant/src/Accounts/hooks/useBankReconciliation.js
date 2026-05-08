import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useBankReconciliation(entityId = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/ledger/bank-reconciliation", { params: { entityId } });
      setData(res.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load bank reconciliation");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
