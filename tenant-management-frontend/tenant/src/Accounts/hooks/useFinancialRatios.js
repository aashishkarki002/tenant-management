import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

function buildParams(quarter, startDate, endDate, month, fiscalYear, entityId) {
  const params = {};
  if (fiscalYear) params.fiscalYear = fiscalYear;
  if (startDate)  params.startDate  = startDate;
  if (endDate)    params.endDate    = endDate;
  if (!startDate && !endDate) {
    if (month)        params.month   = month;
    else if (quarter) params.quarter = quarter;
  }
  if (entityId) params.entityId = entityId;
  return params;
}

export function useFinancialRatios(
  quarter,
  startDate  = "",
  endDate    = "",
  month      = null,
  fiscalYear = null,
  entityId   = null,
) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = buildParams(quarter, startDate, endDate, month, fiscalYear, entityId);
      const res = await api.get("/api/accounting/financial-ratios", { params });
      setData(res.data.data);
    } catch (err) {
      console.error("[useFinancialRatios] fetch failed", err);
      setError("Failed to load financial ratios");
    } finally {
      setLoading(false);
    }
  }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
