// src/pages/rent/components/RentFilter.jsx
//
// Pill + popover filter bar — inspired by Linear / Notion filter patterns.
// All props/callbacks identical to previous version — zero functionality changes.
// Pure Tailwind + shadcn, zero inline styles.

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    NEPALI_MONTH_NAMES,
    getNepaliYearOptions,
} from "../../../utils/nepaliDate";

// ── Status chip definitions (unchanged) ──────────────────────────────────────
const STATUS_CHIPS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "overdue", label: "Overdue", variant: "danger" },
    { value: "partially_paid", label: "Partial" },
    { value: "paid", label: "Paid", variant: "success" },
];

// ── Shared FilterPill ─────────────────────────────────────────────────────────
// A rounded pill that opens a Popover. isActive darkens the pill.
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
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
        {children}
    </p>
);

// ── Grid option button (month/year) ───────────────────────────────────────────
const GridBtn = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "h-8 rounded-lg border text-xs font-medium transition-colors",
            active
                ? "bg-foreground border-foreground text-background"
                : "bg-background border-border text-foreground hover:bg-accent",
        )}
    >
        {children}
    </button>
);

// ── List option button (property) ─────────────────────────────────────────────
const ListBtn = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium",
            "transition-colors text-left",
            active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
    >
        <Check className={cn("h-3 w-3 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-0")} />
        {children}
    </button>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const RentFilter = ({
    month,
    year,
    status = "all",
    propertyId = "",
    properties = [],
    defaultMonth,
    defaultYear,
    onMonthChange,
    onYearChange,
    onStatusChange,
    onPropertyChange,
    onReset,
    frequencyView = "monthly",
    onFrequencyChange,
}) => {
    const monthOptions = NEPALI_MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name }));
    const yearOptions = getNepaliYearOptions(2078).reverse();

    const hasActiveFilters =
        status !== "all" ||
        propertyId !== "" ||
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear) ||
        frequencyView !== "monthly";

    // Derived labels for pills
    const currentMonthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : "Month";
    const periodLabel = `${currentMonthName} ${year ?? ""}`.trim();
    const isPeriodActive =
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear);

    const selectedProperty = properties.find((p) => p._id === propertyId);
    const propertyLabel = selectedProperty?.name ?? "All Properties";
    const isPropertyActive = !!propertyId;

    return (
        <div className="space-y-2.5">

            {/* ── Row 1: Frequency toggle + filter pills + Reset ─────────────────── */}
            <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                {/* Frequency segmented control — rounded-full to match pill language */}
                <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5 gap-0.5 shrink-0">
                    {["monthly", "quarterly"].map((freq) => (
                        <button
                            key={freq}
                            type="button"
                            onClick={() => onFrequencyChange?.(freq)}
                            className={cn(
                                "px-3 h-7 text-xs font-semibold capitalize rounded-full transition-all duration-150 select-none",
                                frequencyView === freq
                                    ? "bg-foreground text-background shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {freq}
                        </button>
                    ))}
                </div>

                {/* Separator */}
                <div className="h-4 w-px bg-border shrink-0" />

                {/* ── Period pill (month × year grid) ─────────────────────────────── */}
                <FilterPill label={periodLabel} isActive={isPeriodActive}>
                    <div className="p-3 w-64">

                        <PopLabel>Year</PopLabel>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {yearOptions.map((opt) => (
                                <GridBtn
                                    key={opt.value}
                                    active={year === opt.value}
                                    onClick={() => onYearChange?.(opt.value)}
                                >
                                    {opt.label}
                                </GridBtn>
                            ))}
                        </div>

                        <PopLabel>Month</PopLabel>
                        {/* 3-column grid — mirrors calendar month picker pattern */}
                        <div className="grid grid-cols-3 gap-1">
                            {monthOptions.map((m) => (
                                <GridBtn
                                    key={m.value}
                                    active={month === m.value}
                                    onClick={() => onMonthChange?.(m.value)}
                                >
                                    {m.label}
                                </GridBtn>
                            ))}
                        </div>

                    </div>
                </FilterPill>

                {/* ── Property pill ────────────────────────────────────────────────── */}
                {properties.length > 0 && (
                    <FilterPill label={propertyLabel} isActive={isPropertyActive}>
                        <div className="p-2 min-w-[160px] max-w-[220px]">
                            {[{ _id: "", name: "All Properties" }, ...properties].map((p) => (
                                <ListBtn
                                    key={p._id}
                                    active={propertyId === p._id}
                                    onClick={() => onPropertyChange?.(p._id)}
                                >
                                    {p.name}
                                </ListBtn>
                            ))}
                        </div>
                    </FilterPill>
                )}

                {/* Spacer */}
                <div className="flex-1 min-w-0" />

                {/* Reset */}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground
                     transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    Reset
                </button>
            </div>

            {/* ── Row 2: Status strip — rounded-full pills for visual consistency ── */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-border overflow-x-auto
                      [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {STATUS_CHIPS.map(({ value, label, variant }) => {
                    const isActive = status === value;
                    const isDanger = variant === "danger";
                    const isSuccess = variant === "success";

                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onStatusChange?.(value)}
                            className={cn(
                                "h-7 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium",
                                "transition-colors shrink-0 whitespace-nowrap select-none",
                                isActive && isDanger
                                    ? "bg-[var(--color-danger)] border-[var(--color-danger)] text-white"
                                    : isActive && isSuccess
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : isActive
                                            ? "bg-foreground border-foreground text-background"
                                            : isDanger
                                                ? "bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white hover:border-[var(--color-danger)]"
                                                : isSuccess
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                            )}
                        >
                            {isDanger && (
                                <span
                                    className={cn(
                                        "h-1.5 w-1.5 rounded-full shrink-0 transition-colors",
                                        isActive ? "bg-white" : "bg-[var(--color-danger)]",
                                    )}
                                />
                            )}
                            {label}
                        </button>
                    );
                })}
            </div>

        </div>
    );
};