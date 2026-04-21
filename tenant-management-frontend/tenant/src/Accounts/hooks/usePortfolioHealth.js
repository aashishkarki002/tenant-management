import { useState, useCallback, useEffect } from "react";
import api from "../../../plugins/axios";

function buildParams(quarter, startDate, endDate, month, fiscalYear, entityId) {
  const params = {};
  if (fiscalYear) params.fiscalYear = fiscalYear;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (!startDate && !endDate) {
    if (month) params.month = month;
    else if (quarter) params.quarter = quarter;
  }
  if (entityId) params.entityId = entityId;
  return params;
}

/**
 * Fetches portfolio health metrics from /api/accounting/portfolio-health.
 *
 * Returns:
 *   health.collection  — { totalRents, paidCount, pendingCount, ratePct, outstandingPaisa, totalExpectedNetPaisa }
 *   health.arrearsAging — { current, days30, days60, days90Plus } each { count, amountPaisa }
 *   health.noi         — { revenuePaisa, operatingExpensesPaisa, noiPaisa, noiMarginPct }
 *   health.yoyDeltas   — { revenue, expenses, netCashFlow } each { currentPaisa, prevPaisa, pct }
 *                        null when no previous fiscal year can be compared
 */
export function usePortfolioHealth(
  quarter,
  startDate = "",
  endDate = "",
  month = null,
  fiscalYear = null,
  entityId = null,
) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildParams(quarter, startDate, endDate, month, fiscalYear, entityId);
      const res = await api.get("/api/accounting/portfolio-health", { params });
      setHealth(res.data.data ?? null);
    } catch (err) {
      console.error("[usePortfolioHealth] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { health, loading, refetch: fetch };
}
