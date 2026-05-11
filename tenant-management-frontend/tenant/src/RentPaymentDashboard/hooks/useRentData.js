import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
// ── Canonical Nepali date source ───────────────────────────────────────────
// nepaliDate.js (client mirror of the server helper). getTodayNepali() gives
// a plain object: { year, month (1-based), day, monthName, … }
import { getTodayNepali } from "@/utils/nepaliDate";
import {
  getQuarterForMonth,
  getQuarterMonthRange,
} from "../utils/quarterUtils";

/**
 * useRentData
 *
 * Single source of truth for rent + payment data and all filter state.
 *
 * Key decisions:
 *  - Default period = current Nepali month + year from getTodayNepali().
 *  - nepaliMonth + nepaliYear are ALWAYS sent to the API (never omitted)
 *    so the default view is scoped to the current billing period, not all time.
 *  - Status defaults to "all" → API returns all statuses for that month.
 *  - frequency split (monthly / quarterly) is client-side only — no extra
 *    round-trip because rentFrequency is already on every rent document.
 *  - getCams reads from its own closure (filterRentMonth/Year) so callers
 *    like handlePaymentSuccess can invoke it with no arguments.
 *  - All fetch functions are useCallback so their references are stable and
 *    safe to use as useEffect dependencies.
 */
