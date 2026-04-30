import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NEPALI_MONTH_NAMES, getNepaliYearOptions } from "@/utils/nepaliDate";
import { NEPALI_QUARTERS } from "../utils/quarterUtils";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partial" },
  { value: "paid", label: "Paid" },
];

/** Compact pill-style dropdown trigger */
const FilterPill = ({ label, isActive, children }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs border transition-colors shrink-0 select-none",
          isActive
            ? "border-border bg-muted/70 text-foreground font-medium"
            : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
        )}
      >
        {label}
        <ChevronDown className="size-3 opacity-40 shrink-0" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={6} className="p-0">
      {children}
    </PopoverContent>
  </Popover>
);

const PopLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
    {children}
  </p>
);

/** Simple frequency toggle (Monthly / Quarterly) */
const FrequencyToggle = ({ value, onChange }) => (
  <div className="inline-flex items-center h-7 rounded-md border border-border/60 bg-muted/20 p-0.5 shrink-0">
    {["monthly", "quarterly"].map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange?.(v)}
        className={cn(
          "h-6 px-2.5 rounded text-xs transition-colors capitalize",
          value === v
            ? "bg-background text-foreground font-medium shadow-sm border border-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {v === "monthly" ? "Monthly" : "Quarterly"}
      </button>
    ))}
  </div>
);

export const RentFilter = ({
  search = "",
  onSearchChange,
  month,
  year,
  defaultMonth,
  defaultYear,
  onMonthChange,
  onYearChange,
  frequencyView = "monthly",
  onFrequencyChange,
  quarter = 0,
  defaultQuarter = 0,
  onQuarterChange,
  propertyId = "",
  properties = [],
  onPropertyChange,
  status = "all",
  onStatusChange,
  onReset,
}) => {
  const monthOptions = NEPALI_MONTH_NAMES.map((name, i) => ({
    value: i + 1,
    label: name,
  }));
  const yearOptions = getNepaliYearOptions(2078).reverse();

  const isMonthly = frequencyView === "monthly";

  const isPeriodActive = isMonthly
    ? (defaultMonth != null && month !== defaultMonth) ||
    (defaultYear != null && year !== defaultYear)
    : quarter !== defaultQuarter ||
    (defaultYear != null && year !== defaultYear);

  const currentMonthName =
    month != null ? NEPALI_MONTH_NAMES[month - 1] : "Month";
  const periodLabel = isMonthly
    ? `${currentMonthName} ${year ?? ""}`.trim()
    : `${NEPALI_QUARTERS[quarter]?.short ?? "Q1"} ${year ?? ""}`.trim();

  const selectedProperty = properties.find((p) => p._id === propertyId);
  const propertyLabel = selectedProperty?.name ?? "All Properties";

  const activeStatusLabel =
    STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";
  const hasStatusFilter = status !== "all";

  const hasActiveFilters =
    !!String(search || "").trim() ||
    hasStatusFilter ||
    propertyId !== "" ||
    isPeriodActive ||
    frequencyView !== "monthly";

  // Count active filter badges for the Filter button
  const filterCount = [hasStatusFilter, !!propertyId].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: filter controls */}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {/* Period picker */}
        <FilterPill label={periodLabel} isActive={isPeriodActive}>
          <div className="p-3 w-64 space-y-4">
            <div>
              <PopLabel>Year</PopLabel>
              <div className="flex flex-wrap gap-1">
                {yearOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onYearChange?.(opt.value)}
                    className={cn(
                      "h-7 px-2 rounded text-xs transition-colors",
                      year === opt.value
                        ? "bg-primary text-background font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {isMonthly ? (
              <div>
                <PopLabel>Month</PopLabel>
                <div className="grid grid-cols-3 gap-1">
                  {monthOptions.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onMonthChange?.(m.value)}
                      className={cn(
                        "h-7 px-1 rounded text-xs transition-colors text-center",
                        month === m.value
                          ? "bg-primary text-background font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <PopLabel>Quarter</PopLabel>
                <div className="grid grid-cols-2 gap-1">
                  {NEPALI_QUARTERS.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onQuarterChange?.(i)}
                      className={cn(
                        "h-7 px-2 rounded text-xs transition-colors text-center",
                        quarter === i
                          ? "bg-primary text-background font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FilterPill>

        {/* Frequency toggle */}
        <FrequencyToggle value={frequencyView} onChange={onFrequencyChange} />

        {/* Property picker */}
        {properties.length > 0 && (
          <FilterPill label={propertyLabel} isActive={!!propertyId}>
            <div className="p-1.5 min-w-44 max-w-56">
              {[{ _id: "", name: "All Properties" }, ...properties].map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => onPropertyChange?.(p._id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    propertyId === p._id
                      ? "bg-primary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {p.name}
                  {propertyId === p._id && <Check className="size-3 opacity-60" />}
                </button>
              ))}
            </div>
          </FilterPill>
        )}

        {/* Status filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs border transition-colors shrink-0 select-none",
                hasStatusFilter
                  ? "border-border bg-muted/70 text-foreground font-medium"
                  : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <SlidersHorizontal className="size-3 opacity-60" />
              {hasStatusFilter ? activeStatusLabel : "Filter"}
              {filterCount > 0 && (
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-background text-background text-[9px] font-bold leading-none">
                  {filterCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-44 p-1.5">
            <PopLabel>Status</PopLabel>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onStatusChange?.(value)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                  status === value
                    ? "bg-primary text-muted font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {label}
                {status === value && <Check className="size-3 opacity-60" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Reset — only when something is active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs bg-warning text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" />
            Reset
          </button>
        )}
      </div>

      {/* Right: search */}
      <div className="relative w-full sm:w-56 sm:shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search tenants or units…"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="h-7 pl-7 text-xs bg-transparent border-border/60 focus-visible:border-border focus-visible:ring-0"
        />
      </div>
    </div>
  );
};
