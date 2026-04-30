/**
 * ProfitLossTab.jsx
 *
 * Formal Income Statement (P&L) for the selected filter period.
 *
 *   Gross Revenue
 *   − Operating Expenses  (Maintenance + Utilities + Salary + Other)
 *   = Operating Profit (EBIT / NOI)
 *   − Interest Expense   (Loan interest payments)
 *   = Net Income
 *
 * Data is fetched via useProfitLoss hook → GET /api/accounting/profit-loss.
 */

import { useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    TrendingUp, TrendingDown, Minus,
    ChevronRight, AlertCircle,
} from "lucide-react";
import { useProfitLoss } from "../../hooks/useProfitLoss";
import { Skeleton } from "../AccountingPrimitives";
import { fmtK, fmtN } from "../AccountingPage";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    revenue:   "var(--color-info)",
    opEx:      "var(--color-warning)",
    ebit:      "#6c63ff",
    interest:  "var(--color-danger)",
    net:       "var(--color-success)",
    netNeg:    "var(--color-danger)",
    border:    "var(--color-border)",
    surface:   "var(--color-surface-raised)",
    sub:       "var(--color-text-sub)",
    body:      "var(--color-text-body)",
    strong:    "var(--color-text-strong)",
    muted:     "var(--color-muted)",
    bg:        "var(--color-bg)",
    accent:    "var(--color-accent)",
    accentBg:  "var(--color-accent-light)",
};

// ─── Small primitives ─────────────────────────────────────────────────────────

function SectionHeader({ children }) {
    return (
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: C.sub }}>
            {children}
        </div>
    );
}

