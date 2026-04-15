/**
 * CashFlowTab.jsx
 *
 * A formal cash flow statement for the selected period.
 * Shows where money entered and exited the system — grouped by
 * income stream / expense category — with a monthly trend at the bottom.
 *
 * Data comes entirely from props already fetched in AccountingPage:
 *   summary.incomeStreams.breakdown  → inflow rows
 *   summary.expensesBreakdown        → outflow rows
 *   totals                           → net / totals
 *   chartData                        → monthly trend bars
 */

import { useMemo } from "react";
import {
    ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Skeleton } from "../AccountingPrimitives";
import { fmtK, fmtN } from "../AccountingPage";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    inflow:  "var(--color-info)",
    outflow: "var(--color-warning)",
    net:     "var(--color-success)",
    netNeg:  "var(--color-danger)",
    border:  "var(--color-border)",
    surface: "var(--color-surface-raised)",
    sub:     "var(--color-text-sub)",
    body:    "var(--color-text-body)",
    strong:  "var(--color-text-strong)",
    muted:   "var(--color-muted)",
    bg:      "var(--color-bg)",
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
    return (
        <div
            className="text-[9px] font-bold tracking-[0.14em] uppercase mb-3"
            style={{ color: C.sub }}
        >
            {children}
        </div>
    );
}

