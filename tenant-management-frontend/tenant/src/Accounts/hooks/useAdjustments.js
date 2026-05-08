import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * List and post accounting adjustments (debit note, credit note, manual journal).
 *
 * @param {Object} filters
 * @param {string} filters.entityId
 * @param {string} [filters.type]
 * @param {string} [filters.tenantId]
 * @param {number} [filters.nepaliYear]
 * @param {number} [filters.nepaliMonth]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 */
export function useAdjustments(filters = {}) {
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError]   = useState(null);

  const fetchList = useCallback(async () => {
    if (!filters.entityId) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.entityId)    params.entityId    = filters.entityId;
      if (filters.type)        params.type        = filters.type;
      if (filters.tenantId)    params.tenantId    = filters.tenantId;
      if (filters.nepaliYear)  params.nepaliYear  = filters.nepaliYear;
      if (filters.nepaliMonth) params.nepaliMonth = filters.nepaliMonth;
      if (filters.page)        params.page        = filters.page;
      if (filters.limit)       params.limit       = filters.limit;

      const res = await api.get("/api/adjustments", { params });
      const d = res.data?.data;
      setItems(d?.items ?? []);
      setTotal(d?.total ?? 0);
      setPages(d?.pages ?? 0);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [
    filters.entityId, filters.type, filters.tenantId,
    filters.nepaliYear, filters.nepaliMonth, filters.page, filters.limit,
  ]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const postAdjustment = useCallback(async (data) => {
    setPosting(true);
    setError(null);
    try {
      const res = await api.post("/api/adjustments", data);
      await fetchList();
      return res.data?.data;
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setPosting(false);
    }
  }, [fetchList]);

  return { items, total, pages, loading, posting, error, fetchList, postAdjustment };
}
