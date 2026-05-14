import React, { useState, useMemo, useCallback } from "react";
import { useRentData } from "./hooks/useRentData";
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
import { TdsTab } from "./components/TdsTab";
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
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn(
        "w-full h-8 pl-7 pr-3 text-xs rounded-md border outline-none",
        "bg-background border-border/60 text-foreground placeholder:text-muted-foreground",
        "transition-colors focus:border-border focus:ring-0",
      )}
    />
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-5 px-4 py-5 animate-pulse">
    <div className="h-12 rounded bg-muted/40 w-2/3" />
    <div className="h-7 rounded bg-muted/30 w-full" />
    <div className="h-4 rounded bg-muted/20 w-1/3" />
    <div className="space-y-px">
      <div className="h-9 rounded-t bg-muted/30" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-11 bg-muted/20"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  </div>
);

/** Minimal inline overdue callout */
const OverdueBanner = ({ count, monthName, year, onShowOverdue }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-red-200/60 bg-red-50/40 px-3 py-2 dark:bg-red-950/15 dark:border-red-900/40">
    <div className="flex items-center gap-2 min-w-0">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
      <p className="text-xs text-red-700 dark:text-red-300">
        <span className="font-medium">{count}</span> overdue rent
        {count !== 1 ? "s" : ""} · {monthName} {year}
      </p>
    </div>
    <button
      type="button"
      onClick={onShowOverdue}
      className="shrink-0 text-xs text-red-600 hover:text-red-700 font-medium transition-colors dark:text-red-400"
    >
      Show →
    </button>
  </div>
);

