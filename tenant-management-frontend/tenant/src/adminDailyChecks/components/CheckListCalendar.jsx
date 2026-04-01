import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useChecklistCalendar from "../hooks/useChecklistCalendar";
import TodayBoard from "./TodayBoard";

// ─── Nepali calendar data ─────────────────────────────────────────────────────
// Days per month for Nepali calendar (BS). This table covers 2080–2090.
// Each row: [year, [days in month 1..12]]
// Source: standard Nepali calendar lookup tables.
const NEPALI_MONTH_DAYS = {
    2079: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2080: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2081: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2083: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2084: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2087: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    2088: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2089: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2090: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
};

const NEPALI_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

// Weekday of 1st Baisakh 2080 is Saturday (6), used as reference anchor.
// We compute the weekday of the 1st of any month by counting days from anchor.
const ANCHOR_YEAR = 2080;
const ANCHOR_MONTH = 1;   // Baisakh
const ANCHOR_DOW = 6;   // Saturday (0=Sun)

/**
 * Count total days from the start of ANCHOR_YEAR/ANCHOR_MONTH (1st day)
 * to the start of targetYear/targetMonth.
 */
function daysBetweenAnchorAndMonth(year, month) {
    let days = 0;
    for (let y = ANCHOR_YEAR; y <= year; y++) {
        const monthsInYear = NEPALI_MONTH_DAYS[y] ?? Array(12).fill(30);
        const startM = y === ANCHOR_YEAR ? ANCHOR_MONTH : 1;
        const endM = y === year ? month - 1 : 12;
        for (let m = startM; m <= endM; m++) {
            days += monthsInYear[m - 1] ?? 30;
        }
    }
    return days;
}

/**
 * Day-of-week for the 1st of a given Nepali year/month (0=Sun … 6=Sat).
 */
function firstDayOfWeek(year, month) {
    if (year < ANCHOR_YEAR || (year === ANCHOR_YEAR && month < ANCHOR_MONTH)) {
        // Earlier than anchor — approximate (shouldn't occur in practice)
        return 0;
    }
    return (ANCHOR_DOW + daysBetweenAnchorAndMonth(year, month)) % 7;
}

/**
 * Zero-pad helper → "2082-03-07"
 */
function toNepaliISODate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

/**
 * CalendarCell
 *
 * Renders one day in the month grid.
 * Visual states:
 *   - Empty (no results): muted number, no dots
 *   - All clear (completed, no issues): green dots
 *   - Has issues: red dot(s)
 *   - Pending/incomplete: amber dot
 *   - Today: highlighted outline
 *   - Selected: filled background
 */
