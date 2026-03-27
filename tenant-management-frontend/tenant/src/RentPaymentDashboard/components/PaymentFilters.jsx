// src/pages/rent/components/PaymentFilters.jsx
//
// Pill + popover filter bar — matches redesigned RentFilter visual language.
// All props/callbacks identical — zero functionality changes.
// Pure Tailwind + shadcn, zero inline styles.

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DualCalendarTailwind from "../../components/dualDate";

// ── Payment method options (unchanged) ───────────────────────────────────────
const METHOD_CHIPS = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

// ── Shared FilterPill ─────────────────────────────────────────────────────────
const FilterPill = ({ label, isActive, children }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border text-xs font-medium",
          "transition-all select-none whitespace-nowrap focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isActive
            ? "bg-foreground border-foreground text-background"
            : "bg-card border-border text-foreground hover:bg-accent hover:border-foreground/20",
        )}
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      sideOffset={6}
      className="p-0 shadow-md rounded-xl border border-border bg-card"
    >
      {children}
    </PopoverContent>
  </Popover>
);

// ── Popover row label ─────────────────────────────────────────────────────────
const PopLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
    {children}
  </p>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const PaymentFilters = ({
  filterStartDate,
  filterEndDate,
  filterPaymentMethod,
  setFilterStartDate,
  setFilterEndDate,
  setFilterPaymentMethod,
  datePickerResetKey,
  onReset,
}) => {
  const hasActiveFilters =
    !!filterStartDate ||
    !!filterEndDate ||
    (filterPaymentMethod && filterPaymentMethod !== "all");

  const activeMethod = filterPaymentMethod || "all";

  // ── Derived pill labels ───────────────────────────────────────────────────
  const isDateActive = !!filterStartDate || !!filterEndDate;
  const dateRangeLabel = isDateActive
    ? [filterStartDate, filterEndDate].filter(Boolean).join(" → ")
    : "Date Range";

  const isMethodActive = activeMethod !== "all";
  const methodLabel = METHOD_CHIPS.find((m) => m.value === activeMethod)?.label ?? "All Methods";

  return (
    <div className="space-y-3">

      {/* ── Row 1: Filter pills + Reset ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto
                      [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* ── Date Range pill ───────────────────────────────────────────────── */}
        <FilterPill label={dateRangeLabel} isActive={isDateActive}>
          <div className="p-3 w-72 space-y-3">
            <div>
              <PopLabel>From</PopLabel>
              <DualCalendarTailwind
                key={`start-${datePickerResetKey}`}
                onChange={(english) => setFilterStartDate(english || "")}
              />
            </div>
            <div className="border-t border-border pt-3">
              <PopLabel>To</PopLabel>
              <DualCalendarTailwind
                key={`end-${datePickerResetKey}`}
                onChange={(english) => setFilterEndDate(english || "")}
              />
            </div>
          </div>
        </FilterPill>

        {/* ── Method pill ───────────────────────────────────────────────────── */}
        <FilterPill label={methodLabel} isActive={isMethodActive}>
          <div className="p-2 min-w-[160px]">
            {METHOD_CHIPS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterPaymentMethod(value)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium",
                  "transition-colors text-left",
                  activeMethod === value
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0 transition-opacity",
                    activeMethod === value ? "opacity-100" : "opacity-0",
                  )}
                />
                {label}
              </button>
            ))}
          </div>
        </FilterPill>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className="text-xs font-medium text-muted-foreground hover:text-foreground
                     transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Clear filters
        </button>
      </div>

      {/* ── Row 2: Method quick-select chips (rounded-full, same pill language) */}
      <div className="flex items-center gap-1.5 overflow-x-auto
                      [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {METHOD_CHIPS.map(({ value, label }) => {
          const isActive = activeMethod === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilterPaymentMethod(value)}
              className={cn(
                "h-7 inline-flex items-center rounded-full border px-3.5 text-xs font-medium",
                "transition-colors shrink-0 whitespace-nowrap select-none",
                isActive
                  ? "bg-foreground border-foreground text-background"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

    </div>
  );
};