function PLRow({ label, amount, pct, color, indent = false, isSubtotal = false, isTotal = false, loading, note }) {
    if (loading) {
        return (
            <div className="flex items-center justify-between gap-4 py-2">
                <div className="h-3 w-36 rounded animate-pulse" style={{ background: C.muted }} />
                <div className="h-3 w-20 rounded animate-pulse" style={{ background: C.muted }} />
            </div>
        );
    }
    return (
        <div
            className={`flex items-center gap-3 py-[7px] ${isTotal || isSubtotal ? "border-t" : ""}`}
            style={isTotal || isSubtotal ? { borderColor: C.border } : {}}
        >
            {indent && <ChevronRight size={11} style={{ color: C.sub, flexShrink: 0 }} />}
            {!indent && !isTotal && !isSubtotal && pct != null && (
                <div className="w-[80px] overflow-hidden rounded-full flex-shrink-0" style={{ height: 2, background: C.border }}>
                    <div style={{ height: "100%", width: `${Math.min(Math.abs(pct), 100)}%`, background: color, borderRadius: 9999 }} />
                </div>
            )}
            <span
                className={`flex-1 truncate ${isTotal ? "font-black text-[13px]" : isSubtotal ? "font-bold text-[12px]" : "text-[11px] font-medium"}`}
                style={{ color: isTotal ? C.strong : C.body }}
            >
                {label}
                {note && <span className="ml-2 text-[9px] font-normal" style={{ color: C.sub }}>{note}</span>}
            </span>
            {amount != null && (
                <div className="text-right shrink-0">
                    <div
                        className={`tabular-nums font-bold ${isTotal ? "text-[16px]" : isSubtotal ? "text-[14px]" : "text-[12px]"}`}
                        style={{ color }}
                    >
                        {amount < 0 ? "−" : ""}RS {fmtK(Math.abs(amount))}
                    </div>
                    {!isTotal && (
                        <div className="text-[9px] tabular-nums" style={{ color: C.sub }}>
                            RS {fmtN(Math.abs(amount))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function YoYBadge({ pct, inverse = false }) {
    if (pct == null) return null;
    const good = inverse ? pct <= 0 : pct >= 0;
    const Icon = pct === 0 ? Minus : good ? TrendingUp : TrendingDown;
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
                background: good ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                color:      good ? "var(--color-success)"    : "var(--color-danger)",
            }}
        >
            <Icon size={10} />
            {Math.abs(pct).toFixed(1)}% YoY
        </span>
    );
}

function KpiCard({ label, value, margin, yoyPct, color, loading, isNeg = false, inverse = false }) {
    return (
        <div className="rounded-2xl p-4 border flex flex-col gap-2" style={{ background: C.surface, borderColor: C.border }}>
            <div className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>{label}</div>
            {loading ? <Skeleton h={36} /> : (
                <>
                    <div className="text-[22px] font-black tabular-nums leading-none" style={{ color }}>
                        {isNeg ? "−" : ""}RS {fmtK(Math.abs(value ?? 0))}
                    </div>
                    {margin != null && (
                        <div className="text-[10px] font-semibold" style={{ color }}>
                            {margin.toFixed(1)}% margin
                        </div>
                    )}
                    <YoYBadge pct={yoyPct} inverse={inverse} />
                </>
            )}
        </div>
    );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function PLWaterfallChart({ data, loading }) {
    if (loading) return <Skeleton h={200} />;
    if (!data?.length) return null;

    const chartData = data.map(d => ({
        ...d,
        absValue: Math.abs(d.value),
        fill: d.color,
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `RS ${fmtK(v)}`} tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                            <div className="rounded-xl px-3 py-2" style={{ background: "var(--color-surface-invert)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 130 }}>
                                <div className="text-[9px] font-bold uppercase mb-1" style={{ color: "rgba(255,255,255,.45)" }}>{d.label}</div>
                                <div className="text-[13px] font-black text-white tabular-nums">RS {fmtN(d.absValue)}</div>
                            </div>
                        );
                    }}
                />
                <Bar dataKey="absValue" radius={[4, 4, 0, 0]} maxBarSize={56}
                    fill={C.revenue}
                    isAnimationActive
                    label={false}
                >
                    {chartData.map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function MonthlyTrendChart({ monthlyTrend = [], loading }) {
    if (loading) return <Skeleton h={180} />;
    if (!monthlyTrend.length) return null;

    const chartData = monthlyTrend.map(m => ({
        label: m.label,
        Revenue: m.revenue ?? 0,
        Expenses: m.expenses ?? 0,
        Net: (m.revenue ?? 0) - (m.expenses ?? 0),
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="plRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={C.revenue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="plExpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.opEx} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={C.opEx} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `RS ${fmtK(v)}`} tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                    cursor={{ stroke: C.accent, strokeWidth: 1, strokeDasharray: "4 2" }}
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                            <div className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: "var(--color-surface-invert)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 140 }}>
                                <div className="text-[9px] font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
                                {payload.map(p => (
                                    <div key={p.dataKey} className="flex justify-between gap-4 font-semibold" style={{ color: p.color }}>
                                        <span>{p.dataKey}</span>
                                        <span className="tabular-nums">RS {fmtK(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    }}
                />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
                <Area type="monotone" dataKey="Revenue"  stroke={C.revenue} strokeWidth={1.5} fill="url(#plRevGrad)" dot={false} />
                <Area type="monotone" dataKey="Expenses" stroke={C.opEx}    strokeWidth={1.5} fill="url(#plExpGrad)" dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProfitLossTab({ filterProps, filterLabel }) {
    const { selectedQuarter, selectedMonth, fiscalYear, customStartDate, customEndDate, entityId } = filterProps;

    const { data, loading, error } = useProfitLoss(
        selectedQuarter,
        customStartDate ?? "",
        customEndDate   ?? "",
        selectedMonth,
        fiscalYear,
        entityId,
    );

    // ── Waterfall chart rows ──────────────────────────────────────────────────
    const waterfallData = useMemo(() => {
        if (!data) return [];
        return [
            { label: "Revenue",     value: data.revenue.totalRupees,      color: C.revenue  },
            { label: "Operating\nEx.", value: -(data.expenses.operatingRupees ?? 0), color: C.opEx   },
            { label: "EBIT",        value: data.ebit.rupees,              color: C.ebit     },
            { label: "Interest",    value: -(data.expenses.interestRupees ?? 0),     color: C.interest },
            { label: "Net Income",  value: data.netIncome.rupees,          color: data.netIncome.rupees >= 0 ? C.net : C.netNeg },
        ];
    }, [data]);

    const cmp       = data?.comparison;
    const isProfit  = (data?.netIncome?.rupees ?? 0) >= 0;
    const netColor  = isProfit ? C.net : C.netNeg;

    if (error) {
        return (
            <div className="flex items-center gap-2 p-6 rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
                <AlertCircle size={16} style={{ color: C.netNeg }} />
                <span className="text-[12px]" style={{ color: C.body }}>Could not load P&L data. Please try refreshing.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">

            {/* ── Period banner ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                    Profit & Loss Statement
                </div>
                <div className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: C.accentBg, color: C.accent }}>
                    {filterLabel}
                </div>
                {cmp && (
                    <div className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: C.border, color: C.sub }}>
                        vs FY {cmp.prevFiscalYear}
                    </div>
                )}
            </div>

            {/* ── KPI row ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                    label="Gross Revenue"
                    value={data?.revenue?.totalRupees}
                    margin={null}
                    yoyPct={cmp?.revenuePct}
                    color={C.revenue}
                    loading={loading}
                />
                <KpiCard
                    label="Operating Expenses"
                    value={data?.expenses?.operatingRupees}
                    margin={null}
                    yoyPct={cmp?.expensesPct}
                    color={C.opEx}
                    loading={loading}
                    inverse
                />
                <KpiCard
                    label="EBIT / NOI"
                    value={Math.abs(data?.ebit?.rupees ?? 0)}
                    margin={data?.ebit?.marginPct}
                    yoyPct={null}
                    color={C.ebit}
                    loading={loading}
                    isNeg={(data?.ebit?.rupees ?? 0) < 0}
                />
                <KpiCard
                    label={isProfit ? "Net Income" : "Net Loss"}
                    value={Math.abs(data?.netIncome?.rupees ?? 0)}
                    margin={data?.netIncome?.marginPct}
                    yoyPct={cmp?.netPct}
                    color={netColor}
                    loading={loading}
                    isNeg={!isProfit}
                />
            </div>

            {/* ── Statement + Waterfall ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

                {/* Left: formal P&L statement */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: C.surface, borderColor: C.border }}>

                    {/* Revenue section */}
                    <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: C.border }}>
                        <SectionHeader>Revenue</SectionHeader>
                        {loading
                            ? [1, 2, 3].map(i => <PLRow key={i} loading />)
                            : (data?.revenue?.breakdown ?? []).map((item, i) => (
                                <PLRow key={item.code ?? i}
                                    label={item.name}
                                    amount={item.amount}
                                    pct={data.revenue.totalRupees > 0 ? (item.amount / data.revenue.totalRupees) * 100 : 0}
                                    color={C.revenue}
                                />
                            ))
                        }
                        <PLRow label="Total Revenue" amount={data?.revenue?.totalRupees} color={C.revenue} isSubtotal loading={loading} />
                    </div>

                    {/* Operating Expenses */}
                    <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: C.border }}>
                        <SectionHeader>Operating Expenses</SectionHeader>
                        {[
                            { key: "maintenancePaisa", label: "Maintenance" },
                            { key: "utilityPaisa",     label: "Utilities" },
                            { key: "salaryPaisa",      label: "Staff Salary" },
                            { key: "manualPaisa",      label: "Other / Manual" },
                        ].map(({ key, label }) => {
                            const paisa = data?.expenses?.[key] ?? 0;
                            const rupees = paisa / 100;
                            if (!loading && rupees === 0) return null;
                            return (
                                <PLRow key={key}
                                    label={label}
                                    amount={rupees}
                                    pct={data?.expenses?.operatingPaisa > 0 ? (paisa / data.expenses.operatingPaisa) * 100 : 0}
                                    color={C.opEx}
                                    loading={loading}
                                />
                            );
                        })}
                        <PLRow label="Total Operating Expenses" amount={data?.expenses?.operatingRupees} color={C.opEx} isSubtotal loading={loading} />
                    </div>

                    {/* EBIT line */}
                    <div className="px-5 py-3 border-b" style={{ borderColor: C.border, background: "rgba(108,99,255,0.04)" }}>
                        <PLRow
                            label="Operating Profit (EBIT / NOI)"
                            amount={data?.ebit?.rupees}
                            color={C.ebit}
                            isTotal
                            loading={loading}
                            note={data ? `${data.ebit.marginPct}% margin` : undefined}
                        />
                    </div>

                    {/* Interest expense */}
                    {(!loading && (data?.expenses?.interestPaisa ?? 0) > 0) && (
                        <div className="px-5 py-3 border-b" style={{ borderColor: C.border }}>
                            <SectionHeader>Below Operating Line</SectionHeader>
                            <PLRow
                                label="Interest Expense (Loan Payments)"
                                amount={data.expenses.interestRupees}
                                color={C.interest}
                                loading={loading}
                                note="excluded from NOI"
                            />
                        </div>
                    )}

                    {/* Net Income */}
                    <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ background: isProfit ? "var(--color-success-bg)" : "var(--color-danger-bg)" }}
                    >
                        <div>
                            <div className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: netColor }}>
                                {isProfit ? "Net Income" : "Net Loss"}
                            </div>
                            <div className="text-[10px] mt-0.5" style={{ color: netColor, opacity: 0.7 }}>
                                {isProfit ? "Profitable period" : "Expenses exceed revenue"}
                            </div>
                        </div>
                        {loading ? <Skeleton h={28} /> : (
                            <div className="text-right">
                                <div className="text-[26px] font-black tabular-nums leading-none" style={{ color: netColor }}>
                                    {isProfit ? "+" : "−"}RS {fmtK(Math.abs(data?.netIncome?.rupees ?? 0))}
                                </div>
                                <div className="text-[10px] tabular-nums mt-0.5 font-semibold" style={{ color: netColor, opacity: 0.7 }}>
                                    {data?.netIncome?.marginPct?.toFixed(1)}% net margin
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: waterfall + expense ratio */}
                <div className="flex flex-col gap-3">
                    <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                        <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                            Income Waterfall
                        </div>
                        <PLWaterfallChart data={waterfallData} loading={loading} />
                    </div>

                    {/* Ratio summary */}
                    <div className="rounded-2xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
                        <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: C.sub }}>Key Ratios</div>
                        {[
                            { label: "Expense Ratio",   value: data?.expenseRatioPct,        suffix: "%", good: v => v < 70,  bad: v => v > 90  },
                            { label: "EBIT Margin",     value: data?.ebit?.marginPct,         suffix: "%", good: v => v > 20,  bad: v => v < 0   },
                            { label: "Net Margin",      value: data?.netIncome?.marginPct,    suffix: "%", good: v => v > 15,  bad: v => v < 0   },
                        ].map(({ label, value, suffix, good, bad }) => {
                            const color = loading || value == null ? C.sub : bad(value) ? C.netNeg : good(value) ? C.net : C.opEx;
                            return (
                                <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: C.border }}>
                                    <span className="text-[11px]" style={{ color: C.body }}>{label}</span>
                                    {loading ? <div className="h-3 w-12 rounded animate-pulse" style={{ background: C.muted }} /> : (
                                        <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
                                            {value != null ? `${value.toFixed(1)}${suffix}` : "—"}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Monthly trend ─────────────────────────────────────────────── */}
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                    Monthly Revenue vs Expenses
                </div>
                <MonthlyTrendChart monthlyTrend={data?.monthlyTrend} loading={loading} />
            </div>

        </div>
    );
}
