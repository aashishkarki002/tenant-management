import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function usePropertyPL(propertyId = null, filterProps = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const { fiscalYear, selectedQuarter, selectedMonth, customStartDate, customEndDate } = filterProps;

  const fetch = useCallback(async () => {
    if (!propertyId) return;
    try {
      setLoading(true);
      setError(null);
      const params = { propertyId };
      if (fiscalYear)      params.fiscalYear = fiscalYear;
      if (selectedQuarter) params.quarter    = selectedQuarter;
      if (selectedMonth)   params.month      = selectedMonth;
      if (customStartDate) params.startDate  = customStartDate;
      if (customEndDate)   params.endDate    = customEndDate;
      const res = await api.get("/api/ledger/property-pl", { params });
      setData(res.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load property P&L");
    } finally {
      setLoading(false);
    }
  }, [propertyId, fiscalYear, selectedQuarter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
