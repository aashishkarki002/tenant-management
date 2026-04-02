/**
 * tabs/LedgerTab.jsx  —  REDESIGNED
 *
 * Premium ledger view. Design decisions:
 *   • Top banner is a solid accent-bordered info card with clear Credit/Debit chips
 *   • The general ledger card has a clean header with print CTA
 *   • Credits chip: emerald bg, Debits chip: rose bg — consistent with the rest of the UI
 *   • Print button uses the ghost style from components.md
 *
 * Props (unchanged):
 *   filterLabel    string
 *   totals         { totalRevenue, totalExpenses }
 *   ledgerEntries  array
 *   loadingLedger  boolean
 */

import { FileTextIcon, PrinterIcon, ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
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

            {/* ── Info banner ─────────────────────────────────────────────── */}
            <div
                className="flex items-center justify-between flex-wrap gap-4 px-4 py-4 rounded-xl"
                style={{
                    background: "var(--color-info-bg)",
                    borderLeft: "3px solid var(--color-info)",
                    border: "1px solid var(--color-border)",
                    borderLeftWidth: "3px",
                    borderLeftColor: "var(--color-info)",
                }}
            >
                {/* Left: icon + label */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "var(--color-info)" }}
                    >
                        <FileTextIcon size={17} color="#fff" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-0.5">
                            General Ledger
                        </div>
                        <div className="text-[13px] text-[var(--color-text-body)]">
                            All transactions for{" "}
                            <span className="font-bold text-[var(--color-text-strong)]">
                                {filterLabel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Credits + Debits chips */}
                <div className="flex gap-2.5">
                    <MetricChip
                        label="Credits"
                        value={totals.totalRevenue}
                        color="var(--color-success)"
                        bg="var(--color-success-bg)"
                        border="var(--color-success)"
                        icon={<ArrowUpRightIcon size={11} />}
                    />
                    <MetricChip
                        label="Debits"
                        value={totals.totalExpenses}
                        color="var(--color-danger)"
                        bg="var(--color-danger-bg)"
                        border="var(--color-danger)"
                        icon={<ArrowDownRightIcon size={11} />}
                    />
                </div>
            </div>

            {/* ── Ledger table card ────────────────────────────────────────── */}
            <Card className="p-0">
                {/* Card header */}
                <div className="px-5 py-4 flex justify-between items-center border-b border-[var(--color-border)]">
                    <div>
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">
                            Transaction Ledger
                        </div>
                        <div className="text-[11px] mt-0.5 text-[var(--color-text-sub)]">
                            {filterLabel} · chronological order
                        </div>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border border-[var(--color-border)] bg-transparent text-[11px] font-semibold cursor-pointer text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                        <PrinterIcon size={12} />
                        Print
                    </button>
                </div>

                {/* Table */}
                <LedgerTable
                    entries={ledgerEntries}
                    loading={loadingLedger}
                    itemsPerPage={20}
                />
            </Card>
        </div>
    );
}

// ─── Private ──────────────────────────────────────────────────────────────────
function MetricChip({ label, value, color, bg, border, icon }) {
    return (
        <div
            className="flex flex-col items-end px-3.5 py-2.5 rounded-xl"
            style={{
                background: bg,
                border: `1px solid ${border}`,
                borderOpacity: 0.25,
            }}
        >
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{ color, opacity: 0.7 }}>
                {icon}
                {label}
            </div>
            <div
                className="text-[17px] font-black tabular-nums leading-none"
                style={{ color, letterSpacing: "-0.025em" }}
            >
                ₹{fmtK(value)}
            </div>
        </div>
    );
}