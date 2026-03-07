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
 * RentFilter — v4  (mobile-first rewrite)
 *
 * Mobile layout  (<sm):
 *   Row 1 — [Period badge] ················· [Reset]
 *   Row 2 — [Monthly|Quarterly]  [Month ▾]  [Year ▾]
 *   Row 3 — [All][Pending][Overdue][Partial][Paid]  ← sideways-scroll strip
 *   Row 4 — [All Properties ▾]   (only when properties exist)
 *
 * Desktop layout (sm+):
 *   Row 1 — [Period badge] [active chips] ········ [Reset]
 *   Row 2 — [Freq] | [Month] [Year] | [status chips] | [Property]
 *
 * Key fixes vs v3:
 * - Controls split into explicit rows instead of one `flex-wrap` soup
 * - Status chips live in an `overflow-x-auto` strip — never wrap on mobile
 * - All selects + toggles use the app's warm neutral palette (#F8F5F2 / #DDD6D0)
 *   instead of generic `bg-white / border-slate-200`
 * - Property select is full-width on mobile, auto-width on desktop
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

    const statusChips = [
        { value: "all", label: "All" },
        { value: "pending", label: "Pending" },
        { value: "overdue", label: "Overdue", danger: true },
        { value: "partially_paid", label: "Partial" },
        { value: "paid", label: "Paid" },
    ];

    const activeStatusChip = statusChips.find((c) => c.value === status);

    // Shared Select trigger class — warm palette, no shadcn white override
    const triggerCls =
        "h-8 text-xs border-[#DDD6D0] bg-[#F8F5F2] text-[#1C1A18] " +
        "focus:ring-[#3D1414]/10 focus:border-[#AFA097]";

    return (
        <div className="space-y-2.5">

            {/* ── Row 1: period badge + active chips + reset ─────────────────── */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">

                    {/* Period badge */}
                    <div
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1
                                   text-[11px] font-semibold tracking-wide shrink-0"
                        style={{ background: "#1C1A18", color: "#F0DADA" }}
                    >
                        <span style={{ opacity: 0.5 }}>Period</span>
                        <span>{currentMonthName} {year}</span>
                    </div>

                    {/* Active status chip — desktop only (visible inline in strip on mobile) */}
                    {status !== "all" && activeStatusChip && (
                        <span className={[
                            "hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
                            "text-[11px] font-semibold",
                            activeStatusChip.danger
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-[#F8F5F2] text-[#1C1A18] border-[#DDD6D0]",
                        ].join(" ")}>
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
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-md border
                                         bg-[#F8F5F2] px-2 py-0.5 text-[11px] font-semibold
                                         text-[#1C1A18] border-[#DDD6D0]">
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

                <button
                    type="button"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                    className="shrink-0 text-[11px] font-semibold transition-colors whitespace-nowrap
                               disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: "#AFA097" }}
                    onMouseEnter={(e) => { if (hasActiveFilters) e.currentTarget.style.color = "#1C1A18"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#AFA097"; }}
                >
                    Reset to current period
                </button>
            </div>

            {/* ── Row 2: Frequency toggle + Month + Year ───────────────────────── */}
            <div className="flex items-center gap-2">

                {/* Frequency toggle */}
                <div
                    className="inline-flex rounded-md border p-0.5 gap-0.5 shrink-0"
                    style={{ borderColor: "#DDD6D0", background: "#F8F5F2" }}
                >
                    {["monthly", "quarterly"].map((freq) => (
                        <button
                            key={freq}
                            type="button"
                            onClick={() => onFrequencyChange?.(freq)}
                            className="px-3 py-1 text-[11px] font-semibold rounded transition-colors capitalize"
                            style={
                                frequencyView === freq
                                    ? { background: "#1C1A18", color: "#F0DADA" }
                                    : { color: "#948472" }
                            }
                        >
                            {freq}
                        </button>
                    ))}
                </div>

                {/* Vertical divider — desktop only */}
                <div className="hidden sm:block h-5 w-px shrink-0" style={{ background: "#DDD6D0" }} />

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
                        <div className="hidden sm:block h-5 w-px shrink-0" style={{ background: "#DDD6D0" }} />
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

            {/* ── Row 3: Status chips — horizontally scrollable on mobile ─────── */}
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
                                    ? { background: "#B02020", borderColor: "#B02020", color: "white" }
                                    : isActive
                                        ? { background: "#1C1A18", borderColor: "#1C1A18", color: "#F0DADA" }
                                        : danger
                                            ? { background: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" }
                                            : { background: "#F8F5F2", borderColor: "#DDD6D0", color: "#948472" }
                            }
                        >
                            {danger && (
                                <span
                                    className="h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{ background: isActive ? "white" : "#EF4444" }}
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