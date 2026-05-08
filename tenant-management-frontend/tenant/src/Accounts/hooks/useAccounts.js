import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useAccounts(entityId = null, type = null) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      if (type)     params.type     = type;
      const res = await api.get("/api/ledger/accounts", { params });
      setData(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  }, [entityId, type]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload) => {
    const res = await api.post("/api/ledger/accounts", payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  const update = useCallback(async (id, payload) => {
    const res = await api.put(`/api/ledger/accounts/${id}`, payload);
    await fetch();
    return res.data?.data;
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create, update };
}
