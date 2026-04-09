import { Card, DarkCard, Lbl, Delta, Spark, Skeleton, ProgBar } from "../AccountingPrimitives";
import {
    RevExpChart,
    CompareChart,
    CompareStatStrip,
    RevenueStreamTable,
    BreakdownPills,
} from "../AccountingCharts";
import ChartCard from "../ChartCard";
import ProgressRow from "../ProgressRow";
import LedgerFeed from "../LedgerFeed";
import { fmtK, fmtN } from "../AccountingPage";
import { cn } from "@/lib/utils";

// ─── Local design tokens ──────────────────────────────────────────────────────
const T = {
    revenue: "var(--color-info)",
    expenses: "var(--color-warning)",
    liabilities: "var(--color-danger)",
};

// ─── Tiny sub-atoms used only in this file ─────────────────────────────────────
function HeroNumber({ value, loading }) {
    if (loading) return <Skeleton h={52} />;
    return (
        <div>
            <div
                className="text-white font-black leading-none tabular-nums"
                style={{
                    fontSize: "clamp(32px, 5vw, 52px)",
                    letterSpacing: "-0.035em",
                    wordBreak: "break-all",
                    textShadow: "0 2px 12px rgba(0,0,0,0.18)",
                }}
            >
                {value < 0 && "−"}₹{fmtK(Math.abs(value))}
            </div>
            <div className="text-[11px] mt-1 text-white/35 tabular-nums">
                ₹{fmtN(Math.abs(value))}
            </div>
        </div>
    );
}

function KpiNumber({ value, color, loading, size = "lg" }) {
    const sizes = {
        lg: "clamp(24px,3.5vw,38px)",
        md: "clamp(20px,2.8vw,30px)",
    };
    if (loading) return <Skeleton h={size === "lg" ? 38 : 30} />;
    return (
        <div>
            <div
                className="font-black leading-none tabular-nums"
                style={{
                    fontSize: sizes[size],
                    letterSpacing: "-0.03em",
                    color,
                }}
            >
                ₹{fmtK(value)}
            </div>
            <div
                className="text-[10px] mt-0.5 tabular-nums"
                style={{ color: "var(--color-text-sub)" }}
            >
                ₹{fmtN(value)}
            </div>
        </div>
    );
}

