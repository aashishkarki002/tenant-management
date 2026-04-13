// src/pages/rent/hooks/useArrearsPayment.js
//
// Drives the ArrearsPaymentDialog:
//   1.  Fetches all unpaid months for a tenant (GET /api/payment/tenant-arrears/:id)
//   2.  Tracks which months are selected + the payment amount entered
//   3.  Auto-fills amount when selection changes (full clearance of selected months)
//   4.  Submits via POST /api/payment/pay-arrears
//   5.  Reports per-month results back to the parent on success

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import {
  normalizeLedgerPaymentMethod,
  paymentMethodRequiresBankAccount,
} from "@/constants/paymentMethods.js";

/**
 * @param {{
 *   tenant:        { _id: string, name: string } | null,
 *   onSuccess?:    () => void,
 *   onClose?:      () => void,
 * }} options
 */
export const useArrearsPayment = ({ tenant, onSuccess, onClose } = {}) => {
  // ── Remote data ─────────────────────────────────────────────────────────────
  const [arrears, setArrears] = useState([]); // shaped rent records from API
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // ── Selection state ──────────────────────────────────────────────────────────
  // Set of rent _id strings the admin has checked
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ── Payment form state ───────────────────────────────────────────────────────
  const [amount, setAmount] = useState(""); // display rupees string
  const [paymentDate, setPaymentDate] = useState(null);
  const [nepaliDate, setNepaliDate] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountCode, setBankAccountCode] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");

  // ── Fetch arrears when tenant changes ────────────────────────────────────────
  const fetchArrears = useCallback(async () => {
    const tenantId = tenant?._id;
    if (!tenantId) {
      setArrears([]);
      setSelectedIds(new Set());
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const res = await api.get(`/api/payment/tenant-arrears/${tenantId}`);
      if (!res.data.success) throw new Error(res.data.message);

      const records = res.data.data ?? [];
      setArrears(records);

      // Pre-select all months by default (full clearance intent)
      setSelectedIds(new Set(records.map((r) => r._id)));

      // Pre-fill amount = total outstanding across all months
      const total = res.data.totalRemaining ?? 0;
      setAmount(total > 0 ? String(total) : "");
    } catch (err) {
      console.error("[useArrearsPayment] fetchArrears:", err);
      setFetchError(err.message || "Failed to load arrears");
      toast.error("Failed to load tenant arrears.");
    } finally {
      setLoading(false);
    }
  }, [tenant?._id]);

  useEffect(() => {
    fetchArrears();
  }, [fetchArrears]);

  // ── Derived totals ────────────────────────────────────────────────────────────
  const selectedArrears = useMemo(
    () => arrears.filter((r) => selectedIds.has(r._id)),
    [arrears, selectedIds],
  );

  const selectedTotalPaisa = useMemo(
    () => selectedArrears.reduce((sum, r) => sum + r.totalRemainingPaisa, 0),
    [selectedArrears],
  );

  const selectedTotal = selectedTotalPaisa / 100;

  const selectedRentOnlyPaisa = useMemo(
    () => selectedArrears.reduce((sum, r) => sum + r.remainingRentPaisa, 0),
    [selectedArrears],
  );

  const selectedLateFeePaisa = useMemo(
    () => selectedArrears.reduce((sum, r) => sum + r.remainingLateFeePaisa, 0),
    [selectedArrears],
  );

  const amountNum = parseFloat(amount) || 0;
  const amountPaisa = Math.round(amountNum * 100);

  const needsBankAccount = paymentMethodRequiresBankAccount(paymentMethod);

  // ── Validation ────────────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errs = [];
    if (selectedIds.size === 0) errs.push("Select at least one month.");
    if (amountNum <= 0) errs.push("Enter a payment amount.");
    if (amountPaisa > selectedTotalPaisa)
      errs.push("Amount exceeds total due for selected months.");
    if (!paymentMethod) errs.push("Select a payment method.");
    if (needsBankAccount && !bankAccountCode)
      errs.push("Select a bank account.");
    if (!paymentDate || !nepaliDate) errs.push("Select a payment date.");
    return errs;
  }, [
    selectedIds.size,
    amountNum,
    amountPaisa,
    selectedTotalPaisa,
    paymentMethod,
    needsBankAccount,
    bankAccountCode,
    paymentDate,
    nepaliDate,
  ]);

  const isValid = validationErrors.length === 0;

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const toggleMonth = useCallback((id) => {
    setSelectedIds((prev) => {
      const prevPaisa = arrears
        .filter((r) => prev.has(r._id))
        .reduce((s, r) => s + r.totalRemainingPaisa, 0);
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const nextPaisa = arrears
        .filter((r) => next.has(r._id))
        .reduce((s, r) => s + r.totalRemainingPaisa, 0);
      // Auto-update amount only when it still matches the previous selection total
      // (i.e. user hasn't manually overridden it)
      setAmount((currentAmount) => {
        const currentPaisa = Math.round((parseFloat(currentAmount) || 0) * 100);
        if (currentPaisa === prevPaisa || currentAmount === "") {
          return nextPaisa > 0 ? String(nextPaisa / 100) : "";
        }
        return currentAmount;
      });
      return next;
    });
  }, [arrears]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(arrears.map((r) => r._id)));
    const totalPaisa = arrears.reduce((s, r) => s + r.totalRemainingPaisa, 0);
    setAmount(totalPaisa > 0 ? String(totalPaisa / 100) : "");
  }, [arrears]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setAmount("");
  }, []);

  // Fill full amount for selected months
  const fillFullAmount = useCallback(() => {
    setAmount(selectedTotal > 0 ? String(selectedTotal) : "");
  }, [selectedTotal]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (!isValid) {
      toast.error(validationErrors[0]);
      return;
    }

    setSubmitting(true);
    try {
      const orderedRentIds = arrears
        .filter((r) => selectedIds.has(r._id))
        .map((r) => r._id); // already sorted oldest-first from API

      const payload = {
        tenantId: tenant._id,
        rentIds: orderedRentIds,
        totalAmount: amountNum,
        paymentDate,
        nepaliDate,
        paymentMethod: normalizeLedgerPaymentMethod(paymentMethod, ""),
        bankAccountId: bankAccountId || null,
        bankAccountCode: bankAccountCode || null,
        transactionRef: transactionRef || null,
        note: note || null,
        allocationStrategy: "proportional",
      };

      const res = await api.post("/api/payment/pay-arrears", payload);
      const data = res.data;

      if (data.success) {
        if (data.data?.partial) {
          toast.warning(data.message, { duration: 6000 });
        } else {
          toast.success(data.message);
        }

        onSuccess?.({
          succeeded: data.data?.succeeded ?? [],
          failed: data.data?.failed ?? [],
          totalPaid: data.data?.totalPaid ?? 0,
        });

        onClose?.();
      } else {
        toast.error(data.message || "Payment failed");
      }
    } catch (err) {
      console.error("[useArrearsPayment] submit:", err);
      toast.error(err?.response?.data?.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid,
    validationErrors,
    arrears,
    selectedIds,
    tenant,
    amountNum,
    paymentDate,
    nepaliDate,
    paymentMethod,
    bankAccountId,
    bankAccountCode,
    transactionRef,
    note,
    onSuccess,
    onClose,
  ]);

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setAmount("");
    setPaymentDate(null);
    setNepaliDate(null);
    setPaymentMethod("");
    setBankAccountId("");
    setBankAccountCode("");
    setTransactionRef("");
    setNote("");
    setSelectedIds(new Set(arrears.map((r) => r._id)));
  }, [arrears]);

  return {
    // Data
    arrears,
    loading,
    submitting,
    fetchError,

    // Selection
    selectedIds,
    selectedArrears,
    selectedTotal,
    selectedTotalPaisa,
    selectedRentOnlyPaisa,
    selectedLateFeePaisa,
    toggleMonth,
    selectAll,
    deselectAll,

    // Form fields
    amount,
    setAmount,
    paymentDate,
    setPaymentDate,
    nepaliDate,
    setNepaliDate,
    paymentMethod,
    setPaymentMethod,
    bankAccountId,
    setBankAccountId,
    bankAccountCode,
    setBankAccountCode,
    transactionRef,
    setTransactionRef,
    note,
    setNote,

    // Derived
    amountNum,
    amountPaisa,
    needsBankAccount,
    fillFullAmount,

    // Validation
    validationErrors,
    isValid,

    // Actions
    submit,
    reset,
    fetchArrears,
  };
};
