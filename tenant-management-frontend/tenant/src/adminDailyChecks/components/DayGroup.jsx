import CategoryRow from "./CategoryRow";
import {
    formatNepaliDateLong,
    formatEnglishDate,
    formatNepaliMonthYear,
    isSameNepaliMonth,
} from "../utils/checkListDateUtil";

/**
 * DayGroup
 *
 * Redesigned: flat layout, no card wrapper.
 * Date heading is clean and prominent; month separator uses a subtle rule.
 *
 * Props:
 *   dayData      { nepaliDate, englishDate, categories: { [cat]: result[] } }
 *   prevDayData  previous day object | null — drives month separator
 *   onCardClick  (result) → void
 */
function DayGroup({ dayData, prevDayData, onCardClick }) {
    const { nepaliDate, englishDate, categories } = dayData;

    const showMonthSeparator =
        !prevDayData || !isSameNepaliMonth(nepaliDate, prevDayData.nepaliDate);

    const sortedCategories = Object.keys(categories).sort();

    // Count totals for the day summary pill
    const dayTotals = sortedCategories.reduce(
        (acc, cat) => {
            for (const r of categories[cat]) {
                acc.total += r.totalItems ?? 0;
                acc.issues += r.failedItems ?? 0;
            }
            return acc;
        },
        { total: 0, issues: 0 },
    );

    return (
        <div>
            {/* ── Month separator ─────────────────────────────────────────────── */}
            {showMonthSeparator && (
                <div className="flex items-center gap-3 mb-5 mt-8 first:mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 whitespace-nowrap">
                        {formatNepaliMonthYear(nepaliDate)}
                    </p>
                    <div className="flex-1 h-px bg-border/60" />
                </div>
            )}

            {/* ── Day block ────────────────────────────────────────────────────── */}
            <div className="mb-7">
                {/* Date heading */}
                <div className="flex items-baseline justify-between gap-3 mb-4">
                    <div className="flex items-baseline gap-2.5">
                        <h3 className="text-base font-semibold text-foreground tracking-tight leading-none">
                            {formatNepaliDateLong(nepaliDate)}
                        </h3>
                        {englishDate && (
                            <span className="text-[11px] text-muted-foreground">
                                {formatEnglishDate(englishDate)}
                            </span>
                        )}
                    </div>

                    {/* Day summary — total items + issues */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {dayTotals.issues > 0 ? (
                            <span className="text-[11px] font-semibold text-rose-500 tabular-nums">
                                {dayTotals.issues} issue{dayTotals.issues !== 1 ? "s" : ""}
                            </span>
                        ) : dayTotals.total > 0 ? (
                            <span className="text-[11px] font-medium text-emerald-500">
                                All clear
                            </span>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                            {sortedCategories.length}{" "}
                            {sortedCategories.length === 1 ? "category" : "categories"}
                        </span>
                    </div>
                </div>

                {/* Category rows */}
                <div className="space-y-4">
                    {sortedCategories.map((cat) => (
                        <CategoryRow
                            key={cat}
                            category={cat}
                            results={categories[cat]}
                            onCardClick={onCardClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default DayGroup;