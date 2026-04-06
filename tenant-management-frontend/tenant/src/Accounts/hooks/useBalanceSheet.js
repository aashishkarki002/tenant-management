import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useBalanceSheet(entityId = null) {
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const fetchBalanceSheet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/ledger/balance-sheet", { params });
      setBalanceSheet(res.data?.data ?? null);
    } catch (err) {
      console.error("[useBalanceSheet] fetch failed", err);
      setError(err.response?.data?.message ?? "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  return { balanceSheet, loading, error, refetch: fetchBalanceSheet };
}
