import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

/**
 * Format an "overdue since" label from TenantBalance fields.
 * Returns e.g. "Poush 2081" or null if data is missing.
 */
export function formatOverdueSince(nepaliYear, nepaliMonth) {
  if (!nepaliYear || !nepaliMonth) return null;
  const monthName = NEPALI_MONTH_NAMES[nepaliMonth - 1];
  if (!monthName) return `${nepaliYear}`;
  return `${monthName} ${nepaliYear}`;
}

/**
 * useArrearsData
 *
 * Fetches all tenants with a non-zero TenantBalance from
 * GET /api/tenant/arrears.
 *
 * Each record:
 *   tenant    { _id, name, phone }
 *   property  { _id, name }
 *   units     [{ _id, name, unitNumber }]
 *   rentDuePaisa, camDuePaisa, lateFeeDuePaisa, totalDuePaisa
 *   oldestOverdueNepaliYear, oldestOverdueNepaliMonth
 *   consecutiveUnpaidMonths
 *
 * Sorted by totalDuePaisa descending (worst arrears first).
 */
export function useArrearsData() {
  const [arrears, setArrears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchArrears = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/tenant/arrears");
      setArrears(response.data?.arrears ?? []);
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || "Failed to fetch arrears";
      setError(message);
      setArrears([]);
      console.error("[useArrearsData]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArrears();
  }, [fetchArrears]);

  return { arrears, loading, error, refetch: fetchArrears };
}
