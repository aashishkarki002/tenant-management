import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export function useProjections(fiscalYear = null, entityId = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (fiscalYear) params.fiscalYear = fiscalYear;
      if (entityId)   params.entityId   = entityId;
      const res = await api.get("/api/accounting/projections", { params });
      setData(res.data.data);
    } catch (err) {
      console.error("[useProjections] fetch failed", err);
      setError("Failed to load projections");
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
