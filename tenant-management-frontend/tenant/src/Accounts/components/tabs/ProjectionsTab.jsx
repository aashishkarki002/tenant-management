/**
 * ProjectionsTab.jsx
 *
 * 6-month forward projections based on linear regression over the
 * last 12 months of actual data.
 *
 * Data: GET /api/accounting/projections
 * Scenarios: base (regression), optimistic (+15% rev / −8% exp), pessimistic (−15% / +8%)
 */

import { useState } from "react";
import {
    ComposedChart, Area, Line, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
    Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Zap } from "lucide-react";
import { useProjections } from "../../hooks/useProjections";
import { Skeleton } from "../AccountingPrimitives";
import { fmtK } from "../../../utils/formatter";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    revenue:     "var(--color-info)",
    expenses:    "var(--color-warning)",
    net:         "var(--color-success)",
    netNeg:      "var(--color-danger)",
    projected:   "#6c63ff",
    optimistic:  "var(--color-success)",
    pessimistic: "var(--color-danger)",
    border:      "var(--color-border)",
    surface:     "var(--color-surface-raised)",
    sub:         "var(--color-text-sub)",
    body:        "var(--color-text-body)",
    strong:      "var(--color-text-strong)",
    muted:       "var(--color-muted)",
    accent:      "var(--color-accent)",
    accentBg:    "var(--color-accent-light)",
};

const SCENARIOS = [
    { key: "base",        label: "Base",        color: C.projected,   desc: "Pure regression trend" },
    { key: "optimistic",  label: "Optimistic",  color: C.optimistic,  desc: "+15% revenue / −8% expenses" },
    { key: "pessimistic", label: "Pessimistic", color: C.pessimistic, desc: "−15% revenue / +8% expenses" },
];

// ─── Chart data builder ───────────────────────────────────────────────────────

function buildChartData(historical, projected, scenario) {
    const hist = (historical ?? []).map(m => ({
        label:    m.label,
        key:      m.key,
        revenue:  m.revenue  ?? 0,
        expenses: m.expenses ?? 0,
        net:      (m.revenue ?? 0) - (m.expenses ?? 0),
        type:     "actual",
    }));

    const proj = (projected ?? []).map(m => ({
        label:    m.label,
        key:      m.key,
        revenue:  m[scenario]?.revenue  ?? 0,
        expenses: m[scenario]?.expenses ?? 0,
        net:      m[scenario]?.net      ?? 0,
        type:     "projected",
    }));

    return [...hist, ...proj];
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
    return <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: C.sub }}>{children}</div>;
}

function StatCard({ label, value, suffix = "", color, sub, loading }) {
    return (
        <div className="rounded-2xl border p-4 flex flex-col gap-1.5" style={{ background: C.surface, borderColor: C.border }}>
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase" style={{ color: C.sub }}>{label}</div>
            {loading ? <Skeleton h={28} /> : (
                <div className="text-[22px] font-black tabular-nums leading-none" style={{ color }}>
                    {value ?? "—"}{suffix}
                </div>
            )}
            {sub && !loading && <div className="text-[9px]" style={{ color: C.sub }}>{sub}</div>}
        </div>
    );
}

function ModelBadge({ r2, dataPoints }) {
    const quality = r2 >= 0.8 ? "High confidence" : r2 >= 0.5 ? "Moderate confidence" : "Low confidence";
    const color   = r2 >= 0.8 ? C.net : r2 >= 0.5 ? "var(--color-warning)" : "var(--color-danger)";
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px]"
            style={{ borderColor: C.border, color: C.sub, background: C.surface }}>
            <Zap size={10} style={{ color }} />
            <span className="font-semibold" style={{ color }}>{quality}</span>
            <span>·</span>
            <span>R² = {r2?.toFixed(2)}</span>
            <span>·</span>
            <span>{dataPoints} data points</span>
        </div>
    );
}

