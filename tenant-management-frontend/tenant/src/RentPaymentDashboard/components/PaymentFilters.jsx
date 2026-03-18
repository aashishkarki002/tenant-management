// src/pages/rent/components/PaymentFilters.jsx
//
// Payment history filter bar — matches RentFilter visual language.
// Pure Tailwind + shadcn, zero inline styles.
import React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DualCalendarTailwind from "../../components/dualDate";

// ── Payment method chips ─────────────────────────────────────────────────────
const METHOD_CHIPS = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

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

  return (
    <div className="space-y-3">

      {/* ── Row 1: Date pickers + Method select + Reset ─────────────────── */}
      <div className="flex flex-wrap items-end gap-3">

        {/* From date */}
        <div className="flex-1 min-w-[140px] max-w-xs">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
            From
          </label>
          <DualCalendarTailwind
            key={`start-${datePickerResetKey}`}
            onChange={(english) => setFilterStartDate(english || "")}
          />
        </div>

        {/* To date */}
        <div className="flex-1 min-w-[140px] max-w-xs">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
            To
          </label>
          <DualCalendarTailwind
            key={`end-${datePickerResetKey}`}
            onChange={(english) => setFilterEndDate(english || "")}
          />
        </div>

        {/* Payment method — compact select on desktop */}
        <div className="hidden sm:block w-44">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
            Method
          </label>
          <Select
            value={activeMethod}
            onValueChange={(v) => setFilterPaymentMethod(v)}
          >
            <SelectTrigger className="h-8 text-xs border-border bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              {METHOD_CHIPS.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset */}
        <div className="flex items-end h-8">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* ── Row 2: Method chips — mobile + desktop quick filter ──────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {METHOD_CHIPS.map(({ value, label }) => {
          const isActive = activeMethod === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilterPaymentMethod(value)}
              className={cn(
                "h-7 inline-flex items-center rounded-md border px-3 text-xs font-medium",
                "transition-colors shrink-0 whitespace-nowrap select-none",
                isActive
                  ? "bg-primary border-primary text-primary-foreground"
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