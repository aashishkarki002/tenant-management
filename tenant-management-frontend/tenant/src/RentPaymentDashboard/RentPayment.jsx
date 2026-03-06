// src/pages/rent/RentPayment.jsx
import React, { useState, useMemo, useCallback } from "react";
import { useRentData } from "./hooks/useRentData";
import { usePaymentForm } from "./hooks/usePaymentForm";
import { RentTable } from "./components/RentTable";
import { PaymentsTable } from "./components/PaymentsTable";
import { PaymentFilters } from "./components/PaymentFilters";
import { RentSummaryCard } from "./components/RentSummaryCard";
import { getPaymentAmounts } from "./utils/paymentUtil";
import { RentFilter } from "./components/RentFilter";
import { AdminRentActions } from "./components/AdminRentAction";
import { NEPALI_MONTH_NAMES } from "../../utils/nepaliDate";
import { useHeaderSlot } from "../context/HeaderSlotContext";

const RentPayment = () => {
  const {
    rents, payments, bankAccounts, cams, properties,
    loading, paymentsLoading,
    filterRentMonth, filterRentYear, filterStatus, filterPropertyId,
    setFilterRentMonth, setFilterRentYear, setFilterStatus, setFilterPropertyId,
    defaultRentMonth, defaultRentYear,
    filterStartDate, filterEndDate, filterPaymentMethod,
    setFilterStartDate, setFilterEndDate, setFilterPaymentMethod,
    getRents, getPayments, fetchRentSummary, getCams,
  } = useRentData();

  // Tab state lives here — no longer driven by shadcn Tabs
  const [activeTab, setActiveTab] = useState("rent");
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const [frequencyView, setFrequencyView] = useState("monthly");

  const frequencyFilteredRents = useMemo(
    () => rents.filter((r) => (r.rentFrequency || "monthly") === frequencyView),
    [rents, frequencyView],
  );

  const overdueCount = useMemo(
    () => rents.filter((r) => (r.status || "").toLowerCase() === "overdue").length,
    [rents],
  );

  const { frequencyTotalDue, frequencyTotalCollected } = useMemo(() => {
    return frequencyFilteredRents.reduce(
      (acc, rent) => {
        const { totalDue } = getPaymentAmounts(rent, cams);
        const status = rent.status?.toLowerCase();
        let collected = 0;
        if (status === "paid") {
          collected = totalDue;
        } else if (status === "partially_paid" || status === "partial") {
          collected = rent.paidAmountPaisa != null
            ? rent.paidAmountPaisa / 100
            : (rent.paidAmount ?? 0);
        }
        return {
          frequencyTotalDue: acc.frequencyTotalDue + totalDue,
          frequencyTotalCollected: acc.frequencyTotalCollected + collected,
        };
      },
      { frequencyTotalDue: 0, frequencyTotalCollected: 0 },
    );
  }, [frequencyFilteredRents, cams]);

  const handlePaymentSuccess = useCallback(async () => {
    await Promise.all([getRents(), getPayments(), fetchRentSummary(), getCams()]);
  }, [getRents, getPayments, fetchRentSummary, getCams]);

  const paymentForm = usePaymentForm({ rents, cams, onSuccess: handlePaymentSuccess });

  const handleSubmit = (e) => { e.preventDefault(); paymentForm.formik.handleSubmit(); };

  const handleClearPaymentFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPaymentMethod("all");
    setDatePickerResetKey((prev) => prev + 1);
  };

  const handleClearRentFilters = () => {
    setFilterRentMonth(defaultRentMonth);
    setFilterRentYear(defaultRentYear);
    setFilterStatus("all");
    setFilterPropertyId("");
  };

  const currentMonthName = filterRentMonth != null ? NEPALI_MONTH_NAMES[filterRentMonth - 1] : "";

  // ── Header slot ───────────────────────────────────────────────────────────
  // Inline tab nav + CTAs live here — the page body is pure content.
  // activeTab is a dep so the active state re-renders in the header.
  useHeaderSlot(
    () => (
      <div className="flex items-center gap-3 w-full min-w-0">
        {/* Brand mark */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
            Rent Management
          </span>
        </div>

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        {/* Inline tab pills */}
        <nav className="flex items-center gap-0.5 shrink-0">
          {[
            { id: "rent", label: "Rent" },
            { id: "payments", label: "Payment History" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                "text-xs font-semibold transition-colors",
                activeTab === t.id
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
              {t.id === "rent" && overdueCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0" />

        {/* Global CTAs */}
        <AdminRentActions onProcessSuccess={getRents} />
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, overdueCount, currentMonthName, filterRentYear, getRents],
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-9 bg-slate-100 rounded-xl w-full" />
        <div className="h-24 bg-slate-100 rounded-xl w-full" />
        <div className="h-64 bg-slate-100 rounded-xl w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* ══ RENT TAB ═════════════════════════════════════════════════════════ */}
      {activeTab === "rent" && (
        <div className="space-y-4">

          {/* Overdue nudge banner */}
          {overdueCount > 0 && filterStatus !== "overdue" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                <p className="text-xs font-semibold text-red-700 whitespace-nowrap">
                  {overdueCount} overdue rent{overdueCount !== 1 ? "s" : ""} need attention
                </p>
                <span className="hidden sm:inline text-xs text-red-400">
                  · {currentMonthName} {filterRentYear}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus("overdue")}
                className="shrink-0 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                Show overdue
              </button>
            </div>
          )}

          {/* Filters — scopes the KPIs below */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5">
            <RentFilter
              month={filterRentMonth}
              year={filterRentYear}
              status={filterStatus}
              propertyId={filterPropertyId}
              properties={properties}
              defaultMonth={defaultRentMonth}
              defaultYear={defaultRentYear}
              onMonthChange={setFilterRentMonth}
              onYearChange={setFilterRentYear}
              onStatusChange={setFilterStatus}
              onPropertyChange={setFilterPropertyId}
              onReset={handleClearRentFilters}
              frequencyView={frequencyView}
              onFrequencyChange={setFrequencyView}
            />
          </div>

          {/* KPI strip — answers the scoped question */}
          <RentSummaryCard
            totalCollected={frequencyTotalCollected}
            totalDue={frequencyTotalDue}
            frequencyView={frequencyView}
            currentMonthName={currentMonthName}
            currentYear={filterRentYear}
          />

          {/* Rent table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center px-4 sm:px-5 py-3 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide tabular-nums">
                {frequencyFilteredRents.length} record{frequencyFilteredRents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-4 sm:px-5 pt-2 pb-4">
              <RentTable
                rents={frequencyFilteredRents}
                cams={cams}
                bankAccounts={bankAccounts}
                formik={paymentForm.formik}
                allocationMode={paymentForm.allocationMode}
                setAllocationMode={paymentForm.setAllocationMode}
                rentAllocation={paymentForm.rentAllocation}
                setRentAllocation={paymentForm.setRentAllocation}
                camAllocation={paymentForm.camAllocation}
                setCamAllocation={paymentForm.setCamAllocation}
                lateFeeAllocation={paymentForm.lateFeeAllocation}
                setLateFeeAllocation={paymentForm.setLateFeeAllocation}
                selectedBankAccountId={paymentForm.selectedBankAccountId}
                setSelectedBankAccountId={paymentForm.setSelectedBankAccountId}
                handleOpenDialog={paymentForm.handleOpenDialog}
                handleAmountChange={paymentForm.handleAmountChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYMENTS TAB ═════════════════════════════════════════════════════ */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              All recorded payments across tenants and billing periods
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-4">
            <PaymentFilters
              filterStartDate={filterStartDate}
              filterEndDate={filterEndDate}
              filterPaymentMethod={filterPaymentMethod}
              setFilterStartDate={setFilterStartDate}
              setFilterEndDate={setFilterEndDate}
              setFilterPaymentMethod={setFilterPaymentMethod}
              datePickerResetKey={datePickerResetKey}
              onReset={handleClearPaymentFilters}
            />
            {paymentsLoading ? (
              <div className="space-y-3 pt-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-slate-100 rounded-lg animate-pulse"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            ) : (
              <PaymentsTable payments={payments} />
            )}
          </div>
        </div>
      )}
    </form>
  );
};

export default RentPayment;