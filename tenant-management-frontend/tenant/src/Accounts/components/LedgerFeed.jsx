import { cn } from "@/lib/utils";
import { Skeleton } from "./AccountingPrimitives";
import { toBSDate } from "../utils/nepaliCalendar";
import { fmtN } from "./AccountingPage";

export default function LedgerFeed({ entries = [], loading, onViewAll }) {
    if (loading) {
        return (
            <div className="flex flex-col gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} h={48} />
                ))}
            </div>
        );
    }

    const recent = entries.length <= 8 ? entries : entries.slice(-8);

    if (!recent.length) {
        return (
            <div className="py-10 text-center">
                <div className="text-2xl mb-2 opacity-30">RS </div>
                <div className="text-[13px] font-semibold text-[var(--color-text-body)]">
                    No transactions yet
                </div>
                <div className="text-[11px] mt-0.5 text-[var(--color-text-sub)]">
                    Entries will appear here once recorded
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {/* Column header */}
            <div className="flex items-center px-2 pb-1.5 mb-0.5 border-b border-[var(--color-border)]/60">
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--color-text-sub)] flex-1">
                    Description
                </span>
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--color-text-sub)] text-right w-28">
                    Amount
                </span>
            </div>

            {/* Rows */}
            <div className="flex flex-col">
                {recent.map((e, i) => {
                    const isDebit = (e.debit ?? 0) > 0;
                    const amt = e.debit ?? e.credit ?? 0;
                    const description = e.description ?? e.account?.name ?? "—";

                    return (
                        <div
                            key={e._id ?? i}
                            className={cn(
                                "flex items-center gap-3 px-2 py-3 rounded-[10px]",
                                "transition-colors duration-100",
                                "hover:bg-[var(--color-surface)]/70 cursor-default",
                                i % 2 !== 0
                                    ? "bg-[var(--color-surface)]/40"
                                    : "bg-transparent",
                            )}
                        >
                            {/* Direction indicator */}
                            <DirectionDot isDebit={isDebit} />

                            {/* Description + date */}
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium text-[var(--color-text-strong)] truncate leading-tight">
                                    {description}
                                </div>
                                <div className="text-[10px] text-[var(--color-text-sub)] mt-0.5 tabular-nums">
                                    {toBSDate(e.date)}
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right w-28 shrink-0">
                                <div
                                    className={cn(
                                        "text-[13px] font-bold tabular-nums",
                                        isDebit
                                            ? "text-[var(--color-danger)]"
                                            : "text-[var(--color-success)]",
                                    )}
                                >
                                    {isDebit ? "−" : "+"}RS {fmtN(amt)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* View all */}
            <button
                onClick={onViewAll}
                className={cn(
                    "mt-3 py-2.5 w-full rounded-[10px]",
                    "border border-[var(--color-border)] bg-transparent",
                    "text-[11px] font-semibold cursor-pointer",
                    "text-[var(--color-text-sub)]",
                    "hover:bg-[var(--color-surface)] hover:text-[var(--color-text-body)]",
                    "transition-colors duration-150",
                    "flex items-center justify-center gap-1.5",
                )}
            >
                <span>View all {entries.length} ledger entries</span>
                <span className="opacity-50">→</span>
            </button>
        </div>
    );
}

// ─── Private ─────────────────────────────────────────────────────────────────

/**
 * A coloured direction indicator:
 *   Credit → solid emerald dot
 *   Debit  → solid rose dot
 * Simpler and more data-dense than a full circle icon.
 */
function DirectionDot({ isDebit }) {
    return (
        <div
            className="shrink-0 relative"
            style={{ width: 32, height: 32 }}
        >
            {/* Background pill */}
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: isDebit
                        ? "var(--color-danger-bg)"
                        : "var(--color-success-bg)",
                }}
            />
            {/* Icon char */}
            <div
                className="absolute inset-0 flex items-center justify-center text-[13px] font-black"
                style={{
                    color: isDebit
                        ? "var(--color-danger)"
                        : "var(--color-success)",
                }}
            >
                {isDebit ? "−" : "+"}
            </div>
        </div>
    );
}