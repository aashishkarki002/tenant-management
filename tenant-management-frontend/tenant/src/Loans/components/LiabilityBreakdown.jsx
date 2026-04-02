import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fmtRupees, fmtK, paisaToRupees } from "../loan.constants";

const PALETTE = [
    "#1A5276", "#2E86C1", "#1ABC9C", "#F39C12", "#8E44AD", "#C0392B",
    "#16A085", "#D35400", "#27AE60", "#7F8C8D",
];
const TOP_N = 6;

export function LiabilityBreakdown({ activeLoans = [], onSelect }) {
    const [expanded, setExpanded] = useState(false);
    if (!activeLoans.length) return null;

    const sorted = [...activeLoans].sort(
        (a, b) => (b.outstandingPaisa ?? 0) - (a.outstandingPaisa ?? 0)
    );
    const totalPaisa = sorted.reduce((s, l) => s + (l.outstandingPaisa ?? 0), 0);
    const topLoans = sorted.slice(0, TOP_N);
    const restLoans = sorted.slice(TOP_N);
    const restPaisa = restLoans.reduce((s, l) => s + (l.outstandingPaisa ?? 0), 0);
    const restPct = totalPaisa > 0 ? (restPaisa / totalPaisa) * 100 : 0;
    const visibleLegend = expanded ? sorted : topLoans;

    return (
        <div className="rounded-2xl border border-border bg-card mb-5 overflow-hidden" role="region" aria-label="Liability breakdown">

            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Liability breakdown — active loans
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-foreground">
                    {fmtK(paisaToRupees(totalPaisa))} outstanding
                </span>
            </div>

            {/* Stacked bar */}
            <div className="flex h-2.5 w-full overflow-hidden" role="img" aria-label={`Outstanding balance split across ${sorted.length} loans`}>
                {sorted.map((loan, i) => {
                    const pct = totalPaisa > 0 ? (loan.outstandingPaisa / totalPaisa) * 100 : 0;
                    return (
                        <motion.button
                            key={loan._id}
                            onClick={() => onSelect(loan)}
                            title={`${loan.lender} · ${pct.toFixed(1)}%`}
                            className="h-full focus-visible:outline-none hover:opacity-75"
                            style={{ background: PALETTE[i % PALETTE.length] }}
                            aria-label={`${loan.lender}: ${pct.toFixed(1)}%`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    );
                })}
            </div>

            {/* Legend grid */}
            <div className="px-5 pt-4 pb-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    <AnimatePresence initial={false}>
                        {visibleLegend.map((loan, i) => {
                            const pct = totalPaisa > 0
                                ? ((loan.outstandingPaisa / totalPaisa) * 100).toFixed(1)
                                : "0.0";
                            return (
                                <motion.button
                                    key={loan._id}
                                    onClick={() => onSelect(loan)}
                                    className="flex items-center gap-2.5 group text-left w-full min-w-0"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                    <span className="flex-1 min-w-0 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                                        {loan.lender}
                                    </span>
                                    <span className="text-[11px] font-semibold tabular-nums text-foreground shrink-0">
                                        {fmtRupees(loan.outstandingPaisa)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums min-w-[34px] text-right shrink-0">
                                        {pct}%
                                    </span>
                                    <ArrowUpRight size={11} className="text-muted-foreground group-hover:text-[var(--color-accent)] transition-colors shrink-0" />
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Collapse / expand footer */}
            {restLoans.length > 0 && (
                <div className="px-5 pb-4 pt-3 flex items-center justify-between">
                    {!expanded && (
                        <span className="text-[11px] text-muted-foreground">
                            +{restLoans.length} more loan{restLoans.length !== 1 ? "s" : ""} ·{" "}
                            <span className="font-semibold text-foreground tabular-nums">
                                {fmtRupees(restPaisa)}
                            </span>{" "}
                            · {restPct.toFixed(1)}%
                        </span>
                    )}
                    {expanded && <span />}

                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] hover:opacity-75 transition-opacity"
                    >
                        {expanded ? (
                            <>
                                Show less <ChevronUp size={12} />
                            </>
                        ) : (
                            <>
                                Show all {sorted.length} <ChevronDown size={12} />
                            </>
                        )}
                    </button>
                </div>
            )}

            {restLoans.length === 0 && <div className="pb-4" />}
        </div>
    );
}