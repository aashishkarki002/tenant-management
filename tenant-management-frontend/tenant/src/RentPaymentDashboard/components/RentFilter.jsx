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
import { Toggle } from "@/components/ui/toggle";


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

    // ── Correct active-filter detection ─────────────────────────────────────
    // A filter is "active" if it differs from the default/neutral state.
    const hasActiveFilters =
        status !== "all" ||
        propertyId !== "" ||
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear) ||
        frequencyView !== "monthly";

    const currentMonthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : "—";

    const statusChips = [
        { value: "all", label: "All" },
        { value: "pending", label: "Pending" },
        { value: "overdue", label: "Overdue", danger: true },
        { value: "partially_paid", label: "Partial" },
        { value: "paid", label: "Paid" },
    ];

    const activeStatusChip = statusChips.find((c) => c.value === status);

    // ── Shared Select trigger style — petrol palette, no shadcn white clash ─
    const triggerCls =
        "h-8 text-xs border-[var(--color-border)] bg-[var(--color-surface)] " +
        "text-[var(--color-text-strong)] focus:ring-[var(--color-accent)]/20 " +
        "focus:border-[var(--color-accent-mid)]";

    return (
        <div className="space-y-2.5">

            {/* ── Row 1: period badge + active filter chips + reset ──────────── */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">

                    {/* Period badge — petrol accent palette */}
                    <div
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1
                                   text-[11px] font-semibold tracking-wide shrink-0"
                        style={{
                            background: "var(--color-accent-light)",
                            color: "var(--color-accent)",
                            border: "1px solid var(--color-accent-mid)",
                        }}
                    >
                        <span style={{ opacity: 0.55 }}>Period</span>
                        <span>{currentMonthName} {year}</span>
                    </div>

                    {/* Frequency chip — shown when quarterly is active */}
                    {frequencyView === "quarterly" && (
                        <span
                            className="hidden sm:inline-flex items-center gap-1 rounded-md border
                                       px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                                background: "var(--color-accent-light)",
                                borderColor: "var(--color-accent-mid)",
                                color: "var(--color-accent)",
                            }}
                        >
                            Quarterly
                            <button
                                type="button"
                                onClick={() => onFrequencyChange?.("monthly")}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                                aria-label="Switch back to monthly"
                            >×</button>
                        </span>
                    )}

                    {/* Active status chip — desktop only */}
                    {status !== "all" && activeStatusChip && (
                        <span
                            className="hidden sm:inline-flex items-center gap-1 rounded-md border
                                       px-2 py-0.5 text-[11px] font-semibold"
                            style={
                                activeStatusChip.danger
                                    ? {
                                        background: "var(--color-danger-bg)",
                                        borderColor: "var(--color-danger-border)",
                                        color: "var(--color-danger)",
                                    }
                                    : {
                                        background: "var(--color-surface)",
                                        borderColor: "var(--color-border)",
                                        color: "var(--color-text-strong)",
                                    }
                            }
                        >
                            {activeStatusChip.label}
                            <button
                                type="button"
                                onClick={() => onStatusChange?.("all")}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                                aria-label="Remove status filter"
                            >×</button>
                        </span>
                    )}

                    {/* Active property chip — desktop only */}
                    {propertyId && (
                        <span
                            className="hidden sm:inline-flex items-center gap-1 rounded-md border
                                       px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                                background: "var(--color-surface)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-text-strong)",
                            }}
                        >
                            {properties.find((p) => p._id === propertyId)?.name ?? "Property"}
                            <button
                                type="button"
                                onClick={() => onPropertyChange?.("")}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                                aria-label="Remove property filter"
                            >×</button>
                        </span>
                    )}
                </div>

                {/* Reset — only enabled when filters differ from default */}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="shrink-0 text-[11px] font-semibold transition-colors whitespace-nowrap
                               disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: "var(--color-text-sub)" }}
                >
                    Reset to current period
                </button>
            </div>

            {/* ── Row 2: Frequency toggle + Month + Year + Property (desktop) ── */}
            <div className="flex items-center gap-2">

                {/* Frequency toggle — drives frequencyView prop, no local state */}
                <div className="shrink-0">
                    <div
                        className="inline-flex items-center rounded-md p-0.5 gap-0.5"
                        style={{
                            border: "1px solid var(--color-border)",
                            background: "color-mix(in srgb, var(--color-surface) 40%, transparent)",
                        }}
                    >
                        {["monthly", "quarterly"].map((freq) => (
                            <Toggle
                                key={freq}
                                size="sm"
                                pressed={frequencyView === freq}
                                onPressedChange={(pressed) => {
                                    // Only fire when toggling ON to avoid double-fire
                                    if (pressed) onFrequencyChange?.(freq);
                                }}
                                className="
                                    px-3 py-1 text-[11px] font-semibold capitalize rounded-sm
                                    transition-all duration-150

                                    text-[var(--color-text-sub)]
                                    hover:bg-[var(--color-surface)]
                                    hover:text-[var(--color-text-strong)]

                                    data-[state=on]:bg-[var(--color-surface)]
                                    data-[state=on]:text-[var(--color-text-strong)]
                                    data-[state=on]:shadow-sm
                                "
                            >
                                {freq}
                            </Toggle>
                        ))}
                    </div>
                </div>

                {/* Vertical divider — desktop only */}
                <div
                    className="hidden sm:block h-5 w-px shrink-0"
                    style={{ background: "var(--color-border)" }}
                />

                {/* Month select */}
                <Select
                    value={month != null ? String(month) : undefined}
                    onValueChange={(v) => onMonthChange?.(Number(v))}
                >
                    <SelectTrigger className={`${triggerCls} w-[116px]`}>
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

                {/* Year select */}
                <Select
                    value={year != null ? String(year) : undefined}
                    onValueChange={(v) => onYearChange?.(Number(v))}
                >
                    <SelectTrigger className={`${triggerCls} w-[80px]`}>
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

                {/* Property — inline on desktop only */}
                {properties.length > 0 && (
                    <>
                        <div
                            className="hidden sm:block h-5 w-px shrink-0"
                            style={{ background: "var(--color-border)" }}
                        />
                        <div className="hidden sm:block">
                            <Select
                                value={propertyId || "all"}
                                onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                            >
                                <SelectTrigger className={`${triggerCls} w-[148px]`}>
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
                        </div>
                    </>
                )}
            </div>

            {/* ── Row 3: Status chips — scrollable on mobile ──────────────────── */}
            <div
                className="flex items-center gap-1.5 overflow-x-auto"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {statusChips.map(({ value, label, danger }) => {
                    const isActive = status === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onStatusChange?.(value)}
                            className="h-8 inline-flex items-center gap-1.5 rounded-md border px-3
                                       text-[11px] font-semibold transition-colors shrink-0"
                            style={
                                isActive && danger
                                    ? {
                                        background: "var(--color-danger)",
                                        borderColor: "var(--color-danger)",
                                        color: "#ffffff",
                                    }
                                    : isActive
                                        ? {
                                            background: "var(--color-accent)",
                                            borderColor: "var(--color-accent)",
                                            color: "#ffffff",
                                        }
                                        : danger
                                            ? {
                                                background: "var(--color-danger-bg)",
                                                borderColor: "var(--color-danger-border)",
                                                color: "var(--color-danger)",
                                            }
                                            : {
                                                background: "var(--color-surface)",
                                                borderColor: "var(--color-border)",
                                                color: "var(--color-text-sub)",
                                            }
                            }
                        >
                            {danger && (
                                <span
                                    className="h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{
                                        background: isActive ? "#ffffff" : "var(--color-danger)",
                                    }}
                                />
                            )}
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── Row 4: Property select — mobile only, full width ─────────────── */}
            {properties.length > 0 && (
                <div className="sm:hidden">
                    <Select
                        value={propertyId || "all"}
                        onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                    >
                        <SelectTrigger className={`${triggerCls} w-full`}>
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
                </div>
            )}

        </div>
    );
};