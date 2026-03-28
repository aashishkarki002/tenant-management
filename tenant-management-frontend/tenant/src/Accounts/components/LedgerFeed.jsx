/**
 * LedgerFeed.jsx
 *
 * Compact recent-transactions list shown at the bottom of the Overview tab.
 * Shows the 8 most recent ledger entries and a "View all" button.
 *
 * Dates are rendered in BS format via toBSDate from nepaliCalendar.js —
 * NOT via toLocaleDateString() as in the original.
 *
 * Props:
 *   entries   array   — from useAccounting ledgerEntries
 *   loading   boolean
 *   onViewAll () => void  — switches AccountingPage to the Ledger tab
 */

import { cn } from "@/lib/utils";
import { ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { Skeleton } from "./AccountingPrimitives";
import { toBSDate } from "../utils/nepaliCalendar";
import { fmtN } from "./AccountingPage";

export default function LedgerFeed({ entries = [], loading, onViewAll }) {
    if (loading) return (
        <div className="flex flex-col gap-1.5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={44} />)}
        </div>
    );

    // API returns oldest-first (FIFO); take the tail for "latest" without re-sorting.
    const recent = entries.length <= 8 ? entries : entries.slice(-8);

    if (!recent.length) return (
        <div className="py-5 text-center text-[13px] text-[var(--color-text-sub)]">
            No ledger entries
        </div>
    );

    return (
        <div className="flex flex-col gap-0.5">
            {recent.map((e, i) => {
                const isDebit = (e.debit ?? 0) > 0;
                const amt = e.debit ?? e.credit ?? 0;

                return (
                    <div
                        key={e._id ?? i}
                        className={cn(
                            "flex items-center gap-3 px-2 py-2.5 rounded-[9px]",
                            i % 2 !== 0 ? "bg-[var(--color-surface)]/70" : "",
                        )}
                    >
                        {/* Direction icon */}
                        <div className={cn(
                            "w-8 h-8 rounded-full shrink-0 flex items-center justify-center",
                            isDebit ? "bg-[var(--color-danger-bg)]" : "bg-[var(--color-success-bg)]",
                        )}>
                            {isDebit
                                ? <ArrowDownRightIcon size={14} color="var(--color-danger)" />
                                : <ArrowUpRightIcon size={14} color="var(--color-success)" />}
                        </div>

                        {/* Description + BS date */}
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[var(--color-text-strong)]">
                                {e.description ?? e.account?.name ?? "—"}
                            </div>
                            {/* ✅ toBSDate from nepaliCalendar — never toLocaleDateString() */}
                            <div className="text-[10px] text-[var(--color-text-sub)]">
                                {toBSDate(e.date)}
                            </div>
                        </div>

                        {/* Amount */}
                        <div className={cn(
                            "text-[13px] font-bold shrink-0",
                            isDebit ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
                        )}>
                            {isDebit ? "−" : "+"}₹{fmtN(amt)}
                        </div>
                    </div>
                );
            })}

            <button
                onClick={onViewAll}
                className="mt-1.5 py-2 rounded-[9px] border border-[var(--color-border)] bg-transparent text-xs font-semibold cursor-pointer text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
            >
                View all {entries.length} entries →
            </button>
        </div>
    );
}