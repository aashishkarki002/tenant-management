/**
 * LiabilitiesPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated liabilities dashboard for EasyManage.
 * Mirrors the structure of AccountingPage (tab bar, filter bar, data hooks).
 *
 * Tabs:
 *   Overview   — KPI strip + category breakdown + aging chart
 *   Loans      — Per-loan repayment progress + EMI schedule
 *   Payables   — Vendor / salary / CAM / manual payables table
 *   Deposits   — Security deposit refund obligations per tenant
 *
 * Pure Tailwind — NO inline CSS except CSS variable references via style={{}}
 * where Tailwind has no class for a given CSS variable. All colours follow
 * the Petrol theme defined in components.md.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import SectionToggle from "../SectionToggle";
import {
    AlertCircleIcon,
    TrendingDownIcon,
    BuildingIcon,
    CreditCardIcon,
    UsersIcon,
    ChevronRightIcon,
    CheckCircle2Icon,
    ClockIcon,
    AlertTriangleIcon,
    BarChart3Icon,
    PrinterIcon,
    PlusIcon,
    ArrowDownRightIcon,
    RefreshCwIcon,
    FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../../plugins/axios";

// ─── Formatters (same as AccountingPage) ─────────────────────────────────────
const fmtK = (v) => {
    const a = Math.abs(v ?? 0), s = (v ?? 0) < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(2)} Cr`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(1)} L`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(0)}K`;
    return `${s}${a}`;
};

const fmtPaisa = (paisa = 0) => `₹${fmtK(paisa / 100)}`;

const pct = (part, total) =>
    total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0;

// ─── Status config ────────────────────────────────────────────────────────────
const LOAN_STATUS = {
    ACTIVE: {
        label: "Active",
        dot: "bg-[var(--color-info)]",
        badge: "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info-border)]",
    },
    CLOSED: {
        label: "Closed",
        dot: "bg-[var(--color-success)]",
        badge: "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]",
    },
    DEFAULTED: {
        label: "Defaulted",
        dot: "bg-[var(--color-danger)]",
        badge: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]",
    },
};

const REF_LABELS = {
    RENT_EXPENSE: "Rent",
    CAM: "CAM",
    SALARY: "Salary",
    MANUAL: "Manual",
    SECURITY_DEPOSIT: "Deposit",
    LOAN: "Loan",
};

// ─── Aging buckets ────────────────────────────────────────────────────────────
function agingBucket(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
    if (days <= 30) return { label: "0–30 days", color: "var(--color-success)" };
    if (days <= 60) return { label: "31–60 days", color: "var(--color-warning)" };
    if (days <= 90) return { label: "61–90 days", color: "var(--color-warning)" };
    return { label: "90+ days", color: "var(--color-danger)" };
}

// ─── Tabs config ──────────────────────────────────────────────────────────────
const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3Icon },
    { id: "loans", label: "Loans", icon: CreditCardIcon },
    { id: "payables", label: "Payables", icon: BuildingIcon },
    { id: "deposits", label: "Deposits", icon: UsersIcon },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return (
        <div className={cn("animate-pulse rounded-lg bg-[var(--color-muted)]", className)} />
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, loading }) {
    return (
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-weak)]">
                {label}
            </span>
            {loading ? (
                <Skeleton className="h-8 w-28" />
            ) : (
                <div className="text-[26px] font-black leading-none tracking-tight text-[var(--color-text-strong)]">
                    {value}
                </div>
            )}
            {sub && !loading && (
                <span className="text-[11px] text-[var(--color-text-sub)]">{sub}</span>
            )}
        </div>
    );
}

// ─── Category Pill ────────────────────────────────────────────────────────────
function CategoryRow({ label, amountPaisa, total, count }) {
    const ratio = pct(amountPaisa, total);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--color-text-body)]">{label}</span>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--color-text-sub)]">{count} items</span>
                    <span className="text-[13px] font-bold text-[var(--color-text-strong)] tabular-nums">
                        {fmtPaisa(amountPaisa)}
                    </span>
                </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                    style={{ width: `${ratio}%` }}
                />
            </div>
        </div>
    );
}

// ─── Loan Card ────────────────────────────────────────────────────────────────
function LoanCard({ loan }) {
    const status = LOAN_STATUS[loan.loanStatus] ?? LOAN_STATUS.ACTIVE;
    const repaid = loan.originalAmountPaisa
        ? loan.originalAmountPaisa - loan.amountPaisa
        : 0;
    const progress = loan.originalAmountPaisa
        ? pct(repaid, loan.originalAmountPaisa)
        : 0;

    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                        <CreditCardIcon size={15} className="text-[var(--color-accent)]" />
                    </div>
                    <div>
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">
                            {loan.notes || "Loan"}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-sub)]">
                            {loan.source?.name ?? "—"}
                        </div>
                    </div>
                </div>
                <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider", status.badge)}>
                    {status.label}
                </span>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
                {/* Amounts row */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-weak)] mb-0.5">
                            Original
                        </div>
                        <div className="text-[15px] font-black tabular-nums text-[var(--color-text-strong)]">
                            {fmtPaisa(loan.originalAmountPaisa ?? loan.amountPaisa)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-weak)] mb-0.5">
                            Repaid
                        </div>
                        <div className="text-[15px] font-black tabular-nums text-[var(--color-success)]">
                            {fmtPaisa(repaid)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-weak)] mb-0.5">
                            Outstanding
                        </div>
                        <div className="text-[15px] font-black tabular-nums text-[var(--color-danger)]">
                            {fmtPaisa(loan.amountPaisa)}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-[var(--color-text-sub)]">Repayment progress</span>
                        <span className="text-[11px] font-bold text-[var(--color-text-body)]">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${progress}%`,
                                background: progress >= 80
                                    ? "var(--color-success)"
                                    : progress >= 40
                                        ? "var(--color-info)"
                                        : "var(--color-warning)",
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Payable Row ──────────────────────────────────────────────────────────────
function PayableRow({ liability, index }) {
    const bucket = agingBucket(liability.date);
    const refLabel = REF_LABELS[liability.referenceType] ?? liability.referenceType;
    return (
        <tr
            className={cn(
                "border-b border-[var(--color-border)] transition-colors",
                "hover:bg-[var(--color-bg)]",
                index % 2 === 0 ? "bg-transparent" : "bg-[var(--color-surface)]",
            )}
        >
            <td className="px-4 py-3 text-[12px] font-semibold text-[var(--color-text-strong)]">
                {liability.payeeType === "TENANT"
                    ? liability.tenant?.name ?? "Tenant"
                    : liability.notes ?? "External"}
            </td>
            <td className="px-4 py-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                    {refLabel}
                </span>
            </td>
            <td className="px-4 py-3 text-[12px] tabular-nums font-bold text-[var(--color-danger)]">
                {fmtPaisa(liability.amountPaisa)}
            </td>
            <td className="px-4 py-3">
                <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                        background: bucket.color + "22",
                        color: bucket.color,
                        border: `1px solid ${bucket.color}55`,
                    }}
                >
                    {bucket.label}
                </span>
            </td>
            <td className="px-4 py-3 text-[11px] text-[var(--color-text-sub)]">
                {new Date(liability.date).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                })}
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

// ─── Deposit Row ──────────────────────────────────────────────────────────────
function DepositRow({ liability, index }) {
    return (
        <tr
            className={cn(
                "border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg)]",
                index % 2 === 0 ? "bg-transparent" : "bg-[var(--color-surface)]",
            )}
        >
            <td className="px-4 py-3 text-[12px] font-semibold text-[var(--color-text-strong)]">
                {liability.tenant?.name ?? "—"}
            </td>
            <td className="px-4 py-3 text-[11px] text-[var(--color-text-sub)]">
                {liability.tenant?.phone ?? "—"}
            </td>
            <td className="px-4 py-3 text-[12px] tabular-nums font-bold text-[var(--color-danger)]">
                {fmtPaisa(liability.amountPaisa)}
            </td>
            <td className="px-4 py-3 text-[11px] text-[var(--color-text-sub)]">
                {new Date(liability.date).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                })}
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

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ message = "No data yet", icon = "📋" }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3 opacity-40">{icon}</div>
            <div className="text-[14px] font-semibold text-[var(--color-text-body)] mb-1">{message}</div>
            <div className="text-[13px] text-[var(--color-text-sub)]">
                Nothing to display for the selected period.
            </div>
        </div>
    );
}

// ─── Hook: useLiabilities ─────────────────────────────────────────────────────
function useLiabilities() {
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/liabilities");
            setAll(res.data?.data ?? []);
        } catch (err) {
            console.error("[useLiabilities] fetch failed", err);
            setAll([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { all, loading, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTabContent({ all, loading }) {
    const totalPaisa = all.reduce((s, l) => s + l.amountPaisa, 0);

    // Category breakdown
    const byCategory = useMemo(() => {
        const map = {};
        for (const l of all) {
            const key = REF_LABELS[l.referenceType] ?? l.referenceType;
            if (!map[key]) map[key] = { count: 0, paisa: 0 };
            map[key].count += 1;
            map[key].paisa += l.amountPaisa;
        }
        return Object.entries(map)
            .sort((a, b) => b[1].paisa - a[1].paisa)
            .map(([label, { count, paisa }]) => ({ label, count, paisa }));
    }, [all]);

    // Aging breakdown
    const aging = useMemo(() => {
        const buckets = { "0–30 days": 0, "31–60 days": 0, "61–90 days": 0, "90+ days": 0 };
        for (const l of all) {
            const b = agingBucket(l.date).label;
            buckets[b] = (buckets[b] ?? 0) + l.amountPaisa;
        }
        return Object.entries(buckets).map(([label, paisa]) => ({ label, paisa }));
    }, [all]);

    const loans = all.filter(l => l.referenceType === "LOAN");
    const deposits = all.filter(l => l.referenceType === "SECURITY_DEPOSIT");
    const payables = all.filter(l => l.referenceType !== "LOAN" && l.referenceType !== "SECURITY_DEPOSIT");
    const overdueCount = all.filter(l => agingBucket(l.date).label === "90+ days").length;

    return (
        <div className="flex flex-col gap-5">
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Liabilities"
                    value={fmtPaisa(totalPaisa)}
                    sub={`${all.length} obligations`}
                    loading={loading}
                />
                <KpiCard
                    label="Loan Outstanding"
                    value={fmtPaisa(loans.reduce((s, l) => s + l.amountPaisa, 0))}
                    sub={`${loans.length} active loans`}
                    loading={loading}
                />
                <KpiCard
                    label="Deposit Obligations"
                    value={fmtPaisa(deposits.reduce((s, l) => s + l.amountPaisa, 0))}
                    sub={`${deposits.length} tenants`}
                    loading={loading}
                />
                <KpiCard
                    label="Overdue (90+ days)"
                    value={String(overdueCount)}
                    sub={overdueCount > 0 ? "Needs attention" : "All on track"}
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category breakdown */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--color-border)]">
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">By Category</div>
                        <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                            Where you owe the most
                        </div>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-4">
                        {loading && [1, 2, 3].map(i => (
                            <div key={i} className="flex flex-col gap-1.5">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-1.5 w-full" />
                            </div>
                        ))}
                        {!loading && byCategory.length === 0 && (
                            <EmptyState message="No liabilities recorded" icon="✅" />
                        )}
                        {!loading && byCategory.map(cat => (
                            <CategoryRow
                                key={cat.label}
                                label={cat.label}
                                amountPaisa={cat.paisa}
                                total={totalPaisa}
                                count={cat.count}
                            />
                        ))}
                    </div>
                </div>

                {/* Aging breakdown */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--color-border)]">
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">Aging Analysis</div>
                        <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                            How long you've owed
                        </div>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-5">
                        {aging.map(({ label, paisa }) => {
                            const colors = {
                                "0–30 days": "var(--color-success)",
                                "31–60 days": "var(--color-warning)",
                                "61–90 days": "var(--color-warning)",
                                "90+ days": "var(--color-danger)",
                            };
                            const color = colors[label] ?? "var(--color-info)";
                            const ratio = pct(paisa, totalPaisa);
                            return (
                                <div key={label} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span
                                            className="text-[12px] font-semibold"
                                            style={{ color }}
                                        >
                                            {label}
                                        </span>
                                        <span className="text-[13px] font-black tabular-nums text-[var(--color-text-strong)]">
                                            {fmtPaisa(paisa)}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${ratio}%`, background: color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Alert banner */}
                    {!loading && overdueCount > 0 && (
                        <div className="mx-5 mb-4 flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)]">
                            <AlertTriangleIcon size={14} className="text-[var(--color-danger)] shrink-0" />
                            <span className="text-[11px] font-semibold text-[var(--color-danger)]">
                                {overdueCount} obligation{overdueCount > 1 ? "s" : ""} past 90 days — take action soon.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick view: top payables */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
                    <div>
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">
                            Top Outstanding Payables
                        </div>
                        <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                            Largest unresolved obligations
                        </div>
                    </div>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                    {loading && [1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                    {!loading && payables.length === 0 && (
                        <EmptyState message="No payables" icon="✅" />
                    )}
                    {!loading && [...payables]
                        .sort((a, b) => b.amountPaisa - a.amountPaisa)
                        .slice(0, 6)
                        .map((l, i) => (
                            <div key={l._id ?? i} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-bg)] transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-[var(--color-accent-light)] flex items-center justify-center shrink-0">
                                        <ArrowDownRightIcon size={12} className="text-[var(--color-accent)]" />
                                    </div>
                                    <div>
                                        <div className="text-[12px] font-semibold text-[var(--color-text-strong)]">
                                            {l.notes || l.tenant?.name || "External"}
                                        </div>
                                        <div className="text-[10px] text-[var(--color-text-sub)]">
                                            {REF_LABELS[l.referenceType]}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[13px] font-black tabular-nums text-[var(--color-danger)]">
                                        {fmtPaisa(l.amountPaisa)}
                                    </span>
                                    <span
                                        className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: agingBucket(l.date).color + "22",
                                            color: agingBucket(l.date).color,
                                            border: `1px solid ${agingBucket(l.date).color}55`,
                                        }}
                                    >
                                        {agingBucket(l.date).label}
                                    </span>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOANS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LoansTabContent({ all, loading }) {
    const loans = all.filter(l => l.referenceType === "LOAN");

    const totalOutstanding = loans.reduce((s, l) => s + l.amountPaisa, 0);
    const totalOriginal = loans.reduce((s, l) => s + (l.originalAmountPaisa ?? l.amountPaisa), 0);
    const totalRepaid = totalOriginal - totalOutstanding;
    const overallProgress = pct(totalRepaid, totalOriginal);

    return (
        <div className="flex flex-col gap-5">
            {/* Summary banner */}
            <div className="flex flex-wrap gap-4 items-center justify-between px-5 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                style={{ borderLeftWidth: "3px", borderLeftColor: "var(--color-info)" }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-info)]">
                        <CreditCardIcon size={17} color="#fff" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-0.5">
                            Loan Portfolio
                        </div>
                        <div className="text-[13px] text-[var(--color-text-body)]">
                            {loans.length} loan{loans.length !== 1 ? "s" : ""} ·{" "}
                            <span className="font-bold text-[var(--color-text-strong)]">
                                {overallProgress}% repaid overall
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-weak)] mb-0.5">
                            Outstanding
                        </div>
                        <div className="text-[17px] font-black tabular-nums text-[var(--color-danger)]">
                            {fmtPaisa(totalOutstanding)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-weak)] mb-0.5">
                            Repaid
                        </div>
                        <div className="text-[17px] font-black tabular-nums text-[var(--color-success)]">
                            {fmtPaisa(totalRepaid)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Loan cards */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
                </div>
            )}
            {!loading && loans.length === 0 && (
                <EmptyState message="No loans recorded" icon="🏦" />
            )}
            {!loading && loans.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {loans.map((loan, i) => <LoanCard key={loan._id ?? i} loan={loan} />)}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYABLES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PayablesTabContent({ all, loading }) {
    const [filterType, setFilterType] = useState("ALL");
    const payables = all.filter(l => l.referenceType !== "LOAN" && l.referenceType !== "SECURITY_DEPOSIT");

    const types = useMemo(() => {
        const set = new Set(payables.map(l => l.referenceType));
        return ["ALL", ...set];
    }, [payables]);

    const filtered = filterType === "ALL"
        ? payables
        : payables.filter(l => l.referenceType === filterType);

    return (
        <div className="flex flex-col gap-4">
            {/* Type filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
                <FilterIcon size={12} className="text-[var(--color-text-sub)]" />
                {types.map(t => (
                    <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                            filterType === t
                                ? "bg-[var(--color-accent)] text-white"
                                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                        )}
                    >
                        {REF_LABELS[t] ?? t}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
                    <div>
                        <div className="text-[13px] font-bold text-[var(--color-text-strong)]">All Payables</div>
                        <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                            {filtered.length} records · {fmtPaisa(filtered.reduce((s, l) => s + l.amountPaisa, 0))} total
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

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[var(--color-bg)]">
                                {["Payee", "Type", "Amount", "Aging", "Date", "Status"].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-weak)] border-b border-[var(--color-border)]">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center">
                                        <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--color-text-sub)]">
                                            <RefreshCwIcon size={13} className="animate-spin" />
                                            Loading…
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState message="No payables found" icon="✅" />
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.map((l, i) => (
                                <PayableRow key={l._id ?? i} liability={l} index={i} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPOSITS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DepositsTabContent({ all, loading }) {
    const deposits = all.filter(l => l.referenceType === "SECURITY_DEPOSIT");
    const totalDeposit = deposits.reduce((s, l) => s + l.amountPaisa, 0);

    return (
        <div className="flex flex-col gap-4">
            {/* Info banner */}
            <div
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[var(--color-border)]"
                style={{ background: "var(--color-warning-bg)", borderLeftWidth: "3px", borderLeftColor: "var(--color-warning)" }}
            >
                <AlertCircleIcon size={15} className="text-[var(--color-warning)] shrink-0" />
                <span className="text-[12px] text-[var(--color-text-body)]">
                    Security deposits are refundable liabilities. Total obligation:{" "}
                    <span className="font-bold text-[var(--color-text-strong)]">{fmtPaisa(totalDeposit)}</span>
                </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)]">
                    <div className="text-[13px] font-bold text-[var(--color-text-strong)]">Deposit Obligations</div>
                    <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                        {deposits.length} tenants · {fmtPaisa(totalDeposit)} to be returned
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[var(--color-bg)]">
                                {["Tenant", "Phone", "Deposit Amount", "Date", "Status"].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-weak)] border-b border-[var(--color-border)]">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center">
                                        <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--color-text-sub)]">
                                            <RefreshCwIcon size={13} className="animate-spin" />
                                            Loading…
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && deposits.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState message="No deposit obligations" icon="✅" />
                                    </td>
                                </tr>
                            )}
                            {!loading && deposits.map((l, i) => (
                                <DepositRow key={l._id ?? i} liability={l} index={i} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function LiabilitiesTab() {
    const [activeTab, setActiveTab] = useState("overview");
    const { all, loading, refetch } = useLiabilities();

    const overdueCount = all.filter(l => agingBucket(l.date).label === "90+ days").length;

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="px-4 sm:px-7 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <div>
                    <div className="flex items-center gap-2.5 mb-0.5">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--color-danger)]">
                            <TrendingDownIcon size={13} color="#fff" />
                        </div>
                        <h1 className="text-[18px] font-black tracking-tight text-[var(--color-text-strong)]">
                            Liabilities
                        </h1>
                        {overdueCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]">
                                <AlertCircleIcon size={9} />
                                {overdueCount} overdue
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-[var(--color-text-sub)]">
                        Track loans, payables, and deposit obligations
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={refetch}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border border-[var(--color-border)] bg-transparent text-[12px] font-semibold cursor-pointer text-[var(--color-text-body)] hover:bg-[var(--color-bg)] transition-colors"
                    >
                        <RefreshCwIcon size={12} />
                        Refresh
                    </button>
                    <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[12px] font-bold cursor-pointer text-white transition-colors"
                        style={{ backgroundColor: "var(--color-accent)" }}>
                        <PlusIcon size={12} />
                        Add Liability
                    </button>
                </div>
            </div>

            {/* ── Sub-toggle ──────────────────────────────────────────────── */}
            <div className="px-4 sm:px-7 pt-4 pb-0">
                <SectionToggle
                    options={["Overview", "Loans", "Payables", "Deposits"]}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            {/* ── Tab content ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 px-4 sm:px-7 pb-10 pt-5">
                {activeTab === "overview" && <OverviewTabContent all={all} loading={loading} />}
                {activeTab === "loans" && <LoansTabContent all={all} loading={loading} />}
                {activeTab === "payables" && <PayablesTabContent all={all} loading={loading} />}
                {activeTab === "deposits" && <DepositsTabContent all={all} loading={loading} />}
            </div>
        </div>
    );
}