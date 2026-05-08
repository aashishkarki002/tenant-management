import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useTrialBalance(entityId = null, filterProps = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const { fiscalYear, selectedQuarter, selectedMonth, customStartDate, customEndDate } = filterProps;

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityId)        params.entityId   = entityId;
      if (fiscalYear)      params.fiscalYear  = fiscalYear;
      if (selectedQuarter) params.quarter     = selectedQuarter;
      if (selectedMonth)   params.month       = selectedMonth;
      if (customStartDate) params.startDate   = customStartDate;
      if (customEndDate)   params.endDate     = customEndDate;
      const res = await api.get("/api/ledger/trial-balance", { params });
      setData(res.data?.data ?? null);
    } catch (err) {
      console.error("[useTrialBalance] fetch failed", err);
      setError(err.response?.data?.message ?? "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [entityId, fiscalYear, selectedQuarter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
