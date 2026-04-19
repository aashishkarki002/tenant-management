import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

export function useBalanceSheet(entityId = null, filterProps = {}) {
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const {
    fiscalYear,
    selectedQuarter,
    selectedMonth,
    customStartDate,
    customEndDate,
  } = filterProps;

  const fetchBalanceSheet = useCallback(async () => {
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
      const res = await api.get("/api/ledger/balance-sheet", { params });
      setBalanceSheet(res.data?.data ?? null);
    } catch (err) {
      console.error("[useBalanceSheet] fetch failed", err);
      setError(err.response?.data?.message ?? "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [entityId, fiscalYear, selectedQuarter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  return { balanceSheet, loading, error, refetch: fetchBalanceSheet };
}
