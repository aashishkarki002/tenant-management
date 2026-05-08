import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useVendorBills(entityId = null) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/vendor-bills", { params });
      setData(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload) => {
    const res = await api.post("/api/vendor-bills", payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  const pay = useCallback(async (billId, payload) => {
    const res = await api.post(`/api/vendor-bills/${billId}/pay`, payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create, pay };
}
