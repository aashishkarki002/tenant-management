import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export const useAccounting = (
  selectedQuarter,
  ledgerType = "all",
  startDate = "",
  endDate = "",
) => {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  /** Build query params — handles quarter, custom range, or no filter */
  const buildParams = useCallback(() => {
    const params = {};
    if (selectedQuarter === "custom") {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    } else if (selectedQuarter) {
      params.quarter = selectedQuarter;
    }
    return params;
  }, [selectedQuarter, startDate, endDate]);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const response = await api.get("/api/accounting/summary", {
        params: buildParams(),
      });
      setSummary(response.data.data);
    } catch (error) {
      console.error("Failed to fetch accounting summary", error);
    } finally {
      setLoadingSummary(false);
    }
  }, [buildParams]);

  const fetchLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
      const params = buildParams();
      if (ledgerType && ledgerType !== "all") params.type = ledgerType;
      const response = await api.get("/api/ledger/get-ledger", { params });
      const data = response.data?.data;
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      setLedgerEntries(entries);
    } catch (error) {
      console.error("Failed to fetch ledger", error);
      setLedgerEntries([]);
    } finally {
      setLoadingLedger(false);
    }
  }, [buildParams, ledgerType]);

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

  return {
    summary,
    loadingSummary,
    ledgerEntries,
    loadingLedger,
    refetch,
  };
};

export const useBankAccounts = () => {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);

  useEffect(() => {
    const getBankAccounts = async () => {
      try {
        const response = await api.get("/api/bank/get-bank-accounts");
        const accounts = response.data.bankAccounts || [];
        setBankAccounts(accounts);
        if (accounts.length > 0) setSelectedBank(accounts[0]);
      } catch (error) {
        console.error("Failed to fetch bank accounts", error);
      }
    };
    getBankAccounts();
  }, []);

  return {
    bankAccounts,
    selectedBank,
    setSelectedBank,
  };
};