const PaymentsMetricsStrip = ({ payments }) => {
  if (!payments.length) return null;
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const fmt = (n) =>
    `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      <span className="text-foreground font-medium">{payments.length}</span>{" "}
      payments ·{" "}
      <span className="text-foreground font-medium">{fmt(total)}</span> total ·{" "}
      <span className="text-foreground font-medium">
        {fmt(total / payments.length)}
      </span>{" "}
      avg.
    </p>
  );
};

function rowFullySettled(rent, electricityByTenantId = {}) {
  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";
  const elecRecords = electricityByTenantId[rent.tenant?._id?.toString()] || [];
  const hasElectricityDue = elecRecords.some((r) => {
    const remaining =
      r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
    return remaining > 0;
  });
  return rent.status === "paid" && !hasOutstandingLateFee && !hasElectricityDue;
}

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
    electricityByTenantId,
    getElectricityForPeriod,
  } = useRentData();

  const adminRent = useAdminRentActions({ onProcessSuccess: getRents });

  const sendRemindersForPeriod = useCallback(() => {
    const month =
      frequencyView === "quarterly"
        ? getQuarterMonthRange(filterQuarter).start
        : filterRentMonth;
    return adminRent.sendRentReminders(month, filterRentYear);
  }, [adminRent.sendRentReminders, frequencyView, filterQuarter, filterRentMonth, filterRentYear]);

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
    () =>
      frequencyFilteredRents.filter(
        (r) => (r.status || "").toLowerCase() === "overdue",
      ).length,
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
    const paid = frequencyFilteredRents.filter((r) => rowFullySettled(r, electricityByTenantId)).length;
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
    await Promise.all([getRents(), getPayments(), getCams(), getElectricityForPeriod()]);
  }, [getRents, getPayments, getCams, getElectricityForPeriod]);

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
      const response = await api.get("/api/rent/export/pdf", {
        params,
        responseType: "blob",
      });
      const month = filterRentMonth ? `-Month${filterRentMonth}` : "";
      const filename = `Rent-Roll-${filterRentYear}${month}.pdf`;
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
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

  const selectedProperty = properties.find((p) => p._id === filterPropertyId);

  const electricityMonthLabel =
    frequencyView === "quarterly"
      ? NEPALI_MONTH_NAMES[filterRentMonth - 1]
      : null;

  // Inline context: "Baisakh 2083 · Monthly · All Properties"
  const contextLine = [
    currentPeriodLabel,
    frequencyView === "quarterly" ? "Quarterly" : "Monthly",
    selectedProperty?.name ?? "All Properties",
  ]
    .filter(Boolean)
    .join(" · ");

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
            { id: "tds", label: "TDS" },
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
    <>
      {/* Mobile search */}
      {activeTab === "rent" && (
        <div className="sm:hidden sticky top-14 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border mb-4">
          <SearchInput
            placeholder="Search tenants or units…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* ── Rent tab ─────────────────────────────────────────────────────── */}
      {activeTab === "rent" && (
        <div className="space-y-4 px-4 py-5">
          {/* Header: title + context + primary action */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground tracking-tight">
                Rent Collection
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 select-none">
                {contextLine}
              </p>
            </div>
            <AdminRentAction
              onProcessSuccess={getRents}
              processMonthlyRents={adminRent.processMonthlyRents}
              sendRentReminders={sendRemindersForPeriod}
              processingRents={adminRent.processingRents}
              sendingEmails={adminRent.sendingEmails}
              onExport={handleExportVisibleRents}
              onExportPdf={handleExportPdf}
              exportingPdf={exportingPdf}
            />
          </div>

          {/* Compact filter bar (desktop) */}
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

          {/* Overdue callout */}
          {overdueCount > 0 && filterStatus !== "overdue" && (
            <OverdueBanner
              count={overdueCount}
              monthName={
                frequencyView === "quarterly"
                  ? NEPALI_QUARTERS[filterQuarter]?.label
                  : currentMonthName
              }
              year={filterRentYear}
              onShowOverdue={() => setFilterStatus("overdue")}
            />
          )}

          {/* Muted inline metrics summary */}
          <RentMetricsStrip
            totalCollected={frequencyTotalCollected}
            totalDue={frequencyTotalDue}
            tenantsPaid={tenantsPaidStats.paid}
            tenantsTotal={tenantsPaidStats.total}
          />

          {/* Table */}
          <div className="rounded-md border border-border/60 bg-background overflow-hidden">
            {/* Record count bar */}
            <div className="flex items-center px-3 py-2 border-b border-border/50">
              <span className="text-[11px] text-muted-foreground tabular-nums select-none">
                {displayRents.length}{" "}
                {displayRents.length === 1 ? "record" : "records"}
              </span>
            </div>
            <RentTable
              rents={displayRents}
              cams={cams}
              bankAccounts={bankAccounts}
              electricityByTenantId={electricityByTenantId}
              onRefresh={handlePaymentSuccess}
              sendRentReminders={sendRemindersForPeriod}
              sendingEmails={adminRent.sendingEmails}
              electricityMonthLabel={electricityMonthLabel}
            />
          </div>
        </div>
      )}

      {/* ── Payments tab ─────────────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <div className="space-y-4 px-4 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              Payment history
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All recorded payments across tenants and billing periods
            </p>
          </div>

          {!paymentsLoading && <PaymentsMetricsStrip payments={payments} />}

          <div className="rounded-md border border-border/60 bg-background overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-border/50">
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
              <div className="px-4 py-5 space-y-1.5 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded bg-muted/30"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="flex items-center py-2 border-b border-border/50 mb-1">
                  <span className="text-[11px] text-muted-foreground tabular-nums select-none">
                    {payments.length}{" "}
                    {payments.length === 1 ? "payment" : "payments"}
                  </span>
                </div>
                <PaymentsTable payments={payments} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TDS tab ──────────────────────────────────────────────────────── */}
      {activeTab === "tds" && <TdsTab />}

      {/* Mobile filter sheet */}
      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
              <SheetTitle className="text-base font-semibold text-foreground">
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {activeFilterCount} active
                  </span>
                )}
              </SheetTitle>
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
                className="flex-1 h-10 text-sm font-medium"
              >
                Clear all
              </Button>
              <Button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-1 h-10 text-sm font-medium"
              >
                Done
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default RentPayment;
