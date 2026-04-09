import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

export function useLoans(entityId = null) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = entityId ? { entityId } : {};
      const res = await api.get("/api/loan", { params });
      setLoans(res.data?.data ?? []);
    } catch (err) {
      const msg = err.response?.data?.message ?? "Failed to load loans";
      setError(msg);
      toast.error(msg);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { loans, loading, error, refetch: fetch };
}
