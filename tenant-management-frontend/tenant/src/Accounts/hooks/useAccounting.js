import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

// ─── Shared param builder ─────────────────────────────────────────────────────

/**
 * Build query params from resolved filter values.
 *
 * Priority (mirrors service layer):
 *   startDate+endDate > month > quarter > fiscalYear (all-year)
 *
 * entityId:
 *   null / undefined  → omitted from params (merged view)
 *   "private"         → "private" (private-only sentinel)
 *   <ObjectId string> → specific entity
 */
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

// ─── useAccounting ────────────────────────────────────────────────────────────

/**
 * Fetches the top-level KPI summary (totals + breakdowns) and ledger entries.
 * No calculations performed client-side — values are used as-is from the API.
 */
export function useAccounting(
  quarter,
  ledgerType = "all",
  startDate = "",
  endDate = "",
  month = null,
  fiscalYear = null,
  entityId = null, // NEW — null = merged/all, "private" = private only, <id> = specific entity
) {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // BUG FIX: params must be built INSIDE useCallback, not outside.
  // Building params outside and referencing it inside useCallback captures a
  // stale closure — params is a new object every render but useCallback only
  // re-runs when its deps change, so it was always using the first render's params.
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = buildParams(
        quarter,
        startDate,
        endDate,
        month,
        fiscalYear,
        entityId,
      );
      const response = await api.get("/api/accounting/summary", { params });
      setSummary(response.data.data);
    } catch (error) {
      console.error("[useAccounting] summary fetch failed", error);
    } finally {
      setLoadingSummary(false);
    }
  }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

  const fetchLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
      const params = buildParams(
        quarter,
        startDate,
        endDate,
        month,
        fiscalYear,
        entityId,
      );
      const ledgerParams = { ...params };
      if (ledgerType && ledgerType !== "all") ledgerParams.type = ledgerType;
      const response = await api.get("/api/ledger/get-ledger", {
        params: ledgerParams,
      });
      const entries = Array.isArray(response.data?.data?.entries)
        ? response.data.data.entries
        : [];
      setLedgerEntries(entries);
    } catch (error) {
      console.error("[useAccounting] ledger fetch failed", error);
      setLedgerEntries([]);
    } finally {
      setLoadingLedger(false);
    }
  }, [quarter, ledgerType, startDate, endDate, month, fiscalYear, entityId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const refetch = useCallback(() => {
    fetchSummary();
    fetchLedger();
  }, [fetchSummary, fetchLedger]);

  return { summary, loadingSummary, ledgerEntries, loadingLedger, refetch };
}

// ─── useRevenueSummary ────────────────────────────────────────────────────────

export function useRevenueSummary(
  quarter,
  startDate = "",
  endDate = "",
  month = null,
  fiscalYear = null,
  entityId = null, // NEW
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // BUG FIX: params built inside useCallback to avoid stale closure
      const params = buildParams(
        quarter,
        startDate,
        endDate,
        month,
        fiscalYear,
        entityId,
      );
      const response = await api.get("/api/accounting/revenue-summary", {
        params,
      });
      setData(response.data.data);
    } catch (error) {
      console.error("[useRevenueSummary] fetch failed", error);
      setError("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useExpenseSummary ────────────────────────────────────────────────────────

export function useExpenseSummary(
  quarter,
  startDate = "",
  endDate = "",
  month = null,
  fiscalYear = null,
  entityId = null, // NEW
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // BUG FIX: params built inside useCallback to avoid stale closure
      const params = buildParams(
        quarter,
        startDate,
        endDate,
        month,
        fiscalYear,
        entityId,
      );
      const response = await api.get("/api/accounting/expense-summary", {
        params,
      });
      setData(response.data.data);
    } catch (error) {
      console.error("[useExpenseSummary] fetch failed", error);
      setError("Failed to load expense data");
    } finally {
      setLoading(false);
    }
  }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useBankAccounts ──────────────────────────────────────────────────────────

export function useBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);

  useEffect(() => {
    api
      .get("/api/bank/get-bank-accounts")
      .then((response) => {
        const data = response.data;
        const accounts = data.bankAccounts || [];
        setBankAccounts(accounts);
        if (accounts.length > 0) setSelectedBank(accounts[0]);
      })
      .catch((error) => console.error("[useBankAccounts] fetch failed", error));
  }, []);

  return { bankAccounts, selectedBank, setSelectedBank };
}
