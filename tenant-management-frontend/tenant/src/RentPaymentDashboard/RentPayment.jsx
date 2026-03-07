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
import { AdminRentAction } from "./components/AdminRentAction";
import { NEPALI_MONTH_NAMES } from "../../utils/nepaliDate";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { Search, SlidersHorizontal, MoreVertical } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const RefreshIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
          d="M4 4v5h.582M20 20v-5h-.582M4.582 9A8 8 0 0119.418 15M19.418 15A8 8 0 014.582 9" />
  </svg>
);

const MailIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

/**
 * SearchInput — plain <input> so we fully own every style token.
 * Using shadcn <Input> caused blue ring + white bg overrides from
 * --ring / --background CSS variables that Tailwind classes can't beat
 * without !important gymnastics.
 */
const SearchInput = ({ placeholder, value, onChange }) => (
  <div className="relative w-full">
    <Search
      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
      style={{ color: "#AFA097" }}
    />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{ background: "#F8F5F2", borderColor: "#DDD6D0", color: "#1C1A18" }}
      className="w-full h-8 sm:h-9 pl-8 pr-3 text-xs rounded-lg border outline-none transition-colors
                 placeholder:text-[#C8BDB6] focus:border-[#AFA097] focus:ring-2 focus:ring-[#3D1414]/10"
    />
  </div>
);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const frequencyFilteredRents = useMemo(
    () => rents.filter((r) => (r.rentFrequency || "monthly") === frequencyView),
    [rents, frequencyView],
  );

  // Search filtering
  const searchFilteredRents = useMemo(() => {
    if (!searchQuery.trim()) return frequencyFilteredRents;
    const query = searchQuery.toLowerCase();
    return frequencyFilteredRents.filter((rent) => {
      const tenantName = rent.tenantId?.name?.toLowerCase() || "";
      const propertyName = rent.propertyId?.name?.toLowerCase() || "";
      const unitNumber = rent.unitId?.unitNumber?.toLowerCase() || "";
      return tenantName.includes(query) || propertyName.includes(query) || unitNumber.includes(query);
    });
  }, [frequencyFilteredRents, searchQuery]);

  const overdueCount = useMemo(
    () => rents.filter((r) => (r.status || "").toLowerCase() === "overdue").length,
    [rents],
  );

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (filterPropertyId) count++;
    if (defaultRentMonth != null && filterRentMonth !== defaultRentMonth) count++;
    if (defaultRentYear != null && filterRentYear !== defaultRentYear) count++;
    return count;
  }, [filterStatus, filterPropertyId, filterRentMonth, filterRentYear, defaultRentMonth, defaultRentYear]);

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

  // Handle admin actions
  const { processMonthlyRents, sendRentReminders, processingRents, sendingEmails } = {
    processMonthlyRents: () => console.log("Process rents"),
    sendRentReminders: () => console.log("Send reminders"),
    processingRents: false,
    sendingEmails: false,
  };

  // ── Header slot ───────────────────────────────────────────────────────────
  // Mobile-first responsive layout with filter drawer pattern
  useHeaderSlot(
    () => (
      <div className="flex flex-col gap-y-2 w-full">

        {/* ── Row 1: Tabs + Actions ── */}
        <div className="flex items-center justify-between gap-x-2 w-full">

          {/* Left: Brand + Tabs (Desktop) / Tabs only (Mobile) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            
            {/* Brand — desktop only */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#1C1A18" }} />
              <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "#1C1A18" }}>
                Rent Management
              </span>
            </div>

            {/* Divider — desktop only */}
            <div className="hidden sm:block h-4 w-px shrink-0" style={{ background: "#DDD6D0" }} />

            {/* Tab nav */}
            <nav className="flex items-center gap-0.5 shrink-0">
              {[
                { id: "rent", label: "Rent" },
                { id: "payments", label: "Payments" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                             whitespace-nowrap transition-colors"
                  style={
                    activeTab === t.id
                      ? { background: "#EEE9E5", color: "#1C1A18" }
                      : { color: "#948472" }
                  }
                  onMouseEnter={(e) => {
                    if (activeTab !== t.id) {
                      e.currentTarget.style.background = "#EEE9E5";
                      e.currentTarget.style.color = "#1C1A18";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== t.id) {
                      e.currentTarget.style.background = "";
                      e.currentTarget.style.color = "#948472";
                    }
                  }}
                >
                  {t.label}
                  {t.id === "rent" && overdueCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center h-4 min-w-[16px] px-1
                                 rounded-full text-white text-[9px] font-bold leading-none"
                      style={{ background: "#B02020" }}
                    >
                      {overdueCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Desktop: Search (inline after tabs) */}
            <div className="hidden sm:block flex-1 min-w-0 max-w-[280px] ml-3">
              <SearchInput 
                placeholder="Search tenants, properties…" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Right: Filter + Menu (Mobile) / Admin Actions (Desktop) */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Mobile: Filters button (only on rent tab) */}
            {activeTab === "rent" && (
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="sm:hidden flex items-center gap-1.5 h-9 px-3 rounded-lg border 
                           text-xs font-semibold transition-colors"
                style={{ 
                  background: activeFilterCount > 0 ? "#1C1A18" : "#F8F5F2", 
                  borderColor: activeFilterCount > 0 ? "#1C1A18" : "#DDD6D0",
                  color: activeFilterCount > 0 ? "#F0DADA" : "#948472"
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1
                                   rounded-full text-[#1C1A18] text-[9px] font-bold leading-none"
                        style={{ background: "#F0DADA" }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile: Menu dropdown for admin actions */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center h-9 w-9 rounded-lg border 
                               transition-colors"
                    style={{ background: "#F8F5F2", borderColor: "#DDD6D0", color: "#948472" }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem 
                    onClick={() => getRents()}
                    disabled={processingRents}
                    className="flex items-center gap-2"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    <span>Process Monthly Rents</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => getRents()}
                    disabled={sendingEmails}
                    className="flex items-center gap-2"
                  >
                    <MailIcon className="h-4 w-4" />
                    <span>Send Rent Reminders</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop: Admin action buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <AdminRentAction onProcessSuccess={getRents} />
            </div>
          </div>
        </div>

        {/* ── Row 2: Mobile search (full-width) ── */}
        <div className="sm:hidden w-full">
          <SearchInput 
            placeholder="Search tenants, properties, units…" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, overdueCount, searchQuery, activeFilterCount, getRents, processingRents, sendingEmails],
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

          {/* Filters — scopes the KPIs below — Desktop only */}
          <div className="hidden sm:block rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5">
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
                {searchFilteredRents.length} record{searchFilteredRents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-4 sm:px-5 pt-2 pb-4">
              <RentTable
                rents={searchFilteredRents}
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

      {/* ══ MOBILE FILTER DRAWER ═════════════════════════════════════════════ */}
      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-lg font-semibold" style={{ color: "#1C1A18" }}>
                    Filters
                  </SheetTitle>
                  {activeFilterCount > 0 && (
                    <p className="text-xs mt-1" style={{ color: "#948472" }}>
                      {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied
                    </p>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
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

            {/* Footer with actions */}
            <SheetFooter className="px-5 py-4 border-t border-slate-100 flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearRentFilters}
                disabled={!activeFilterCount}
                className="flex-1 h-11 text-sm font-semibold"
                style={{
                  borderColor: "#DDD6D0",
                  color: "#948472",
                }}
              >
                Clear All
              </Button>
              <Button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-1 h-11 text-sm font-semibold"
                style={{
                  background: "#1C1A18",
                  color: "#F0DADA",
                }}
              >
                Apply Filters
              </Button>
            </SheetFooter>

          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
};

export default RentPayment;