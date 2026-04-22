/**
 * LiabilitiesTab.jsx — distilled
 *
 * Before: self-contained full-page wrapper (min-h-screen + px-4 sm:px-7 header)
 *   with heavy card chrome, font-black everywhere, uppercase on field labels,
 *   local Skeleton/fmtK duplicates fighting AccountingPage's outer layout.
 *
 * After:
 *   - Starts with flex flex-col gap-4 (matches OverviewTab / RevenueTab)
 *   - T token map (style={{ color: T.body }}) — no Tailwind var() strings
 *   - Skeleton + ProgBar imported from AccountingPrimitives
 *   - fmtK imported from AccountingPage
 *   - Max font weight: font-bold
 *   - Uppercase tracking only on table column headers
 *   - Panel helper collapses repeated card chrome
 *   - LOAN_STATUS badge/dot classes → color+opacity inline style
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import SectionToggle from "../SectionToggle";
import { Skeleton, ProgBar } from "../AccountingPrimitives";
import { fmtK } from "../AccountingPage";
import {
    AlertCircleIcon,
    AlertTriangleIcon,
    CheckCircle2Icon,
    CreditCardIcon,
    FilterIcon,
    PlusIcon,
    PrinterIcon,
    RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../../plugins/axios";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
    danger:  "var(--color-danger)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    info:    "var(--color-info)",
    accent:  "var(--color-accent)",
    sub:     "var(--color-text-sub)",
    body:    "var(--color-text-body)",
    strong:  "var(--color-text-strong)",
    border:  "var(--color-border)",
    surface: "var(--color-surface)",
    raised:  "var(--color-surface-raised)",
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtPaisa = (p = 0) => `RS ${fmtK(p / 100)}`;
const pct = (part, total) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

// ─── Lookup maps ──────────────────────────────────────────────────────────────
const LOAN_STATUS = {
    ACTIVE:    { label: "Active",    color: "var(--color-info)" },
    CLOSED:    { label: "Closed",    color: "var(--color-success)" },
    DEFAULTED: { label: "Defaulted", color: "var(--color-danger)" },
};

const REF_LABELS = {
    RENT_EXPENSE:     "Rent",
    CAM:              "CAM",
    SALARY:           "Salary",
    MANUAL:           "Manual",
    SECURITY_DEPOSIT: "Deposit",
    LOAN:             "Loan",
};

function agingBucket(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
    if (days <= 30) return { label: "0–30 days",  color: "var(--color-success)" };
    if (days <= 60) return { label: "31–60 days", color: "var(--color-warning)" };
    if (days <= 90) return { label: "61–90 days", color: "var(--color-warning)" };
    return             { label: "90+ days",  color: "var(--color-danger)" };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useLiabilities() {
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/liabilities");
            setAll(res.data?.data ?? []);
        } catch (err) {
            console.error("[useLiabilities]", err);
            setAll([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { all, loading, refetch: fetch };
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Empty({ message = "Nothing to display" }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2Icon size={28} className="mb-2.5 opacity-25" style={{ color: T.sub }} />
            <div className="text-[13px] font-semibold" style={{ color: T.body }}>{message}</div>
            <div className="text-[12px] mt-0.5" style={{ color: T.sub }}>
                Nothing to display for the selected period.
            </div>
        </div>
    );
}

function Panel({ title, subtitle, actions, children }) {
    return (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.raised }}>
            <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: T.border }}>
                <div>
                    <div className="text-[13px] font-semibold" style={{ color: T.body }}>{title}</div>
                    {subtitle && <div className="text-[11px] mt-0.5" style={{ color: T.sub }}>{subtitle}</div>}
                </div>
                {actions}
            </div>
            {children}
        </div>
    );
}

// ─── CategoryRow ──────────────────────────────────────────────────────────────
function CategoryRow({ label, amountPaisa, total, count }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: T.body }}>{label}</span>
                <div className="flex items-center gap-3">
                    <span className="text-[11px]" style={{ color: T.sub }}>{count} items</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: T.strong }}>
                        {fmtPaisa(amountPaisa)}
                    </span>
                </div>
            </div>
            <ProgBar value={amountPaisa} max={total || 1} color={T.accent} h={3} />
        </div>
    );
}

// ─── LoanCard ─────────────────────────────────────────────────────────────────
function LoanCard({ loan }) {
    const status   = LOAN_STATUS[loan.loanStatus] ?? LOAN_STATUS.ACTIVE;
    const repaid   = (loan.originalAmountPaisa ?? loan.amountPaisa) - loan.amountPaisa;
    const progress = pct(repaid, loan.originalAmountPaisa ?? loan.amountPaisa);
    const barColor = progress >= 80 ? T.success : progress >= 40 ? T.info : T.warning;

    return (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.raised }}>
            <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: T.border }}>
                <div>
                    <div className="text-[13px] font-bold" style={{ color: T.strong }}>{loan.notes || "Loan"}</div>
                    <div className="text-[11px]" style={{ color: T.sub }}>{loan.source?.name ?? "—"}</div>
                </div>
                <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                        background: status.color + "22",
                        color: status.color,
                        border: `1px solid ${status.color}55`,
                    }}
                >
                    {status.label}
                </span>
            </div>

            <div className="px-4 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Original",    value: loan.originalAmountPaisa ?? loan.amountPaisa, color: T.strong },
                        { label: "Repaid",      value: repaid,              color: T.success },
                        { label: "Outstanding", value: loan.amountPaisa,    color: T.danger },
                    ].map(({ label, value, color }) => (
                        <div key={label}>
                            <div className="text-[10px] font-semibold mb-0.5" style={{ color: T.sub }}>{label}</div>
                            <div className="text-[15px] font-bold tabular-nums" style={{ color }}>{fmtPaisa(value)}</div>
                        </div>
                    ))}
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px]" style={{ color: T.sub }}>Repayment progress</span>
                        <span className="text-[11px] font-bold" style={{ color: T.body }}>{progress}%</span>
                    </div>
                    <ProgBar value={progress} max={100} color={barColor} h={6} />
                </div>
            </div>
        </div>
    );
}

// ─── Table rows ───────────────────────────────────────────────────────────────
function PayableRow({ liability, index }) {
    const bucket   = agingBucket(liability.date);
    const refLabel = REF_LABELS[liability.referenceType] ?? liability.referenceType;
    return (
        <tr
            className={cn("border-b transition-colors", index % 2 === 1 && "bg-[var(--color-surface)]")}
            style={{ borderColor: T.border }}
        >
            <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: T.strong }}>
                {liability.payeeType === "TENANT"
                    ? (liability.tenant?.name ?? "Tenant")
                    : (liability.notes ?? "External")}
            </td>
            <td className="px-4 py-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: T.accent + "22", color: T.accent }}>
                    {refLabel}
                </span>
            </td>
            <td className="px-4 py-3 text-[12px] tabular-nums font-bold" style={{ color: T.danger }}>
                {fmtPaisa(liability.amountPaisa)}
            </td>
            <td className="px-4 py-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: bucket.color + "22", color: bucket.color, border: `1px solid ${bucket.color}55` }}>
                    {bucket.label}
                </span>
            </td>
            <td className="px-4 py-3 text-[11px]" style={{ color: T.sub }}>
                {new Date(liability.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    liability.status === "SYNCED"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                        : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
                )}>
                    {liability.status}
                </span>
            </td>
        </tr>
    );
}

function DepositRow({ liability, index }) {
    return (
        <tr
            className={cn("border-b transition-colors", index % 2 === 1 && "bg-[var(--color-surface)]")}
            style={{ borderColor: T.border }}
        >
            <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: T.strong }}>
                {liability.tenant?.name ?? "—"}
            </td>
            <td className="px-4 py-3 text-[11px]" style={{ color: T.sub }}>
                {liability.tenant?.phone ?? "—"}
            </td>
            <td className="px-4 py-3 text-[12px] tabular-nums font-bold" style={{ color: T.danger }}>
                {fmtPaisa(liability.amountPaisa)}
            </td>
            <td className="px-4 py-3 text-[11px]" style={{ color: T.sub }}>
                {new Date(liability.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    liability.status === "SYNCED"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                        : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
                )}>
                    {liability.status}
                </span>
            </td>
        </tr>
    );
}

// ─── Table shell ──────────────────────────────────────────────────────────────
function TableShell({ cols, loading, empty, children }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr style={{ background: T.surface }}>
                        {cols.map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.07em] border-b"
                                style={{ color: T.sub, borderColor: T.border }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading && (
                        <tr>
                            <td colSpan={cols.length} className="py-8 text-center text-[12px]" style={{ color: T.sub }}>
                                Loading…
                            </td>
                        </tr>
                    )}
                    {!loading && empty && (
                        <tr><td colSpan={cols.length}>{empty}</td></tr>
                    )}
                    {!loading && !empty && children}
                </tbody>
            </table>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewContent({ all, loading }) {
    const totalPaisa   = all.reduce((s, l) => s + l.amountPaisa, 0);
    const loans        = all.filter(l => l.referenceType === "LOAN");
    const deposits     = all.filter(l => l.referenceType === "SECURITY_DEPOSIT");
    const payables     = all.filter(l => l.referenceType !== "LOAN" && l.referenceType !== "SECURITY_DEPOSIT");
    const overdueCount = all.filter(l => agingBucket(l.date).label === "90+ days").length;

    const byCategory = useMemo(() => {
        const map = {};
        for (const l of all) {
            const key = REF_LABELS[l.referenceType] ?? l.referenceType;
            if (!map[key]) map[key] = { count: 0, paisa: 0 };
            map[key].count++;
            map[key].paisa += l.amountPaisa;
        }
        return Object.entries(map)
            .sort((a, b) => b[1].paisa - a[1].paisa)
            .map(([label, { count, paisa }]) => ({ label, count, paisa }));
    }, [all]);

    const aging = useMemo(() => {
        const buckets = { "0–30 days": 0, "31–60 days": 0, "61–90 days": 0, "90+ days": 0 };
        for (const l of all) { buckets[agingBucket(l.date).label] += l.amountPaisa; }
        return Object.entries(buckets).map(([label, paisa]) => ({ label, paisa }));
    }, [all]);

    const agingColors = {
        "0–30 days": T.success, "31–60 days": T.warning, "61–90 days": T.warning, "90+ days": T.danger,
    };

    const kpis = [
        {
            label: "Total liabilities",
            value: fmtPaisa(totalPaisa),
            sub: `${all.length} obligations`,
            className: "border-r border-b lg:border-b-0",
        },
        {
            label: "Loan outstanding",
            value: fmtPaisa(loans.reduce((s, l) => s + l.amountPaisa, 0)),
            sub: `${loans.length} active loans`,
            className: "border-b lg:border-b-0 lg:border-l",
        },
        {
            label: "Deposit obligations",
            value: fmtPaisa(deposits.reduce((s, l) => s + l.amountPaisa, 0)),
            sub: `${deposits.length} tenants`,
            className: "border-r border-t lg:border-t-0 lg:border-l",
        },
        {
            label: "Overdue (90+ days)",
            value: String(overdueCount),
            sub: overdueCount > 0 ? "Needs attention" : "All on track",
            className: "border-t lg:border-t-0 lg:border-l",
            highlight: overdueCount > 0,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip — one surface, four cells */}
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.raised }}>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    {kpis.map(k => (
                        <div key={k.label} className={cn("flex flex-col gap-1 px-5 py-4", k.className)} style={{ borderColor: T.border }}>
                            <span className="text-[11px] font-medium" style={{ color: T.sub }}>{k.label}</span>
                            {loading
                                ? <Skeleton h={28} />
                                : (
                                    <span
                                        className="text-[22px] font-bold tabular-nums leading-none"
                                        style={{ color: k.highlight ? T.danger : T.strong, letterSpacing: "-0.02em" }}
                                    >
                                        {k.value}
                                    </span>
                                )}
                            {!loading && <span className="text-[11px]" style={{ color: T.sub }}>{k.sub}</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Category + Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="By category" subtitle="Where you owe the most">
                    <div className="px-4 py-4 flex flex-col gap-4">
                        {loading && [1, 2, 3].map(i => <Skeleton key={i} h={20} />)}
                        {!loading && byCategory.length === 0 && <Empty message="No liabilities recorded" />}
                        {!loading && byCategory.map(cat => (
                            <CategoryRow key={cat.label} label={cat.label} amountPaisa={cat.paisa} total={totalPaisa} count={cat.count} />
                        ))}
                    </div>
                </Panel>

                <Panel title="Aging analysis" subtitle="How long you've owed">
                    <div className="px-4 py-4 flex flex-col gap-4">
                        {aging.map(({ label, paisa }) => {
                            const color = agingColors[label] ?? T.info;
                            return (
                                <div key={label} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
                                        <span className="text-[13px] font-bold tabular-nums" style={{ color: T.strong }}>
                                            {fmtPaisa(paisa)}
                                        </span>
                                    </div>
                                    <ProgBar value={paisa} max={totalPaisa || 1} color={color} h={4} />
                                </div>
                            );
                        })}
                    </div>
                    {!loading && overdueCount > 0 && (
                        <div className="mx-4 mb-4 flex items-center gap-2 px-3.5 py-3 rounded-lg"
                            style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)" }}>
                            <AlertTriangleIcon size={13} style={{ color: T.danger }} className="shrink-0" />
                            <span className="text-[11px] font-semibold" style={{ color: T.danger }}>
                                {overdueCount} obligation{overdueCount > 1 ? "s" : ""} past 90 days — take action soon.
                            </span>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Top payables */}
            <Panel title="Top outstanding payables" subtitle="Largest unresolved obligations">
                <div className="divide-y" style={{ borderColor: T.border }}>
                    {loading && [1, 2, 3].map(i => (
                        <div key={i} className="px-4 py-3"><Skeleton h={14} /></div>
                    ))}
                    {!loading && payables.length === 0 && <Empty message="No payables" />}
                    {!loading && [...payables]
                        .sort((a, b) => b.amountPaisa - a.amountPaisa)
                        .slice(0, 6)
                        .map((l, i) => {
                            const bucket = agingBucket(l.date);
                            return (
                                <div key={l._id ?? i} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg)] transition-colors">
                                    <div>
                                        <div className="text-[12px] font-semibold" style={{ color: T.strong }}>
                                            {l.notes || l.tenant?.name || "External"}
                                        </div>
                                        <div className="text-[11px]" style={{ color: T.sub }}>{REF_LABELS[l.referenceType]}</div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[13px] font-bold tabular-nums" style={{ color: T.danger }}>
                                            {fmtPaisa(l.amountPaisa)}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                            style={{ background: bucket.color + "22", color: bucket.color, border: `1px solid ${bucket.color}55` }}>
                                            {bucket.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </Panel>
        </div>
    );
}

function LoansContent({ all, loading }) {
    const loans            = all.filter(l => l.referenceType === "LOAN");
    const totalOutstanding = loans.reduce((s, l) => s + l.amountPaisa, 0);
    const totalOriginal    = loans.reduce((s, l) => s + (l.originalAmountPaisa ?? l.amountPaisa), 0);
    const totalRepaid      = totalOriginal - totalOutstanding;
    const overallProgress  = pct(totalRepaid, totalOriginal);

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.info}`, background: T.raised }}>
                <div className="flex flex-wrap items-center justify-between px-5 py-4 gap-4">
                    <div>
                        <div className="text-[11px] font-medium mb-0.5" style={{ color: T.sub }}>Loan portfolio</div>
                        <div className="text-[13px]" style={{ color: T.body }}>
                            {loans.length} loan{loans.length !== 1 ? "s" : ""} ·{" "}
                            <span className="font-bold" style={{ color: T.strong }}>{overallProgress}% repaid overall</span>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        {[
                            { label: "Outstanding", value: totalOutstanding, color: T.danger },
                            { label: "Repaid",      value: totalRepaid,      color: T.success },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="text-right">
                                <div className="text-[11px]" style={{ color: T.sub }}>{label}</div>
                                <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color, letterSpacing: "-0.02em" }}>
                                    {fmtPaisa(value)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <Skeleton key={i} h={180} />)}
                </div>
            )}
            {!loading && loans.length === 0 && <Empty message="No loans recorded" />}
            {!loading && loans.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {loans.map((loan, i) => <LoanCard key={loan._id ?? i} loan={loan} />)}
                </div>
            )}
        </div>
    );
}

function PayablesContent({ all, loading }) {
    const [filterType, setFilterType] = useState("ALL");
    const payables = all.filter(l => l.referenceType !== "LOAN" && l.referenceType !== "SECURITY_DEPOSIT");
    const types    = useMemo(() => ["ALL", ...new Set(payables.map(l => l.referenceType))], [payables]);
    const filtered = filterType === "ALL" ? payables : payables.filter(l => l.referenceType === filterType);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <FilterIcon size={12} style={{ color: T.sub }} />
                {types.map(t => (
                    <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                            filterType === t ? "bg-[var(--color-accent)] text-white" : "",
                        )}
                        style={filterType !== t ? { background: T.raised, border: `1px solid ${T.border}`, color: T.sub } : undefined}
                    >
                        {REF_LABELS[t] ?? t}
                    </button>
                ))}
            </div>

            <Panel
                title="All payables"
                subtitle={`${filtered.length} records · ${fmtPaisa(filtered.reduce((s, l) => s + l.amountPaisa, 0))} total`}
                actions={
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                        style={{ border: `1px solid ${T.border}`, background: "transparent", color: T.body }}
                    >
                        <PrinterIcon size={11} /> Print
                    </button>
                }
            >
                <TableShell
                    cols={["Payee", "Type", "Amount", "Aging", "Date", "Status"]}
                    loading={loading}
                    empty={filtered.length === 0 ? <Empty message="No payables found" /> : null}
                >
                    {filtered.map((l, i) => <PayableRow key={l._id ?? i} liability={l} index={i} />)}
                </TableShell>
            </Panel>
        </div>
    );
}

function DepositsContent({ all, loading }) {
    const deposits     = all.filter(l => l.referenceType === "SECURITY_DEPOSIT");
    const totalDeposit = deposits.reduce((s, l) => s + l.amountPaisa, 0);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                style={{
                    background: "var(--color-warning-bg)",
                    border: "1px solid var(--color-warning-border)",
                    borderLeft: `3px solid ${T.warning}`,
                }}>
                <AlertCircleIcon size={13} style={{ color: T.warning }} className="shrink-0" />
                <span className="text-[12px]" style={{ color: T.body }}>
                    Security deposits are refundable. Total obligation:{" "}
                    <span className="font-bold" style={{ color: T.strong }}>{fmtPaisa(totalDeposit)}</span>
                </span>
            </div>

            <Panel
                title="Deposit obligations"
                subtitle={`${deposits.length} tenants · ${fmtPaisa(totalDeposit)} to be returned`}
            >
                <TableShell
                    cols={["Tenant", "Phone", "Deposit amount", "Date", "Status"]}
                    loading={loading}
                    empty={deposits.length === 0 ? <Empty message="No deposit obligations" /> : null}
                >
                    {deposits.map((l, i) => <DepositRow key={l._id ?? i} liability={l} index={i} />)}
                </TableShell>
            </Panel>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LiabilitiesTab() {
    const [activeTab, setActiveTab] = useState("overview");
    const { all, loading, refetch } = useLiabilities();
    const overdueCount = all.filter(l => agingBucket(l.date).label === "90+ days").length;

    return (
        <div className="flex flex-col gap-4">

            {/* ── Header: toggle + overdue badge + actions ──────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <SectionToggle
                        options={["Overview", "Loans", "Payables", "Deposits"]}
                        value={activeTab}
                        onChange={setActiveTab}
                    />
                    {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--color-danger-bg)", color: T.danger, border: "1px solid var(--color-danger-border)" }}>
                            <AlertCircleIcon size={9} />
                            {overdueCount} overdue
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={refetch}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors"
                        style={{ border: `1px solid ${T.border}`, background: "transparent", color: T.body }}
                    >
                        <RefreshCwIcon size={12} /> Refresh
                    </button>
                    <button
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer text-white"
                        style={{ background: T.accent }}
                    >
                        <PlusIcon size={12} /> Add liability
                    </button>
                </div>
            </div>

            {/* ── Content ───────────────────────────────────────────────────── */}
            {activeTab === "overview"  && <OverviewContent  all={all} loading={loading} />}
            {activeTab === "loans"     && <LoansContent     all={all} loading={loading} />}
            {activeTab === "payables"  && <PayablesContent  all={all} loading={loading} />}
            {activeTab === "deposits"  && <DepositsContent  all={all} loading={loading} />}
        </div>
    );
}
