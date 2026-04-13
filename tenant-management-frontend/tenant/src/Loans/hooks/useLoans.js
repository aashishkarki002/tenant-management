import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

/**
 * entityId can be:
 *   - null / undefined  → don't fetch (empty list)
 *   - string            → fetch for one entity
 *   - string[]          → fetch for all given entities and merge results
 */
export function useLoans(entityId = null) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stable dependency key so useCallback doesn't re-create on every render
  const key = Array.isArray(entityId) ? entityId.join(",") : (entityId ?? "");

  const fetch = useCallback(async () => {
    const ids = Array.isArray(entityId)
      ? entityId
      : entityId
      ? [entityId]
      : [];

    if (ids.length === 0) {
      setLoans([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        ids.map((id) => api.get("/api/loan", { params: { entityId: id } }))
      );
      const all = results.flatMap((r) => r.data?.data ?? []);
      setLoans(all);
    } catch (err) {
      const msg = err.response?.data?.message ?? "Failed to load loans";
      setError(msg);
      toast.error(msg);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { loans, loading, error, refetch: fetch };
}
