// src/pages/rent/components/RentFilter.jsx
//
// Linear-style compact control bar.
// Pure Tailwind + shadcn — zero inline styles.
// Uses cn() for conditional class composition.
import React from "react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    NEPALI_MONTH_NAMES,
    getNepaliYearOptions,
} from "../../../utils/nepaliDate";

// ── Status chip definitions ───────────────────────────────────────────────────
const STATUS_CHIPS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "overdue", label: "Overdue", variant: "danger" },
    { value: "partially_paid", label: "Partial" },
    { value: "paid", label: "Paid", variant: "success" },
];

// ── Reusable compact Select ───────────────────────────────────────────────────
const CompactSelect = ({ value, onValueChange, placeholder, className, children }) => (
    <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
            className={cn(
                "h-8 text-xs border-border bg-card text-foreground",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
                className,
            )}
        >
            <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
    </Select>
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

    const currentMonthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : "—";

    return (
        <div className="space-y-2.5">

            {/* ── Row 1: Frequency · Selects · Period badge · Reset ─────────────── */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">

                {/* Frequency segmented control */}
                <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5 shrink-0">
                    {["monthly", "quarterly"].map((freq) => (
                        <button
                            key={freq}
                            type="button"
                            onClick={() => onFrequencyChange?.(freq)}
                            className={cn(
                                "px-3 h-7 text-xs font-semibold capitalize rounded-sm transition-all duration-150 select-none",
                                frequencyView === freq
                                    ? "bg-card text-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {freq}
                        </button>
                    ))}
                </div>

                {/* Divider — desktop */}
                <div className="hidden sm:block h-4 w-px bg-border shrink-0" />

                {/* Month */}
                <CompactSelect
                    className="w-[118px]"
                    value={month != null ? String(month) : undefined}
                    onValueChange={(v) => onMonthChange?.(Number(v))}
                    placeholder="Month"
                >
                    {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                            {m.label}
                        </SelectItem>
                    ))}
                </CompactSelect>

                {/* Year */}
                <CompactSelect
                    className="w-[82px]"
                    value={year != null ? String(year) : undefined}
                    onValueChange={(v) => onYearChange?.(Number(v))}
                    placeholder="Year"
                >
                    {yearOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                            {opt.label}
                        </SelectItem>
                    ))}
                </CompactSelect>

                {/* Property — desktop inline */}
                {properties.length > 0 && (
                    <div className="hidden sm:block">
                        <CompactSelect
                            className="w-[160px]"
                            value={propertyId || "all"}
                            onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                            placeholder="All Properties"
                        >
                            <SelectItem value="all" className="text-xs">All Properties</SelectItem>
                            {properties.map((p) => (
                                <SelectItem key={p._id} value={p._id} className="text-xs">
                                    {p.name}
                                </SelectItem>
                            ))}
                        </CompactSelect>
                    </div>
                )}

                {/* Push right */}
                <div className="flex-1 min-w-0 hidden sm:block" />

                {/* Period badge */}
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-accent-mid)] bg-[var(--color-accent-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                    <span className="opacity-60 font-medium">Period</span>
                    <span>{currentMonthName} {year}</span>
                </span>

                {/* Reset */}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    Reset
                </button>
            </div>

            {/* ── Property — mobile full-width ──────────────────────────────────── */}
            {properties.length > 0 && (
                <div className="sm:hidden">
                    <CompactSelect
                        className="w-full"
                        value={propertyId || "all"}
                        onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                        placeholder="All Properties"
                    >
                        <SelectItem value="all" className="text-xs">All Properties</SelectItem>
                        {properties.map((p) => (
                            <SelectItem key={p._id} value={p._id} className="text-xs">
                                {p.name}
                            </SelectItem>
                        ))}
                    </CompactSelect>
                </div>
            )}

            {/* ── Row 2: Status chips — horizontal scroll on mobile ─────────────── */}
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                                "h-7 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                                "transition-colors shrink-0 whitespace-nowrap select-none",
                                // active — danger
                                isActive && isDanger
                                    ? "bg-[var(--color-danger)] border-[var(--color-danger)] text-white"
                                    // active — success
                                    : isActive && isSuccess
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        // active — default (petrol)
                                        : isActive
                                            ? "bg-primary border-primary text-primary-foreground"
                                            // inactive — danger
                                            : isDanger
                                                ? "bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white hover:border-[var(--color-danger)]"
                                                // inactive — success
                                                : isSuccess
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                                    // inactive — default
                                                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                            )}
                        >
                            {/* Danger dot */}
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