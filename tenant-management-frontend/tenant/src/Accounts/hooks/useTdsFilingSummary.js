import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useTdsFilingSummary(nepaliYear = null, tenantId = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!nepaliYear) return;
    try {
      setLoading(true);
      setError(null);
      const params = { nepaliYear };
      if (tenantId) params.tenantId = tenantId;
      const res = await api.get("/api/ledger/tds-filing", { params });
      setData(res.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load TDS filing summary");
    } finally {
      setLoading(false);
    }
  }, [nepaliYear, tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
