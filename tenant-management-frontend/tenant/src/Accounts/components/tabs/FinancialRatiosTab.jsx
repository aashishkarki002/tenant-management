/**
 * FinancialRatiosTab.jsx
 *
 * Financial ratio analysis dashboard derived entirely from backend data.
 *
 * Ratio groups:
 *   Profitability  — Net Margin, Operating Margin, Expense Ratio
 *   Efficiency     — Collection Rate, Outstanding Ratio, Arrears Aging
 *   Leverage       — Debt-to-Revenue, Total Liabilities
 *   NOI            — Net Operating Income breakdown
 */

import {
    LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Info } from "lucide-react";
import { useFinancialRatios } from "../../hooks/useFinancialRatios";
import { Skeleton } from "../AccountingPrimitives";
import { fmtK } from "../../utils/formatter";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    good:     "var(--color-success)",
    warn:     "var(--color-warning)",
    bad:      "var(--color-danger)",
    info:     "var(--color-info)",
    accent:   "var(--color-accent)",
    accentBg: "var(--color-accent-light)",
    border:   "var(--color-border)",
    surface:  "var(--color-surface-raised)",
    sub:      "var(--color-text-sub)",
    body:     "var(--color-text-body)",
    strong:   "var(--color-text-strong)",
    muted:    "var(--color-muted)",
};

// ─── Ratio health thresholds ──────────────────────────────────────────────────
// Returns "good" | "warn" | "bad" based on the metric and its value
function ratioHealth(key, value) {
    const thresholds = {
        netMarginPct:       { good: 20,  warn: 5   },  // higher = better
        operatingMarginPct: { good: 25,  warn: 10  },
        expenseRatioPct:    { bad:  90,  warn: 75  },  // lower = better (inverted)
        collectionRatePct:  { good: 90,  warn: 70  },
        outstandingRatioPct:{ bad:  30,  warn: 15  },  // lower = better
        debtToRevenuePct:   { bad:  200, warn: 100 },  // lower = better
        grossProfitPct:     { good: 30,  warn: 10  },
    };
    const t = thresholds[key];
    if (!t || value == null) return "neutral";

    // Inverted metrics (lower is better)
    if (["expenseRatioPct", "outstandingRatioPct", "debtToRevenuePct"].includes(key)) {
        if (value >= t.bad) return "bad";
        if (value >= t.warn) return "warn";
        return "good";
    }
    // Normal metrics (higher is better)
    if (value >= (t.good ?? Infinity)) return "good";
    if (value >= (t.warn ?? -Infinity)) return "warn";
    return "bad";
}

function healthColor(h) {
    if (h === "good")    return C.good;
    if (h === "warn")    return C.warn;
    if (h === "bad")     return C.bad;
    return C.sub;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
    return <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: C.sub }}>{children}</div>;
}

function YoYBadge({ prev, curr, inverse = false }) {
    if (prev == null || curr == null) return null;
    const diff = curr - prev;
    const pct  = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
    const good = inverse ? diff <= 0 : diff >= 0;
    const Icon = diff === 0 ? Minus : good ? TrendingUp : TrendingDown;
    return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: good ? "var(--color-success-bg)" : "var(--color-danger-bg)", color: good ? C.good : C.bad }}>
            <Icon size={9} />
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
}

