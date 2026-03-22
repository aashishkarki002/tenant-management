/**
 * tabs/LedgerTab.jsx
 *
 * Renders the "Ledger" tab content.
 * Shows a coloured info header (credits / debits totals) and the
 * paginated GeneralLedger table below it.
 *
 * Props:
 *   filterLabel    string  — human-readable period label
 *   totals         { totalRevenue, totalExpenses }
 *   ledgerEntries  array   — from useAccounting
 *   loadingLedger  boolean
 */

import { FileTextIcon, PrinterIcon } from "lucide-react";
import { Card } from "../AccountingPrimitives";
import LedgerTable from "../LedgerTable";
import { fmtK } from "../AccountingPage";

export default function LedgerTab({
    filterLabel,
    totals,
    ledgerEntries,
    loadingLedger,
}) {
    return (
        <div className="flex flex-col gap-4">

            {/* ── Coloured info header ─────────────────────────────────────── */}
            <div
                className="flex items-center justify-between flex-wrap gap-3 px-4 py-3.5 rounded-xl border border-l-4 border-[var(--color-border)] bg-[var(--color-info-bg)]"
                style={{ borderLeftColor: "var(--color-info)" }}
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-info)]">
                        <FileTextIcon size={18} color="#fff" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)]">
                            Ledger Detail View
                        </div>
                        <div className="text-[13px] mt-0.5 text-[var(--color-text-body)]">
                            All transactions for{" "}
                            <span className="font-bold text-[var(--color-text-strong)]">{filterLabel}</span>
                        </div>
                    </div>
                </div>

                {/* Credits / Debits summary chips */}
                <div className="flex gap-3">
                    <div className="px-3.5 py-2 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-bg)]">
                        <div className="text-[9px] text-[var(--color-text-sub)]">Credits</div>
                        <div className="text-base font-bold text-[var(--color-success)]">
                            ₹{fmtK(totals.totalRevenue)}
                        </div>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)]">
                        <div className="text-[9px] text-[var(--color-text-sub)]">Debits</div>
                        <div className="text-base font-bold text-[var(--color-danger)]">
                            ₹{fmtK(totals.totalExpenses)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── General Ledger table card ────────────────────────────────── */}
            <Card className="p-0">
                <div className="px-[22px] py-4 flex justify-between items-center border-b border-[var(--color-border)]">
                    <div>
                        <div className="text-sm font-bold text-[var(--color-text-strong)]">General Ledger</div>
                        <div className="text-[11px] mt-0.5 text-[var(--color-text-sub)]">{filterLabel}</div>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-xs font-semibold cursor-pointer text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                        <PrinterIcon size={13} />
                        Print
                    </button>
                </div>
                <LedgerTable entries={ledgerEntries} loading={loadingLedger} itemsPerPage={20} />
            </Card>
        </div>
    );
}