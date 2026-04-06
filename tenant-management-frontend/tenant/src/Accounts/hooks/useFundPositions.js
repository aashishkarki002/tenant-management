import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useFundPositions(entityId = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId) params.entityId = entityId;
      const res = await api.get("/api/bank/fund-positions", { params });
      setData(res.data);
    } catch (err) {
      console.error("[useFundPositions] fetch failed", err);
      setError("Failed to load fund positions");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { data, loading, error, refetch: fetchPositions };
}
