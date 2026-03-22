/**
 * tabs/OverviewTab.jsx
 *
 * Renders the "Overview" dashboard tab.
 * Pure presentational — receives all data via props, emits only navigation callbacks.
 * No hooks, no API calls, no date logic.
 *
 * Props:
 *   summary          object | null
 *   loadingSummary   boolean
 *   totals           { totalRevenue, totalExpenses, totalLiabilities, netCashFlow }
 *   netMargin        number
 *   chartData        array    — monthly data for primary period
 *   compareData      array    — monthly data for compare period
 *   comparisonStats  object | null
 *   loadingChart     boolean
 *   compareMode      boolean
 *   labelA           string
 *   labelB           string
 *   filterLabel      string
 *   ledgerEntries    array
 *   loadingLedger    boolean
 *   onViewLedger     () => void
 *   currentBSMonth   string | null  — from CURRENT_BS_MONTH_NAME
 */

import { Card, DarkCard, Lbl, Delta, Spark, Skeleton } from "../AccountingPrimitives";
import {
    RevExpChart,
    CashFlowArea,
    CompareChart,
    CompareStatStrip,
    RevenueStreamTable,
    Scorecard,
    BreakdownPills,
} from "../AccountingCharts";
import LedgerFeed from "../LedgerFeed";
import { fmtK, fmtN } from "../AccountingPage";

