import React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NEPALI_MONTHS } from "@/constants/nepaliMonths";

/**
 * RentFilter — month, year, status, and property filters for the Rent tab.
 *
 * Industry Standard: filters are controlled (value + onChange) so the parent
 * hook (useRentData) owns all state. This component is purely presentational.
 *
 * Props:
 *   month         {number}   - selected Nepali month (1–12)
 *   year          {number}   - selected Nepali year
 *   status        {string}   - "all" | "pending" | "overdue" | "paid" | "partially_paid"
 *   propertyId    {string}   - selected property ID or ""
 *   properties    {Array}    - [{ _id, name }] for property dropdown
 *   onMonthChange    {fn}
 *   onYearChange     {fn}
 *   onStatusChange   {fn}
 *   onPropertyChange {fn}
 *   onReset          {fn}    - resets all filters to defaults
 *   defaultMonth     {number} - optional; when set, month !== defaultMonth counts as active
 *   defaultYear      {number} - optional; when set, year !== defaultYear counts as active
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
    // Build a year range: current Nepali year ± 2 (guard against NaN/undefined)
    const baseYear = Number.isFinite(year) ? year : 2081;
    const yearOptions = Array.from({ length: 5 }, (_, i) => baseYear - 2 + i);

    const hasActiveFilters =
        status !== "all" ||
        propertyId !== "" ||
        (defaultMonth != null && month !== defaultMonth) ||
        (defaultYear != null && year !== defaultYear);

    return (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-end gap-2">
            {/* ── Month ── */}
            <Select
                value={month != null ? String(month) : undefined}
                onValueChange={(v) => onMonthChange?.(Number(v))}
            >
                <SelectTrigger className="w-full min-w-0 sm:w-[140px]">
                    <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                    {NEPALI_MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* ── Year ── */}
            <Select
                value={year != null ? String(year) : undefined}
                onValueChange={(v) => onYearChange?.(Number(v))}
            >
                <SelectTrigger className="w-full min-w-0 sm:w-[100px]">
                    <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                    {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* ── Status ── */}
            <Select
                value={status}
                onValueChange={(v) => onStatusChange?.(v)}
            >
                <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
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

            {/* ── Property (only rendered when properties are available) ── */}
            {properties.length > 0 && (
                <Select
                    value={propertyId || "all"}
                    onValueChange={(v) => onPropertyChange?.(v === "all" ? "" : v)}
                >
                    <SelectTrigger className="w-full min-w-0 sm:w-[160px]">
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

            {/* ── Overdue quick-filter shortcut ── */}
            <Button
                variant={status === "overdue" ? "destructive" : "outline"}
                size="sm"
                onClick={() =>
                    onStatusChange?.(status === "overdue" ? "all" : "overdue")
                }
                className={
                    (status !== "overdue"
                        ? "border-red-300 text-red-600 hover:bg-red-50"
                        : "") + " shrink-0 w-full sm:w-auto"
                }
            >
                Overdue only
            </Button>

            {/* ── Clear filters (only visible when non-default filters are active) ── */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0 w-full sm:w-auto">
                    Clear filters
                </Button>
            )}
        </div>
    );
};