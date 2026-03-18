// src/pages/rent/RentPayment.jsx
//
// Redesigned — Stripe / Linear aesthetic.
// Pure Tailwind + shadcn throughout. No inline styles except:
//   - Loading skeleton opacity ramp (runtime index computation)
// Inline-style exceptions are annotated inline.
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
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, MoreVertical, Receipt } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ── Icons ─────────────────────────────────────────────────────────────────────
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

// ── Minimal search input ───────────────────────────────────────────────────────
// Plain <input> avoids shadcn white-bg / blue-ring overrides from --ring / --background.
const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn(
        "w-full h-8 pl-8 pr-3 text-xs rounded-lg border outline-none",
        "bg-card border-border text-foreground placeholder:text-muted-foreground",
        "transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
      )}
    />
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-[88px] rounded-xl bg-card border border-border" />
    <div className="h-24 rounded-xl bg-card border border-border" />
    <div className="space-y-2">
      {/* ONLY inline style: runtime opacity ramp on skeleton rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-lg bg-card border border-border"
          style={{ opacity: 1 - i * 0.13 }}
        />
      ))}
    </div>
  </div>
);

// ── Overdue nudge banner ──────────────────────────────────────────────────────
const OverdueBanner = ({ count, monthName, year, onShowOverdue }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-2.5">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="h-2 w-2 rounded-full bg-[var(--color-danger)] shrink-0 animate-pulse" />
      <p className="text-xs font-semibold text-[var(--color-danger)] whitespace-nowrap">
        {count} overdue rent{count !== 1 ? "s" : ""} need attention
      </p>
      <span className="hidden sm:inline text-xs text-[var(--color-danger)] opacity-60">
        · {monthName} {year}
      </span>
    </div>
    <button
      type="button"
      onClick={onShowOverdue}
      className="shrink-0 rounded-md border border-[var(--color-danger-border)] bg-card px-2.5 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
    >
      Show overdue
    </button>
  </div>
);

// ── Section header with record count ─────────────────────────────────────────
const SectionHeader = ({ count, label = "record", loading }) => (
  <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground tabular-nums">
      {loading ? "Loading…" : `${count} ${label}${count !== 1 ? "s" : ""}`}
    </span>
  </div>
);

// ── Payments KPI strip (inline, lightweight) ──────────────────────────────────
const PaymentsKpiStrip = ({ payments }) => {
  if (!payments.length) return null;
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const kpis = [
    { label: "Total Collected", value: fmt(total), valueClass: "text-emerald-600" },
    { label: "Payments", value: payments.length, valueClass: "text-foreground" },
    { label: "Avg. Payment", value: fmt(total / payments.length), valueClass: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {kpis.map(({ label, value, valueClass }) => (
        <div key={label} className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
            {label}
          </p>
          <p className={cn("text-xl font-bold tracking-tight tabular-nums", valueClass)}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Main page component
// ═════════════════════════════════════════════════════════════════════════════
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

  const [activeTab, setActiveTab] = useState("rent");
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const [frequencyView, setFrequencyView] = useState("monthly");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // ── Derived rents ──────────────────────────────────────────────────────────
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
        r.units?.some((u) => u.name?.toLowerCase().includes(q)),
    );
  }, [frequencyFilteredRents, searchQuery]);

  const overdueCount = useMemo(
    () => rents.filter((r) => (r.status || "").toLowerCase() === "overdue").length,
    [rents],
  );

  // ── KPIs scoped to frequency view ─────────────────────────────────────────
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

  // ── Active filter count (drives mobile badge) ──────────────────────────────
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterStatus !== "all") c++;
    if (filterPropertyId) c++;
    if (defaultRentMonth != null && filterRentMonth !== defaultRentMonth) c++;
    if (defaultRentYear != null && filterRentYear !== defaultRentYear) c++;
    return c;
  }, [filterStatus, filterPropertyId, filterRentMonth, filterRentYear, defaultRentMonth, defaultRentYear]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePaymentSuccess = useCallback(async () => {
    await Promise.all([getRents(), getPayments(), fetchRentSummary(), getCams()]);
  }, [getRents, getPayments, fetchRentSummary, getCams]);

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
    setFilterStatus("all");
    setFilterPropertyId("");
  };

  const currentMonthName =
    filterRentMonth != null ? NEPALI_MONTH_NAMES[filterRentMonth - 1] : "";

  // ── Header slot ────────────────────────────────────────────────────────────
  useHeaderSlot(
    () => (
      <div className="flex items-center gap-2 w-full min-w-0">

        {/* Brand — desktop only */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            Rent Management
          </span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-border shrink-0" />

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
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors",
                activeTab === t.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60",
              )}
            >
              {t.label}
              {t.id === "rent" && overdueCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold leading-none">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Search — desktop */}
        <div className="hidden sm:block flex-1 min-w-0 max-w-[280px] ml-2">
          <SearchInput
            placeholder="Search tenants, properties…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0 sm:hidden" />

        {/* Right: mobile filter + kebab + desktop admin */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Mobile filter button (rent tab only) */}
          {activeTab === "rent" && (
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={cn(
                "sm:hidden flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors",
                activeFilterCount > 0
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground",
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

          {/* Mobile kebab */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={getRents} className="flex items-center gap-2 text-xs">
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Process Monthly Rents
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 text-xs">
                  <MailIcon className="h-3.5 w-3.5" />
                  Send Rent Reminders
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop admin actions */}
          <div className="hidden sm:flex">
            <AdminRentAction onProcessSuccess={getRents} />
          </div>
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, overdueCount, searchQuery, activeFilterCount, getRents],
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit}>

      {/* ── Mobile search — sticky sub-bar below the header ── */}
      <div className="sm:hidden sticky top-14 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border mb-3">
        <SearchInput
          placeholder="Search tenants, properties, units…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ══ RENT TAB ═══════════════════════════════════════════════════════════ */}
      {activeTab === "rent" && (
        <div className="space-y-4">

          {/* Overdue nudge */}
          {overdueCount > 0 && filterStatus !== "overdue" && (
            <OverdueBanner
              count={overdueCount}
              monthName={currentMonthName}
              year={filterRentYear}
              onShowOverdue={() => setFilterStatus("overdue")}
            />
          )}

          {/* Filter bar — desktop */}
          <div className="hidden sm:block rounded-xl border border-border bg-card px-5 py-4">
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

          {/* KPI strip — scoped to selected period + frequency */}
          <RentSummaryCard
            totalCollected={frequencyTotalCollected}
            totalDue={frequencyTotalDue}
            frequencyView={frequencyView}
            currentMonthName={currentMonthName}
            currentYear={filterRentYear}
          />

          {/* Rent table card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <SectionHeader count={displayRents.length} loading={false} />
            <div className="px-4 sm:px-5 pt-2 pb-4">
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
              />
            </div>
          </div>

        </div>
      )}

      {/* ══ PAYMENTS TAB ═══════════════════════════════════════════════════════ */}
      {activeTab === "payments" && (
        <div className="space-y-4">

          {/* Page heading */}
          <div>
            <h2 className="text-base font-semibold text-foreground">Payment History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All recorded payments across tenants and billing periods
            </p>
          </div>

          {/* KPI strip */}
          {!paymentsLoading && <PaymentsKpiStrip payments={payments} />}

          {/* Filter + table card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
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
                    className="h-12 rounded-lg bg-border"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 sm:px-5 pt-2 pb-4">
                <SectionHeader count={payments.length} label="payment" />
                <PaymentsTable payments={payments} />
              </div>
            )}
          </div>

        </div>
      )}

      {/* ══ MOBILE FILTER DRAWER ═══════════════════════════════════════════════ */}
      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
          <div className="flex flex-col h-full">

            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-base font-semibold text-foreground">
                    Filters
                  </SheetTitle>
                  {activeFilterCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                    </p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-5">
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

            <SheetFooter className="px-5 py-4 border-t border-border flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearRentFilters}
                disabled={!activeFilterCount}
                className="flex-1 h-11 text-sm font-semibold"
              >
                Clear All
              </Button>
              <Button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-1 h-11 text-sm font-semibold"
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