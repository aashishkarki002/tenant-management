import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, LabelList, ReferenceArea, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { NEPALI_MONTH_NAMES, getCurrentNepaliMonth } from '../../../utils/nepaliDate';

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGHLIGHT_FILL = '#375534';   // orange-800 — brand accent, current month only
const MUTED_FILL = '#6B9071';   // slate-300 — all other recorded months
const EMPTY_FILL = '#F5F7F4';   // slate-100 — months with no data

const MONTH_SHORT = NEPALI_MONTH_NAMES.map((n) => n.slice(0, 3));

/**
 * Nepali fiscal year quarters (Shrawan = month 1):
 *   Q1: Shrawan–Ashwin   (1–3)
 *   Q2: Kartik–Poush     (4–6)
 *   Q3: Magh–Chaitra     (7–9)
 *   Q4: Baisakh–Ashadh   (10–12)
 */
const QUARTERS = [
    { label: 'Q1', months: [1, 2, 3], fill: 'rgba(241,245,249,0.55)' },
    { label: 'Q2', months: [4, 5, 6], fill: 'rgba(248,250,252,0.0)' },
    { label: 'Q3', months: [7, 8, 9], fill: 'rgba(241,245,249,0.55)' },
    { label: 'Q4', months: [10, 11, 12], fill: 'rgba(248,250,252,0.0)' },
];

// ─── Approximate Nepali year (BS) from Gregorian ──────────────────────────────
// Industry note: use a proper BS library (e.g. `bikram-sambat`) in production.
// This approximation is sufficient for display-only FY labels.
function getApproxNepaliYear() {
    const now = new Date();
    const adYr = now.getFullYear();
    const adMon = now.getMonth(); // 0-indexed; Nepali new year ~mid-April (month 3)
    return adMon >= 3 ? adYr + 56 : adYr + 57;
}

// ─── Data builder ─────────────────────────────────────────────────────────────

/**
 * Normalises raw backend data into a 12-entry Recharts array (Shrawan → Ashadh).
 * Adds `momChange` (month-over-month %) derived from the previous non-empty month.
 *
 * Industry pattern: "enrich at the boundary" — components receive ready-to-render
 * data; they never compute derived metrics inline during render.
 */
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
                name: shortName,
                month: monthNum,
                revenue,
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
                revenue,
                isEmpty: revenue === 0,
                isHighlighted: highlightCurrent
                    ? item.month === currentMonth
                    : Boolean(item.isHighlighted),
            };
        });
    }

    // ── Compute month-over-month % change ────────────────────────────────────
    // We compare against the most recent *non-empty* prior month so that months
    // with zero revenue don't produce misleading +∞ annotations.
    return base.map((item, idx) => {
        if (item.isEmpty || item.revenue === 0) return { ...item, momChange: null };
        // Walk backwards to find the last non-empty month
        let prevRevenue = 0;
        for (let i = idx - 1; i >= 0; i--) {
            if (!base[i].isEmpty && base[i].revenue > 0) {
                prevRevenue = base[i].revenue;
                break;
            }
        }
        const momChange = prevRevenue > 0
            ? Math.round(((item.revenue - prevRevenue) / prevRevenue) * 100)
            : null;
        return { ...item, momChange };
    });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCompact(n) {
    if (n == null) return '—';
    if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
    return `₹${n}`;
}

