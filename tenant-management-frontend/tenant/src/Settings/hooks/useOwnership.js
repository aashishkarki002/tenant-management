/**
 * useOwnership.js
 *
 * Custom hook that fetches:
 *   - All OwnershipEntity records  → GET /api/ownership
 *
 * Exposes:
 *   entities      OwnershipEntity[]
 *   loading       boolean
 *   error         string | null
 *   refresh()     re-fetch entities
 *   createEntity(data)          POST /api/ownership
 *   updateEntity(id, data)      PATCH /api/ownership/:id
 */

import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export function useOwnership() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entRes = await api.get("/api/ownership");
      setEntities(entRes.data?.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load ownership data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createEntity = useCallback(
    async (data) => {
      const res = await api.post("/api/ownership", data);
      if (!res.data?.success)
        throw new Error(res.data?.message ?? "Failed to create entity");
      await fetchAll(); // keep local state in sync
      return res.data.data;
    },
    [fetchAll],
  );

  const updateEntity = useCallback(
    async (id, data) => {
      const res = await api.patch(`/api/ownership/${id}`, data);
      if (!res.data?.success)
        throw new Error(res.data?.message ?? "Failed to update entity");
      await fetchAll();
      return res.data.data;
    },
    [fetchAll],
  );

  return {
    entities,
    loading,
    error,
    refresh: fetchAll,
    createEntity,
    updateEntity,
  };
}
