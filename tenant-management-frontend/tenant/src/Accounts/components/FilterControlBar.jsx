/**
 * FilterControlBar.jsx  (rewrite — v3)
 *
 * Changes in this version:
 *   • Month picker now uses NEPALI_MONTHS_FY_ORDER (Shrawan-first) — both
 *     desktop dropdown and mobile sheet
 *   • Removed CURRENT_FISCAL_YEAR / CURRENT_BS_MONTH_NAME stale constant
 *     imports — no constants from this file were used anyway
 *   • Desktop: added `sticky top-0 z-20` so the bar pins on scroll
 *   • All props identical — zero breaking changes
 */

import { useState, useMemo, useRef, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import {
    NEPALI_MONTH_NAMES,       // still needed for periodValueLabel display
    NEPALI_MONTHS_FY_ORDER,   // ✅ FY-ordered list for pickers
    QUARTER_LABELS,
    toBSShort,
    getCurrentBSMonth,
    getCurrentFiscalYear,
} from "../utils/nepaliCalendar";

import { useIsMobile } from "@/hooks/use-mobile";
import DualCalendarTailwind from "../../components/dualDate";
import CompareTrigger from "./CompareTrigger";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUARTERS = [
    { label: "Q1", value: 1 },
    { label: "Q2", value: 2 },
    { label: "Q3", value: 3 },
    { label: "Q4", value: 4 },
];

const GRANULARITIES = [
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
    { id: "custom", label: "Custom" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function EntityPill({ label, dot, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium",
                "transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer border",
                isActive
                    ? "text-white border-transparent"
                    : "border-[var(--color-border)] bg-transparent text-[var(--color-text-body)]",
                !isActive && "hover:bg-[var(--color-accent-light)]/50 hover:border-[var(--color-accent-mid)]",
            )}
            style={isActive ? { background: dot, borderColor: dot } : {}}
        >
            <span
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ background: isActive ? "rgba(255,255,255,0.6)" : dot }}
            />
            <span className="max-w-[120px] truncate">{label}</span>
        </button>
    );
}