function CalendarCell({ dayNum, nepaliDate, daySummary, isToday, isSelected, onClick }) {
    const hasSummary = !!daySummary;
    const hasIssues = hasSummary && daySummary.withIssues > 0;
    const allPending = hasSummary && daySummary.pending === daySummary.total;
    const allClear = hasSummary && !hasIssues && daySummary.completed > 0;

    // Dot count — clamp to 4 for visual clarity
    const dotsToShow = hasSummary ? Math.min(daySummary.total, 4) : 0;

    return (
        <button
            onClick={() => onClick?.(nepaliDate, daySummary)}
            disabled={!hasSummary}
            className={cn(
                "relative flex flex-col items-center justify-start rounded-lg pt-1.5 pb-2 px-0.5",
                "transition-all duration-100 min-h-[54px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !hasSummary && "cursor-default opacity-40",
                hasSummary && !isSelected && "hover:bg-muted/60 cursor-pointer",
                isSelected && "bg-primary text-primary-foreground shadow-sm",
                !isSelected && isToday && "ring-1.5 ring-primary/40",
            )}
        >
            {/* Day number */}
            <span
                className={cn(
                    "text-[12px] font-medium leading-none mb-1.5 tabular-nums",
                    isSelected ? "text-primary-foreground" : "text-foreground",
                    isToday && !isSelected && "text-primary font-semibold",
                    !hasSummary && "text-muted-foreground",
                )}
            >
                {dayNum}
            </span>

            {/* Issue count badge — shown instead of dots when there are issues */}
            {hasSummary && hasIssues && !isSelected && (
                <span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.5 rounded-full leading-none mb-1">
                    {daySummary.withIssues}✗
                </span>
            )}

            {/* Dots — one dot per result, colored by outcome */}
            {hasSummary && !hasIssues && (
                <div className="flex gap-0.5 flex-wrap justify-center">
                    {Array.from({ length: dotsToShow }).map((_, i) => {
                        const isThisPending = allPending || (i >= daySummary.completed && i < daySummary.pending + daySummary.completed);
                        return (
                            <span
                                key={i}
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    isSelected
                                        ? "bg-primary-foreground/70"
                                        : isThisPending
                                            ? "bg-amber-400"
                                            : "bg-emerald-500",
                                )}
                            />
                        );
                    })}
                    {daySummary.total > 4 && (
                        <span className={cn("text-[8px] leading-none font-mono", isSelected ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            +{daySummary.total - 4}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function CalendarLegend() {
    return (
        <div className="flex items-center gap-3 flex-wrap">
            {[
                { color: "bg-emerald-500", label: "All clear" },
                { color: "bg-rose-500", label: "Issues found" },
                { color: "bg-amber-400", label: "Pending" },
            ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", color)} />
                    {label}
                </span>
            ))}
        </div>
    );
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

/**
 * DayDetailPanel
 *
 * Shown to the right of (or below on mobile) the calendar.
 * Fetches that day's results on demand when a date is selected.
 * Uses TodayBoard in "day detail" mode — same component, different prop.
 */
function DayDetailPanel({ nepaliDate, daySummary, propertyId, onCardClick }) {
    if (!nepaliDate) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Select a day to see its results
            </div>
        );
    }

    return (
        <div>
            {daySummary && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <span className="text-sm font-semibold text-foreground">{nepaliDate}</span>
                    {daySummary.withIssues > 0 ? (
                        <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                            {daySummary.withIssues} issue{daySummary.withIssues !== 1 ? "s" : ""}
                        </span>
                    ) : (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                            All clear
                        </span>
                    )}
                </div>
            )}
            <TodayBoard
                propertyId={propertyId}
                nepaliDate={nepaliDate}
                onCardClick={onCardClick}
            />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ChecklistCalendar
 *
 * Month-grid calendar view for checklist history.
 * Clicking a day opens a detail panel showing that day's results.
 *
 * Props:
 *   propertyId       string   required
 *   initialYear      number   optional — Nepali year to start on
 *   initialMonth     number   optional — Nepali month (1–12) to start on
 *   todayNepaliDate  string   optional — "2082-03-14" used to highlight today
 *   onCardClick      (result) → void   optional
 */
function ChecklistCalendar({
    propertyId,
    initialYear,
    initialMonth,
    todayNepaliDate,
    onCardClick,
}) {
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSummary, setSelectedSummary] = useState(null);

    const {
        dayMap,
        nepaliYear,
        nepaliMonth,
        goToPrevMonth,
        goToNextMonth,
        isLoading,
        error,
    } = useChecklistCalendar(propertyId, initialYear, initialMonth);

    const monthDays = NEPALI_MONTH_DAYS[nepaliYear]?.[nepaliMonth - 1] ?? 30;
    const startDow = firstDayOfWeek(nepaliYear, nepaliMonth);
    const totalCells = startDow + monthDays;
    const weekCount = Math.ceil(totalCells / 7);

    const monthLabel = `${NEPALI_MONTHS[nepaliMonth - 1]} ${nepaliYear}`;

    function handleDayClick(nepaliDate, summary) {
        setSelectedDate(nepaliDate);
        setSelectedSummary(summary ?? null);
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">

            {/* ── Two-column layout on larger screens ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">

                {/* Left — Calendar */}
                <div className="space-y-3">
                    {/* Month navigation header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
                        <div className="flex items-center gap-1">
                            {isLoading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin mr-1" />}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToPrevMonth}
                                disabled={isLoading}
                                aria-label="Previous month"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToNextMonth}
                                disabled={isLoading}
                                aria-label="Next month"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground/60 py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day grid */}
                    {error ? (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-4 text-center">
                            <p className="text-xs text-destructive">{error}</p>
                        </div>
                    ) : (
                        <div
                            className="grid grid-cols-7 gap-0.5"
                            style={{ gridTemplateRows: `repeat(${weekCount}, minmax(54px, auto))` }}
                        >
                            {/* Empty cells before first day */}
                            {Array.from({ length: startDow }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: monthDays }).map((_, i) => {
                                const dayNum = i + 1;
                                const nepDate = toNepaliISODate(nepaliYear, nepaliMonth, dayNum);
                                const summary = dayMap.get(nepDate) ?? null;
                                const isToday = nepDate === todayNepaliDate;
                                const isSelected = nepDate === selectedDate;

                                return (
                                    <CalendarCell
                                        key={nepDate}
                                        dayNum={dayNum}
                                        nepaliDate={nepDate}
                                        daySummary={summary}
                                        isToday={isToday}
                                        isSelected={isSelected}
                                        onClick={summary ? handleDayClick : undefined}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <CalendarLegend />
                </div>

                {/* Right — Day detail panel */}
                <div className="lg:border-l lg:pl-6 min-h-[300px]">
                    <DayDetailPanel
                        nepaliDate={selectedDate}
                        daySummary={selectedSummary}
                        propertyId={propertyId}
                        onCardClick={onCardClick}
                    />
                </div>
            </div>
        </div>
    );
}

export default ChecklistCalendar;