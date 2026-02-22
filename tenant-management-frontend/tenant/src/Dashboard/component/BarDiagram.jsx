import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { useNepaliDate } from '../../../plugins/useNepaliDate';

const MUTED_FILL = '#cbd5e1';          // slate-300 — softer muted bars
const HIGHLIGHT_FILL = '#9a3412';       // orange-800

// All 12 Nepali month short names
const NEPALI_MONTH_NAMES = [
    'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw',
    'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha',
];

/**
 * Fills in missing months so the chart always shows all 12 months.
 * Months without data get revenue = 0 (renders as an empty-looking bar with a min height indicator).
 */
function buildFullYearData(items, currentMonth, highlightCurrent) {
    // Build a lookup from month number → revenue
    const lookup = new Map();
    if (Array.isArray(items)) {
        items.forEach((item) => {
            if (item.month != null) {
                lookup.set(item.month, Number(item.revenue ?? item.value ?? item.total ?? 0) || 0);
            }
        });
    }

    return NEPALI_MONTH_NAMES.map((name, i) => {
        const monthNum = i + 1;
        const revenue = lookup.get(monthNum) ?? 0;
        return {
            name,
            month: monthNum,
            revenue,
            isEmpty: revenue === 0,
            isHighlighted: highlightCurrent ? monthNum === currentMonth : false,
        };
    });
}

/**
 * Normalizes a free-form items array (no month numbers) —
 * used when the API returns items with just name/label/value.
 */
function normalizeGenericData(items, currentMonth, highlightCurrent) {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((item) => ({
        name: item.name ?? item.label ?? '',
        month: item.month ?? null,
        revenue: Number(item.revenue ?? item.value ?? item.total ?? 0) || 0,
        isEmpty: (Number(item.revenue ?? item.value ?? item.total ?? 0) || 0) === 0,
        isHighlighted: highlightCurrent
            ? item.month === currentMonth
            : Boolean(item.isHighlighted),
    }));
}

function normalizeChartData(items, currentMonth, highlightCurrent = false) {
    if (!Array.isArray(items) || items.length === 0) return [];

    // If any item has a `month` number field, build the full 12-month scaffold
    const hasMonthNumbers = items.some((it) => it.month != null);
    if (hasMonthNumbers) {
        return buildFullYearData(items, currentMonth, highlightCurrent);
    }
    return normalizeGenericData(items, currentMonth, highlightCurrent);
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function ChartSkeleton() {
    return (
        <div className="h-full w-full flex items-end gap-1 px-2">
            {[40, 65, 30, 80, 55, 70, 45, 60, 75, 50, 35, 68].map((h, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t animate-pulse bg-muted"
                    style={{ height: `${h}%`, minHeight: 8 }}
                />
            ))}
        </div>
    );
}

/* ── Custom Tooltip ───────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const { revenue, isEmpty } = payload[0]?.payload ?? {};
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
            <p className="font-semibold text-gray-800 mb-0.5">{label}</p>
            {isEmpty ? (
                <p className="text-gray-400 italic">No data recorded</p>
            ) : (
                <p className="text-orange-800 font-medium">
                    ₹{Number(revenue).toLocaleString()}
                </p>
            )}
        </div>
    );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function BarDiagram({ stats, loading, error }) {
    const [period, setPeriod] = useState('thisYear');
    const { month: currentNepaliMonth } = useNepaliDate();

    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueTrend ?? stats?.monthlyRevenue ?? stats?.revenueByMonth)
        : (stats?.revenueLastYear ?? stats?.revenueTrend ?? stats?.monthlyRevenue ?? stats?.revenueByMonth);

    const highlightCurrent = period === 'thisYear';
    const monthlyData = normalizeChartData(rawData, currentNepaliMonth, highlightCurrent);

    // Check if ALL bars are zero — true empty state (no array at all)
    const hasNoData = !rawData || (Array.isArray(rawData) && rawData.length === 0);

    // Stats for the subtitle: sum of collected months
    const totalRevenue = monthlyData.reduce((s, d) => s + d.revenue, 0);
    const filledMonths = monthlyData.filter((d) => !d.isEmpty).length;

    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-2">
                <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg font-semibold">Revenue Trend</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                        {loading
                            ? 'Loading…'
                            : hasNoData
                                ? 'No revenue data recorded yet'
                                : `₹${totalRevenue.toLocaleString()} across ${filledMonths} month${filledMonths !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <div className="flex rounded-md border border-input overflow-hidden shrink-0 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setPeriod('thisYear')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === 'thisYear'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        This Year
                    </button>
                    <button
                        type="button"
                        onClick={() => setPeriod('lastYear')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === 'lastYear'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        Last Year
                    </button>
                </div>
            </CardHeader>

            <CardContent>
                {error && <p className="text-sm text-destructive mb-2">{error}</p>}

                {/* Legend */}
                {!loading && !hasNoData && (
                    <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: HIGHLIGHT_FILL }} />
                            Current month
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: MUTED_FILL }} />
                            Other months
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block border border-dashed border-gray-300 bg-white" />
                            No data
                        </span>
                    </div>
                )}

                <div className="h-[220px] sm:h-[260px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : hasNoData ? (
                        /* True empty state — no data at all */
                        <div className="h-full w-full flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg text-center px-4">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">No revenue data yet</p>
                                <p className="text-xs text-gray-400 mt-0.5">Record payments to see your monthly trend</p>
                            </div>
                        </div>
                    ) : (
                        /* Chart with all 12 months — empty months show as zero-height with a dotted indicator */
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyData}
                                margin={{ top: 8, right: 4, left: 0, bottom: 8 }}
                                barCategoryGap="20%"
                            >
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={(props) => {
                                        const { x, y, payload } = props;
                                        const point = monthlyData.find((d) => d.name === payload.value);
                                        const isHighlighted = point?.isHighlighted ?? false;
                                        const isEmpty = point?.isEmpty ?? false;
                                        return (
                                            <g transform={`translate(${x},${y})`}>
                                                <text
                                                    x={0}
                                                    y={0}
                                                    dy={14}
                                                    textAnchor="middle"
                                                    fill={
                                                        isHighlighted
                                                            ? HIGHLIGHT_FILL
                                                            : isEmpty
                                                                ? '#cbd5e1'
                                                                : '#64748b'
                                                    }
                                                    fontSize={10}
                                                    fontWeight={isHighlighted ? 600 : 400}
                                                >
                                                    {payload.value}
                                                </text>
                                            </g>
                                        );
                                    }}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: '#f1f5f9', radius: 4 }}
                                />
                                <Bar
                                    dataKey="revenue"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={40}
                                    /* minPointSize ensures empty months are always visible as a thin bar */
                                    minPointSize={3}
                                >
                                    {monthlyData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={
                                                entry.isEmpty
                                                    ? '#f1f5f9'          // near-white for zero months
                                                    : entry.isHighlighted
                                                        ? HIGHLIGHT_FILL
                                                        : MUTED_FILL
                                            }
                                            stroke={entry.isEmpty ? '#e2e8f0' : 'none'}
                                            strokeWidth={entry.isEmpty ? 1 : 0}
                                            strokeDasharray={entry.isEmpty ? '3 2' : 'none'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}