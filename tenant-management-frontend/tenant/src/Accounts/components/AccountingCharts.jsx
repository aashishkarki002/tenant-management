/**
 * AccountingCharts.jsx
 *
 * All chart and data-display components that were previously defined inline
 * inside AccountingPage.jsx. Extracted to this file so:
 *   • AccountingPage stays under 250 lines
 *   • Each chart can be tested and iterated independently
 *   • OverviewTab imports from one predictable location
 *
 * Exports:
 *   RevExpChart         — composed bar+line chart (revenue / expenses / net)
 *   CompareChart        — grouped bar chart for period A vs period B
 *   CashFlowArea        — area chart showing cumulative cash flow position
 *   CompareStatStrip    — 3-card stat strip shown below CompareChart
 *   RevenueStreamTable  — tabular breakdown of income streams with progress bars
 *   BreakdownPills      — compact dot-list used inside KPI cards
 *   Scorecard           — gauge + health metrics panel
 *
 * No date logic lives here. All components are purely presentational.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    ComposedChart, Bar, Line, BarChart, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
    TrendingUpIcon, TrendingDownIcon, MinusIcon,
    ArrowUpRightIcon, ArrowDownRightIcon,
} from "lucide-react";

import { Skeleton, ProgBar, Gauge, ChartTip } from "./AccountingPrimitives";
import { fmtK, fmtN } from "./AccountingPage";
import { toBSDate } from "../utils/nepaliCalendar";

// ─── Shared design tokens ─────────────────────────────────────────────────────
const CHR = {
    revenue: "var(--color-accent)",
    revenueLight: "var(--color-info)",
    expenses: "var(--color-warning)",
    net: "#10B981",
    positive: "var(--color-success)",
    negative: "var(--color-danger)",
    grid: "var(--color-border)",
    muted: "var(--color-text-sub)",
    violet: "#6D28D9",
    blue: "var(--color-info)",
};

// ═══════════════════════════════════════════════════════════════════════════════
// RevExpChart — composed bar + net line chart
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   data          { label, revenue, expenses }[]
 *   loading       boolean
 *   currentMonth  string | null  — highlights the current BS month on the X axis
 */
