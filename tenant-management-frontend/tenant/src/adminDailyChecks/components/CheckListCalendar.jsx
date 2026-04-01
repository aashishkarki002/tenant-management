/**
 * ChecklistCalendar.jsx
 *
 * Migrated from a hand-rolled Nepali calendar grid to FullCalendar React.
 *
 * Install:
 *   npm install @fullcalendar/core @fullcalendar/react \
 *               @fullcalendar/daygrid @fullcalendar/interaction \
 *               nepali-date
 *
 * ── Nepali calendar strategy ─────────────────────────────────────────────────
 * FullCalendar has no native BS support. The approach here is:
 *
 *   1. Let FullCalendar render its standard Gregorian month grid.
 *   2. In the `dayCellContent` render hook, convert each AD cell date → BS
 *      using the `nepali-date` package, then render the BS day number and
 *      your dots/badges instead of the default AD number.
 *   3. On each BS month change, call `calendarApi.gotoDate(bsMonthStartToAd())`
 *      so FullCalendar scrolls to the AD month that contains the BS month's
 *      first day (e.g. Baisakh 1 ≈ April 14, so FullCalendar shows April).
 *   4. Cells at the leading/trailing edges will show days from adjacent BS
 *      months — dim them with `isOutsideBsMonth` so the user sees a clear
 *      "current month" boundary in BS space, not AD space.
 *
 * This gives you a bilingual Gregorian-grid / BS-labeled calendar that
 * FullCalendar handles entirely (navigation, keyboard, accessibility, SSR)
 * while the domain stays in BS throughout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useChecklistCalendar from "../hooks/useCheckListCalendar";
import TodayBoard from "./TodayBoard";
import { jsDateToNepali, parseNepaliISO } from "../../../utils/nepaliDate";

/** FullCalendar must receive a stable plugins reference (see resetOptions on each render). */
const CHECKLIST_FC_PLUGINS = [dayGridPlugin, interactionPlugin];

/** Coerce API summary fields so Math.min / Array.from never see NaN. */
function normalizeDaySummary(summary) {
    if (!summary || typeof summary !== "object") return null;
    const total = Math.max(0, Number(summary.total) || 0);
    const completed = Math.max(0, Number(summary.completed) || 0);
    const pending = Math.max(0, Number(summary.pending) || 0);
    const withIssues = Math.max(0, Number(summary.withIssues) || 0);
    return { ...summary, total, completed, pending, withIssues };
}

// ─── BS ↔ AD helpers (via nepali-date package) ───────────────────────────────

function adToBsStr(jsDate) {
    return jsDateToNepali(jsDate).isoString;
}

/**
 * Convert BS year + month (1-indexed) → JS Date for the 1st of that month.
 * Used to tell FullCalendar which AD month to navigate to.
 */