// Color tokens local to overview — no date math, safe here
const CHR = {
    revenueLight: "var(--color-info)",
    expenses: "var(--color-warning)",
};

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
    return (
        <div className="flex flex-col gap-4">

            {/* ── KPI cards row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">

                {/* Net Cash Position */}
                <DarkCard className="flex flex-col justify-between min-h-[148px]">
                    <Lbl light>Net Cash Position</Lbl>
                    {loadingSummary
                        ? <div className="h-[54px] rounded-lg bg-white/10 animate-pulse" />
                        : <>
                            <div
                                className="text-white leading-none font-bold tracking-tight"
                                style={{ fontSize: "clamp(28px,4vw,44px)", letterSpacing: "-0.02em", wordBreak: "break-all" }}
                            >
                                {totals.netCashFlow < 0 ? "−" : ""}₹{fmtK(Math.abs(totals.netCashFlow))}
                            </div>
                            <div className="text-[11px] mt-0.5 font-mono text-white/35">
                                ₹{fmtN(Math.abs(totals.netCashFlow))}
                            </div>
                        </>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Delta value={netMargin} label={`${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}% margin`} />
                        <span className="text-[11px] text-white/40">
                            {totals.netCashFlow >= 0 ? "Surplus" : "Deficit"}
                        </span>
                    </div>
                    <div className="mt-3 flex gap-4">
                        {[
                            { l: "Revenue", v: totals.totalRevenue, c: "#6EE7B7" },
                            { l: "Expenses", v: totals.totalExpenses, c: "#FCA5A5" },
                        ].map(x => (
                            <div key={x.l}>
                                <div className="text-[10px] mb-0.5 text-white/35">{x.l}</div>
                                <div className="text-sm font-bold" style={{ color: x.c }}>₹{fmtK(x.v)}</div>
                            </div>
                        ))}
                    </div>
                </DarkCard>

                {/* Total Revenue */}
                <Card className="flex flex-col min-h-[148px]">
                    <Lbl>Total Revenue</Lbl>
                    {loadingSummary ? <Skeleton h={40} /> : <>
                        <div
                            className="font-bold leading-none text-[var(--color-accent)] tracking-tight"
                            style={{ fontSize: "clamp(26px,3.5vw,40px)", letterSpacing: "-0.02em" }}
                        >
                            ₹{fmtK(totals.totalRevenue)}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 text-[var(--color-text-sub)]">
                            ₹{fmtN(totals.totalRevenue)}
                        </div>
                    </>}
                    <div className="mt-2.5">
                        <Spark data={chartData.map(d => ({ v: d.revenue ?? 0 }))} color={CHR.revenueLight} h={28} />
                    </div>
                    <div className="mt-2.5 flex-1">
                        <BreakdownPills
                            breakdown={summary?.incomeStreams?.breakdown?.slice(0, 3) ?? []}
                            loading={loadingSummary}
                        />
                    </div>
                </Card>

                {/* Total Expenses */}
                <Card className="flex flex-col min-h-[148px]">
                    <Lbl>Total Expenses</Lbl>
                    {loadingSummary ? <Skeleton h={40} /> : <>
                        <div
                            className="font-bold leading-none text-[var(--color-warning)] tracking-tight"
                            style={{ fontSize: "clamp(26px,3.5vw,40px)", letterSpacing: "-0.02em" }}
                        >
                            ₹{fmtK(totals.totalExpenses)}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 text-[var(--color-text-sub)]">
                            ₹{fmtN(totals.totalExpenses)}
                        </div>
                    </>}
                    <div className="mt-2.5">
                        <Spark data={chartData.map(d => ({ v: d.expenses ?? 0 }))} color={CHR.expenses} h={28} />
                    </div>
                    <div className="mt-2.5 flex-1">
                        <BreakdownPills
                            breakdown={summary?.expensesBreakdown?.slice(0, 3) ?? []}
                            loading={loadingSummary}
                        />
                    </div>
                </Card>

                {/* Outstanding Liabilities */}
                <Card className="flex flex-col min-h-[148px]">
                    <div className="flex items-start justify-between mb-1">
                        <Lbl className="mb-0">Outstanding Liabilities</Lbl>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] whitespace-nowrap shrink-0">
                            BALANCE SHEET
                        </span>
                    </div>
                    {loadingSummary ? <Skeleton h={40} /> : <>
                        <div
                            className="font-bold leading-none text-[var(--color-danger)] tracking-tight mt-2"
                            style={{ fontSize: "clamp(26px,3.5vw,40px)", letterSpacing: "-0.02em" }}
                        >
                            ₹{fmtK(totals.totalLiabilities)}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 text-[var(--color-text-sub)]">
                            ₹{fmtN(totals.totalLiabilities)}
                        </div>
                    </>}
                    <div className="mt-1 text-[11px] text-[var(--color-text-sub)]">
                        Deposits &amp; obligations held — not cash flow
                    </div>
                    <div className="mt-2.5 flex-1">
                        <BreakdownPills breakdown={summary?.liabilitiesBreakdown ?? []} loading={loadingSummary} />
                    </div>
                </Card>
            </div>

            {/* ── Compare chart + stat strip ──────────────────────────────── */}
            {compareMode && (
                <Card>
                    <CompareChartHeader labelA={labelA} labelB={labelB} />
                    <CompareChart data={compareData} loading={loadingChart} labelA={labelA} labelB={labelB} />
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

            {/* ── Cash Flow Trend + Financial Scorecard ───────────────────── */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_280px]">
                <Card>
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <Lbl className="mb-0.5">
                                {compareMode ? "Primary Period · Cash Flow" : "Cash Flow Trend"}
                            </Lbl>
                            <div className="text-[11px] text-[var(--color-text-sub)]">{filterLabel}</div>
                        </div>
                    </div>
                    <RevExpChart data={chartData} loading={loadingChart} currentMonth={currentBSMonth} />
                </Card>
                <Card>
                    <Lbl>Financial Scorecard</Lbl>
                    <Scorecard totals={totals} loading={loadingSummary} />
                </Card>
            </div>

            {/* ── Cash Flow Position + Revenue Streams ────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CashFlowAreaHeader />
                    <CashFlowArea data={chartData} loading={loadingChart} />
                </Card>
                <Card>
                    <Lbl>Revenue Streams</Lbl>
                    <RevenueStreamTable
                        breakdown={summary?.incomeStreams?.breakdown ?? []}
                        loading={loadingSummary}
                    />
                </Card>
            </div>

            {/* ── Recent Transactions ─────────────────────────────────────── */}
            <Card>
                <div className="flex justify-between items-center mb-3.5">
                    <Lbl className="mb-0">Recent Transactions</Lbl>
                    <button
                        onClick={onViewLedger}
                        className="text-xs font-bold bg-transparent border-none cursor-pointer text-[var(--color-accent)]"
                    >
                        View all →
                    </button>
                </div>
                <LedgerFeed entries={ledgerEntries} loading={loadingLedger} onViewAll={onViewLedger} />
            </Card>
        </div>
    );
}

// ─── Private sub-components (only used by OverviewTab) ────────────────────────

function CompareChartHeader({ labelA, labelB }) {
    const tokens = {
        revenueLight: "var(--color-info)",
        expenses: "var(--color-warning)",
    };
    return (
        <div className="flex items-center justify-between mb-3.5">
            <div>
                <Lbl className="mb-0.5">Period Comparison</Lbl>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold">
                        A: {labelA}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-weak)]">vs</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
                        B: {labelB}
                    </span>
                </div>
            </div>
            <div className="flex gap-3.5 flex-wrap">
                {[
                    { color: tokens.revenueLight, label: "Rev A" },
                    { color: `${tokens.revenueLight}55`, label: "Rev B" },
                    { color: tokens.expenses, label: "Exp A" },
                    { color: `${tokens.expenses}55`, label: "Exp B" },
                ].map(x => (
                    <div key={x.label} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-sub)]">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: x.color }} />
                        {x.label}
                    </div>
                ))}
            </div>
        </div>
    );
}

function CashFlowAreaHeader() {
    return (
        <div className="flex justify-between mb-2.5">
            <div>
                <Lbl className="mb-0.5">Cash Flow Position</Lbl>
                <div className="text-[11px] text-[var(--color-text-sub)]">Cumulative · monthly net overlay</div>
            </div>
            <div className="flex gap-2.5">
                {[
                    { c: "var(--color-accent)", l: "Cumulative" },
                    { c: "var(--color-warning)", l: "Net" },
                ].map(x => (
                    <div key={x.l} className="flex items-center gap-1 text-[10px] text-[var(--color-text-sub)]">
                        <span className="w-3.5 h-0.5 rounded-sm" style={{ background: x.c }} />
                        {x.l}
                    </div>
                ))}
            </div>
        </div>
    );
}