export function RevExpChart({ data = [], loading, currentMonth = null }) {
    const [logScale, setLogScale] = useState(false);

    const enriched = useMemo(() =>
        data.map(d => ({ ...d, net: (d.revenue ?? 0) - (d.expenses ?? 0) })),
        [data],
    );

    // Warn when one period is >5× the median — log scale becomes helpful
    const dominanceFlag = useMemo(() => {
        if (data.length < 2) return false;
        const vals = data.map(d => Math.max(d.revenue ?? 0, d.expenses ?? 0)).filter(v => v > 0);
        if (!vals.length) return false;
        const sorted = [...vals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return median > 0 && sorted[sorted.length - 1] > 5 * median;
    }, [data]);

    if (loading) return <Skeleton h={200} />;
    if (!data.length) return (
        <div className="flex flex-col items-center justify-center gap-1 border border-dashed border-[var(--color-border)] rounded-xl h-[200px]">
            <span className="text-[13px] font-semibold text-[var(--color-text-body)]">No data for selected period</span>
            <span className="text-[11px] text-[var(--color-text-sub)]">Select a quarter or custom range</span>
        </div>
    );

    const netVals = enriched.map(d => d.net);
    const netMin = Math.min(...netVals);
    const netMax = Math.max(...netVals);
    const netPad = Math.max(Math.abs(netMax - netMin) * 0.15, 1000);

    return (
        <div>
            {/* Log scale toggle — only shown when data is heavily skewed */}
            {dominanceFlag && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-[var(--color-text-sub)]">
                        ⚠ One period dominates — consider log scale
                    </span>
                    <button
                        onClick={() => setLogScale(p => !p)}
                        className={cn(
                            "text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer border transition-colors",
                            logScale
                                ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-transparent text-[var(--color-text-sub)]",
                        )}
                    >
                        {logScale ? "Linear" : "Log scale"}
                    </button>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
                {[
                    { color: CHR.revenue, label: "Revenue" },
                    { color: CHR.expenses, label: "Expenses" },
                    { color: CHR.net, label: "Net", dashed: true },
                ].map(x => (
                    <div key={x.label} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-sub)]">
                        <span
                            className="inline-block w-3 h-2 rounded-sm"
                            style={{ background: x.color, opacity: x.dashed ? 0.8 : 1 }}
                        />
                        {x.label}
                    </div>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                    data={enriched}
                    margin={{ top: 4, right: 12, left: -18, bottom: 0 }}
                    barCategoryGap="25%"
                    barGap={3}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHR.grid} strokeOpacity={0.5} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: CHR.muted }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={l => l === currentMonth ? `▸ ${l}` : l}
                    />
                    <YAxis
                        yAxisId="bars"
                        tickFormatter={fmtK}
                        tick={{ fontSize: 10, fill: CHR.muted }}
                        tickLine={false}
                        axisLine={false}
                        width={38}
                        scale={logScale ? "log" : "auto"}
                        domain={logScale ? ["auto", "auto"] : undefined}
                    />
                    <YAxis
                        yAxisId="net"
                        orientation="right"
                        tickFormatter={fmtK}
                        tick={{ fontSize: 10, fill: CHR.muted }}
                        tickLine={false}
                        axisLine={false}
                        width={38}
                        domain={[netMin - netPad, netMax + netPad]}
                    />
                    <ReferenceLine yAxisId="net" y={0} stroke={CHR.muted} strokeDasharray="4 3" strokeOpacity={0.5} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-surface)", opacity: 0.5, radius: 4 }} />
                    <Bar yAxisId="bars" dataKey="revenue" name="Revenue" fill={CHR.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.9} />
                    <Bar yAxisId="bars" dataKey="expenses" name="Expenses" fill={CHR.expenses} radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.9} />
                    <Line
                        yAxisId="net"
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke={CHR.net}
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={(props) => {
                            const { cx, cy, payload } = props;
                            return (
                                <circle
                                    key={`d-${cx}-${cy}`}
                                    cx={cx} cy={cy} r={3.5}
                                    fill={(payload.net ?? 0) >= 0 ? CHR.net : CHR.negative}
                                    stroke="none"
                                />
                            );
                        }}
                        activeDot={{ r: 5, fill: CHR.net, strokeWidth: 0 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CompareChart — grouped bars for period A vs period B
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   data    { labelA, revenueA, revenueB, expensesA, expensesB }[]
 *   loading boolean
 *   labelA  string
 *   labelB  string
 */
export function CompareChart({ data = [], loading, labelA, labelB }) {
    if (loading) return <Skeleton h={200} />;
    if (!data.length) return (
        <div className="flex items-center justify-center h-[200px] text-[13px] text-[var(--color-text-sub)]">
            No comparison data
        </div>
    );

    const plotData = data.map(d => ({ ...d, label: d.labelA ?? d.label }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart
                data={plotData}
                margin={{ top: 4, right: 0, left: -18, bottom: 0 }}
                barCategoryGap="20%"
                barGap={2}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHR.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHR.muted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: CHR.muted }} tickLine={false} axisLine={false} width={38} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-surface)", radius: 4 }} />
                <Bar dataKey="revenueA" name={`Rev · ${labelA ?? "A"}`} fill={CHR.revenueLight} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="revenueB" name={`Rev · ${labelB ?? "B"}`} fill={`${CHR.revenueLight}55`} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expensesA" name={`Exp · ${labelA ?? "A"}`} fill={CHR.expenses} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expensesB" name={`Exp · ${labelB ?? "B"}`} fill={`${CHR.expenses}55`} radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CashFlowArea — cumulative + monthly net area chart
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   data    { label, revenue, expenses }[]
 *   loading boolean
 */
export function CashFlowArea({ data = [], loading }) {
    const enriched = useMemo(() => {
        let cum = 0;
        return data.map(d => {
            const net = (d.revenue ?? 0) - (d.expenses ?? 0);
            cum += net;
            return { ...d, net, cumulative: cum };
        });
    }, [data]);

    if (loading) return <Skeleton h={140} />;
    if (!enriched.length) return (
        <div className="flex items-center justify-center h-[140px] text-[13px] text-[var(--color-text-sub)]">
            No data
        </div>
    );

    return (
        <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={enriched} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <defs>
                    <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHR.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHR.muted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: CHR.muted }} tickLine={false} axisLine={false} width={38} />
                <ReferenceLine y={0} stroke={CHR.muted} strokeDasharray="4 3" strokeOpacity={0.5} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: CHR.grid, strokeWidth: 1 }} />
                <Area
                    type="monotone" dataKey="cumulative" name="Cumulative"
                    stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#cumG)"
                    dot={false} activeDot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
                />
                <Area
                    type="monotone" dataKey="net" name="Monthly Net"
                    stroke="var(--color-warning)" strokeWidth={1.5} fill="none"
                    dot={false} activeDot={{ r: 3, fill: "var(--color-warning)", strokeWidth: 0 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CompareStatStrip — 3-card metrics row shown below CompareChart
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   stats    { revenue, expenses, netCashFlow } — each: { a, b, pct }
 *   labelA   string
 *   labelB   string
 *   loading  boolean
 */
export function CompareStatStrip({ stats, labelA, labelB, loading }) {
    if (loading) return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <Skeleton key={i} h={72} />)}
        </div>
    );
    if (!stats) return null;

    const items = [
        { key: "revenue", label: "Revenue", positive: true },
        { key: "expenses", label: "Expenses", positive: false },
        { key: "netCashFlow", label: "Net Cash Flow", positive: true },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {items.map(({ key, label, positive }) => {
                const s = stats[key] ?? {};
                const pct = s.pct ?? null;
                const isGood = positive ? (pct ?? 0) >= 0 : (pct ?? 0) <= 0;
                const TI = pct === null
                    ? MinusIcon
                    : pct >= 0 ? TrendingUpIcon : TrendingDownIcon;

                return (
                    <div
                        key={key}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
                    >
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5 text-[var(--color-text-sub)]">
                            {label}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div>
                                <div className="text-[10px] mb-0.5 text-[var(--color-text-sub)]">{labelA}</div>
                                <div className="text-[15px] font-bold text-[var(--color-text-strong)]">₹{fmtK(s.a ?? 0)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] mb-0.5 text-[var(--color-text-sub)]">{labelB}</div>
                                <div className="text-[15px] font-bold text-[var(--color-text-strong)]">₹{fmtK(s.b ?? 0)}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5">
                            <TI size={12} color={isGood ? "var(--color-success)" : "var(--color-danger)"} />
                            <span className={cn(
                                "text-xs font-bold",
                                isGood ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                            )}>
                                {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-sub)]">vs {labelB}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RevenueStreamTable — income stream breakdown with progress bars
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   breakdown  { name, code?, amount }[]
 *   loading    boolean
 */
export function RevenueStreamTable({ breakdown = [], loading }) {
    const total = breakdown.reduce((s, x) => s + (x.amount ?? 0), 0);
    const PALETTE = [CHR.revenueLight, CHR.expenses, CHR.blue, CHR.violet, "#0891B2"];

    if (loading) return (
        <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map(i => <Skeleton key={i} h={36} />)}
        </div>
    );
    if (!breakdown.length) return (
        <div className="py-5 text-center text-[13px] text-[var(--color-text-sub)]">No revenue streams</div>
    );

    return (
        <>
            {/* Header row */}
            <div
                className="grid pb-2 border-b border-[var(--color-border)] px-1"
                style={{ gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px" }}
            >
                {["Source", "Share", "Amount"].map(h => (
                    <span key={h} className="text-[10px] font-bold tracking-[0.06em] uppercase text-[var(--color-text-sub)]">
                        {h}
                    </span>
                ))}
            </div>

            {/* Data rows */}
            {breakdown.map((item, i) => (
                <div
                    key={item.code ?? i}
                    className="grid items-center px-1 py-2.5 border-b border-[var(--color-border)]/20"
                    style={{ gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px" }}
                >
                    <div>
                        <div className="text-[13px] font-semibold text-[var(--color-text-strong)]">{item.name}</div>
                        {item.code && <div className="text-[10px] text-[var(--color-text-sub)]">{item.code}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <ProgBar value={item.amount} max={total} color={PALETTE[i % PALETTE.length]} />
                        <span className="text-[11px] min-w-[26px] text-[var(--color-text-sub)]">
                            {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className="text-[13px] font-bold text-right text-[var(--color-text-strong)]">
                        ₹{fmtK(item.amount)}
                    </div>
                </div>
            ))}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BreakdownPills — compact dot-list used inside KPI summary cards
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   breakdown  { name, code?, amount }[]
 *   loading    boolean
 */
export function BreakdownPills({ breakdown = [], loading }) {
    const DOTS = ["var(--color-warning)", "var(--color-danger)", CHR.violet, "var(--color-info)"];

    if (loading) return <Skeleton h={56} />;
    if (!breakdown.length) return (
        <div className="text-xs text-[var(--color-text-sub)]">No breakdown data</div>
    );

    const total = breakdown.reduce((s, x) => s + x.amount, 0);

    return (
        <div className="flex flex-col gap-2">
            {breakdown.slice(0, 4).map((item, i) => (
                <div key={item.code ?? i} className="flex items-center gap-2.5">
                    <span
                        className="w-[7px] h-[7px] rounded-full shrink-0"
                        style={{ background: DOTS[i % 4] }}
                    />
                    <span className="text-[13px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--color-text-body)]">
                        {item.name}
                    </span>
                    <span className="text-xs font-bold shrink-0 text-[var(--color-text-strong)]">
                        ₹{fmtK(item.amount)}
                    </span>
                    <span className="text-[10px] min-w-[24px] text-right text-[var(--color-text-sub)]">
                        {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                    </span>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scorecard — gauge + net margin + health metrics
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   totals   { totalRevenue, totalExpenses, totalLiabilities, netCashFlow }
 *   loading  boolean
 */
export function Scorecard({ totals, loading }) {
    const {
        totalRevenue: rev = 0,
        totalExpenses: exp = 0,
        totalLiabilities: liab = 0,
        netCashFlow: net = 0,
    } = totals;

    const margin = rev > 0 ? (net / rev) * 100 : 0;
    const expRatio = rev > 0 ? (exp / rev) * 100 : 0;
    const coverage = liab > 0 && rev > 0 ? rev / liab : null;

    const statusLabel = margin >= 25 ? "Excellent" : margin >= 10 ? "On Track" : margin >= 0 ? "Watch" : "At Risk";
    const statusColor = margin >= 25
        ? "var(--color-success)"
        : margin >= 10 ? "var(--color-warning)"
            : margin >= 0 ? "var(--color-warning)"
                : "var(--color-danger)";
    const insight = margin >= 25 ? "Strong profitability. Expenses well controlled."
        : margin >= 10 ? "Healthy margin. Review expense growth."
            : margin >= 0 ? "Low margin. Prioritise expense reduction."
                : "Expenses exceed revenue. Action needed.";

    return (
        <div className="flex flex-col gap-4">

            {/* Gauge + margin */}
            <div className="flex flex-col items-center">
                <span
                    className="text-[10px] font-bold tracking-[0.06em] uppercase px-3 py-0.5 rounded-full mb-1"
                    style={{ color: statusColor, background: `${statusColor}18` }}
                >
                    {statusLabel}
                </span>
                <Gauge pct={Math.max(0, Math.min(1, margin / 40))} color={statusColor} />
                {loading ? <Skeleton h={28} /> : (
                    <div className="text-[30px] font-bold -mt-2 leading-none text-[var(--color-text-strong)]">
                        {margin.toFixed(1)}%
                    </div>
                )}
                <div className="text-[11px] mt-0.5 text-[var(--color-text-sub)]">Net Margin</div>
                <div className="flex items-center gap-3 mt-2">
                    {[
                        { l: "At Risk", c: "var(--color-danger)" },
                        { l: "Watch", c: "var(--color-warning)" },
                        { l: "Excellent", c: "var(--color-success)" },
                    ].map(x => (
                        <div key={x.l} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: x.c }} />
                            <span className="text-[9px] text-[var(--color-text-sub)]">{x.l}</span>
                        </div>
                    ))}
                </div>
                <div
                    className="mt-2 text-center text-[11px] px-3 py-1.5 rounded-lg w-full"
                    style={{ background: `${statusColor}10`, color: statusColor }}
                >
                    {insight}
                </div>
            </div>

            {/* Progress bars */}
            <div className="flex flex-col gap-2.5">
                {[
                    {
                        label: "Expense Ratio",
                        value: expRatio,
                        max: 100,
                        color: expRatio > 80 ? "var(--color-danger)" : "var(--color-warning)",
                        display: `${expRatio.toFixed(1)}%`,
                        benchmark: "target <20%",
                    },
                    {
                        label: "Revenue Retained",
                        value: Math.max(0, 100 - expRatio),
                        max: 100,
                        color: CHR.revenueLight,
                        display: `${Math.max(0, 100 - expRatio).toFixed(1)}%`,
                        benchmark: "target >80%",
                    },
                ].map(m => (
                    <div key={m.label}>
                        <div className="flex justify-between mb-1.5">
                            <div>
                                <span className="text-[11px] text-[var(--color-text-sub)]">{m.label}</span>
                                <span className="text-[9px] ml-1.5 text-[var(--color-text-sub)] opacity-60">{m.benchmark}</span>
                            </div>
                            <span className="text-[11px] font-bold text-[var(--color-text-strong)]">{m.display}</span>
                        </div>
                        <ProgBar value={m.value} max={m.max} color={m.color} />
                    </div>
                ))}

                {/* Liability coverage ratio */}
                {coverage !== null && (
                    <div className={cn(
                        "mt-0.5 px-3 py-2.5 rounded-xl",
                        coverage >= 1 ? "bg-[var(--color-success-bg)]" : "bg-[var(--color-danger-bg)]",
                    )}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className={cn(
                                    "text-[10px] font-bold tracking-[0.07em] uppercase",
                                    coverage >= 1 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                                )}>
                                    Liability Coverage
                                </div>
                                <div className="text-[9px] mt-0.5 text-[var(--color-text-sub)]">
                                    Revenue ÷ Liabilities · target &gt;1×
                                </div>
                            </div>
                            <div className={cn(
                                "text-2xl font-bold",
                                coverage >= 1 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                            )}>
                                {coverage.toFixed(2)}×
                            </div>
                        </div>
                        {coverage < 1 && (
                            <div className="mt-1.5 text-[10px] font-semibold text-[var(--color-danger)]">
                                ⚠ Revenue does not fully cover liabilities
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}