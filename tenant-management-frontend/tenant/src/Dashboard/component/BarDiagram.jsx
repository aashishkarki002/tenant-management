import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, LabelList, ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
    NEPALI_MONTH_NAMES,
    NEPALI_MONTH_SHORT,
    getCurrentNepaliMonth,
    getCurrentNepaliYear,
    getCurrentFYMonths,
    getFYLabel,
} from '../../../utils/nepaliDate';

// ─── Palette — petrol design tokens ──────────────────────────────────────────
// Hex values are required for SVG presentation attributes (fill/stroke);
// CSS variables are not resolved by the browser in SVG attrs via Recharts.

const COLOR = {
    barHighlight: '#1A5276',   // --color-accent       current/highlighted month
    barRecorded: '#AED6F1',   // --color-accent-mid   past recorded months
    barEmpty: '#E7E5E0',   // --color-border       no-data placeholder

    trendLine: '#92400E',      // --color-warning

    up: '#166534',           // --color-success
    down: '#991B1B',           // --color-danger
    flat: '#78716C',           // --color-text-sub

    gridLine: '#E7E5E0',
    axisText: '#78716C',
    axisHighlight: '#1C1917',
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

// ─── Trend / analytics ────────────────────────────────────────────────────────

function calcTrend(recorded) {
    if (recorded.length < 2) return { slope: 0, direction: 'flat' };
    const n = recorded.length;
    const xs = recorded.map((_, i) => i);
    const ys = recorded.map((d) => d.revenue);
    const meanX = xs.reduce((s, x) => s + x, 0) / n;
    const meanY = ys.reduce((s, y) => s + y, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
    const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const direction = slope > meanY * 0.015 ? 'up'
        : slope < -meanY * 0.015 ? 'down'
            : 'flat';
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
//
// fyMonths: the ordered array from getCurrentFYMonths().months — Shrawan first.
// items: API response array, each with { month: number, total|revenue: number }.

function buildChartData(items, fyMonths, currentMonth, highlightCurrent) {
    if (!Array.isArray(fyMonths) || fyMonths.length === 0) return [];

    // Build a lookup by BS calendar month number
    const lookup = new Map(
        (Array.isArray(items) ? items : []).map((it) => [Number(it.month), it])
    );

    const base = fyMonths.map((fm) => {
        const item = lookup.get(fm.month);
        const revenue = Number(item?.total ?? item?.revenue ?? 0) || 0;
        return {
            name: fm.short,
            month: fm.month,
            bsYear: fm.bsYear,
            fyIndex: fm.fyIndex,
            quarter: fm.quarter,
            fullName: fm.name,
            revenue,
            isEmpty: revenue === 0,
            isHighlighted: highlightCurrent && fm.isCurrent,
            isFuture: fm.isFuture,
        };
    });

    // Month-over-month vs last non-empty month
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

// ─── Verdict computation ──────────────────────────────────────────────────────

function computeVerdict(monthlyData) {
    const recorded = monthlyData.filter((d) => !d.isEmpty);
    if (recorded.length < 2) return null;

    const { direction } = calcTrend(recorded);
    const { direction: recentDir } = calcTrend(recorded.slice(-3));

    const ytdTotal = recorded.reduce((s, d) => s + d.revenue, 0);

    const half = Math.floor(recorded.length / 2);
    const firstAvg = recorded.slice(0, half).reduce((s, d) => s + d.revenue, 0) / (half || 1);
    const secondAvg = recorded.slice(half).reduce((s, d) => s + d.revenue, 0) / (recorded.length - half || 1);
    const popChange = firstAvg > 0
        ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
        : null;

    const peak = recorded.reduce((b, d) => d.revenue > b.revenue ? d : b, recorded[0]);
    const trough = recorded.reduce((b, d) => d.revenue < b.revenue ? d : b, recorded[0]);

    return { direction, recentDir, ytdTotal, popChange, peak, trough, recorded };
}

// ─── Quarter bands (derived from FY month order) ──────────────────────────────
//
// Q1 = Shrawan–Ashwin (fyIndex 1–3), Q2 = Kartik–Poush (4–6),
// Q3 = Magh–Falgun+Chaitra (7–9), Q4 = Baisakh–Ashadh (10–12)

function buildQBands(fyMonths) {
    const quarters = [1, 2, 3, 4].map((q) => {
        const qMonths = fyMonths.filter((m) => m.quarter === q);
        return {
            label: `Q${q}`,
            x1: qMonths[0]?.short,
            x2: qMonths[qMonths.length - 1]?.short,
            fill: q % 2 === 1 ? 'rgba(231,229,224,0.18)' : 'rgba(0,0,0,0)',
        };
    });
    return quarters.filter((q) => q.x1 && q.x2);
}

// ─── VerdictBadge ─────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }) {
    if (!verdict) return null;
    const { direction, recentDir, popChange, ytdTotal, recorded } = verdict;

    const isUp = direction === 'up';
    const isDown = direction === 'down';
    const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;

    const theme = isUp
        ? {
            bg: 'var(--color-success-bg)', border: 'var(--color-success-border)',
            iconBg: 'var(--color-success)', text: 'var(--color-text-strong)', sub: 'var(--color-success)'
        }
        : isDown
            ? {
                bg: 'var(--color-danger-bg)', border: 'var(--color-danger-border)',
                iconBg: 'var(--color-danger)', text: 'var(--color-text-strong)', sub: 'var(--color-danger)'
            }
            : {
                bg: 'var(--color-surface)', border: 'var(--color-border)',
                iconBg: 'var(--color-text-weak)', text: 'var(--color-text-body)', sub: 'var(--color-text-sub)'
            };

    const label = isUp ? 'Growing' : isDown ? 'Declining' : 'Stable';
    const recentLabel = recentDir === 'up' ? 'Accelerating ↑'
        : recentDir === 'down' ? 'Slowing ↓'
            : 'Holding steady';
    const popText = popChange != null
        ? `${popChange > 0 ? '+' : ''}${popChange}% second-half vs first`
        : null;

    return (
        <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border"
            style={{ background: theme.bg, borderColor: theme.border }}>

            <div className="rounded-lg p-1.5 shrink-0" style={{ background: theme.iconBg }}>
                <Icon className="w-3.5 h-3.5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-bold leading-none" style={{ color: theme.text }}>
                        Revenue {label}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: theme.sub }}>
                        {recentLabel}
                    </span>
                </div>
                {(popText || recorded.length > 0) && (
                    <p className="text-[10px] mt-0.5 font-medium" style={{ color: theme.sub }}>
                        {[
                            popText,
                            `${recorded.length} months recorded`,
                            `YTD ₹${fmtCompact(ytdTotal)}`,
                        ].filter(Boolean).join(' · ')}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <svg width="22" height="10" viewBox="0 0 22 10">
                    <path d="M1 9 C5 9 7 1 11 1 C15 1 17 6 21 4"
                        stroke={COLOR.trendLine} strokeWidth="2"
                        fill="none" strokeLinecap="round" />
                </svg>
                <span className="text-[9px] font-semibold tracking-wide uppercase"
                    style={{ color: COLOR.trendLine }}>
                    3-mo avg
                </span>
            </div>
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload ?? {};
    const monthName = d.fullName ?? (d.month != null ? NEPALI_MONTH_NAMES[d.month - 1] : label);
    const trendVal = payload.find((p) => p.dataKey === 'trend')?.value;

    return (
        <div className="rounded-xl border shadow-lg px-3 py-2.5 text-xs min-w-[150px]"
            style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--color-text-strong)' }}>
                {monthName} {d.bsYear}
            </p>

            {d.isEmpty ? (
                <p style={{ color: COLOR.axisText }} className="italic">
                    {d.isFuture ? 'Upcoming month' : 'No data recorded'}
                </p>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-4 mb-1">
                        <span style={{ color: COLOR.axisText }}>Revenue</span>
                        <span className="font-bold tabular-nums" style={{ color: COLOR.barHighlight }}>
                            {fmtFull(d.revenue)}
                        </span>
                    </div>
                    {trendVal != null && (
                        <div className="flex items-center justify-between gap-4 mb-1">
                            <span style={{ color: COLOR.axisText }}>3-mo avg</span>
                            <span className="font-semibold tabular-nums" style={{ color: COLOR.trendLine }}>
                                {fmtFull(Math.round(trendVal))}
                            </span>
                        </div>
                    )}
                    {d.momChange != null && (
                        <div className="flex items-center justify-between gap-4 pt-1 border-t"
                            style={{ borderColor: COLOR.gridLine }}>
                            <span style={{ color: COLOR.axisText }}>vs prev month</span>
                            <span className="font-bold tabular-nums"
                                style={{ color: d.momChange > 0 ? COLOR.up : d.momChange < 0 ? COLOR.down : COLOR.flat }}>
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
                    fill={COLOR.barHighlight} opacity={0.12} />
            )}
            <text x={0} y={0} dy={14} textAnchor="middle" fontSize={9}
                fontWeight={isHighlight ? 700 : 400}
                fill={isHighlight ? COLOR.axisHighlight : isEmpty ? COLOR.gridLine : COLOR.axisText}>
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
    const isPos = point.momChange > 0;
    return (
        <text x={x + width / 2} y={y - 5} textAnchor="middle"
            fontSize={7} fontWeight={700}
            fill={isPos ? COLOR.up : COLOR.down}
            style={{ pointerEvents: 'none' }}>
            {isPos ? '+' : ''}{point.momChange}%
        </text>
    );
}

// ─── Current month callout ────────────────────────────────────────────────────

function CurrentMonthCallout({ data, currentMonth, currentYear }) {
    const point = data.find((d) => d.month === currentMonth && d.bsYear === currentYear);
    const mthName = NEPALI_MONTH_NAMES[currentMonth - 1] ?? '';

    if (!point || point.isEmpty) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR.gridLine }} />
                <span className="font-semibold" style={{ color: COLOR.axisText }}>
                    {mthName} {currentYear}
                </span>
                <span style={{ color: COLOR.gridLine }}>·</span>
                <span style={{ color: COLOR.axisText }}>No data recorded yet</span>
            </div>
        );
    }

    const MomIcon = point.momChange == null ? Minus : point.momChange > 0 ? TrendingUp : TrendingDown;
    const momColor = point.momChange == null ? COLOR.flat : point.momChange > 0 ? COLOR.up : COLOR.down;

    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: COLOR.barHighlight, outline: `2px solid ${COLOR.barEmpty}`, outlineOffset: '1px' }} />
            <span className="font-bold" style={{ color: COLOR.axisHighlight }}>
                {mthName} {currentYear}
            </span>
            <span style={{ color: COLOR.gridLine }}>·</span>
            <span className="font-bold tabular-nums" style={{ color: 'var(--color-text-strong)' }}>
                {fmtFull(point.revenue)}
            </span>
            {point.momChange != null && (
                <>
                    <span style={{ color: COLOR.gridLine }}>·</span>
                    <span className="flex items-center gap-0.5 font-semibold tabular-nums"
                        style={{ color: momColor }}>
                        <MomIcon className="w-3 h-3" />
                        {point.momChange > 0 ? '+' : ''}{point.momChange}% vs last month
                    </span>
                </>
            )}
        </div>
    );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ data }) {
    const recorded = data.filter((d) => !d.isEmpty);
    if (recorded.length === 0) return null;

    const ytdTotal = recorded.reduce((s, d) => s + d.revenue, 0);
    const avg = Math.round(ytdTotal / recorded.length);
    const peak = recorded.reduce((b, d) => d.revenue > b.revenue ? d : b, recorded[0]);
    const peakName = peak.fullName ?? NEPALI_MONTH_NAMES[peak.month - 1];

    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2 border-t"
            style={{ borderColor: COLOR.gridLine }}>
            {[
                { label: 'FY Progress', value: `${recorded.length}/12 months` },
                { label: 'YTD', value: `₹${fmtCompact(ytdTotal)}` },
                { label: 'Avg / mo', value: `₹${fmtCompact(avg)}` },
                peakName ? { label: 'Peak', value: `${peakName} · ₹${fmtCompact(peak.revenue)}` } : null,
            ].filter(Boolean).map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold tracking-widest uppercase"
                        style={{ color: COLOR.axisText }}>{label}</span>
                    <span className="text-[10px] font-bold tabular-nums"
                        style={{ color: COLOR.axisHighlight }}>{value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Skeleton / Empty ─────────────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="h-full w-full flex items-end gap-1 px-2">
            {[40, 65, 30, 80, 55, 70, 45, 60, 75, 50, 35, 68].map((h, i) => (
                <div key={i} className="flex-1 rounded-t animate-pulse"
                    style={{ height: `${h}%`, minHeight: 6, background: COLOR.barEmpty }} />
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2
            rounded-xl border border-dashed text-center px-4"
            style={{ borderColor: COLOR.gridLine }}>
            <p className="text-xs font-semibold" style={{ color: COLOR.axisText }}>No revenue data yet</p>
            <p className="text-[10px]" style={{ color: COLOR.axisText }}>Record payments to see your trend</p>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BarDiagram({ stats, loading, error, period = 'thisYear' }) {
    const [quarterFilter, setQuarterFilter] = React.useState('ALL');

    // ── Derive all date context from the real BS calendar ─────────────────────
    const todayBs = useMemo(() => {
        // getCurrentFYMonths is cheap — runs once per render
        return getCurrentFYMonths();
    }, []);

    const currentFY = todayBs.fy;                        // e.g. 2081
    const currentMonth = todayBs.currentMonth;              // 1–12
    const currentYear = todayBs.currentYear;               // BS year of today

    // For "last year" we shift the FY back by 1
    const targetFY = period === 'thisYear' ? currentFY : currentFY - 1;
    const fyLabel = getFYLabel(targetFY);

    // Build the ordered 12-month FY array for the target year.
    // If period === 'lastYear' we synthesise a fake bsDate pointing to the
    // last month of that FY (Ashadh of targetFY+1) so getFYMonths works correctly.
    const fyMonths = useMemo(() => {
        if (period === 'thisYear') {
            return todayBs.months;
        }
        // Last year: all 12 months in FY order, all marked past
        const lastYearFakeDate = { year: targetFY + 1, month: 3, day: 30 }; // Chaitra (end of FY)
        const { months } = getCurrentFYMonths(lastYearFakeDate);
        return months;
    }, [period, targetFY, todayBs.months]);

    // Raw API data array
    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueByMonth ?? [])
        : (stats?.revenueLastYear ?? stats?.revenueByMonth ?? []);

    const monthlyData = useMemo(
        () => buildChartData(rawData, fyMonths, currentMonth, period === 'thisYear'),
        [rawData, fyMonths, currentMonth, period],
    );

    // Filter data by quarter
    const filteredData = useMemo(() => {
        if (quarterFilter === 'ALL') return monthlyData;
        const targetQuarter = parseInt(quarterFilter.replace('Q', ''));
        return monthlyData.filter(d => d.quarter === targetQuarter);
    }, [monthlyData, quarterFilter]);

    const verdict = useMemo(() => computeVerdict(filteredData), [filteredData]);
    const hasNoData = filteredData.length === 0 || filteredData.every((d) => d.isEmpty);

    const qBands = useMemo(() => buildQBands(fyMonths), [fyMonths]);

    return (
        <Card className="w-full overflow-hidden shadow-none rounded-2xl border-0">
            <CardHeader className="flex flex-row items-start justify-between px-4 pt-4 pb-2 gap-3">
                <div className="space-y-0.5">
                    <CardTitle className="text-sm font-bold" style={{ color: 'var(--color-text-strong)' }}>
                        Revenue Trend
                    </CardTitle>
                    <p className="text-[11px] font-medium tracking-wide" style={{ color: COLOR.axisText }}>
                        {loading ? 'Loading…' : fyLabel}
                    </p>
                </div>

                {!loading && !hasNoData && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setQuarterFilter('ALL')}
                            className={`px-2 py-1 rounded text-[10px] font-medium tracking-wide transition-colors ${quarterFilter === 'ALL'
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-secondary'
                                }`}
                            style={{ color: quarterFilter === 'ALL' ? COLOR.barHighlight : COLOR.axisText }}
                        >
                            ALL
                        </button>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                            <button
                                key={q}
                                onClick={() => setQuarterFilter(q)}
                                className={`px-2 py-1 rounded text-[10px] font-medium tracking-wide transition-colors ${quarterFilter === q
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-secondary'
                                    }`}
                                style={{ color: quarterFilter === q ? COLOR.barHighlight : COLOR.axisText }}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {error && <p className="text-xs font-medium" style={{ color: COLOR.down }}>{error}</p>}

                {!loading && !hasNoData && verdict && <VerdictBadge verdict={verdict} />}

                {!loading && !hasNoData && period === 'thisYear' && quarterFilter === 'ALL' && (
                    <CurrentMonthCallout
                        data={filteredData}
                        currentMonth={currentMonth}
                        currentYear={currentYear}
                    />
                )}

                <div className="h-[160px] md:h-[180px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : hasNoData ? (
                        <EmptyState />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={filteredData}
                                margin={{ top: 22, right: 6, left: 0, bottom: 4 }}
                                barCategoryGap="22%"
                            >
                                {quarterFilter === 'ALL' && qBands.map((q) => (
                                    <ReferenceArea key={q.label}
                                        x1={q.x1} x2={q.x2} fill={q.fill} stroke="none"
                                        label={{
                                            value: q.label, position: 'insideTopLeft',
                                            fontSize: 8, fontWeight: 600, fill: '#A8A29E', dx: 2, dy: -16,
                                        }}
                                    />
                                ))}

                                <XAxis dataKey="name" axisLine={false} tickLine={false}
                                    tick={(props) => <XAxisTick {...props} monthlyData={filteredData} />}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(231,229,224,0.2)', radius: 4 }} />

                                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={28} minPointSize={2}>
                                    {filteredData.map((entry, index) => (
                                        <Cell key={index}
                                            fill={
                                                entry.isEmpty ? COLOR.barEmpty
                                                    : entry.isHighlighted ? COLOR.barHighlight
                                                        : COLOR.barRecorded
                                            }
                                            stroke={entry.isEmpty ? '#E7E5E0' : 'none'}
                                            strokeWidth={entry.isEmpty ? 1 : 0}
                                            strokeDasharray={entry.isEmpty ? '3 2' : 'none'}
                                        />
                                    ))}
                                    <LabelList dataKey="revenue"
                                        content={(props) => <MoMLabel {...props} monthlyData={filteredData} />}
                                    />
                                </Bar>

                                <Line
                                    dataKey="trend"
                                    type="monotone"
                                    stroke={COLOR.trendLine}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: COLOR.trendLine, stroke: '#FFFFFF', strokeWidth: 2 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {!loading && !hasNoData && <SummaryStrip data={filteredData} />}
            </CardContent>
        </Card>
    );
}