import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

// ─── Shared param builder ─────────────────────────────────────────────────────

function buildParams(selectedQuarter, startDate, endDate) {
  const params = {};
  if (selectedQuarter === "custom") {
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
  } else if (selectedQuarter) {
    params.quarter = selectedQuarter;
  }
  return params;
}

// ─── useAccounting ────────────────────────────────────────────────────────────

/**
 * Fetches the top-level KPI summary (totals + breakdowns) and ledger entries.
 * No calculations performed client-side — values are used as-is from the API.
 */
export function useAccounting(
  selectedQuarter,
  ledgerType = "all",
  startDate = "",
  endDate = "",
) {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const params = buildParams(selectedQuarter, startDate, endDate);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const response = await api.get("/api/accounting/summary", { params });
      setSummary(response.data.data);
    } catch (error) {
      console.error("[useAccounting] summary fetch failed", error);
    } finally {
      setLoadingSummary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, startDate, endDate]);

  const fetchLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, ledgerType, startDate, endDate]);

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

/**
 * Fetches the full revenue breakdown from /api/accounting/revenue-summary.
 * Returns pre-aggregated data — frontend only formats for display.
 */
export function useRevenueSummary(
  selectedQuarter,
  startDate = "",
  endDate = "",
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const params = buildParams(selectedQuarter, startDate, endDate);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/accounting/revenue-summary", {
        params,
      });
      ("/api/accounting/revenue-summary", setData(response.data.data));
    } catch (error) {
      console.error("[useRevenueSummary] fetch failed", error);
      setError("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, startDate, endDate]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useExpenseSummary ────────────────────────────────────────────────────────

/**
 * Fetches the full expense breakdown from /api/accounting/expense-summary.
 * Returns pre-aggregated data — frontend only formats for display.
 */
export function useExpenseSummary(
  selectedQuarter,
  startDate = "",
  endDate = "",
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const params = buildParams(selectedQuarter, startDate, endDate);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, startDate, endDate]);

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