function bsMonthStartToAd(bsYear, bsMonth) {
    const bsMonthStart = `${bsYear}-${String(bsMonth).padStart(2, "0")}-01`;
    return parseNepaliISO(bsMonthStart).nd.getDateObject();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NEPALI_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

// ─── Legend ───────────────────────────────────────────────────────────────────

function CalendarLegend() {
    return (
        <div className="flex items-center gap-3 flex-wrap mt-2">
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
            <TodayBoard propertyId={propertyId} nepaliDate={nepaliDate} onCardClick={onCardClick} />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ChecklistCalendar
 *
 * Month-grid calendar view for checklist history, built on FullCalendar React.
 * The grid is Gregorian but every cell displays its BS date and checklist status.
 *
 * Props:
 *   propertyId       string   required
 *   initialYear      number   optional — BS year to start on
 *   initialMonth     number   optional — BS month (1–12) to start on
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
    const calendarRef = useRef(null);
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

    // ── Sync FullCalendar's displayed AD month to the active BS month ──────────
    //
    // When the hook's BS month changes (prev/next nav), gotoDate() moves
    // FullCalendar to the AD month containing the first day of that BS month.
    // e.g. Baisakh 2082 → April 2025, Jestha 2082 → May 2025.
    //
    useEffect(() => {
        const api = calendarRef.current?.getApi();
        if (!api) return;
        api.gotoDate(bsMonthStartToAd(nepaliYear, nepaliMonth));
    }, [nepaliYear, nepaliMonth]);

    const monthLabel = `${NEPALI_MONTHS[nepaliMonth - 1]} ${nepaliYear}`;

    // ── Date click handler ─────────────────────────────────────────────────────

    function handleDateClick(arg) {
        const bsStr = adToBsStr(arg.date);
        const summary = normalizeDaySummary(dayMap.get(bsStr) ?? null);
        if (!summary || summary.total < 1) return;
        setSelectedDate(bsStr);
        setSelectedSummary(summary);
    }

    // ── dayCellContent — replaces default AD day number with BS content ─────────
    //
    // FullCalendar passes `arg.date` (a JS Date in AD). We:
    //   1. Convert to BS string to look up the dayMap.
    //   2. Render BS day number (not the AD number).
    //   3. Render dots / issue badge matching the original CalendarCell logic.
    //   4. Dim cells that fall outside the current BS month (they belong to an
    //      adjacent BS month and won't have data from this hook's fetch).
    //
    function renderDayCellContent(arg) {
        const bsStr = adToBsStr(arg.date);
        const [bsY, bsM, bsD] = bsStr.split("-");
        const bsDay = parseInt(bsD, 10) || 0;

        const summary = normalizeDaySummary(dayMap.get(bsStr) ?? null);
        const isToday = bsStr === todayNepaliDate;
        const isSelected = bsStr === selectedDate;
        const hasData = summary != null && summary.total > 0;

        // Cells from adjacent BS months (shown in leading/trailing edge of the AD grid)
        const isOutsideBsMonth =
            parseInt(bsY, 10) !== nepaliYear || parseInt(bsM, 10) !== nepaliMonth;

        const hasIssues = hasData && summary.withIssues > 0;
        const allPending = hasData && summary.pending === summary.total;
        const dotsToShow = hasData ? Math.min(summary.total, 4) : 0;

        return (
            <div
                className={cn(
                    "flex flex-col items-center justify-start w-full h-full pt-1.5 pb-2 gap-0.5 rounded-lg",
                    "transition-colors duration-100",
                    // Dim adjacent-month cells
                    isOutsideBsMonth && "opacity-30 pointer-events-none",
                    // No data → non-interactive
                    !hasData && !isOutsideBsMonth && "opacity-40 cursor-default",
                    // Selected state (background applied via dayCellClassNames)
                    isSelected && "text-primary-foreground",
                )}
            >
                {/* BS day number */}
                <span
                    className={cn(
                        "text-[12px] font-medium leading-none tabular-nums",
                        isSelected
                            ? "text-primary-foreground"
                            : isToday
                                ? "text-primary font-semibold"
                                : !hasData
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                    )}
                >
                    {bsDay}
                </span>

                {/* Issue count badge */}
                {hasData && hasIssues && !isSelected && (
                    <span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.5 rounded-full leading-none">
                        {summary.withIssues}✗
                    </span>
                )}

                {/* Status dots */}
                {hasData && !hasIssues && (
                    <div className="flex gap-0.5 flex-wrap justify-center">
                        {Array.from({ length: dotsToShow }).map((_, i) => {
                            const isPending =
                                allPending ||
                                (i >= summary.completed && i < summary.pending + summary.completed);
                            return (
                                <span
                                    key={i}
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        isSelected
                                            ? "bg-primary-foreground/70"
                                            : isPending
                                                ? "bg-amber-400"
                                                : "bg-emerald-500",
                                    )}
                                />
                            );
                        })}
                        {summary.total > 4 && (
                            <span
                                className={cn(
                                    "text-[8px] leading-none font-mono",
                                    isSelected ? "text-primary-foreground/60" : "text-muted-foreground",
                                )}
                            >
                                +{summary.total - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── dayCellClassNames — applies selected / today ring classes ──────────────
    //
    // FullCalendar merges these with its own classes. We use them to apply
    // the filled-background for selected days and the ring for today.
    //
    function getDayCellClassNames(arg) {
        const bsStr = adToBsStr(arg.date);
        const isSelected = bsStr === selectedDate;
        const isToday = bsStr === todayNepaliDate;
        const cellSummary = normalizeDaySummary(dayMap.get(bsStr) ?? null);
        const hasData = cellSummary != null && cellSummary.total > 0;
        return [
            isSelected ? "!bg-primary rounded-lg" : "",
            isToday && !isSelected ? "ring-1 ring-primary/40 rounded-lg" : "",
            hasData && !isSelected ? "hover:!bg-muted/60 cursor-pointer" : "",
        ].filter(Boolean);
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">

                {/* Left — calendar */}
                <div className="space-y-2">

                    {/* Custom month header (FullCalendar's own header is disabled) */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
                        <div className="flex items-center gap-1">
                            {isLoading && (
                                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin mr-1" />
                            )}
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

                    {error ? (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-4 text-center">
                            <p className="text-xs text-destructive">{error}</p>
                        </div>
                    ) : (
                        /*
                         * Scoped wrapper for FullCalendar CSS overrides.
                         * Add the styles below to your global CSS (e.g. index.css or app.css).
                         *
                         * .checklist-fc .fc-theme-standard td { border-color: transparent; }
                         * .checklist-fc .fc-theme-standard th { border: none; }
                         * .checklist-fc .fc-scrollgrid       { border: none; }
                         * .checklist-fc .fc-daygrid-day-top  { display: none; }   ← hides the default AD number
                         * .checklist-fc .fc-col-header-cell-cushion {
                         *   font-size: 10px;
                         *   font-weight: 500;
                         *   color: hsl(var(--muted-foreground) / 0.6);
                         *   text-decoration: none;
                         * }
                         */
                        <div className="checklist-fc">
                            <FullCalendar
                                ref={calendarRef}
                                plugins={CHECKLIST_FC_PLUGINS}
                                initialView="dayGridMonth"
                                // Disable FullCalendar's own header — we render our own above
                                headerToolbar={false}
                                // Seed the calendar on the AD month that contains the initial BS month's start
                                initialDate={bsMonthStartToAd(
                                    initialYear ?? nepaliYear,
                                    initialMonth ?? nepaliMonth,
                                )}
                                // Inject BS day numbers + status dots into every cell
                                dayCellContent={renderDayCellContent}
                                // Merge Tailwind classes for selected / today / hover states
                                dayCellClassNames={getDayCellClassNames}
                                // Handle day clicks — filter to days with data in the handler
                                dateClick={handleDateClick}
                                selectable
                                // Weekday column headers: "Su", "Mo" … matching the original
                                dayHeaderFormat={{ weekday: "short" }}
                                // Don't pad the grid to always show 6 weeks
                                fixedWeekCount={false}
                                // Show adjacent month days so the grid is always fully populated
                                showNonCurrentDates={true}
                                height="auto"
                            />
                        </div>
                    )}

                    <CalendarLegend />
                </div>

                {/* Right — day detail */}
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