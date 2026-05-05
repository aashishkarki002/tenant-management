import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

/**
 * Fetches daily end-of-day balance snapshots for all fund accounts
 * (cash on hand + all bank accounts) for the past `days` days.
 *
 * Returns:
 *   histories: { [accountCode]: [{ date: "YYYY-MM-DD", balancePaisa: number }] }
 */
export function useBalanceHistory(entityId = null, days = 30) {
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = { days };
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/bank/balance-history", { params });
      setHistories(res.data.histories ?? {});
    } catch {
      // silent — sparklines are decorative, don't block the main view
    } finally {
      setLoading(false);
    }
  }, [entityId, days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { histories, loading, refetch: fetch };
}
