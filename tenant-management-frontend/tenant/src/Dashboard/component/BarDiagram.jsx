// src/pages/component/BarDiagram.jsx
// Revenue Trend chart — compact layout, all data preserved.
// VerdictBadge + CurrentMonthCallout collapsed into header row.
// SummaryStrip inlined below chart with minimal padding.

import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, LabelList, ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
    NEPALI_MONTH_NAMES,
    getCurrentFYMonths,
    getFYLabel,
} from '../../../utils/nepaliDate';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    barHighlight: '#1A5276',
    barRecorded: '#AED6F1',
    barEmpty: '#E7E5E0',
    trendLine: '#92400E',
    up: '#166534',
    down: '#991B1B',
    flat: '#78716C',
    grid: '#E7E5E0',
    axisText: '#78716C',
    axisStrong: '#1C1917',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCompact(n) {
    if (n == null) return '—';
    if (n >= 10_00_000) return `${(n / 10_00_000).toFixed(1)}Cr`;
    if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${n}`;
}

function fmtFull(n) {
    return `₹${Number(n).toLocaleString('en-IN')}`;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function calcTrend(recorded) {
    if (recorded.length < 2) return { slope: 0, direction: 'flat' };
    const n = recorded.length;
    const xs = recorded.map((_, i) => i);
    const ys = recorded.map((d) => d.revenue);
    const mX = xs.reduce((s, x) => s + x, 0) / n;
    const mY = ys.reduce((s, y) => s + y, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - mX) * (ys[i] - mY), 0);
    const den = xs.reduce((s, x) => s + (x - mX) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const direction = slope > mY * 0.015 ? 'up' : slope < -mY * 0.015 ? 'down' : 'flat';
    return { slope, direction };
}

function rollingAvg(data, window = 3) {
    return data.map((d, i) => {
        if (d.isEmpty) return null;
        const half = Math.floor(window / 2);
        const slice = data.slice(Math.max(0, i - half), Math.min(data.length, i + half + 1));
        const active = slice.filter((s) => !s.isEmpty);
        if (active.length === 0) return null;
        return active.reduce((s, a) => s + a.revenue, 0) / active.length;
    });
}

// ─── Data builder ─────────────────────────────────────────────────────────────

function buildChartData(items, fyMonths, currentMonth, highlightCurrent) {
    if (!Array.isArray(fyMonths) || fyMonths.length === 0) return [];
    const lookup = new Map(
        (Array.isArray(items) ? items : []).map((it) => [Number(it.month), it])
    );
    const base = fyMonths.map((fm) => {
        const item = lookup.get(fm.month);
        const revenue = Number(item?.total ?? item?.revenue ?? 0) || 0;
        return {
            name: fm.short, month: fm.month, bsYear: fm.bsYear,
            fyIndex: fm.fyIndex, quarter: fm.quarter, fullName: fm.name,
            revenue, isEmpty: revenue === 0,
            isHighlighted: highlightCurrent && fm.isCurrent,
            isFuture: fm.isFuture,
        };
    });
    const withMom = base.map((item, idx) => {
        if (item.isEmpty) return { ...item, momChange: null };
        let prev = 0;
        for (let i = idx - 1; i >= 0; i--) {
            if (!base[i].isEmpty && base[i].revenue > 0) { prev = base[i].revenue; break; }
        }
        const momChange = prev > 0 ? Math.round(((item.revenue - prev) / prev) * 100) : null;
        return { ...item, momChange };
    });
    const avgs = rollingAvg(withMom, 3);
    return withMom.map((d, i) => ({ ...d, trend: avgs[i] }));
}

function buildQBands(fyMonths) {
    return [1, 2, 3, 4].map((q) => {
        const qm = fyMonths.filter((m) => m.quarter === q);
        return {
            label: `Q${q}`,
            x1: qm[0]?.short,
            x2: qm[qm.length - 1]?.short,
            fill: q % 2 === 1 ? 'rgba(231,229,224,0.18)' : 'rgba(0,0,0,0)',
        };
    }).filter((q) => q.x1 && q.x2);
}

// ─── Compact header metadata ──────────────────────────────────────────────────
// Replaces the old VerdictBadge + CurrentMonthCallout blocks (saved ~80px).

function HeaderMeta({ monthlyData, currentMonth, currentYear }) {
    const recorded = monthlyData.filter((d) => !d.isEmpty);
    if (recorded.length === 0) return null;

    const { direction } = calcTrend(recorded);
    const { direction: recentDir } = calcTrend(recorded.slice(-3));

    const dirIcon = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
    const dirLabel = direction === 'up' ? 'Growing' : direction === 'down' ? 'Declining' : 'Stable';
    const dirColor = direction === 'up' ? C.up : direction === 'down' ? C.down : C.flat;

    const recentLabel = recentDir === 'up' ? 'Accelerating'
        : recentDir === 'down' ? 'Slowing'
            : 'Holding steady';

    const currentPoint = monthlyData.find(
        (d) => d.month === currentMonth && d.bsYear === currentYear
    );
    const mthName = NEPALI_MONTH_NAMES[currentMonth - 1] ?? '';

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* CURRENT MONTH - PROMINENT FIRST for at-a-glance viewing */}
            {currentPoint && !currentPoint.isEmpty && (
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold"
                    style={{
                        background: 'var(--color-accent-light)',
                        borderLeft: `3px solid ${C.barHighlight}`,
                    }}
                >
                    <span className="text-[11px] font-bold" style={{ color: C.barHighlight }}>
                        {mthName}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: C.axisStrong }}>
                        {fmtFull(currentPoint.revenue)}
                    </span>
                    {currentPoint.momChange != null && (
                        <span
                            className="text-[10px] font-bold tabular-nums"
                            style={{ color: currentPoint.momChange > 0 ? C.up : C.down }}
                        >
                            ({currentPoint.momChange > 0 ? '+' : ''}{currentPoint.momChange}%)
                        </span>
                    )}
                </span>
            )}

            {/* Trend pill */}
            <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                    background: direction === 'up'
                        ? 'color-mix(in oklch, var(--success) 14%, transparent)'
                        : direction === 'down'
                            ? 'color-mix(in oklch, var(--destructive) 12%, transparent)'
                            : 'var(--color-secondary)',
                    color: dirColor,
                }}
            >
                {dirIcon} {dirLabel}
            </span>

            <span className="text-[10px] text-muted-foreground font-medium">
                {recentLabel}
            </span>

            {/* Trend line legend */}
            <span className="flex items-center gap-1 ml-auto text-[10px] font-medium"
                style={{ color: C.trendLine }}>
                <svg width="18" height="8" viewBox="0 0 18 8">
                    <path d="M1 7 C4 7 6 1 9 1 C12 1 14 4 17 3"
                        stroke={C.trendLine} strokeWidth="1.5"
                        fill="none" strokeLinecap="round" />
                </svg>
                3-mo avg
            </span>
        </div>
    );
}

// ─── Summary strip (compressed) ───────────────────────────────────────────────

function SummaryStrip({ data }) {
    const recorded = data.filter((d) => !d.isEmpty);
    if (recorded.length === 0) return null;

    const ytdTotal = recorded.reduce((s, d) => s + d.revenue, 0);
    const avg = Math.round(ytdTotal / recorded.length);
    const peak = recorded.reduce((b, d) => d.revenue > b.revenue ? d : b, recorded[0]);
    const peakName = peak.fullName ?? NEPALI_MONTH_NAMES[peak.month - 1];

    const items = [
        { label: 'FY', value: `${recorded.length}/12 mo` },
        { label: 'YTD', value: `₹${fmtCompact(ytdTotal)}` },
        { label: 'Avg', value: `₹${fmtCompact(avg)}/mo` },
        peakName ? { label: 'Peak', value: `${peakName} · ₹${fmtCompact(peak.revenue)}` } : null,
    ].filter(Boolean);

    return (
        <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t"
            style={{ borderColor: C.grid }}
        >
            {items.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1">
                    <span
                        className="text-[9px] font-semibold tracking-widest uppercase"
                        style={{ color: C.axisText }}
                    >
                        {label}
                    </span>
                    <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{ color: C.axisStrong }}
                    >
                        {value}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload ?? {};
    const monthName = d.fullName ?? (d.month != null ? NEPALI_MONTH_NAMES[d.month - 1] : label);
    const trendVal = payload.find((p) => p.dataKey === 'trend')?.value;

    return (
        <div
            className="rounded-xl border shadow-lg px-3 py-2.5 text-xs min-w-[150px]"
            style={{
                background: 'var(--color-surface-raised)',
                borderColor: 'var(--color-border)',
            }}
        >
            <p className="font-bold mb-2" style={{ color: 'var(--color-text-strong)' }}>
                {monthName} {d.bsYear}
            </p>
            {d.isEmpty ? (
                <p style={{ color: C.axisText }} className="italic">
                    {d.isFuture ? 'Upcoming month' : 'No data recorded'}
                </p>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-4 mb-1">
                        <span style={{ color: C.axisText }}>Revenue</span>
                        <span className="font-bold tabular-nums" style={{ color: C.barHighlight }}>
                            {fmtFull(d.revenue)}
                        </span>
                    </div>
                    {trendVal != null && (
                        <div className="flex items-center justify-between gap-4 mb-1">
                            <span style={{ color: C.axisText }}>3-mo avg</span>
                            <span className="font-semibold tabular-nums" style={{ color: C.trendLine }}>
                                {fmtFull(Math.round(trendVal))}
                            </span>
                        </div>
                    )}
                    {d.momChange != null && (
                        <div
                            className="flex items-center justify-between gap-4 pt-1 border-t"
                            style={{ borderColor: C.grid }}
                        >
                            <span style={{ color: C.axisText }}>vs prev month</span>
                            <span
                                className="font-bold tabular-nums"
                                style={{ color: d.momChange > 0 ? C.up : d.momChange < 0 ? C.down : C.flat }}
                            >
                                {d.momChange > 0 ? '+' : ''}{d.momChange}%
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── X-Axis tick ──────────────────────────────────────────────────────────────

function XAxisTick({ x, y, payload, monthlyData }) {
    const point = monthlyData.find((d) => d.name === payload.value);
    const isHighlight = point?.isHighlighted ?? false;
    const isEmpty = point?.isEmpty ?? false;
    return (
        <g transform={`translate(${x},${y})`}>
            {isHighlight && (
                <rect x={-9} y={4} width={18} height={14} rx={4}
                    fill={C.barHighlight} opacity={0.12} />
            )}
            <text
                x={0} y={0} dy={14} textAnchor="middle" fontSize={9}
                fontWeight={isHighlight ? 700 : 400}
                fill={isHighlight ? C.axisStrong : isEmpty ? C.grid : C.axisText}
            >
                {payload.value}
            </text>
        </g>
    );
}

// ─── MoM label above bar ──────────────────────────────────────────────────────

function MoMLabel({ x, y, width, index, monthlyData }) {
    if (!monthlyData) return null;
    const point = monthlyData[index];
    if (!point || point.isEmpty || point.momChange == null) return null;
    if (Math.abs(point.momChange) < 3) return null;
    return (
        <text
            x={x + width / 2} y={y - 4} textAnchor="middle"
            fontSize={7} fontWeight={700}
            fill={point.momChange > 0 ? C.up : C.down}
            style={{ pointerEvents: 'none' }}
        >
            {point.momChange > 0 ? '+' : ''}{point.momChange}%
        </text>
    );
}

// ─── Skeleton / Empty ─────────────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="h-full w-full flex items-end gap-1 px-2">
            {[40, 65, 30, 80, 55, 70, 45, 60, 75, 50, 35, 68].map((h, i) => (
                <div key={i} className="flex-1 rounded-t animate-pulse"
                    style={{ height: `${h}%`, minHeight: 6, background: C.barEmpty }} />
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div
            className="h-full w-full flex flex-col items-center justify-center gap-2
                rounded-xl border border-dashed text-center px-4"
            style={{ borderColor: C.grid }}
        >
            <p className="text-xs font-semibold" style={{ color: C.axisText }}>
                No revenue data yet
            </p>
            <p className="text-[10px]" style={{ color: C.axisText }}>
                Record payments to see your trend
            </p>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BarDiagram({ stats, loading, error, period = 'thisYear' }) {
    const [quarterFilter, setQuarterFilter] = React.useState('ALL');

    const todayBs = useMemo(() => getCurrentFYMonths(), []);

    const currentFY = todayBs.fy;
    const currentMonth = todayBs.currentMonth;
    const currentYear = todayBs.currentYear;

    const targetFY = period === 'thisYear' ? currentFY : currentFY - 1;
    const fyLabel = getFYLabel(targetFY);

    const fyMonths = useMemo(() => {
        if (period === 'thisYear') return todayBs.months;
        const lastYearFakeDate = { year: targetFY + 1, month: 3, day: 30 };
        const { months } = getCurrentFYMonths(lastYearFakeDate);
        return months;
    }, [period, targetFY, todayBs.months]);

    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueByMonth ?? [])
        : (stats?.revenueLastYear ?? stats?.revenueByMonth ?? []);

    const monthlyData = useMemo(
        () => buildChartData(rawData, fyMonths, currentMonth, period === 'thisYear'),
        [rawData, fyMonths, currentMonth, period],
    );

    const filteredData = useMemo(() => {
        if (quarterFilter === 'ALL') return monthlyData;
        const q = parseInt(quarterFilter.replace('Q', ''));
        return monthlyData.filter((d) => d.quarter === q);
    }, [monthlyData, quarterFilter]);

    const hasNoData = filteredData.length === 0 || filteredData.every((d) => d.isEmpty);
    const qBands = useMemo(() => buildQBands(fyMonths), [fyMonths]);

    return (
        <Card className="rounded-none border-0 shadow-none h-full flex flex-col bg-gradient-to-br from-card via-card to-secondary/5">

            {/* ── Compact header: title + FY label + quarter tabs + verdict + callout ── */}
            <CardHeader className="px-4 pt-2 pb-1.5 gap-1 flex flex-col">

                {/* Row 1: title + quarter filter */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-strong)' }}>
                            Revenue Trend
                        </p>
                        <p className="text-[11px] font-medium" style={{ color: C.axisText }}>
                            {loading ? 'Loading…' : fyLabel}
                        </p>
                    </div>

                    {!loading && !hasNoData && (
                        <div className="flex items-center gap-0.5 shrink-0">
                            {['ALL', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setQuarterFilter(q)}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-colors"
                                    style={{
                                        background: quarterFilter === q
                                            ? 'color-mix(in oklch, var(--primary) 12%, transparent)'
                                            : 'transparent',
                                        color: quarterFilter === q ? C.barHighlight : C.axisText,
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Row 2: verdict + trend legend + current month callout — all inline */}
                {!loading && !hasNoData && (
                    <HeaderMeta
                        monthlyData={filteredData}
                        currentMonth={currentMonth}
                        currentYear={currentYear}
                    />
                )}
            </CardHeader>

            {/* ── Chart body ── */}
            <CardContent className="px-4 pb-1.5 flex flex-col flex-1 gap-1">
                {error && (
                    <p className="text-xs font-medium" style={{ color: C.down }}>{error}</p>
                )}

                <div className="flex-1 min-h-[130px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : hasNoData ? (
                        <EmptyState />
                    ) : (
                        <ResponsiveContainer width="100%" height="90%">
                            <ComposedChart
                                data={filteredData}
                                margin={{ top: 14, right: 6, left: 0, bottom: 0 }}
                                barCategoryGap="22%"
                            >
                                {/* Quarter bands */}
                                {quarterFilter === 'ALL' && qBands.map((q) => (
                                    <ReferenceArea
                                        key={q.label}
                                        x1={q.x1} x2={q.x2}
                                        fill={q.fill} stroke="none"
                                        label={{
                                            value: q.label,
                                            position: 'insideTopLeft',
                                            fontSize: 8, fontWeight: 600,
                                            fill: '#A8A29E', dx: 2, dy: -14,
                                        }}
                                    />
                                ))}

                                <XAxis
                                    dataKey="name"
                                    axisLine={false} tickLine={false}
                                    tick={(props) => (
                                        <XAxisTick {...props} monthlyData={filteredData} />
                                    )}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(231,229,224,0.2)', radius: 4 }}
                                />

                                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={28} minPointSize={2}>
                                    {filteredData.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={
                                                entry.isEmpty ? C.barEmpty
                                                    : entry.isHighlighted ? C.barHighlight
                                                        : C.barRecorded
                                            }
                                            stroke={entry.isEmpty ? C.barEmpty : 'none'}
                                            strokeWidth={entry.isEmpty ? 1 : 0}
                                            strokeDasharray={entry.isEmpty ? '3 2' : 'none'}
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="revenue"
                                        content={(props) => (
                                            <MoMLabel {...props} monthlyData={filteredData} />
                                        )}
                                    />
                                </Bar>

                                <Line
                                    dataKey="trend"
                                    type="monotone"
                                    stroke={C.trendLine}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: C.trendLine, stroke: '#FFFFFF', strokeWidth: 2 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary strip — tighter, no extra top margin */}
                {!loading && !hasNoData && <SummaryStrip data={filteredData} />}
            </CardContent>
        </Card>
    );
}