// src/pages/rent/components/RentFilter.jsx
import React from "react";
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

/**
 * RentFilter — v3
 *
 * Changes from v2:
 * - Status Select replaced with flat chip buttons — matches the V2 design
 *   where all filters are inline, no nested dropdowns for status.
 * - Frequency toggle stays at the start of the controls row.
 * - Active filter chips in the period row remain.
 * - Overdue quick-toggle replaced by the "Overdue" status chip (same function,
 *   cleaner — one less control).
 *
 * Props: identical to v2 (fully backwards compatible).
 */
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
    const monthOptions = NEPALI_MONTH_NAMES.map((name, i) => ({
        value: i + 1,
        label: name,
    }));

    const yearOptions = getNepaliYearOptions(2078).reverse();

    const hasActiveFilters =
        status !== "all" ||
        propertyId !== "" ||
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear);

    const currentMonthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : "—";

    // Status chip definitions
    const statusChips = [
        { value: "all", label: "All" },
        { value: "pending", label: "Pending" },
        { value: "overdue", label: "Overdue", danger: true },
        { value: "partially_paid", label: "Partial" },
        { value: "paid", label: "Paid" },
    ];

    // Active chip label for the period row
    const activeStatusChip = statusChips.find((c) => c.value === status);

    return (
        <div className="space-y-3">

            {/* ── Row 1: period badge + active chips + reset ─────────────────── */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period badge */}
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white tracking-wide">
                        <span className="opacity-50 font-medium">Period</span>
                        <span>{currentMonthName} {year}</span>
                    </div>

                    {/* Active status chip (dismissible) */}
                    {status !== "all" && activeStatusChip && (
                        <span className={[
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
                            "text-[11px] font-semibold",
                            activeStatusChip.danger
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-slate-50 text-slate-700 border-slate-200",
                        ].join(" ")}>
                            {activeStatusChip.label}
                            <button
                                type="button"
                                onClick={() => onStatusChange?.("all")}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                                aria-label="Remove status filter"
                            >
                                ×
                            </button>
                        </span>
                    )}

                    {/* Active property chip (dismissible) */}
                    {propertyId && (
                        <span className="inline-flex items-center gap-1 rounded-md border bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border-slate-200">
                            {properties.find((p) => p._id === propertyId)?.name ?? "Property"}
                            <button
                                type="button"
                                onClick={() => onPropertyChange?.("")}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                                aria-label="Remove property filter"
                            >
                                ×
                            </button>
                        </span>
                    )}
                </div>

                {/* Reset */}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    Reset to current period
                </button>
            </div>

            {/* ── Row 2: all controls in one flex line ────────────────────────── */}
            <div className="flex flex-wrap gap-2 items-center">

                {/* Frequency toggle */}
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5 shrink-0">
                    {["monthly", "quarterly"].map((freq) => (
                        <button
                            key={freq}
                            type="button"
                            onClick={() => onFrequencyChange?.(freq)}
                            className={[
                                "px-3 py-1 text-[11px] font-semibold rounded transition-colors capitalize",
                                frequencyView === freq
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-100",
                            ].join(" ")}
                        >
                            {freq}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

                {/* Month */}
                <Select
                    value={month != null ? String(month) : undefined}
                    onValueChange={(v) => onMonthChange?.(Number(v))}
                >
                    <SelectTrigger className="h-8 w-[128px] text-xs border-slate-200 bg-white">
                        <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                        {monthOptions.map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Year */}
                <Select
                    value={year != null ? String(year) : undefined}
                    onValueChange={(v) => onYearChange?.(Number(v))}
                >
                    <SelectTrigger className="h-8 w-[86px] text-xs border-slate-200 bg-white">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Divider */}
                <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

                {/* Status chips — flat buttons, no Select dropdown */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {statusChips.map(({ value, label, danger }) => {
                        const isActive = status === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onStatusChange?.(value)}
                                className={[
                                    "h-8 inline-flex items-center gap-1.5 rounded-md border px-3",
                                    "text-[11px] font-semibold transition-colors",
                                    isActive && danger
                                        ? "bg-red-600 border-red-600 text-white"
                                        : isActive
                                            ? "bg-slate-900 border-slate-900 text-white"
                                            : danger
                                                ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                                                : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-800",
                                ].join(" ")}
                            >
                                {danger && (
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-white" : "bg-red-500"}`} />
                                )}
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Property select — only when available */}
                {properties.length > 0 && (
                    <>
                        <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />
                        <Select
                            value={propertyId || "all"}
                            onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="h-8 w-[148px] text-xs border-slate-200 bg-white">
                                <SelectValue placeholder="All Properties" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Properties</SelectItem>
                                {properties.map((p) => (
                                    <SelectItem key={p._id} value={p._id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                )}
            </div>
        </div>
    );
};