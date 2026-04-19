// src/pages/rent/RentPayment.jsx
import React, { useState, useMemo, useCallback } from "react";
import { useRentData } from "./hooks/useRentData";
import { usePaymentForm } from "./hooks/usePaymentForm";
import { RentTable } from "./components/RentTable";
import { PaymentsTable } from "./components/PaymentsTable";
import { PaymentFilters } from "./components/PaymentFilters";
import { getPaymentAmounts } from "./utils/paymentUtil";
import { RentFilter } from "./components/RentFilter";
import { AdminRentAction } from "./components/AdminRentAction";
import { useAdminRentActions } from "./hooks/AdminRentAction";
import { RentMetricsStrip } from "./components/RentMetricsStrip";
import { exportRentsToCsv } from "./utils/rentExport";
import api from "../../plugins/axios";
import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";
import { NEPALI_QUARTERS, getQuarterForMonth } from "./utils/quarterUtils";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn(
        "w-full h-9 pl-8 pr-3 text-xs rounded-md border outline-none",
        "bg-background border-border text-foreground placeholder:text-muted-foreground",
        "transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30",
      )}
    />
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-16 rounded-lg bg-muted/50 border border-border" />
    <div className="h-10 rounded-lg bg-muted/50 border border-border" />
    <div className="h-24 rounded-lg bg-muted/50 border border-border" />
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-md bg-muted/50 border border-border"
          style={{ opacity: 1 - i * 0.13 }}
        />
      ))}
    </div>
  </div>
);

const OverdueBanner = ({ count, monthName, year, onShowOverdue }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200/80 bg-red-50/50 px-4 py-2.5 dark:bg-red-950/25 dark:border-red-900/50">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
      <p className="text-xs font-medium text-red-800 dark:text-red-200 whitespace-nowrap">
        {count} overdue rent{count !== 1 ? "s" : ""} need attention
      </p>
      <span className="hidden sm:inline text-xs text-red-700/70 dark:text-red-300/70">
        · {monthName} {year}
      </span>
    </div>
    <button
      type="button"
      onClick={onShowOverdue}
      className="shrink-0 rounded-md border border-red-200 bg-background px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40 transition-colors"
    >
      Show overdue
    </button>
  </div>
);

function rowFullySettled(rent) {
  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";
  return rent.status === "paid" && !hasOutstandingLateFee;
}