function RatioCard({ label, value, suffix = "%", metricKey, prevValue, inverse = false, description, loading }) {
    const h = ratioHealth(metricKey, value);
    const color = healthColor(h);

    return (
        <div className="rounded-2xl border p-4 flex flex-col gap-2" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex items-start justify-between gap-2">
                <div className="text-[9px] font-bold tracking-[0.1em] uppercase leading-tight" style={{ color: C.sub }}>
                    {label}
                </div>
                <YoYBadge prev={prevValue} curr={value} inverse={inverse} />
            </div>
            {loading ? <Skeleton h={32} /> : (
                <div className="text-[26px] font-black tabular-nums leading-none" style={{ color }}>
                    {value != null ? `${value.toFixed(1)}${suffix}` : "—"}
                </div>
            )}
            {!loading && prevValue != null && (
                <div className="text-[9px]" style={{ color: C.sub }}>
                    vs {prevValue.toFixed(1)}{suffix} prev year
                </div>
            )}
            {description && (
                <div className="flex items-center gap-1 text-[9px]" style={{ color: C.sub }}>
                    <Info size={9} />
                    {description}
                </div>
            )}
            {/* Health bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div style={{
                    height: "100%",
                    width: `${Math.min(Math.abs(value ?? 0), 100)}%`,
                    background: color,
                    transition: "width .8s ease",
                }} />
            </div>
        </div>
    );
}

function AgingBar({ label, count, amountPaisa, color, maxPaisa }) {
    const pct = maxPaisa > 0 ? (amountPaisa / maxPaisa) * 100 : 0;
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="w-20 shrink-0 text-[10px] font-medium" style={{ color: C.body }}>{label}</div>
            <div className="flex-1 overflow-hidden rounded-full" style={{ height: 6, background: C.border }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999, transition: "width .8s ease" }} />
            </div>
            <div className="text-right shrink-0">
                <div className="text-[10px] font-bold tabular-nums" style={{ color }}>{count} rents</div>
                <div className="text-[9px] tabular-nums" style={{ color: C.sub }}>RS {fmtK(amountPaisa / 100)}</div>
            </div>
        </div>
    );
}

function RatioTrendChart({ trend = [], loading }) {
    if (loading) return <Skeleton h={180} />;
    if (!trend.length) return null;

    const data = trend.map(m => ({
        label: m.label,
        "Net Margin %": m.netMarginPct ?? 0,
        "Expense Ratio %": m.expenseRatioPct ?? 0,
    }));

    return (
        <ResponsiveContainer width="100%" height={190}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: C.sub }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                    cursor={{ stroke: C.accent, strokeWidth: 1, strokeDasharray: "4 2" }}
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                            <div className="rounded-xl px-3 py-2" style={{ background: "var(--color-surface-invert)", border: "1px solid rgba(255,255,255,.08)", minWidth: 140 }}>
                                <div className="text-[9px] font-bold uppercase mb-1.5" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
                                {payload.map(p => (
                                    <div key={p.dataKey} className="flex justify-between gap-3 text-[11px] font-semibold" style={{ color: p.color }}>
                                        <span>{p.dataKey}</span>
                                        <span className="tabular-nums">{p.value?.toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        );
                    }}
                />
                <Line type="monotone" dataKey="Net Margin %"    stroke={C.good} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Expense Ratio %" stroke={C.warn} strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </LineChart>
        </ResponsiveContainer>
    );
}

function CollectionGauge({ ratePct, loading }) {
    if (loading) return <Skeleton h={120} />;
    const h = ratioHealth("collectionRatePct", ratePct);
    const color = healthColor(h);
    const data = [{ value: ratePct ?? 0 }];

    return (
        <div className="flex flex-col items-center gap-1">
            <ResponsiveContainer width="100%" height={100}>
                <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
                    startAngle={180} endAngle={0} data={data}>
                    <RadialBar dataKey="value" background={{ fill: C.border }} fill={color}
                        cornerRadius={4} maxBarSize={12} />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-[26px] font-black tabular-nums -mt-6" style={{ color }}>
                {ratePct?.toFixed(1) ?? "—"}%
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.sub }}>Collection Rate</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FinancialRatiosTab({ filterProps, filterLabel }) {
    const { selectedQuarter, selectedMonth, fiscalYear, customStartDate, customEndDate, entityId } = filterProps;

    const { data, loading, error } = useFinancialRatios(
        selectedQuarter,
        customStartDate ?? "",
        customEndDate   ?? "",
        selectedMonth,
        fiscalYear,
        entityId,
    );

    const prof      = data?.profitability ?? {};
    const eff       = data?.efficiency   ?? {};
    const lev       = data?.leverage     ?? {};
    const noi       = data?.noi          ?? {};
    const prev      = prof?.prev;
    const aging     = eff?.arrearsAging  ?? {};
    const maxAging  = Math.max(
        aging.current?.amountPaisa ?? 0,
        aging.days30?.amountPaisa ?? 0,
        aging.days60?.amountPaisa ?? 0,
        aging.days90Plus?.amountPaisa ?? 0,
        1,
    );

    if (error) {
        return (
            <div className="flex items-center gap-2 p-6 rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
                <AlertCircle size={16} style={{ color: C.bad }} />
                <span className="text-[12px]" style={{ color: C.body }}>Could not load financial ratios. Please try refreshing.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">

            {/* ── Period banner ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: C.sub }}>Financial Ratios</div>
                <div className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: C.accentBg, color: C.accent }}>
                    {filterLabel}
                </div>
            </div>

            {/* ── Profitability Ratios ───────────────────────────────────────── */}
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <SectionHeader>Profitability</SectionHeader>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <RatioCard
                        label="Net Profit Margin"
                        value={prof.netMarginPct}
                        metricKey="netMarginPct"
                        prevValue={prev?.netMarginPct}
                        description="Net income ÷ Revenue"
                        loading={loading}
                    />
                    <RatioCard
                        label="Operating Margin (NOI)"
                        value={prof.operatingMarginPct}
                        metricKey="operatingMarginPct"
                        prevValue={null}
                        description="NOI ÷ Revenue"
                        loading={loading}
                    />
                    <RatioCard
                        label="Expense Ratio"
                        value={prof.expenseRatioPct}
                        metricKey="expenseRatioPct"
                        prevValue={prev?.expenseRatioPct}
                        description="Expenses ÷ Revenue"
                        inverse
                        loading={loading}
                    />
                    <RatioCard
                        label="Gross Profit %"
                        value={prof.grossProfitPct}
                        metricKey="grossProfitPct"
                        prevValue={null}
                        description="NOI before interest"
                        loading={loading}
                    />
                </div>
            </div>

            {/* ── Efficiency + Leverage side by side ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

                {/* Efficiency */}
                <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                    <SectionHeader>Rent Collection Efficiency</SectionHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-6">
                        <CollectionGauge ratePct={eff.collectionRatePct} loading={loading} />
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[11px] py-1.5 border-b" style={{ borderColor: C.border }}>
                                <span style={{ color: C.body }}>Paid rents</span>
                                {loading ? <Skeleton h={12} /> : <span className="font-bold tabular-nums" style={{ color: C.good }}>{eff.paidCount ?? 0}</span>}
                            </div>
                            <div className="flex justify-between text-[11px] py-1.5 border-b" style={{ borderColor: C.border }}>
                                <span style={{ color: C.body }}>Total rents</span>
                                {loading ? <Skeleton h={12} /> : <span className="font-bold tabular-nums" style={{ color: C.body }}>{eff.totalRents ?? 0}</span>}
                            </div>
                            <div className="flex justify-between text-[11px] py-1.5 border-b" style={{ borderColor: C.border }}>
                                <span style={{ color: C.body }}>Outstanding</span>
                                {loading ? <Skeleton h={12} /> : <span className="font-bold tabular-nums" style={{ color: C.bad }}>RS {fmtK((eff.outstandingPaisa ?? 0) / 100)}</span>}
                            </div>
                            <div className="flex justify-between text-[11px] py-1.5">
                                <span style={{ color: C.body }}>Outstanding ratio</span>
                                {loading ? <Skeleton h={12} /> : (
                                    <span className="font-bold tabular-nums" style={{ color: healthColor(ratioHealth("outstandingRatioPct", eff.outstandingRatioPct)) }}>
                                        {(eff.outstandingRatioPct ?? 0).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Arrears aging */}
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
                        <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: C.sub }}>Arrears Aging (Live)</div>
                        {loading ? [1, 2, 3, 4].map(i => <Skeleton key={i} h={20} className="mb-2" />) : (
                            <>
                                <AgingBar label="Current"     count={aging.current?.count ?? 0}    amountPaisa={aging.current?.amountPaisa ?? 0}    color={C.good} maxPaisa={maxAging} />
                                <AgingBar label="1–30 days"   count={aging.days30?.count ?? 0}     amountPaisa={aging.days30?.amountPaisa ?? 0}     color={C.warn} maxPaisa={maxAging} />
                                <AgingBar label="31–60 days"  count={aging.days60?.count ?? 0}     amountPaisa={aging.days60?.amountPaisa ?? 0}     color={C.bad}  maxPaisa={maxAging} />
                                <AgingBar label="60+ days"    count={aging.days90Plus?.count ?? 0} amountPaisa={aging.days90Plus?.amountPaisa ?? 0} color={C.bad}  maxPaisa={maxAging} />
                            </>
                        )}
                    </div>
                </div>

                {/* Leverage + NOI */}
                <div className="flex flex-col gap-3">
                    <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                        <SectionHeader>Leverage</SectionHeader>
                        <RatioCard
                            label="Debt-to-Revenue"
                            value={lev.debtToRevenuePct}
                            metricKey="debtToRevenuePct"
                            description="Total liabilities ÷ Revenue"
                            inverse
                            loading={loading}
                        />
                        {/* DSCR — Debt Service Coverage Ratio */}
                        {loading ? <Skeleton h={64} className="mt-3" /> : (
                            <div className="mt-3 pt-3 border-t flex flex-col gap-2" style={{ borderColor: C.border }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.sub }}>DSCR</div>
                                        <div className="text-[9px]" style={{ color: C.sub }}>NOI ÷ Debt service</div>
                                    </div>
                                    {lev.dscr == null ? (
                                        <span className="text-[11px] font-semibold" style={{ color: C.sub }}>No debt</span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[20px] font-black tabular-nums" style={{
                                                color: lev.dscr >= 1.25 ? C.good : lev.dscr >= 1.0 ? C.warn : C.bad,
                                            }}>
                                                {lev.dscr.toFixed(2)}×
                                            </span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                                                background: lev.dscr >= 1.25 ? "var(--color-success-bg)" : lev.dscr >= 1.0 ? "var(--color-warning-bg)" : "var(--color-danger-bg)",
                                                color: lev.dscr >= 1.25 ? C.good : lev.dscr >= 1.0 ? C.warn : C.bad,
                                            }}>
                                                {lev.dscr >= 1.25 ? "Healthy" : lev.dscr >= 1.0 ? "Watch" : "Distress"}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {lev.dscr != null && (
                                    <div className="text-[11px] flex justify-between" style={{ color: C.body }}>
                                        <span>Debt service (period)</span>
                                        <span className="font-bold tabular-nums" style={{ color: C.bad }}>RS {fmtK(lev.annualDebtServiceRupees ?? 0)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {!loading && (
                            <div className="mt-2 text-[11px] flex justify-between" style={{ color: C.body }}>
                                <span>Total Liabilities</span>
                                <span className="font-bold tabular-nums" style={{ color: C.bad }}>RS {fmtK(lev.totalLiabilitiesRupees ?? 0)}</span>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                        <SectionHeader>Net Operating Income (NOI)</SectionHeader>
                        {loading ? <Skeleton h={80} /> : (
                            <>
                                <div className="text-[22px] font-black tabular-nums leading-none mb-1"
                                    style={{ color: (noi.noiPaisa ?? 0) >= 0 ? C.good : C.bad }}>
                                    RS {fmtK((noi.noiPaisa ?? 0) / 100)}
                                </div>
                                <div className="text-[10px] font-semibold mb-3" style={{ color: C.sub }}>
                                    {(noi.noiMarginPct ?? 0).toFixed(1)}% NOI margin
                                </div>
                                {[
                                    { label: "Revenue",           value: (noi.revenuePaisa ?? 0) / 100,           color: C.info },
                                    { label: "Operating Expenses", value: (noi.operatingExpensesPaisa ?? 0) / 100, color: C.warn },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="flex justify-between text-[10px] py-1.5 border-b last:border-0" style={{ borderColor: C.border }}>
                                        <span style={{ color: C.body }}>{label}</span>
                                        <span className="font-bold tabular-nums" style={{ color }}>RS {fmtK(value)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Ratio trend chart ─────────────────────────────────────────── */}
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: C.sub }}>
                    Ratio Trend — Net Margin & Expense Ratio
                </div>
                <RatioTrendChart trend={data?.ratioTrend} loading={loading} />
            </div>

        </div>
    );
}