/** Inline revenue vs expenses bar — fills width proportionally */
function RevExpBar({ revenue, expenses }) {
    const total = (revenue ?? 0) + (expenses ?? 0);
    const revPct = total > 0 ? (revenue / total) * 100 : 50;
    return (
        <div className="flex gap-0.5 h-1 rounded-full overflow-hidden mt-3">
            <div
                className="rounded-l-full"
                style={{
                    width: `${revPct}%`,
                    background: "rgba(255,255,255,0.55)",
                    transition: "width .8s cubic-bezier(0.25,0.46,0.45,0.94)",
                }}
            />
            <div
                className="rounded-r-full flex-1"
                style={{ background: "rgba(255,255,255,0.15)" }}
            />
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function OverviewTab({
    summary,
    loadingSummary,
    totals,
    netMargin,
    chartData,
    compareData,
    comparisonStats,
    loadingChart,
    compareMode,
    labelA,
    labelB,
    filterLabel,
    ledgerEntries,
    loadingLedger,
    onViewLedger,
    currentBSMonth,
}) {
    const isDeficit = (totals.netCashFlow ?? 0) < 0;

    return (
        <div className="flex flex-col gap-4">

            {/* ══════════════════════════════════════════════════════════════
                TIER 1 — 2×2 KPI grid: hero (top-left) + 3 stat cards
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-4">

                {/* ── Hero: Net Cash Position ─────────────────────────────── */}
                <DarkCard className="flex flex-col justify-between min-h-[168px]">
                    {/* Label row */}
                    <div className="flex items-center justify-between">
                        <Lbl light className="mb-0">Net Cash Position</Lbl>
                        <span
                            className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                                isDeficit
                                    ? "bg-red-400/20 text-red-200"
                                    : "bg-white/15 text-white/70",
                            )}
                        >
                            {isDeficit ? "Deficit" : "Surplus"}
                        </span>
                    </div>

                    {/* Hero number */}
                    <HeroNumber value={totals.netCashFlow} loading={loadingSummary} />

                    {/* Margin pill + sub-line */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Delta
                            value={netMargin}
                            label={`${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}% margin`}
                        />
                        <span className="text-[11px] text-white/35">{filterLabel}</span>
                    </div>

                    {/* Rev vs Exp inline ratio bar */}
                    <RevExpBar
                        revenue={totals.totalRevenue}
                        expenses={totals.totalExpenses}
                    />

                    {/* Rev / Exp sub-row */}
                    <div className="flex gap-5 mt-2.5">
                        {[
                            { l: "Revenue", v: totals.totalRevenue, c: "rgba(110,231,183,0.9)" },
                            { l: "Expenses", v: totals.totalExpenses, c: "rgba(252,165,165,0.9)" },
                        ].map((x) => (
                            <div key={x.l}>
                                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">
                                    {x.l}
                                </div>
                                <div
                                    className="text-[13px] font-bold tabular-nums"
                                    style={{ color: x.c }}
                                >
                                    ₹{fmtK(x.v)}
                                </div>
                            </div>
                        ))}
                    </div>
                </DarkCard>

                {/* ── Revenue ────────────────────────────────────────────── */}
                <KpiCard
                    label="Total Revenue"
                    value={totals.totalRevenue}
                    loading={loadingSummary}
                    color={T.revenue}
                    sparkData={chartData.map((d) => ({ v: d.revenue ?? 0 }))}
                    sparkColor={T.revenue}
                    pills={summary?.incomeStreams?.breakdown?.slice(0, 3) ?? []}
                />

                {/* ── Expenses ───────────────────────────────────────────── */}
                <KpiCard
                    label="Total Expenses"
                    value={totals.totalExpenses}
                    loading={loadingSummary}
                    color={T.expenses}
                    sparkData={chartData.map((d) => ({ v: d.expenses ?? 0 }))}
                    sparkColor={T.expenses}
                    pills={summary?.expensesBreakdown?.slice(0, 3) ?? []}
                />

                {/* ── Liabilities ─────────────────────────────────────────── */}
                <KpiCard
                    label="Liabilities"
                    value={totals.totalLiabilities}
                    loading={loadingSummary}
                    color={T.liabilities}
                    badge={
                        <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] uppercase tracking-widest">
                            Balance Sheet
                        </span>
                    }
                    pills={summary?.liabilitiesBreakdown ?? []}
                    footnote="Deposits & obligations — not cash flow"
                />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                COMPARE MODE — period A vs B
            ══════════════════════════════════════════════════════════════ */}
            {compareMode && (
                <Card>
                    <CompareBanner labelA={labelA} labelB={labelB} />
                    <CompareChart
                        data={compareData}
                        loading={loadingChart}
                        labelA={labelA}
                        labelB={labelB}
                    />
                </Card>
            )}
            {compareMode && comparisonStats && (
                <CompareStatStrip
                    stats={comparisonStats}
                    labelA={labelA}
                    labelB={labelB}
                    loading={loadingChart}
                />
            )}

            {/* ══════════════════════════════════════════════════════════════
                TIER 2 — Cash Flow Trend chart (full width)
            ══════════════════════════════════════════════════════════════ */}
            <ChartCard
                title={compareMode ? "Primary Period · Cash Flow" : "Cash Flow Trend"}
                subtitle={filterLabel}
                actions={
                    <div className="flex gap-3.5">
                        {[
                            { c: T.revenue, l: "Revenue" },
                            { c: T.expenses, l: "Expenses" },
                        ].map((x) => (
                            <div key={x.l} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-sub)]">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: x.c }} />
                                {x.l}
                            </div>
                        ))}
                    </div>
                }
            >
                <RevExpChart data={chartData} loading={loadingChart} currentMonth={currentBSMonth} />
            </ChartCard>

            {/* ══════════════════════════════════════════════════════════════
                TIER 2b — Revenue Streams (55%) + Expense Breakdown (45%)
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-[55%_1fr] gap-4">
                <ChartCard title="Revenue Streams" subtitle={filterLabel}>
                    <RevenueStreamTable
                        breakdown={summary?.incomeStreams?.breakdown ?? []}
                        loading={loadingSummary}
                    />
                </ChartCard>

                <ChartCard title="Expense Breakdown">
                    {loadingSummary && (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <div className="h-3 w-full rounded animate-pulse bg-[var(--color-muted)]" />
                                    <div className="h-1.5 w-full rounded animate-pulse bg-[var(--color-muted)]" />
                                </div>
                            ))}
                        </div>
                    )}
                    {!loadingSummary && (summary?.expensesBreakdown ?? []).length === 0 && (
                        <div className="py-6 text-center text-[12px] text-[var(--color-text-sub)]">
                            No expense data for this period
                        </div>
                    )}
                    {!loadingSummary && (summary?.expensesBreakdown ?? []).map((item, i) => (
                        <ProgressRow
                            key={item.name ?? item._id ?? i}
                            label={item.name ?? item.label ?? "—"}
                            percent={Math.round(item.pct ?? 0)}
                            amount={`₹${fmtK(item.amount ?? 0)}`}
                            color="var(--color-warning)"
                        />
                    ))}
                </ChartCard>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TIER 3 — Recent Transactions
            ══════════════════════════════════════════════════════════════ */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <Lbl className="mb-0">Recent Transactions</Lbl>
                        <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                            Latest {Math.min(8, ledgerEntries.length)} entries
                        </div>
                    </div>
                    <button
                        onClick={onViewLedger}
                        className="text-[11px] font-bold bg-transparent border-none cursor-pointer text-[var(--color-accent)] hover:opacity-75 transition-opacity flex items-center gap-1"
                    >
                        View all ledger →
                    </button>
                </div>
                <LedgerFeed
                    entries={ledgerEntries}
                    loading={loadingLedger}
                    onViewAll={onViewLedger}
                />
            </Card>
        </div>
    );
}