function StatementRow({ label, amount, pct, color, isTotal = false, loading }) {
    if (loading) {
        return (
            <div className="flex items-center justify-between gap-4 py-2">
                <div className="h-3 w-32 rounded animate-pulse" style={{ background: C.muted }} />
                <div className="h-3 w-20 rounded animate-pulse" style={{ background: C.muted }} />
            </div>
        );
    }
    return (
        <div
            className={`flex items-center gap-3 py-2 ${isTotal ? "border-t mt-1" : ""}`}
            style={isTotal ? { borderColor: C.border } : {}}
        >
            {/* Progress track */}
            {!isTotal && (
                <div className="flex-1 max-w-[120px] overflow-hidden rounded-full" style={{ height: 2, background: C.border }}>
                    <div
                        style={{
                            height: "100%",
                            width: `${Math.min(pct, 100)}%`,
                            background: color,
                            borderRadius: 9999,
                            transition: "width .8s cubic-bezier(0.25,0.46,0.45,0.94)",
                        }}
                    />
                </div>
            )}

            <span
                className={`flex-1 truncate ${isTotal ? "font-bold text-[12px]" : "text-[11px] font-medium"}`}
                style={{ color: isTotal ? C.strong : C.body }}
            >
                {label}
            </span>

            <div className="text-right shrink-0">
                <div
                    className={`tabular-nums font-bold leading-none ${isTotal ? "text-[15px]" : "text-[12px]"}`}
                    style={{ color }}
                >
                    ₹{fmtK(Math.abs(amount))}
                </div>
                {!isTotal && (
                    <div className="text-[9px] mt-0.5 tabular-nums" style={{ color: C.sub }}>
                        ₹{fmtN(Math.abs(amount))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Waterfall chart ──────────────────────────────────────────────────────────
/**
 * Builds a simple stacked waterfall using a transparent base bar + a colored bar on top.
 * Recharts doesn't have a native waterfall, but this trick is clean and reliable.
 */
function WaterfallChart({ inflows, outflows, totalIn, totalOut, net, loading }) {
    const data = useMemo(() => {
        if (!totalIn && !totalOut) return [];

        const rows = [
            { label: "Total In", base: 0, value: totalIn, fill: C.inflow },
        ];

        // Each outflow category stacked going down from totalIn
        let cursor = totalIn;
        outflows.slice(0, 6).forEach(item => {
            const amt = item.amount ?? 0;
            cursor -= amt;
            rows.push({ label: item.name ?? item.label ?? "—", base: Math.max(cursor, 0), value: amt, fill: C.outflow });
        });

        rows.push({
            label: "Net",
            base: 0,
            value: Math.abs(net),
            fill: net >= 0 ? C.net : C.netNeg,
        });

        return rows;
    }, [inflows, outflows, totalIn, totalOut, net]);

    if (loading) return <Skeleton h={180} />;
    if (!data.length) return (
        <div className="flex items-center justify-center h-[180px] text-[12px]" style={{ color: C.sub }}>
            No data for selected period
        </div>
    );

    return (
        <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: C.sub, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tickFormatter={v => `₹${fmtK(v)}`}
                    tick={{ fontSize: 9, fill: C.sub }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const v = payload.find(p => p.dataKey === "value");
                        return (
                            <div
                                className="rounded-xl px-3.5 py-2.5"
                                style={{
                                    background: "linear-gradient(140deg,#0a2f46,#1a5276)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    minWidth: 130,
                                }}
                            >
                                <div className="text-[9px] font-bold tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,255,255,.38)" }}>
                                    {label}
                                </div>
                                <div className="text-[13px] font-black text-white tabular-nums">
                                    ₹{fmtN(v?.value ?? 0)}
                                </div>
                            </div>
                        );
                    }}
                />
                {/* Transparent base — positions each visible bar */}
                <Bar dataKey="base" stackId="w" fill="transparent" radius={0} />
                {/* Visible bar on top of the base */}
                <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} maxBarSize={52}>
                    {data.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                    ))}
                </Bar>
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// ─── Monthly trend chip ───────────────────────────────────────────────────────
function TrendChip({ chartData, loading }) {
    if (loading) return <Skeleton h={72} />;
    if (!chartData.length) return null;

    const netVals = chartData.map(d => (d.revenue ?? 0) - (d.expenses ?? 0));
    const positiveMonths = netVals.filter(v => v >= 0).length;

    return (
        <div className="flex items-center gap-4 flex-wrap">
            <div>
                <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: C.sub }}>Positive months</div>
                <div className="text-[22px] font-black leading-none tabular-nums" style={{ color: C.net }}>
                    {positiveMonths}<span className="text-[13px] font-semibold ml-0.5" style={{ color: C.sub }}>/{chartData.length}</span>
                </div>
            </div>
            <div className="w-px h-10 self-center" style={{ background: C.border }} />
            <div>
                <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: C.sub }}>Best month</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: C.inflow }}>
                    ₹{fmtK(Math.max(...chartData.map(d => d.revenue ?? 0)))}
                </div>
            </div>
            <div className="w-px h-10 self-center" style={{ background: C.border }} />
            <div>
                <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: C.sub }}>Highest spend</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: C.outflow }}>
                    ₹{fmtK(Math.max(...chartData.map(d => d.expenses ?? 0)))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CashFlowTab({
    summary,
    totals,
    filterLabel,
    loadingSummary,
    chartData = [],
    loadingChart,
}) {
    const inflows  = summary?.incomeStreams?.breakdown ?? [];
    const outflows = summary?.expensesBreakdown        ?? [];
    const { totalRevenue = 0, totalExpenses = 0, netCashFlow = 0 } = totals;
    const isDeficit = netCashFlow < 0;
    const netColor  = isDeficit ? C.netNeg : C.net;
    const margin    = totalRevenue > 0 ? ((netCashFlow / totalRevenue) * 100).toFixed(1) : "—";

    return (
        <div className="flex flex-col gap-4">

            {/* ── Period banner ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                    Cash Flow Statement
                </div>
                <div
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                >
                    {filterLabel}
                </div>
            </div>

            {/* ── Three-column net KPIs ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total Inflows", value: totalRevenue, color: C.inflow, icon: ArrowDownLeft },
                    { label: "Total Outflows", value: totalExpenses, color: C.outflow, icon: ArrowUpRight },
                    { label: `Net · ${isDeficit ? "Deficit" : "Surplus"}`, value: Math.abs(netCashFlow), color: netColor, icon: null, prefix: isDeficit ? "−" : "+" },
                ].map(({ label, value, color, icon: Icon, prefix = "" }) => (
                    <div
                        key={label}
                        className="rounded-2xl p-4 border"
                        style={{ background: C.surface, borderColor: C.border }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                                {label}
                            </div>
                            {Icon && <Icon size={13} style={{ color, opacity: 0.55 }} />}
                        </div>
                        {loadingSummary ? (
                            <Skeleton h={32} />
                        ) : (
                            <>
                                <div className="text-[22px] font-black tabular-nums leading-none" style={{ color }}>
                                    {prefix}₹{fmtK(value)}
                                </div>
                                <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: C.sub }}>
                                    ₹{fmtN(value)}
                                </div>
                            </>
                        )}
                        {label.startsWith("Net") && !loadingSummary && (
                            <div className="text-[10px] mt-1.5 font-semibold" style={{ color: netColor }}>
                                {margin}% net margin
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Statement + Waterfall side by side ───────────────────────── */}
            <div className="grid grid-cols-[1fr_340px] gap-4">

                {/* Left: formal statement */}
                <div
                    className="rounded-2xl border overflow-hidden"
                    style={{ background: C.surface, borderColor: C.border }}
                >
                    {/* Inflows section */}
                    <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowDownLeft size={12} style={{ color: C.inflow }} />
                            <SectionLabel>Cash Receipts (Inflows)</SectionLabel>
                        </div>
                        <div className="flex flex-col">
                            {loadingSummary
                                ? [1, 2, 3, 4].map(i => <StatementRow key={i} loading />)
                                : inflows.length === 0
                                    ? <div className="text-[11px] py-3" style={{ color: C.sub }}>No inflow data for this period</div>
                                    : inflows.map((item, i) => (
                                        <StatementRow
                                            key={item.name ?? i}
                                            label={item.name ?? item.label ?? "—"}
                                            amount={item.amount ?? 0}
                                            pct={item.pct ?? 0}
                                            color={C.inflow}
                                        />
                                    ))
                            }
                            <StatementRow
                                label="Total Inflows"
                                amount={totalRevenue}
                                color={C.inflow}
                                isTotal
                                loading={loadingSummary}
                            />
                        </div>
                    </div>

                    {/* Outflows section */}
                    <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowUpRight size={12} style={{ color: C.outflow }} />
                            <SectionLabel>Cash Disbursements (Outflows)</SectionLabel>
                        </div>
                        <div className="flex flex-col">
                            {loadingSummary
                                ? [1, 2, 3].map(i => <StatementRow key={i} loading />)
                                : outflows.length === 0
                                    ? <div className="text-[11px] py-3" style={{ color: C.sub }}>No expense data for this period</div>
                                    : outflows.map((item, i) => (
                                        <StatementRow
                                            key={item.name ?? item._id ?? i}
                                            label={item.name ?? item.label ?? "—"}
                                            amount={item.amount ?? 0}
                                            pct={item.pct ?? 0}
                                            color={C.outflow}
                                        />
                                    ))
                            }
                            <StatementRow
                                label="Total Outflows"
                                amount={totalExpenses}
                                color={C.outflow}
                                isTotal
                                loading={loadingSummary}
                            />
                        </div>
                    </div>

                    {/* Net row */}
                    <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ background: isDeficit ? "var(--color-danger-bg)" : "var(--color-success-bg)" }}
                    >
                        <div>
                            <div className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: netColor }}>
                                Net Cash Flow
                            </div>
                            <div className="text-[10px] mt-0.5" style={{ color: netColor, opacity: 0.65 }}>
                                {isDeficit ? "Outflows exceed inflows" : "Healthy surplus position"}
                            </div>
                        </div>
                        {loadingSummary ? (
                            <Skeleton h={28} />
                        ) : (
                            <div className="text-right">
                                <div className="text-[24px] font-black tabular-nums leading-none" style={{ color: netColor }}>
                                    {netCashFlow >= 0 ? "+" : "−"}₹{fmtK(Math.abs(netCashFlow))}
                                </div>
                                <div className="text-[10px] tabular-nums mt-0.5" style={{ color: netColor, opacity: 0.65 }}>
                                    ₹{fmtN(Math.abs(netCashFlow))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: waterfall chart */}
                <div
                    className="rounded-2xl border p-5 flex flex-col"
                    style={{ background: C.surface, borderColor: C.border }}
                >
                    <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                        Flow Breakdown
                    </div>
                    <div className="flex-1">
                        <WaterfallChart
                            inflows={inflows}
                            outflows={outflows}
                            totalIn={totalRevenue}
                            totalOut={totalExpenses}
                            net={netCashFlow}
                            loading={loadingSummary}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {[
                            { label: "Inflows", color: C.inflow },
                            { label: "Outflows", color: C.outflow },
                            { label: "Net", color: netColor },
                        ].map(x => (
                            <div key={x.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: C.sub }}>
                                <span className="w-2 h-2 rounded-sm" style={{ background: x.color }} />
                                {x.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Period trend stats ────────────────────────────────────────── */}
            <div
                className="rounded-2xl border px-5 py-4"
                style={{ background: C.surface, borderColor: C.border }}
            >
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                    Period Highlights
                </div>
                <TrendChip chartData={chartData} loading={loadingChart} />
            </div>
        </div>
    );
}
