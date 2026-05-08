import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useOwnerDistribution(entityId = null) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/owner-distribution", { params });
      setData(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load owner distributions");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload) => {
    const res = await api.post("/api/owner-distribution", payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create };
}
