import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useAdvanceRent(entityId = null) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/advance-rent", { params });
      setData(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load advance rents");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const receive = useCallback(async (payload) => {
    const res = await api.post("/api/advance-rent", payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  const recognize = useCallback(async (advanceRentId, payload) => {
    const res = await api.post(`/api/advance-rent/${advanceRentId}/recognize`, payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  return { data, loading, error, refetch: fetch, receive, recognize };
}