const PaymentsMetricsStrip = ({ payments }) => {
  if (!payments.length) return null;
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const fmt = (n) =>
    `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const items = [
    { label: "Total collected", value: fmt(total) },
    { label: "Payments", value: String(payments.length) },
    { label: "Avg. payment", value: fmt(total / payments.length) },
  ];

  return (
    <div className="flex flex-wrap items-stretch gap-y-2 rounded-lg border border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && (
            <div
              className="hidden sm:block h-8 w-px shrink-0 bg-border self-center"
              aria-hidden
            />
          )}
          <div className="flex flex-col gap-0.5 min-w-0 px-3 sm:px-4 first:pl-0 last:pr-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const RentPayment = () => {
  const {
    rents,
    payments,
    bankAccounts,
    cams,
    properties,
    loading,
    paymentsLoading,
    filterRentMonth,
    filterRentYear,
    filterStatus,
    filterPropertyId,
    setFilterRentMonth,
    setFilterRentYear,
    setFilterStatus,
    setFilterPropertyId,
    frequencyView,
    setFrequencyView,
    filterQuarter,
    setFilterQuarter,
    defaultQuarter,
    defaultRentMonth,
    defaultRentYear,
    filterStartDate,
    filterEndDate,
    filterPaymentMethod,
    setFilterStartDate,
    setFilterEndDate,
    setFilterPaymentMethod,
    getRents,
    getPayments,
    getCams,
  } = useRentData();

  const adminRent = useAdminRentActions({ onProcessSuccess: getRents });

  const [activeTab, setActiveTab] = useState("rent");
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const frequencyFilteredRents = useMemo(
    () => rents.filter((r) => (r.rentFrequency || "monthly") === frequencyView),
    [rents, frequencyView],
  );

  const displayRents = useMemo(() => {
    if (!searchQuery.trim()) return frequencyFilteredRents;
    const q = searchQuery.toLowerCase();
    return frequencyFilteredRents.filter(
      (r) =>
        r.tenant?.name?.toLowerCase().includes(q) ||
        r.block?.name?.toLowerCase().includes(q) ||
        r.innerBlock?.name?.toLowerCase().includes(q) ||
        r.units?.some((u) => u.name?.toLowerCase().includes(q)),
    );
  }, [frequencyFilteredRents, searchQuery]);

  const overdueCount = useMemo(
    () => frequencyFilteredRents.filter((r) => (r.status || "").toLowerCase() === "overdue").length,
    [frequencyFilteredRents],
  );

  const { frequencyTotalDue, frequencyTotalCollected } = useMemo(() => {
    return frequencyFilteredRents.reduce(
      (acc, rent) => {
        const { totalDue } = getPaymentAmounts(rent, cams);
        const s = rent.status?.toLowerCase();
        const collected =
          s === "paid"
            ? totalDue
            : s === "partially_paid" || s === "partial"
              ? rent.paidAmountPaisa != null
                ? rent.paidAmountPaisa / 100
                : (rent.paidAmount ?? 0)
              : 0;
        return {
          frequencyTotalDue: acc.frequencyTotalDue + totalDue,
          frequencyTotalCollected: acc.frequencyTotalCollected + collected,
        };
      },
      { frequencyTotalDue: 0, frequencyTotalCollected: 0 },
    );
  }, [frequencyFilteredRents, cams]);

  const tenantsPaidStats = useMemo(() => {
    const total = frequencyFilteredRents.length;
    const paid = frequencyFilteredRents.filter((r) =>
      rowFullySettled(r),
    ).length;
    return { paid, total };
  }, [frequencyFilteredRents]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterStatus !== "all") c++;
    if (filterPropertyId) c++;
    if (frequencyView === "monthly") {
      if (defaultRentMonth != null && filterRentMonth !== defaultRentMonth) c++;
    } else {
      if (filterQuarter !== defaultQuarter) c++;
    }
    if (defaultRentYear != null && filterRentYear !== defaultRentYear) c++;
    return c;
  }, [
    filterStatus,
    filterPropertyId,
    frequencyView,
    filterRentMonth,
    filterQuarter,
    filterRentYear,
    defaultRentMonth,
    defaultQuarter,
    defaultRentYear,
  ]);

  const handlePaymentSuccess = useCallback(async () => {
    await Promise.all([getRents(), getPayments(), getCams()]);
  }, [getRents, getPayments, getCams]);

  const paymentForm = usePaymentForm({ rents, cams, onSuccess: handlePaymentSuccess });

  const handleSubmit = (e) => {
    e.preventDefault();
    paymentForm.formik.handleSubmit();
  };

  const handleClearPaymentFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPaymentMethod("all");
    setDatePickerResetKey((k) => k + 1);
  };

  const handleClearRentFilters = () => {
    setFilterRentMonth(defaultRentMonth);
    setFilterRentYear(defaultRentYear);
    setFilterQuarter(defaultQuarter);
    setFilterStatus("all");
    setFilterPropertyId("");
    setSearchQuery("");
  };

  const handleExportVisibleRents = useCallback(() => {
    exportRentsToCsv(displayRents, cams);
  }, [displayRents, cams]);

  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = useCallback(async () => {
    try {
      setExportingPdf(true);
      const params = { nepaliYear: filterRentYear };
      if (filterRentMonth != null) params.nepaliMonth = filterRentMonth;
      const response = await api.get("/api/rent/export/pdf", { params, responseType: "blob" });
      const month = filterRentMonth ? `-Month${filterRentMonth}` : "";
      const filename = `Rent-Roll-${filterRentYear}${month}.pdf`;
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  }, [filterRentYear, filterRentMonth]);

  const currentMonthName =
    filterRentMonth != null ? NEPALI_MONTH_NAMES[filterRentMonth - 1] : "";
  const currentPeriodLabel =
    frequencyView === "quarterly"
      ? `${NEPALI_QUARTERS[filterQuarter]?.label ?? ""} ${filterRentYear}`
      : `${currentMonthName} ${filterRentYear}`;

  useHeaderSlot(
    () => (
      <div className="flex items-center gap-2 p-2 w-full min-w-0">
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            Rent Management
          </span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-border shrink-0" />

        <nav className="flex items-center gap-0.5 shrink-0">
          {[
            { id: "rent", label: "Rent" },
            { id: "payments", label: "Payments" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors",
                activeTab === t.id
                  ? "bg-card text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {t.label}
              {t.id === "rent" && overdueCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0" />

        {activeTab === "rent" && (
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={cn(
              "sm:hidden flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors",
              activeFilterCount > 0
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background border-border text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary-foreground text-primary text-[9px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>
    ),
    [activeTab, overdueCount, activeFilterCount],
  );

  if (loading) return <LoadingSkeleton />;

  return (
    <form onSubmit={handleSubmit}>
      {activeTab === "rent" && (
        <div className="sm:hidden sticky top-14 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border mb-4">
          <SearchInput
            placeholder="Search tenants or units…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {activeTab === "rent" && (
        <div className="space-y-5 p-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-5">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Rent Collection
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentPeriodLabel}
              </p>
            </div>
            <AdminRentAction
              onProcessSuccess={getRents}
              processMonthlyRents={adminRent.processMonthlyRents}
              sendRentReminders={adminRent.sendRentReminders}
              processingRents={adminRent.processingRents}
              sendingEmails={adminRent.sendingEmails}
              onExport={handleExportVisibleRents}
              onExportPdf={handleExportPdf}
              exportingPdf={exportingPdf}
            />
          </header>

          {overdueCount > 0 && filterStatus !== "overdue" && (
            <OverdueBanner
              count={overdueCount}
              monthName={frequencyView === "quarterly" ? NEPALI_QUARTERS[filterQuarter]?.label : currentMonthName}
              year={filterRentYear}
              onShowOverdue={() => setFilterStatus("overdue")}
            />
          )}

          <RentMetricsStrip
            totalCollected={frequencyTotalCollected}
            totalDue={frequencyTotalDue}
            tenantsPaid={tenantsPaidStats.paid}
            tenantsTotal={tenantsPaidStats.total}
          />

          <div className="hidden sm:block">
            <RentFilter
              search={searchQuery}
              onSearchChange={setSearchQuery}
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
              quarter={filterQuarter}
              defaultQuarter={defaultQuarter}
              onQuarterChange={setFilterQuarter}
            />
          </div>

          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                {displayRents.length} record
                {displayRents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <RentTable
              rents={displayRents}
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
              onRefresh={handlePaymentSuccess}
              sendRentReminders={adminRent.sendRentReminders}
              sendingEmails={adminRent.sendingEmails}
            />
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-5 p-4">
          <header className="border-b border-border pb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Payment history
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              All recorded payments across tenants and billing periods
            </p>
          </header>

          {!paymentsLoading && <PaymentsMetricsStrip payments={payments} />}

          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 pb-2 border-b border-border">
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
            </div>

            {paymentsLoading ? (
              <div className="px-4 sm:px-5 pt-4 pb-5 space-y-2 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 rounded-md bg-muted/50"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 sm:px-5 pt-2 pb-4">
                <div className="flex items-center justify-between py-2 border-b border-border mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                    {payments.length} payment{payments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <PaymentsTable payments={payments} />
              </div>
            )}
          </div>
        </div>
      )}

      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
              <SheetTitle className="text-base font-semibold text-foreground">
                Filters
              </SheetTitle>
              {activeFilterCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
                  active
                </p>
              )}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <RentFilter
                search={searchQuery}
                onSearchChange={setSearchQuery}
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

            <SheetFooter className="px-5 py-4 border-t border-border flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearRentFilters}
                disabled={!activeFilterCount && !searchQuery.trim()}
                className="flex-1 h-11 text-sm font-medium"
              >
                Clear all
              </Button>
              <Button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-1 h-11 text-sm font-medium"
              >
                Done
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
};

export default RentPayment;