export const useRentData = () => {
  const today = getTodayNepali(); // { year, month(1-based), monthName, … }
  const defaultRentMonth = today.month;
  const defaultRentYear = today.year;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [rents, setRents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cams, setCams] = useState([]);
  // electricityByTenantId: { [tenantId]: ElectricityRecord[] } — only unpaid records
  const [electricityByTenantId, setElectricityByTenantId] = useState({});

  // ── Loading / error ───────────────────────────────────────────────────────
  const [initLoading, setInitLoading] = useState(true);
  const [rentsLoading, setRentsLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Rent tab filters ──────────────────────────────────────────────────────
  const [filterRentMonth, setFilterRentMonth] = useState(defaultRentMonth);
  const [filterRentYear, setFilterRentYear] = useState(defaultRentYear);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPropertyId, setFilterPropertyId] = useState("");

  // ── Frequency + quarter ───────────────────────────────────────────────────
  const defaultQuarter = getQuarterForMonth(today.month);
  const [frequencyView, setFrequencyView] = useState("monthly");
  const [filterQuarter, setFilterQuarter] = useState(defaultQuarter);

  // ── Payment tab filters ───────────────────────────────────────────────────
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");

  // ── Fetch: rents ──────────────────────────────────────────────────────────
  const getRents = useCallback(async () => {
    try {
      setRentsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      // Scope to the selected period — monthly sends a single month, quarterly
      // sends a month range covering all 3 months of the selected quarter.
      if (frequencyView === "quarterly") {
        const { start, end } = getQuarterMonthRange(filterQuarter);
        params.append("nepaliMonthStart", start);
        params.append("nepaliMonthEnd", end);
      } else {
        params.append("nepaliMonth", filterRentMonth);
      }
      params.append("nepaliYear", filterRentYear);
      if (filterStatus && filterStatus !== "all")
        params.append("status", filterStatus);
      if (filterPropertyId) params.append("propertyId", filterPropertyId);

      const response = await api.get(
        `/api/rent/get-rents?${params.toString()}`,
      );
      if (response.data.success) {
        setRents(response.data.rents || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch rents");
      }
    } catch (err) {
      console.error("Error fetching rents:", err);
      setError(err);
      toast.error("Failed to fetch rents. Please try again.");
    } finally {
      setRentsLoading(false);
    }
  }, [frequencyView, filterQuarter, filterRentMonth, filterRentYear, filterStatus, filterPropertyId]);

  // ── Fetch: electricity for current period ────────────────────────────────
  // Groups unpaid readings by tenantId so each RentTableRow can look up its own.
  const getElectricityForPeriod = useCallback(async () => {
    try {
      const response = await api.get("/api/electricity/get-readings", {
        params: { nepaliMonth: filterRentMonth, nepaliYear: filterRentYear },
      });
      if (response.data.success) {
        const readings = response.data.data?.readings || [];
        const map = {};
        readings.forEach((r) => {
          const tenantId = r.tenant?._id || r.tenant;
          if (!tenantId) return;
          const remaining =
            r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
          if (remaining <= 0) return; // skip fully paid
          const key = tenantId.toString();
          if (!map[key]) map[key] = [];
          map[key].push(r);
        });
        setElectricityByTenantId(map);
      }
    } catch (err) {
      console.error("Error fetching electricity readings for period:", err);
      setElectricityByTenantId({});
    }
  }, [filterRentMonth, filterRentYear]);

  // ── Fetch: CAMs ───────────────────────────────────────────────────────────
  // Reads month/year from closure — no args needed when called post-payment.
  const getCams = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("nepaliMonth", filterRentMonth);
      params.append("nepaliYear", filterRentYear);
      const response = await api.get(`/api/cam/get-cams?${params.toString()}`);
      if (response.data.success) {
        setCams(response.data.cams || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch CAMs");
      }
    } catch (err) {
      console.error("Error fetching CAMs:", err);
      setCams([]);
      toast.error("Failed to fetch CAMs. CAM payments may be unavailable.");
    }
  }, [filterRentMonth, filterRentYear]);

  // ── Fetch: payments ───────────────────────────────────────────────────────
  const getPayments = useCallback(async () => {
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
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError(err);
      toast.error("Failed to fetch payments. Please try again.");
    } finally {
      setPaymentsLoading(false);
    }
  }, [filterStartDate, filterEndDate, filterPaymentMethod]);

  // ── Fetch: supporting data ────────────────────────────────────────────────
  const getBankAccounts = useCallback(async () => {
    try {
      const response = await api.get("/api/bank/get-bank-accounts");
      setBankAccounts(response.data.bankAccounts || []);
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
      toast.error("Failed to fetch bank accounts");
    }
  }, []);

  const getProperties = useCallback(async () => {
    try {
      const response = await api.get("/api/property/get-property");
      setProperties(response.data.property || []);
    } catch (err) {
      console.error("Error fetching properties:", err);
      setProperties([]);
      toast.error("Failed to load properties");
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  // One-time init: non-period-dependent reference data
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([getBankAccounts(), getProperties()]);
      } catch (err) {
        console.error("Init load failed:", err);
        setError(err);
      } finally {
        setInitLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getRents();
  }, [getRents]);
  useEffect(() => {
    getCams();
  }, [getCams]);
  useEffect(() => {
    getElectricityForPeriod();
  }, [getElectricityForPeriod]);
  useEffect(() => {
    getPayments();
  }, [getPayments]);

  return {
    rents,
    payments,
    properties,
    bankAccounts,
    cams,
    // loading = true until both init reference data AND first rents fetch complete
    loading: initLoading || rentsLoading,
    paymentsLoading,
    error,
    // Rent filters
    filterRentMonth,
    filterRentYear,
    filterStatus,
    filterPropertyId,
    setFilterRentMonth,
    setFilterRentYear,
    setFilterStatus,
    setFilterPropertyId,
    // Frequency + quarter
    frequencyView,
    setFrequencyView,
    filterQuarter,
    setFilterQuarter,
    defaultQuarter,
    // Payment filters
    filterStartDate,
    filterEndDate,
    filterPaymentMethod,
    setFilterStartDate,
    setFilterEndDate,
    setFilterPaymentMethod,
    // Electricity by tenant
    electricityByTenantId,
    getElectricityForPeriod,
    // Stable actions
    getRents,
    getPayments,
    getBankAccounts,
    getProperties,
    getCams,
    // Reset targets
    defaultRentMonth,
    defaultRentYear,
    // Expose today's full descriptor for display use (monthName, etc.)
    todayNepali: today,
  };
};