function ProjectionChart({ historical, projected, scenario, loading }) {
    if (loading) return <Skeleton h={280} />;
    const data = buildChartData(historical, projected, scenario);
    const splitIdx = (historical?.length ?? 0) - 1;

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="projRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={C.revenue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="projExpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.expenses} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={C.expenses} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `RS ${fmtK(v)}`} tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                    cursor={{ stroke: C.accent, strokeWidth: 1, strokeDasharray: "4 2" }}
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const isProj = payload[0]?.payload?.type === "projected";
                        return (
                            <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--color-surface-invert)", border: "1px solid rgba(255,255,255,.08)", minWidth: 150 }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="text-[9px] font-bold uppercase" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
                                    {isProj && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: C.projected, color: "#fff" }}>PROJECTED</span>}
                                </div>
                                {payload.filter(p => p.value != null && p.value !== 0).map(p => (
                                    <div key={p.dataKey} className="flex justify-between gap-4 text-[11px] font-semibold" style={{ color: p.color ?? "#fff" }}>
                                        <span>{p.dataKey}</span>
                                        <span className="tabular-nums">RS {fmtK(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    }}
                />
                {/* Divider between actual and projected */}
                {splitIdx >= 0 && splitIdx < data.length - 1 && (
                    <ReferenceLine x={data[splitIdx]?.label} stroke={C.projected} strokeDasharray="6 3" strokeWidth={1.5} />
                )}
                <Area type="monotone" dataKey="revenue"  stroke={C.revenue}  strokeWidth={1.5} fill="url(#projRevGrad)" dot={false} name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke={C.expenses} strokeWidth={1.5} fill="url(#projExpGrad)" dot={false} name="Expenses" />
                <Line  type="monotone" dataKey="net"      stroke={C.net}      strokeWidth={2}   dot={false} name="Net" strokeDasharray="5 2" />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function ScenarioCompareChart({ projected, loading }) {
    if (loading) return <Skeleton h={200} />;
    if (!projected?.length) return null;

    const data = projected.map(m => ({
        label:       m.label,
        Optimistic:  m.optimistic?.net  ?? 0,
        Base:        m.base?.net        ?? 0,
        Pessimistic: m.pessimistic?.net ?? 0,
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `RS ${fmtK(v)}`} tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                            <div className="rounded-xl px-3 py-2" style={{ background: "var(--color-surface-invert)", border: "1px solid rgba(255,255,255,.08)", minWidth: 150 }}>
                                <div className="text-[9px] font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
                                {payload.map(p => (
                                    <div key={p.dataKey} className="flex justify-between gap-4 text-[11px] font-semibold" style={{ color: p.color }}>
                                        <span>{p.dataKey}</span>
                                        <span className="tabular-nums">RS {fmtK(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    }}
                />
                <ReferenceLine y={0} stroke={C.border} />
                <Bar dataKey="Optimistic"  fill={C.optimistic}  radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Base"        fill={C.projected}   radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Pessimistic" fill={C.pessimistic} radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProjectionsTab({ filterProps, filterLabel }) {
    const { fiscalYear, entityId } = filterProps;
    const [scenario, setScenario] = useState("base");

    const { data, loading, error } = useProjections(fiscalYear, entityId);

    const historical = data?.historical ?? [];
    const projected  = data?.projected  ?? [];
    const model      = data?.model;
    const stats      = data?.stats;

    const scenarioData = SCENARIOS.find(s => s.key === scenario);

    const projectedRevSum  = projected.reduce((s, m) => s + (m[scenario]?.revenue  ?? 0), 0);
    const projectedExpSum  = projected.reduce((s, m) => s + (m[scenario]?.expenses ?? 0), 0);
    const projectedNetSum  = projected.reduce((s, m) => s + (m[scenario]?.net      ?? 0), 0);
    const growthPct        = stats?.revenueGrowthPct;

    if (error) {
        return (
            <div className="flex items-center gap-2 p-6 rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
                <AlertCircle size={16} style={{ color: C.netNeg }} />
                <span className="text-[12px]" style={{ color: C.body }}>Could not load projections. Please try refreshing.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                        6-Month Projections
                    </div>
                    <div className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: C.accentBg, color: C.accent }}>
                        Based on {filterLabel}
                    </div>
                    {model && <ModelBadge r2={model.revenue.r2} dataPoints={model.dataPoints} />}
                </div>

                {/* Scenario selector */}
                <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: C.border, background: C.surface }}>
                    {SCENARIOS.map(s => (
                        <button
                            key={s.key}
                            onClick={() => setScenario(s.key)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                            style={{
                                background: scenario === s.key ? s.color : "transparent",
                                color:      scenario === s.key ? "#fff"   : C.sub,
                            }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Scenario description ───────────────────────────────────────── */}
            <div className="flex items-center gap-2 text-[11px]" style={{ color: C.sub }}>
                <span className="w-2 h-2 rounded-full" style={{ background: scenarioData.color }} />
                <span>{scenarioData.desc}</span>
            </div>

            {/* ── Summary KPIs ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    label="Avg Monthly Revenue (historical)"
                    value={`RS ${fmtK(stats?.avgMonthlyRevenue ?? 0)}`}
                    color={C.revenue}
                    sub="last 12 months average"
                    loading={loading}
                />
                <StatCard
                    label="Projected 6-Month Revenue"
                    value={`RS ${fmtK(projectedRevSum)}`}
                    color={C.projected}
                    sub={`${scenario} scenario`}
                    loading={loading}
                />
                <StatCard
                    label="Projected 6-Month Net"
                    value={`RS ${fmtK(Math.abs(projectedNetSum))}`}
                    color={projectedNetSum >= 0 ? C.net : C.netNeg}
                    sub={projectedNetSum >= 0 ? "Surplus projected" : "Deficit projected"}
                    loading={loading}
                />
                <StatCard
                    label="Revenue Trend"
                    value={growthPct != null ? `${growthPct >= 0 ? "+" : ""}${growthPct?.toFixed(1)}%` : "—"}
                    color={growthPct == null ? C.sub : growthPct >= 0 ? C.net : C.netNeg}
                    sub="period-over-period growth"
                    loading={loading}
                />
            </div>

            {/* ── Main projection chart ──────────────────────────────────────── */}
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                        Actual + Projected · {scenarioData.label} Scenario
                    </div>
                    <div className="flex items-center gap-2 text-[9px]" style={{ color: C.sub }}>
                        <div className="w-6 border-t border-dashed" style={{ borderColor: C.projected }} />
                        <span>Projection starts here</span>
                    </div>
                </div>
                <ProjectionChart
                    historical={historical}
                    projected={projected}
                    scenario={scenario}
                    loading={loading}
                />
            </div>

            {/* ── Scenario comparison + Projection table side by side ────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

                {/* Scenario compare chart */}
                <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                    <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                        Net Income — All Scenarios
                    </div>
                    <ScenarioCompareChart projected={projected} loading={loading} />
                </div>

                {/* Projection table */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: C.surface, borderColor: C.border }}>
                    <div className="px-5 pt-4 pb-2 border-b" style={{ borderColor: C.border }}>
                        <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>
                            Monthly Forecast — {scenarioData.label}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="border-b" style={{ borderColor: C.border }}>
                                    <th className="px-4 py-2 text-left font-semibold" style={{ color: C.sub }}>Month</th>
                                    <th className="px-4 py-2 text-right font-semibold" style={{ color: C.revenue }}>Revenue</th>
                                    <th className="px-4 py-2 text-right font-semibold" style={{ color: C.expenses }}>Expenses</th>
                                    <th className="px-4 py-2 text-right font-semibold" style={{ color: C.net }}>Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading
                                    ? [1, 2, 3, 4, 5, 6].map(i => (
                                        <tr key={i} className="border-b" style={{ borderColor: C.border }}>
                                            {[1, 2, 3, 4].map(j => (
                                                <td key={j} className="px-4 py-2">
                                                    <div className="h-3 rounded animate-pulse" style={{ background: C.muted }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                    : projected.map((m, i) => {
                                        const s = m[scenario];
                                        const isPos = (s?.net ?? 0) >= 0;
                                        return (
                                            <tr key={m.key} className="border-b last:border-0 hover:bg-black/[0.02]" style={{ borderColor: C.border }}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.projected }} />
                                                        <span className="font-medium" style={{ color: C.body }}>{m.label}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: C.revenue }}>
                                                    RS {fmtK(s?.revenue ?? 0)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: C.expenses }}>
                                                    RS {fmtK(s?.expenses ?? 0)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-bold" style={{ color: isPos ? C.net : C.netNeg }}>
                                                    {isPos ? "+" : "−"}RS {fmtK(Math.abs(s?.net ?? 0))}
                                                </td>
                                            </tr>
                                        );
                                    })
                                }
                                {!loading && projected.length > 0 && (
                                    <tr className="border-t-2" style={{ borderColor: C.border }}>
                                        <td className="px-4 py-2.5 font-bold text-[11px]" style={{ color: C.strong }}>Total</td>
                                        <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: C.revenue }}>
                                            RS {fmtK(projectedRevSum)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: C.expenses }}>
                                            RS {fmtK(projectedExpSum)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-black tabular-nums" style={{ color: projectedNetSum >= 0 ? C.net : C.netNeg }}>
                                            {projectedNetSum >= 0 ? "+" : "−"}RS {fmtK(Math.abs(projectedNetSum))}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Model info ────────────────────────────────────────────────── */}
            {!loading && model && (
                <div className="rounded-xl border px-5 py-3 flex items-start gap-3" style={{ borderColor: C.border, background: C.surface }}>
                    <AlertCircle size={13} style={{ color: C.sub, marginTop: 1, flexShrink: 0 }} />
                    <div className="text-[10px] leading-relaxed" style={{ color: C.sub }}>
                        Projections use linear regression over <strong style={{ color: C.body }}>{model.dataPoints} months</strong> of actuals.
                        Revenue model: R² = {model.revenue.r2}, slope RS {fmtK(model.revenue.slope)}/month.
                        Expense model: R² = {model.expenses.r2}, slope RS {fmtK(model.expenses.slope)}/month.
                        {model.revenue.r2 < 0.5 && " Low R² indicates irregular revenue — projections have wider uncertainty."}
                    </div>
                </div>
            )}
        </div>
    );
}