function fmtFull(n) {
    return `₹${Number(n).toLocaleString('en-IN')}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="h-full w-full flex items-end gap-1 px-2">
            {[40, 65, 30, 80, 55, 70, 45, 60, 75, 50, 35, 68].map((h, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t animate-pulse bg-slate-100"
                    style={{ height: `${h}%`, minHeight: 6 }}
                />
            ))}
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const { revenue, isEmpty, momChange, month } = payload[0]?.payload ?? {};
    const monthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : label;

    return (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[120px]">
            <p className="font-semibold text-zinc-700 mb-1.5">{monthName}</p>
            {isEmpty ? (
                <p className="text-zinc-400 italic">No data recorded</p>
            ) : (
                <>
                    <p className="text-orange-800 font-bold tabular-nums text-sm">
                        {fmtFull(revenue)}
                    </p>
                    {momChange != null && (
                        <p className={`mt-1 font-semibold tabular-nums ${momChange > 0 ? 'text-emerald-600' :
                            momChange < 0 ? 'text-red-500' : 'text-zinc-400'
                            }`}>
                            {momChange > 0 ? '▲' : momChange < 0 ? '▼' : '—'}{' '}
                            {Math.abs(momChange)}% vs prev month
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Custom X-Axis Tick ───────────────────────────────────────────────────────

function XAxisTick({ x, y, payload, monthlyData }) {
    const point = monthlyData.find((d) => d.name === payload.value);
    const isHighlight = point?.isHighlighted ?? false;
    const isEmpty = point?.isEmpty ?? false;

    return (
        <g transform={`translate(${x},${y})`}>
            {isHighlight && (
                <circle cx={0} cy={14} r={10} fill={HIGHLIGHT_FILL} opacity={0.1} />
            )}
            <text
                x={0} y={0} dy={14}
                textAnchor="middle"
                fontSize={9}
                fontWeight={isHighlight ? 700 : 400}
                fill={isHighlight ? HIGHLIGHT_FILL : isEmpty ? '#e2e8f0' : '#94a3b8'}
            >
                {payload.value}
            </text>
        </g>
    );
}

// ─── MoM Label (above each bar) ───────────────────────────────────────────────

/**
 * Renders a compact month-over-month % annotation above each bar.
 *
 * Design rules:
 *  - Hidden for empty months (no data to compare against)
 *  - Hidden when |change| < 2% — prevents annotation noise on stable months
 *  - Green for positive, red for negative, suppressed when null
 */
function MoMLabel({ x, y, width, index, monthlyData }) {
    if (!monthlyData) return null;
    const point = monthlyData[index];
    if (!point || point.isEmpty || point.momChange == null) return null;
    if (Math.abs(point.momChange) < 2) return null; // suppress noise

    const isPos = point.momChange > 0;
    const color = isPos ? '#16a34a' : '#dc2626';
    const prefix = isPos ? '+' : '';

    return (
        <text
            x={x + width / 2}
            y={y - 5}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill={color}
            style={{ pointerEvents: 'none' }}
        >
            {prefix}{point.momChange}%
        </text>
    );
}

// ─── Current Month Callout Chip ───────────────────────────────────────────────

function CurrentMonthCallout({ data, currentMonth, nepaliYear }) {
    const point = data.find((d) => d.month === currentMonth);
    const mthName = NEPALI_MONTH_NAMES[currentMonth - 1] ?? '';

    if (!point || point.isEmpty) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                <span className="font-medium">{mthName} {nepaliYear}</span>
                <span className="text-zinc-300">·</span>
                <span>No data recorded yet</span>
            </div>
        );
    }

    const MomIcon = point.momChange == null ? Minus
        : point.momChange > 0 ? TrendingUp : TrendingDown;
    const momColor = point.momChange == null ? 'text-zinc-400'
        : point.momChange > 0 ? 'text-emerald-600' : 'text-red-500';

    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100 text-xs">
            {/* "You are here" dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-orange-800 shrink-0 ring-2 ring-orange-200" />

            {/* Month + year */}
            <span className="font-semibold text-orange-900">{mthName} {nepaliYear}</span>

            <span className="text-orange-300">·</span>

            {/* Revenue */}
            <span className="font-bold text-orange-800 tabular-nums">
                {fmtFull(point.revenue)}
            </span>

            {/* MoM delta */}
            {point.momChange != null && (
                <>
                    <span className="text-orange-300">·</span>
                    <span className={`flex items-center gap-0.5 font-semibold tabular-nums ${momColor}`}>
                        <MomIcon className="w-3 h-3" />
                        {point.momChange > 0 ? '+' : ''}{point.momChange}% vs last month
                    </span>
                </>
            )}
        </div>
    );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

/**
 * Below-chart 3-metric strip.
 * Answers: "Where am I in the FY?" at a glance without reading bar heights.
 */
function SummaryStrip({ data }) {
    const recorded = data.filter((d) => !d.isEmpty);
    const totalMonths = data.length;
    const totalRev = recorded.reduce((s, d) => s + d.revenue, 0);

    const peak = recorded.reduce(
        (best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best),
        null,
    );
    const peakName = peak ? NEPALI_MONTH_NAMES[peak.month - 1] : null;

    if (recorded.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2 border-t border-zinc-100">
            {/* FY progress */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
                    FY Progress
                </span>
                <span className="text-[10px] font-bold text-zinc-600 tabular-nums">
                    {recorded.length}/{totalMonths} months
                </span>
            </div>

            {/* YTD total */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
                    YTD
                </span>
                <span className="text-[10px] font-bold text-zinc-700 tabular-nums">
                    {fmtCompact(totalRev)}
                </span>
            </div>

            {/* Peak month */}
            {peakName && (
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
                        Peak
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 tabular-nums">
                        {peakName} · {fmtCompact(peak.revenue)}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2 border border-dashed border-zinc-200 rounded-lg text-center px-4">
            <p className="text-xs font-medium text-zinc-500">No revenue data yet</p>
            <p className="text-[10px] text-zinc-400">Record payments to see your monthly trend</p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * BarDiagram — Revenue Trend chart.
 *
 * ARCHITECTURE NOTE (moved toggle to Dashboard header):
 * This component is now a pure display component. It receives `period` as a
 * prop from Dashboard.jsx, which owns the period state and renders the
 * Year toggle in the global header slot. This follows the "lift state to
 * the nearest common ancestor" pattern — the header and this chart both need
 * period, so Dashboard owns it.
 *
 * Props:
 *   stats      — normalised stats object from useStats()
 *   loading    — boolean
 *   error      — string | null
 *   period     — 'thisYear' | 'lastYear' (controlled by Dashboard header)
 *   propertyId — future multi-property support
 */
export default function BarDiagram({ stats, loading, error, period = 'thisYear', propertyId }) {
    const currentNepaliMonth = getCurrentNepaliMonth();
    const nepaliYear = getApproxNepaliYear();

    // FY label: "FY 2081–82" (this year) or "FY 2080–81" (last year)
    const fyYear = period === 'thisYear' ? nepaliYear : nepaliYear - 1;
    const fyLabel = `FY ${fyYear}–${String(fyYear + 1).slice(-2)}`;

    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueByMonth ?? [])
        : (stats?.revenueLastYear ?? stats?.revenueByMonth ?? []);

    const monthlyData = buildChartData(
        rawData,
        currentNepaliMonth,
        period === 'thisYear',
    );

    const hasNoData = monthlyData.length === 0 || monthlyData.every((d) => d.isEmpty);

    // Quarter ReferenceArea x-boundaries (short names, must match XAxis dataKey values)
    const qBands = QUARTERS.map((q) => ({
        ...q,
        x1: MONTH_SHORT[q.months[0] - 1],
        x2: MONTH_SHORT[q.months[q.months.length - 1] - 1],
    }));

    return (
        <Card className="w-full overflow-hidden shadow-sm rounded-xl border-zinc-200">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <CardHeader className="flex flex-row items-start justify-between px-4 pt-4 pb-2 gap-3">
                <div className="min-w-0 space-y-0.5">
                    <CardTitle className="text-sm font-semibold text-zinc-900">
                        Revenue Trend
                    </CardTitle>
                    {/* Fiscal year subtitle — always visible, answers "which year am I looking at?" */}
                    <p className="text-[11px] font-semibold text-zinc-400 tracking-wide">
                        {loading ? 'Loading…' : fyLabel}
                    </p>
                </div>

                {/* Quarter legend — top-right, minimal */}
                {!loading && !hasNoData && (
                    <div className="flex items-center gap-3 shrink-0">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                            <span key={q} className="text-[10px] font-semibold text-zinc-400 tracking-wide">
                                {q}
                            </span>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {error && (
                    <p className="text-xs text-red-500 font-medium">{error}</p>
                )}

                {/* ── Current Month Callout ──────────────────────────────────────── */}
                {!loading && !hasNoData && period === 'thisYear' && (
                    <CurrentMonthCallout
                        data={monthlyData}
                        currentMonth={currentNepaliMonth}
                        nepaliYear={fyYear}
                    />
                )}

                {/* ── Chart ─────────────────────────────────────────────────────── */}
                {/*
          Height: 160px desktop. Quarter bands use ReferenceArea (Recharts built-in).
          MoM annotations use LabelList with a custom SVG text renderer.
          Industry note: keep chart height fixed — fluid height causes layout shift
          when data loads and feels unstable in executive dashboards.
        */}
                <div className="h-[148px] md:h-[164px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : hasNoData ? (
                        <EmptyState />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyData}
                                margin={{ top: 20, right: 2, left: 0, bottom: 4 }}
                                barCategoryGap="18%"
                            >
                                {/* Quarter background bands */}
                                {qBands.map((q) => (
                                    <ReferenceArea
                                        key={q.label}
                                        x1={q.x1}
                                        x2={q.x2}
                                        fill={q.fill}
                                        stroke="none"
                                        label={{
                                            value: q.label,
                                            position: 'insideTopLeft',
                                            fontSize: 8,
                                            fontWeight: 600,
                                            fill: '#cbd5e1',
                                            dx: 2,
                                            dy: -14,
                                        }}
                                    />
                                ))}

                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={(props) => (
                                        <XAxisTick {...props} monthlyData={monthlyData} />
                                    )}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: '#f8fafc', radius: 3 }}
                                />

                                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={30} minPointSize={2}>
                                    {/* Per-bar fill driven by state (empty / muted / highlight) */}
                                    {monthlyData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={
                                                entry.isEmpty ? EMPTY_FILL
                                                    : entry.isHighlighted ? HIGHLIGHT_FILL
                                                        : MUTED_FILL
                                            }
                                            stroke={entry.isEmpty ? '#e2e8f0' : 'none'}
                                            strokeWidth={entry.isEmpty ? 1 : 0}
                                            strokeDasharray={entry.isEmpty ? '3 2' : 'none'}
                                        />
                                    ))}

                                    {/*
                    MoM label list — custom SVG text above each bar.
                    `monthlyData` is closed over so the renderer can look up
                    momChange by index without Recharts needing to know about it.
                  */}
                                    <LabelList
                                        dataKey="revenue"
                                        content={(props) => (
                                            <MoMLabel {...props} monthlyData={monthlyData} />
                                        )}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* ── Summary Strip ──────────────────────────────────────────────── */}
                {!loading && !hasNoData && (
                    <SummaryStrip data={monthlyData} />
                )}
            </CardContent>
        </Card>
    );
}