// ─── Private sub-components ───────────────────────────────────────────────────

/** KPI card — used for Revenue, Expenses, Liabilities */
function KpiCard({
    label,
    value,
    loading,
    color,
    sparkData,
    sparkColor,
    pills = [],
    badge,
    footnote,
}) {
    return (
        <div
            className={cn(
                "rounded-2xl bg-[var(--color-surface-raised)] p-5 flex flex-col min-h-[168px]",
                "border border-[var(--color-border)]/50",
                "shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]",
                "transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)]",
            )}
        >
            {/* Label row */}
            <div className="flex items-center justify-between mb-2">
                <Lbl className="mb-0">{label}</Lbl>
                {badge}
            </div>

            {/* Primary number */}
            <KpiNumber value={value} color={color} loading={loading} />

            {/* Sparkline */}
            {sparkData && (
                <div className="mt-2.5 -mx-1">
                    <Spark data={sparkData} color={sparkColor} h={28} />
                </div>
            )}

            {/* Breakdown pills */}
            {pills.length > 0 && (
                <div className="mt-2.5 flex-1">
                    <BreakdownPills breakdown={pills} loading={loading} />
                </div>
            )}

            {/* Footnote */}
            {footnote && (
                <div className="mt-2 text-[10px] text-[var(--color-text-sub)] leading-tight">
                    {footnote}
                </div>
            )}
        </div>
    );
}

function CompareBanner({ labelA, labelB }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <Lbl className="mb-0.5">Period Comparison</Lbl>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold">
                        A: {labelA}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-sub)]">vs</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
                        B: {labelB}
                    </span>
                </div>
            </div>
            <div className="flex gap-3.5 flex-wrap">
                {[
                    { c: "var(--color-info)", l: "Rev A" },
                    { c: "var(--color-info)", l: "Rev B", op: "0.4" },
                    { c: "var(--color-warning)", l: "Exp A" },
                    { c: "var(--color-warning)", l: "Exp B", op: "0.4" },
                ].map((x) => (
                    <div
                        key={x.l}
                        className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-sub)]"
                        style={{ opacity: x.op ?? 1 }}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: x.c }}
                        />
                        {x.l}
                    </div>
                ))}
            </div>
        </div>
    );
}

