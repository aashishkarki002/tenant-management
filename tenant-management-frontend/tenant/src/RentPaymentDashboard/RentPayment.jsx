// src/pages/rent/RentPayment.jsx
import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

// ── Header slot: page title only — no CTAs on this page ──────────────────────
// Declared at module level → stable reference → useLayoutEffect fires once.
const RentPaymentHeaderSlot = (
  <div className="flex flex-col justify-center min-w-0">
    <h1 className="text-sm font-semibold text-slate-900 leading-tight truncate">
      Rent Management
    </h1>
    <p className="text-xs text-slate-400 truncate">
      Track and record rent collection across all tenants
    </p>
  </div>
);

const RentPayment = () => {
  useHeaderSlot(RentPaymentHeaderSlot);

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

  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const [frequencyView, setFrequencyView] = useState("monthly");

  const frequencyFilteredRents = useMemo(
    () => rents.filter((r) => (r.rentFrequency || "monthly") === frequencyView),
    [rents, frequencyView],
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

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="animate-pulse p-6 space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="overflow-hidden border-slate-200">
        <Tabs defaultValue="rent">
          {/* ── Tab navigation only — title lives in the header slot ─────── */}
          <div className="px-4 sm:px-6 pt-4 pb-0 border-b border-slate-100">
            <TabsList className="grid grid-cols-2 w-full max-w-xs h-9 bg-slate-100 p-0.5 rounded-lg -mb-px">
              <TabsTrigger
                value="rent"
                className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Rent
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Payment History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ══ RENT TAB ═════════════════════════════════════════════════════ */}
          <TabsContent value="rent" className="mt-0 focus-visible:outline-none focus-visible:ring-0">

            <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
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
              />
            </div>

            <RentSummaryCard
              totalCollected={frequencyTotalCollected}
              totalDue={frequencyTotalDue}
              frequencyView={frequencyView}
              currentMonthName={currentMonthName}
              currentYear={filterRentYear}
            />

            <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">View</span>
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 gap-0.5">
                  {["monthly", "quarterly"].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequencyView(freq)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors capitalize ${frequencyView === freq
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
                {frequencyFilteredRents.length > 0 && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {frequencyFilteredRents.length} record{frequencyFilteredRents.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <AdminRentActions onProcessSuccess={getRents} />
            </div>

            <CardContent className="px-4 sm:px-6 pt-4">
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
            </CardContent>
          </TabsContent>

          {/* ══ PAYMENTS TAB ══════════════════════════════════════════════════ */}
          <TabsContent value="payments" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="px-4 sm:px-6 pt-5 pb-2">
              <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                All recorded payments across tenants and billing periods
              </p>
            </div>

            <CardContent className="px-4 sm:px-6">
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
                <div className="space-y-3 py-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-slate-100 rounded animate-pulse"
                      style={{ opacity: 1 - i * 0.15 }}
                    />
                  ))}
                </div>
              ) : (
                <PaymentsTable payments={payments} />
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </form>
  );
};

export default RentPayment;