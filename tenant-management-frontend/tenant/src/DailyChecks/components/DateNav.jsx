import { ChevronLeft, ChevronRight, Calendar, History } from "lucide-react";
import { DATE_NAV_MAX_DAYS_BACK } from "../constants/dailyChecksConstants";

export function DateNav({ daysBack, onDaysBackChange, nepaliInfo, onHistoryOpen }) {
    const isToday = daysBack === 0;
    const maxBack = DATE_NAV_MAX_DAYS_BACK;

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => daysBack < maxBack && onDaysBackChange(daysBack + 1)}
                disabled={daysBack >= maxBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-raised)] disabled:opacity-30 hover:bg-[var(--color-accent-light)] transition-colors shrink-0"
                aria-label="Previous day"
            >
                <ChevronLeft className="w-4 h-4 text-[var(--color-text-body)]" />
            </button>

            <div className="flex-1 flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span className="text-sm font-bold text-[var(--color-text-strong)]">
                        {nepaliInfo
                            ? `${nepaliInfo.bsDay} ${nepaliInfo.monthName} ${nepaliInfo.bsYear}`
                            : "—"} BS
                    </span>
                </div>
                <span className={`text-xs font-semibold mt-0.5 ${isToday ? "text-[var(--color-accent)]" : "text-amber-600"}`}>
                    {isToday ? "Today" : daysBack === 1 ? "Yesterday" : `${daysBack} days ago — catch-up`}
                </span>
            </div>

            <button
                onClick={() => daysBack > 0 && onDaysBackChange(daysBack - 1)}
                disabled={daysBack === 0}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-raised)] disabled:opacity-30 hover:bg-[var(--color-accent-light)] transition-colors shrink-0"
                aria-label="Next day"
            >
                <ChevronRight className="w-4 h-4 text-[var(--color-text-body)]" />
            </button>

            <button
                onClick={onHistoryOpen}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:bg-[var(--color-accent-light)] transition-colors shrink-0 ml-1"
                aria-label="View history"
                title="View past checks"
            >
                <History className="w-4 h-4 text-[var(--color-text-sub)]" />
            </button>
        </div>
    );
}