function GranularitySegment({ value, onChange }) {
    return (
        <div className="flex items-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-[3px] gap-[2px] shrink-0">
            {GRANULARITIES.map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={cn(
                        "h-[26px] px-3 rounded-[5px] text-[12px] font-semibold cursor-pointer",
                        "transition-colors duration-100 whitespace-nowrap",
                        value === opt.id
                            ? "bg-[var(--color-accent)] text-white shadow-sm"
                            : "bg-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

const PeriodChip = forwardRef(function PeriodChip({ label, onClick, ...rest }, ref) {
    return (
        <button
            ref={ref}
            onClick={onClick}
            {...rest}
            className={cn(
                "inline-flex items-center gap-1 h-7 px-3 rounded-lg border text-[12px] font-semibold",
                "cursor-pointer transition-colors whitespace-nowrap shrink-0",
                "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]",
                "hover:bg-[var(--color-accent-light)]/70",
            )}
        >
            {label}
            <ChevronDownIcon size={11} className="opacity-60" />
        </button>
    );
});



// ─── Mobile bar ───────────────────────────────────────────────────────────────

function MobileFilterBar({
    filterGranularity, onGranularityChange,
    selectedQuarter, onQuarterChange,
    selectedMonth, onMonthChange,
    selectedFiscalYear, onFiscalYearChange,
    filterLabel, entities, activeEntityId, onEntitySelect,
}) {
    const [open, setOpen] = useState(false);
    const FISCAL_YEARS = [selectedFiscalYear, selectedFiscalYear - 1, selectedFiscalYear - 2];
    const hasNonDefaultFilter = filterGranularity !== "year";

    return (
        <div className="no-print flex items-center justify-between px-4 h-11 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-[12px] font-medium text-[var(--color-text-sub)] truncate">
                {filterLabel}
            </span>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <button
                        className={cn(
                            "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold shrink-0 ml-3 cursor-pointer",
                            hasNonDefaultFilter
                                ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                                : "border-[var(--color-border)] text-[var(--color-text-body)]",
                        )}
                    >
                        Filters
                        {hasNonDefaultFilter && (
                            <span className="w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full bg-[var(--color-accent)]">
                                1
                            </span>
                        )}
                    </button>
                </SheetTrigger>

                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-auto">
                    <SheetHeader className="pb-1">
                        <SheetTitle className="text-[var(--color-accent)]">Filter Period</SheetTitle>
                    </SheetHeader>

                    <div className="mt-5 flex flex-col gap-5 pb-2">

                        {/* Entity scope */}
                        {entities.length > 1 && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-3">
                                    Scope
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[{ _id: null, name: "All Entities" }, ...entities.filter(e => e.type !== "head_office")].map(e => (
                                        <button
                                            key={e._id ?? "all"}
                                            onClick={() => onEntitySelect(e._id ?? null)}
                                            className={cn(
                                                "px-4 h-8 rounded-full border text-[12px] font-semibold cursor-pointer transition-colors",
                                                (activeEntityId === null && !e._id) || activeEntityId === e._id
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                    : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                            )}
                                        >
                                            {e.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Granularity */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-3">
                                Period
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {GRANULARITIES.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => onGranularityChange(g.id)}
                                        className={cn(
                                            "py-2.5 rounded-xl border text-[13px] font-semibold cursor-pointer transition-colors",
                                            filterGranularity === g.id
                                                ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                        )}
                                    >
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Year picker */}
                        {filterGranularity === "year" && (
                            <div className="flex flex-wrap gap-2">
                                {FISCAL_YEARS.map(y => (
                                    <button
                                        key={y}
                                        onClick={() => onFiscalYearChange(y)}
                                        className={cn(
                                            "h-9 px-4 rounded-xl border text-[13px] font-semibold cursor-pointer transition-colors",
                                            selectedFiscalYear === y
                                                ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                        )}
                                    >
                                        FY {y}/{String(y + 1).slice(2)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Quarter picker */}
                        {filterGranularity === "quarter" && (
                            <div className="grid grid-cols-2 gap-2">
                                {QUARTERS.map(q => (
                                    <button
                                        key={q.value}
                                        onClick={() => onQuarterChange(q.value)}
                                        className={cn(
                                            "p-3 rounded-xl border text-left text-[13px] font-semibold cursor-pointer transition-colors",
                                            selectedQuarter === q.value
                                                ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                        )}
                                    >
                                        {q.label}
                                        <span className="block text-[11px] font-normal mt-0.5 opacity-60">
                                            {QUARTER_LABELS[q.value]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Month picker — FY order ✅ */}
                        {filterGranularity === "month" && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-3">
                                    Month
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {NEPALI_MONTHS_FY_ORDER.map(({ month, name }) => (
                                        <button
                                            key={month}
                                            onClick={() => onMonthChange(month)}
                                            className={cn(
                                                "py-2.5 rounded-xl border text-[13px] font-semibold cursor-pointer transition-colors",
                                                selectedMonth === month
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                    : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                            )}
                                        >
                                            {name.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FY picker for month/quarter modes */}
                        {(filterGranularity === "month" || filterGranularity === "quarter") && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-3">
                                    Fiscal Year
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {FISCAL_YEARS.map(y => (
                                        <button
                                            key={y}
                                            onClick={() => onFiscalYearChange(y)}
                                            className={cn(
                                                "h-9 px-4 rounded-xl border text-[13px] font-semibold cursor-pointer transition-colors",
                                                selectedFiscalYear === y
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                    : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-accent-mid)]",
                                            )}
                                        >
                                            FY {y}/{String(y + 1).slice(2)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setOpen(false)}
                            className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[var(--color-accent)] text-white cursor-pointer mt-1"
                        >
                            Done
                        </button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

// ─── Desktop bar ──────────────────────────────────────────────────────────────

export default function FilterControlBar({
    entities = [], activeEntityId, onEntitySelect,
    filterGranularity, onGranularityChange,
    selectedQuarter, onQuarterChange,
    selectedMonth, onMonthChange,
    selectedFiscalYear, onFiscalYearChange,
    customStart, customEnd, onCustomStartChange, onCustomEndChange,
    compareMode, compareQuarter, compareYear, compareMonth,
    onCompareApply, onCompareClear,
    filterLabel,
}) {
    const isMobile = useIsMobile();
    const [showCustom, setShowCustom] = useState(false);
    const customRef = useRef(null);
    const showEntities = entities.length > 1;

    const FISCAL_YEARS = useMemo(
        () => [selectedFiscalYear, selectedFiscalYear - 1, selectedFiscalYear - 2],
        [selectedFiscalYear],
    );

    const handleGranularity = (g) => {
        onGranularityChange(g);
        if (g !== "custom") { onCustomStartChange(""); onCustomEndChange(""); }
        if (g === "month") {
            // Auto-select current BS month and ensure FY matches
            onMonthChange(getCurrentBSMonth());
            onFiscalYearChange(getCurrentFiscalYear());
        } else {
            onMonthChange(null);
        }
        if (g !== "quarter") onQuarterChange(null);
    };

    // periodValueLabel uses NEPALI_MONTH_NAMES[selectedMonth - 1] which is correct
    // because selectedMonth is always a 1-indexed Nepali month number, and
    // NEPALI_MONTH_NAMES is indexed 0–11 (Baisakh=0). This is a display-only
    // lookup — the picker is what previously had the ordering bug.
    const periodValueLabel = useMemo(() => {
        if (filterGranularity === "year")
            return `FY ${selectedFiscalYear}/${String(selectedFiscalYear + 1).slice(2)}`;
        if (filterGranularity === "quarter")
            return selectedQuarter
                ? `Q${selectedQuarter} · ${QUARTER_LABELS[selectedQuarter]}`
                : "Pick quarter";
        if (filterGranularity === "month")
            return selectedMonth ? NEPALI_MONTH_NAMES[selectedMonth - 1] : "Pick month";
        if (filterGranularity === "custom" && customStart && customEnd)
            return `${toBSShort(customStart)} – ${toBSShort(customEnd)}`;
        return "Set range";
    }, [filterGranularity, selectedFiscalYear, selectedQuarter, selectedMonth, customStart, customEnd]);

    const entityDot = (type) => type === "private" ? "#16a34a" : "var(--color-accent)";

    if (isMobile) {
        return (
            <MobileFilterBar
                filterGranularity={filterGranularity}
                onGranularityChange={handleGranularity}
                selectedQuarter={selectedQuarter}
                onQuarterChange={onQuarterChange}
                selectedMonth={selectedMonth}
                onMonthChange={onMonthChange}
                selectedFiscalYear={selectedFiscalYear}
                onFiscalYearChange={onFiscalYearChange}
                filterLabel={filterLabel}
                entities={entities}
                activeEntityId={activeEntityId}
                onEntitySelect={onEntitySelect}
            />
        );
    }

    return (
        <div className="no-print sticky top-0 z-20 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
            <div className="flex items-center h-12 min-w-0">

                {/* ── ZONE A: Entity scope ─────────────────────────────────── */}
                {showEntities && (
                    <div className="flex items-center gap-1.5 shrink-0 h-full px-4 lg:px-6 border-r border-[var(--color-border)]">
                        <EntityPill
                            label="All"
                            dot="var(--color-accent)"
                            isActive={activeEntityId === null}
                            onClick={() => onEntitySelect(null)}
                        />
                        {entities
                            .filter(e => e.type !== "head_office")
                            .map(entity => (
                                <EntityPill
                                    key={entity._id}
                                    label={entity.name}
                                    dot={entityDot(entity.type)}
                                    isActive={activeEntityId === entity._id}
                                    onClick={() => onEntitySelect(entity._id)}
                                />
                            ))
                        }
                    </div>
                )}

                {/* ── ZONE B: Period controls ──────────────────────────────── */}
                <div className="flex items-center gap-2.5 h-full flex-1 min-w-0 px-4 lg:px-5">

                    <GranularitySegment value={filterGranularity} onChange={handleGranularity} />

                    {filterGranularity !== "custom" ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <PeriodChip label={periodValueLabel} />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="start" className="rounded-2xl p-3 min-w-[220px]">

                                {/* ── Year ── */}
                                {filterGranularity === "year" && (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-2 px-1">
                                            Fiscal Year
                                        </p>
                                        {FISCAL_YEARS.map(y => (
                                            <DropdownMenuItem
                                                key={y}
                                                onClick={() => onFiscalYearChange(y)}
                                                className={cn(
                                                    "cursor-pointer rounded-lg text-[13px]",
                                                    y === selectedFiscalYear && "font-bold text-[var(--color-accent)]",
                                                )}
                                            >
                                                FY {y}/{String(y + 1).slice(2)}
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}

                                {/* ── Quarter ── */}
                                {filterGranularity === "quarter" && (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-2 px-1">
                                            Quarter · FY {selectedFiscalYear}
                                        </p>
                                        {QUARTERS.map(q => (
                                            <DropdownMenuItem
                                                key={q.value}
                                                onClick={() => onQuarterChange(q.value)}
                                                className="cursor-pointer rounded-lg flex justify-between text-[13px]"
                                            >
                                                <span className={cn(selectedQuarter === q.value && "font-bold text-[var(--color-accent)]")}>
                                                    {q.label}
                                                </span>
                                                <span className="text-[11px] text-[var(--color-text-sub)]">
                                                    {QUARTER_LABELS[q.value]}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        {FISCAL_YEARS.map(y => (
                                            <DropdownMenuItem
                                                key={y}
                                                onClick={() => onFiscalYearChange(y)}
                                                className={cn(
                                                    "cursor-pointer rounded-lg text-[13px]",
                                                    y === selectedFiscalYear && "font-bold text-[var(--color-accent)]",
                                                )}
                                            >
                                                FY {y}/{String(y + 1).slice(2)}
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}


                                {filterGranularity === "month" && (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-2 px-1">
                                            Month · FY {selectedFiscalYear}
                                        </p>
                                        <div className="grid grid-cols-3 gap-1">
                                            {NEPALI_MONTHS_FY_ORDER.map(({ month, name }) => (
                                                <DropdownMenuItem
                                                    key={month}
                                                    onClick={() => onMonthChange(month)}
                                                    className={cn(
                                                        "cursor-pointer rounded-lg text-center justify-center text-[12px]",
                                                        selectedMonth === month && "font-bold text-[var(--color-accent)] bg-[var(--color-accent-light)]",
                                                    )}
                                                >
                                                    {name.slice(0, 3)}
                                                </DropdownMenuItem>
                                            ))}
                                        </div>
                                        <DropdownMenuSeparator />
                                        {FISCAL_YEARS.map(y => (
                                            <DropdownMenuItem
                                                key={y}
                                                onClick={() => onFiscalYearChange(y)}
                                                className={cn(
                                                    "cursor-pointer rounded-lg text-[13px]",
                                                    y === selectedFiscalYear && "font-bold text-[var(--color-accent)]",
                                                )}
                                            >
                                                FY {y}/{String(y + 1).slice(2)}
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                    ) : (
                        /* Custom date range */
                        <div className="relative shrink-0" ref={customRef}>
                            {customStart && customEnd ? (
                                <PeriodChip
                                    label={`${toBSShort(customStart)} – ${toBSShort(customEnd)}`}
                                    onClick={() => setShowCustom(true)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowCustom(true)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-dashed",
                                        "border-[var(--color-border)] text-[12px] font-semibold",
                                        "text-[var(--color-text-sub)] cursor-pointer whitespace-nowrap",
                                        "hover:border-[var(--color-accent-mid)] hover:text-[var(--color-text-body)]",
                                        "transition-colors",
                                    )}
                                >
                                    <CalendarIcon size={12} />
                                    Set range
                                </button>
                            )}

                            {showCustom && (
                                <div className="absolute top-full left-0 mt-2 z-50 rounded-2xl border border-[var(--color-border)] shadow-xl p-5 w-[320px] max-w-[calc(100vw-1rem)] bg-[var(--color-surface-raised)]">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-4">
                                        Custom Date Range
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-[10px] font-semibold text-[var(--color-text-sub)] mb-1.5">Start</p>
                                            <DualCalendarTailwind
                                                value={customStart}
                                                onChange={v => onCustomStartChange(v ?? "")}
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-[var(--color-text-sub)] mb-1.5">End</p>
                                            <DualCalendarTailwind
                                                value={customEnd}
                                                onChange={v => onCustomEndChange(v ?? "")}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={!customStart || !customEnd}
                                            onClick={() => setShowCustom(false)}
                                            className="flex-1 py-2 rounded-lg text-[12px] font-bold text-white bg-[var(--color-accent)] disabled:opacity-40 cursor-pointer"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => setShowCustom(false)}
                                            className="px-4 rounded-lg border border-[var(--color-border)] bg-transparent text-[12px] font-semibold text-[var(--color-text-body)] cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── ZONE C: Compare — hidden on iPad/narrow screens ─────── */}
                <div className="hidden lg:flex items-center h-full px-4 lg:px-5 border-l border-[var(--color-border)] shrink-0">
                    <CompareTrigger
                        filterGranularity={filterGranularity}
                        selectedFiscalYear={selectedFiscalYear}
                        filterLabel={filterLabel}
                        compareMode={compareMode}
                        compareQuarter={compareQuarter}
                        compareYear={compareYear}
                        compareMonth={compareMonth}
                        onApply={onCompareApply}
                        onClear={onCompareClear}
                    />
                </div>

            </div>
        </div>
    );
}