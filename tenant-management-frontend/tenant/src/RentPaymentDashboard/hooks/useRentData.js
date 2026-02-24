import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { getCurrentNepaliMonthYear } from "@/constants/nepaliMonths";

/**
 * Custom hook for managing rent and payment data.
 *
 * CHANGE: getRents now passes all rent-tab filters as query params
 * instead of fetching everything and filtering client-side.
 *
 * Industry Standard: server-side filtering is preferred over client-side
 * for paginated/large datasets — reduces payload, avoids stale data, and
 * keeps the server as the single source of truth for filter logic.
 *
 * filteredRents (useMemo) is removed — the API now returns only matching
 * records, so `rents` is already the filtered set.
 */
export const useRentData = () => {
  const [rents, setRents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cams, setCams] = useState([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Rent tab filters ──────────────────────────────────────────────────
  const { month: defaultRentMonth, year: defaultRentYear } =
    getCurrentNepaliMonthYear();
  const [filterRentMonth, setFilterRentMonth] = useState(defaultRentMonth);
  const [filterRentYear, setFilterRentYear] = useState(defaultRentYear);
  const [filterStatus, setFilterStatus] = useState("all"); // NEW
  const [filterPropertyId, setFilterPropertyId] = useState(""); // NEW

  // ── Payment tab filters ───────────────────────────────────────────────
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");

  /**
   * Fetches rents with all active filters sent as query params.
   *
   * Matches the filter shape already supported by getRentsController:
   *   nepaliMonth, nepaliYear, status, propertyId
   */
  const getRents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterRentMonth) params.append("nepaliMonth", filterRentMonth);
      if (filterRentYear) params.append("nepaliYear", filterRentYear);
      if (filterStatus && filterStatus !== "all")
        params.append("status", filterStatus);
      if (filterPropertyId) params.append("propertyId", filterPropertyId);

      const qs = params.toString();
      const url = qs ? `/api/rent/get-rents?${qs}` : "/api/rent/get-rents";

      const response = await api.get(url);
      if (response.data.success) {
        setRents(response.data.rents || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch rents");
      }
    } catch (error) {
      console.error("Error fetching rents:", error);
      setError(error);
      toast.error("Failed to fetch rents. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches payments with optional filters.
   */
  const getPayments = async () => {
    try {
      setPaymentsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterStartDate) params.append("startDate", filterStartDate);
      if (filterEndDate) params.append("endDate", filterEndDate);
      if (filterPaymentMethod && filterPaymentMethod !== "all")
        params.append("paymentMethod", filterPaymentMethod);

      const qs = params.toString();
      const endpoint = qs
        ? `/api/payment/get-filtered-payment-history?${qs}`
        : "/api/payment/get-all-payment-history";

      const response = await api.get(endpoint);
      if (response.data.success) {
        setPayments(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch payments");
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError(error);
      toast.error("Failed to fetch payments. Please try again.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchRentSummary = async () => {
    try {
      const response = await api.get("/api/payment/get-rent-summary");
      if (response.data.success && response.data.data) {
        setTotalCollected(response.data.data.totalCollected || 0);
        setTotalDue(response.data.data.totalDue || 0);
      }
    } catch (error) {
      console.error("Error fetching rent summary:", error);
      toast.error("Failed to fetch rent summary");
    }
  };

  const getBankAccounts = async () => {
    try {
      const response = await api.get("/api/bank/get-bank-accounts");
      setBankAccounts(response.data.bankAccounts || []);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      toast.error("Failed to fetch bank accounts");
    }
  };

  const getUnits = async () => {
    try {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units || []);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to fetch units");
    }
  };

  const getProperties = async () => {
    try {
      const response = await api.get("/api/property/get-property");
      setProperties(response.data.property || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Failed to load properties");
      setProperties([]);
    }
  };

  const getCams = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.nepaliMonth != null)
        params.append("nepaliMonth", filters.nepaliMonth);
      if (filters.nepaliYear != null)
        params.append("nepaliYear", filters.nepaliYear);
      const qs = params.toString();
      const url = qs ? `/api/cam/get-cams?${qs}` : "/api/cam/get-cams";
      const response = await api.get(url);
      if (response.data.success) {
        setCams(response.data.cams || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch CAMs");
      }
    } catch (error) {
      console.error("Error fetching CAMs:", error);
      setCams([]);
      toast.error("Failed to fetch CAMs. CAM payments may be unavailable.");
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────

  // Initial load of non-rent data
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([
          getBankAccounts(),
          getUnits(),
          getProperties(),
          fetchRentSummary(),
        ]);
      } catch (error) {
        console.error("Init load failed:", error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refetch rents whenever any rent filter changes (server-side)
  useEffect(() => {
    getRents();
  }, [filterRentMonth, filterRentYear, filterStatus, filterPropertyId]);

  // Refetch CAMs when month/year changes (needed for payment allocation)
  useEffect(() => {
    getCams({ nepaliMonth: filterRentMonth, nepaliYear: filterRentYear });
  }, [filterRentMonth, filterRentYear]);

  // Refetch payments when payment filters change
  useEffect(() => {
    getPayments();
  }, [filterStartDate, filterEndDate, filterPaymentMethod]);

  return {
    // Data
    rents, // already filtered by server — use directly (replaces filteredRents)
    payments,
    units,
    properties,
    bankAccounts,
    cams,
    totalCollected,
    totalDue,
    // State
    loading,
    paymentsLoading,
    error,
    // Rent tab filters
    filterRentMonth,
    filterRentYear,
    filterStatus,
    filterPropertyId,
    setFilterRentMonth,
    setFilterRentYear,
    setFilterStatus,
    setFilterPropertyId,
    // Payment tab filters
    filterStartDate,
    filterEndDate,
    filterPaymentMethod,
    setFilterStartDate,
    setFilterEndDate,
    setFilterPaymentMethod,
    // Actions
    getRents,
    getPayments,
    fetchRentSummary,
    getBankAccounts,
    getUnits,
    getProperties,
    getCams,
    defaultRentMonth,
    defaultRentYear,
  };
};
