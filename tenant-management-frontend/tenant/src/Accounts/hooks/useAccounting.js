import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export const useAccounting = (selectedQuarter, ledgerType = "all") => {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = {};
      if (selectedQuarter) params.quarter = selectedQuarter;
      const response = await api.get("/api/accounting/summary", { params });
      setSummary(response.data.data);
    } catch (error) {
      console.error("Failed to fetch accounting summary", error);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedQuarter]);

  const fetchLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
      const params = {};
      if (selectedQuarter) params.quarter = selectedQuarter;
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
  }, [selectedQuarter, ledgerType]);

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
