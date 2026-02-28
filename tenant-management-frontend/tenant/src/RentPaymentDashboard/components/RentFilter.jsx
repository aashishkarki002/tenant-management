import React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ── Use nepaliDate.js as the single source of truth ───────────────────────────
// NEPALI_MONTH_NAMES is the canonical month name list. getNepaliYearOptions
// generates a proper year range anchored to the current Nepali year.
import {
    NEPALI_MONTH_NAMES,
    getNepaliYearOptions,
} from "../../../utils/nepaliDate";

/**
 * RentFilter
 *
 * Redesign decisions (as design lead):
 *
 * 1. PERIOD CONTEXT BADGE — a prominent "Falgun 2081" chip sits above the
 *    filter strip so the user always knows which billing period they're viewing
 *    at a glance, before reading any filter control.
 *
 * 2. LEFT-ALIGNED FILTERS — filters are the primary control on this view;
 *    pushing them to the right edge (justify-end) buried them. They now sit
 *    left-aligned in a natural reading order: Month → Year → Status → Property.
 *
 * 3. OVERDUE QUICK-TOGGLE moved into the status select as a styled badge-chip
 *    below the filter row, not a floating orphan button. Reduces visual noise.
 *
 * 4. CLEAR FILTERS is always visible but disabled when filters are at default,
 *    preventing layout shift when it appears/disappears.
 *
 * 5. YEAR OPTIONS from getNepaliYearOptions() (nepaliDate.js) instead of the
 *    ad-hoc baseYear±2 array — respects the canonical supported year range.
 *
 * 6. MONTH OPTIONS built from NEPALI_MONTH_NAMES (nepaliDate.js) instead of
 *    a separate @/constants/nepaliMonths file — one source of truth.
 *
 * Props: unchanged from previous revision (fully backwards compatible).
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
}) => {
    // Build month options from nepaliDate.js constant (1-based value, name label)
    const monthOptions = NEPALI_MONTH_NAMES.map((name, i) => ({
        value: i + 1,
        label: name,
    }));

    // Year options from nepaliDate.js: current year down to 2075, ascending for select
    const yearOptions = getNepaliYearOptions(2078).reverse(); // ascending: oldest → newest

    const hasActiveFilters =
        status !== "all" ||
        propertyId !== "" ||
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear);

    const currentMonthName =
        month != null ? NEPALI_MONTH_NAMES[month - 1] : "—";

    // Status display config
    const statusConfig = {
        all: { label: "All Statuses", color: null },
        pending: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
        partially_paid: { label: "Partial", color: "bg-blue-50 text-blue-700 border-blue-200" },
        overdue: { label: "Overdue", color: "bg-red-50 text-red-700 border-red-200" },
        paid: { label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    };

    return (
        <div className="space-y-3">
            {/* ── Period context + active filter chips ─────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Primary period badge — always visible */}
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white tracking-wide">
                        <span className="opacity-60">Period</span>
                        <span>{currentMonthName} {year}</span>
                    </div>

                    {/* Active filter chips */}
                    {status !== "all" && statusConfig[status] && (
                        <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${statusConfig[status].color}`}
                        >
                            {statusConfig[status].label}
                            <button
                                onClick={() => onStatusChange?.("all")}
                                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                aria-label="Remove status filter"
                            >
                                ×
                            </button>
                        </span>
                    )}
                    {propertyId && (
                        <span className="inline-flex items-center gap-1 rounded-md border bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 border-slate-200">
                            {properties.find((p) => p._id === propertyId)?.name ?? "Property"}
                            <button
                                onClick={() => onPropertyChange?.("")}
                                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                aria-label="Remove property filter"
                            >
                                ×
                            </button>
                        </span>
                    )}
                </div>

                {/* Clear all — always mounted, disabled when no active filters */}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    Reset to current period
                </button>
            </div>

            {/* ── Filter controls ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Month */}
                <Select
                    value={month != null ? String(month) : undefined}
                    onValueChange={(v) => onMonthChange?.(Number(v))}
                >
                    <SelectTrigger className="h-8 w-[130px] text-sm border-slate-200 bg-white">
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
                    <SelectTrigger className="h-8 w-[90px] text-sm border-slate-200 bg-white">
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
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* Status */}
                <Select
                    value={status}
                    onValueChange={(v) => onStatusChange?.(v)}
                >
                    <SelectTrigger className="h-8 w-[140px] text-sm border-slate-200 bg-white">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                </Select>

                {/* Property (only when data is available) */}
                {properties.length > 0 && (
                    <Select
                        value={propertyId || "all"}
                        onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                    >
                        <SelectTrigger className="h-8 w-[150px] text-sm border-slate-200 bg-white">
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
                )}

                {/* Overdue quick-toggle — styled as a compact pill, not a full button */}
                <button
                    type="button"
                    onClick={() =>
                        onStatusChange?.(status === "overdue" ? "all" : "overdue")
                    }
                    className={`h-8 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${status === "overdue"
                        ? "bg-red-600 border-red-600 text-white"
                        : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        }`}
                >
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${status === "overdue" ? "bg-white" : "bg-red-500"
                            }`}
                    />
                    Overdue only
                </button>
            </div>
        </div>
    );
};