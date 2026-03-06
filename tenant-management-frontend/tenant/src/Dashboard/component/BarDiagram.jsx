import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, LabelList, ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { NEPALI_MONTH_NAMES, getCurrentNepaliMonth } from '../../../utils/nepaliDate';

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLOR = {
    barHighlight: '#3D1414',
    barRecorded: '#A07070',
    barEmpty: '#F0EBE8',
    trendLine: '#C4721A',
    up: '#2E7A4A',
    down: '#B02020',
    flat: '#7A6858',
    gridLine: '#EEE9E5',
    axisText: '#B0A090',
    axisHighlight: '#3D1414',
};

const MONTH_SHORT = NEPALI_MONTH_NAMES.map((n) => n.slice(0, 3));

const QUARTERS = [
    { label: 'Q1', months: [1, 2, 3] },
    { label: 'Q2', months: [4, 5, 6] },
    { label: 'Q3', months: [7, 8, 9] },
    { label: 'Q4', months: [10, 11, 12] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApproxNepaliYear() {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() + 56 : now.getFullYear() + 57;
}

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
//
// calcTrend: least-squares linear regression over recorded months.
//   direction 'up'   = slope > 1.5% of mean revenue (meaningful growth)
//   direction 'down' = slope < -1.5% of mean (meaningful decline)
//   direction 'flat' = within noise band

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

// rollingAvg: 3-month centered average, null for empty months.
// Smooths single-month noise (vacancy gaps, lump payments).

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

function buildChartData(items, currentMonth, highlightCurrent) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const hasMonthField = items.some((it) => it.month != null);
    let base;

    if (hasMonthField) {
        const lookup = new Map(items.map((it) => [it.month, it]));
        base = MONTH_SHORT.map((shortName, i) => {
            const monthNum = i + 1;
            const item = lookup.get(monthNum);
            const revenue = Number(item?.total ?? item?.revenue ?? 0) || 0;
            return {
                name: shortName, month: monthNum, revenue,
                isEmpty: revenue === 0,
                isHighlighted: highlightCurrent && monthNum === currentMonth,
            };
        });
    } else {
        base = items.map((item) => {
            const revenue = Number(item.revenue ?? item.value ?? item.total ?? 0) || 0;
            return {
                name: item.name ?? item.label ?? '',
                month: item.month ?? null,
                revenue, isEmpty: revenue === 0,
                isHighlighted: highlightCurrent ? item.month === currentMonth : Boolean(item.isHighlighted),
            };
        });
    }

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

    // Attach rolling average as `trend` for the Line series
    const avgs = rollingAvg(withMom, 3);
    return withMom.map((d, i) => ({ ...d, trend: avgs[i] }));
}

// ─── Verdict computation ──────────────────────────────────────────────────────
//
// Answers the owner's core question: "Is my revenue growing or declining?"
// Pure function — all logic here, zero logic in components.

function computeVerdict(monthlyData) {
    const recorded = monthlyData.filter((d) => !d.isEmpty);
    if (recorded.length < 2) return null;

    const { direction } = calcTrend(recorded);

    // Recent momentum: trend of just the last 3 recorded months
    const { direction: recentDir } = calcTrend(recorded.slice(-3));

    const ytdTotal = recorded.reduce((s, d) => s + d.revenue, 0);

    // First-half vs second-half average (period-over-period change)
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

// ─── VerdictBadge ─────────────────────────────────────────────────────────────
//
// The first thing the owner reads — directly answers the question.
// Sits ABOVE the chart so it's visible before the bars.

function VerdictBadge({ verdict }) {
    if (!verdict) return null;
    const { direction, recentDir, popChange, ytdTotal, recorded } = verdict;

    const isUp = direction === 'up';
    const isDown = direction === 'down';
    const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;

    const theme = isUp
        ? { bg: '#F0FAF3', border: '#C3E8CF', iconBg: '#2E7A4A', text: '#1A5C34', sub: '#2E7A4A' }
        : isDown
            ? { bg: '#FDF2F2', border: '#F0CBCB', iconBg: '#B02020', text: '#8A1515', sub: '#B02020' }
            : { bg: '#F8F5F2', border: '#E8E0D8', iconBg: '#7A6858', text: '#3D2A20', sub: '#7A6858' };

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

            {/* Trend line legend swatch */}
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
    const monthName = d.month != null ? NEPALI_MONTH_NAMES[d.month - 1] : label;
    const trendVal = payload.find((p) => p.dataKey === 'trend')?.value;

    return (
        <div className="rounded-xl border shadow-lg px-3 py-2.5 text-xs min-w-[150px]"
            style={{ background: '#FDFCFA', borderColor: '#DDD6D0' }}>
            <p className="font-bold mb-2" style={{ color: '#1C1A18' }}>{monthName}</p>

            {d.isEmpty ? (
                <p style={{ color: '#B0A090' }} className="italic">No data recorded</p>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-4 mb-1">
                        <span style={{ color: '#7A6858' }}>Revenue</span>
                        <span className="font-bold tabular-nums" style={{ color: COLOR.barHighlight }}>
                            {fmtFull(d.revenue)}
                        </span>
                    </div>
                    {trendVal != null && (
                        <div className="flex items-center justify-between gap-4 mb-1">
                            <span style={{ color: '#7A6858' }}>3-mo avg</span>
                            <span className="font-semibold tabular-nums" style={{ color: COLOR.trendLine }}>
                                {fmtFull(Math.round(trendVal))}
                            </span>
                        </div>
                    )}
                    {d.momChange != null && (
                        <div className="flex items-center justify-between gap-4 pt-1 border-t"
                            style={{ borderColor: '#EEE9E5' }}>
                            <span style={{ color: '#7A6858' }}>vs prev month</span>
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

// ─── X-Axis tick ─────────────────────────────────────────────────────────────

function XAxisTick({ x, y, payload, monthlyData }) {
    const point = monthlyData.find((d) => d.name === payload.value);
    const isHighlight = point?.isHighlighted ?? false;
    const isEmpty = point?.isEmpty ?? false;
    return (
        <g transform={`translate(${x},${y})`}>
            {isHighlight && (
                <rect x={-9} y={4} width={18} height={14} rx={4}
                    fill={COLOR.barHighlight} opacity={0.1} />
            )}
            <text x={0} y={0} dy={14} textAnchor="middle" fontSize={9}
                fontWeight={isHighlight ? 700 : 400}
                fill={isHighlight ? COLOR.axisHighlight : isEmpty ? '#DDD6D0' : COLOR.axisText}>
                {payload.value}
            </text>
        </g>
    );
}

// ─── MoM label above bar ─────────────────────────────────────────────────────

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

function CurrentMonthCallout({ data, currentMonth, nepaliYear }) {
    const point = data.find((d) => d.month === currentMonth);
    const mthName = NEPALI_MONTH_NAMES[currentMonth - 1] ?? '';

    if (!point || point.isEmpty) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: '#F8F5F2', border: '1px solid #EEE9E5' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#DDD6D0' }} />
                <span className="font-semibold" style={{ color: '#7A6858' }}>{mthName} {nepaliYear}</span>
                <span style={{ color: '#DDD6D0' }}>·</span>
                <span style={{ color: '#B0A090' }}>No data recorded yet</span>
            </div>
        );
    }

    const MomIcon = point.momChange == null ? Minus : point.momChange > 0 ? TrendingUp : TrendingDown;
    const momColor = point.momChange == null ? COLOR.flat : point.momChange > 0 ? COLOR.up : COLOR.down;

    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#FBF7F5', border: '1px solid #EEE9E5' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: COLOR.barHighlight, outline: '2px solid #F0DADA', outlineOffset: '1px' }} />
            <span className="font-bold" style={{ color: COLOR.barHighlight }}>{mthName} {nepaliYear}</span>
            <span style={{ color: '#DDD6D0' }}>·</span>
            <span className="font-bold tabular-nums" style={{ color: '#1C1A18' }}>
                {fmtFull(point.revenue)}
            </span>
            {point.momChange != null && (
                <>
                    <span style={{ color: '#DDD6D0' }}>·</span>
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
    const peakName = NEPALI_MONTH_NAMES[peak.month - 1];

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
                        style={{ color: '#B0A090' }}>{label}</span>
                    <span className="text-[10px] font-bold tabular-nums"
                        style={{ color: '#3D2A20' }}>{value}</span>
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
                    style={{ height: `${h}%`, minHeight: 6, background: '#EEE9E5' }} />
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2
            rounded-xl border border-dashed text-center px-4"
            style={{ borderColor: '#DDD6D0' }}>
            <p className="text-xs font-semibold" style={{ color: '#7A6858' }}>No revenue data yet</p>
            <p className="text-[10px]" style={{ color: '#B0A090' }}>Record payments to see your trend</p>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BarDiagram({ stats, loading, error, period = 'thisYear' }) {
    const currentNepaliMonth = getCurrentNepaliMonth();
    const nepaliYear = getApproxNepaliYear();

    const fyYear = period === 'thisYear' ? nepaliYear : nepaliYear - 1;
    const fyLabel = `FY ${fyYear}–${String(fyYear + 1).slice(-2)}`;

    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueByMonth ?? [])
        : (stats?.revenueLastYear ?? stats?.revenueByMonth ?? []);

    const monthlyData = useMemo(
        () => buildChartData(rawData, currentNepaliMonth, period === 'thisYear'),
        [rawData, currentNepaliMonth, period],
    );

    const verdict = useMemo(() => computeVerdict(monthlyData), [monthlyData]);
    const hasNoData = monthlyData.length === 0 || monthlyData.every((d) => d.isEmpty);

    const qBands = QUARTERS.map((q) => ({
        ...q,
        x1: MONTH_SHORT[q.months[0] - 1],
        x2: MONTH_SHORT[q.months[q.months.length - 1] - 1],
        fill: q.months[0] % 2 === 1 ? 'rgba(200,185,175,0.07)' : 'rgba(0,0,0,0)',
    }));

    return (
        <Card className="w-full overflow-hidden shadow-none rounded-2xl border-0">
            <CardHeader className="flex flex-row items-start justify-between px-4 pt-4 pb-2 gap-3">
                <div className="space-y-0.5">
                    <CardTitle className="text-sm font-bold" style={{ color: '#1C1A18' }}>
                        Revenue Trend
                    </CardTitle>
                    <p className="text-[11px] font-semibold tracking-wide" style={{ color: '#B0A090' }}>
                        {loading ? 'Loading…' : fyLabel}
                    </p>
                </div>

                {!loading && !hasNoData && (
                    <div className="flex items-center gap-3 shrink-0">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                            <span key={q} className="text-[10px] font-semibold tracking-wide"
                                style={{ color: '#C8BDB6' }}>{q}</span>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {error && <p className="text-xs font-medium" style={{ color: COLOR.down }}>{error}</p>}

                {/* Verdict badge — the direct answer to "growing or declining?" */}
                {!loading && !hasNoData && verdict && <VerdictBadge verdict={verdict} />}

                {/* Current month callout */}
                {!loading && !hasNoData && period === 'thisYear' && (
                    <CurrentMonthCallout data={monthlyData} currentMonth={currentNepaliMonth} nepaliYear={fyYear} />
                )}

                {/* Chart: bars + trend line overlay */}
                <div className="h-[160px] md:h-[180px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : hasNoData ? (
                        <EmptyState />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={monthlyData}
                                margin={{ top: 22, right: 6, left: 0, bottom: 4 }}
                                barCategoryGap="22%"
                            >
                                {/* Quarter background shading */}
                                {qBands.map((q) => (
                                    <ReferenceArea key={q.label}
                                        x1={q.x1} x2={q.x2} fill={q.fill} stroke="none"
                                        label={{
                                            value: q.label, position: 'insideTopLeft',
                                            fontSize: 8, fontWeight: 600, fill: '#C8BDB6', dx: 2, dy: -16,
                                        }}
                                    />
                                ))}

                                <XAxis dataKey="name" axisLine={false} tickLine={false}
                                    tick={(props) => <XAxisTick {...props} monthlyData={monthlyData} />}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(200,185,175,0.12)', radius: 4 }} />

                                {/* Revenue bars */}
                                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={28} minPointSize={2}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={index}
                                            fill={
                                                entry.isEmpty ? COLOR.barEmpty
                                                    : entry.isHighlighted ? COLOR.barHighlight
                                                        : COLOR.barRecorded
                                            }
                                            stroke={entry.isEmpty ? '#DDD6D0' : 'none'}
                                            strokeWidth={entry.isEmpty ? 1 : 0}
                                            strokeDasharray={entry.isEmpty ? '3 2' : 'none'}
                                        />
                                    ))}
                                    <LabelList dataKey="revenue"
                                        content={(props) => <MoMLabel {...props} monthlyData={monthlyData} />}
                                    />
                                </Bar>

                                {/*
                                  Trend line — 3-month rolling average.
                                  Drawn on top of bars. Orange so it contrasts the burgundy/rose bars.
                                  connectNulls keeps it continuous across future empty months.
                                  dot={false} for a clean read; activeDot appears only on hover.
                                */}
                                <Line
                                    dataKey="trend"
                                    type="monotone"
                                    stroke={COLOR.trendLine}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: COLOR.trendLine, stroke: '#FDFCFA', strokeWidth: 2 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary strip */}
                {!loading && !hasNoData && <SummaryStrip data={monthlyData} />}
            </CardContent>
        </Card>
    );
}