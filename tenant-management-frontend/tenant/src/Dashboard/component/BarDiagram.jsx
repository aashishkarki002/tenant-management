import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { NEPALI_MONTH_NAMES, getCurrentNepaliMonth } from '../../../utils/nepaliDate';

// ─── Constants ───────────────────────────────────────────────────────────────

const MUTED_FILL = '#cbd5e1'; // slate-300
const HIGHLIGHT_FILL = '#9a3412'; // orange-800

const MONTH_SHORT_NAMES = NEPALI_MONTH_NAMES.map((n) => n.slice(0, 3));

// ─── Data normalisation ───────────────────────────────────────────────────────

/**
 * The hook guarantees revenueThisYear / revenueLastYear as 12-entry arrays:
 *   [{ month: 1-12, name: string, total: number }]
 *
 * We map them to the chart shape here. Any item with total === 0 is "empty"
 * (no data recorded) and rendered as a dashed bar.
 */
function buildChartData(items, currentMonth, highlightCurrent) {
    if (!Array.isArray(items) || items.length === 0) return [];

    // If items already have a month field, map directly (guaranteed shape from hook)
    const hasMonthField = items.some((it) => it.month != null);

    if (hasMonthField) {
        // Build a lookup so we can zero-fill any gaps the hook may have left
        const lookup = new Map(items.map((it) => [it.month, it]));
        return MONTH_SHORT_NAMES.map((shortName, i) => {
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
    }

    // Generic fallback for any shape that doesn't include month numbers
    return items.map((item) => {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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
                    रू {Number(revenue).toLocaleString('en-IN')}
                </p>
            )}
        </div>
    );
}

function XAxisTick({ x, y, payload, monthlyData }) {
    const point = monthlyData.find((d) => d.name === payload.value);
    const isHighlighted = point?.isHighlighted ?? false;
    const isEmpty = point?.isEmpty ?? false;
    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0} y={0} dy={14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={isHighlighted ? 600 : 400}
                fill={isHighlighted ? HIGHLIGHT_FILL : isEmpty ? '#cbd5e1' : '#64748b'}
            >
                {payload.value}
            </text>
        </g>
    );
}

function EmptyState() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg text-center px-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                </svg>
            </div>
            <div>
                <p className="text-sm font-medium text-gray-600">No revenue data yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Record payments to see your monthly trend</p>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BarDiagram({ stats, loading, error }) {
    const [period, setPeriod] = useState('thisYear');

    const currentNepaliMonth = getCurrentNepaliMonth();

    // Hook guarantees revenueThisYear / revenueLastYear; no multi-level fallback needed.
    // revenueByMonth is kept as a last-resort for legacy API shape compatibility.
    const rawData = period === 'thisYear'
        ? (stats?.revenueThisYear ?? stats?.revenueByMonth ?? [])
        : (stats?.revenueLastYear ?? stats?.revenueByMonth ?? []);

    const highlightCurrent = period === 'thisYear';
    const monthlyData = buildChartData(rawData, currentNepaliMonth, highlightCurrent);

    const hasNoData = monthlyData.length === 0 || monthlyData.every((d) => d.isEmpty);
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
                                : `रू ${totalRevenue.toLocaleString('en-IN')} across ${filledMonths} month${filledMonths !== 1 ? 's' : ''}`}
                    </p>
                </div>

                <div className="flex rounded-md border border-input overflow-hidden shrink-0 self-start sm:self-auto">
                    {['thisYear', 'lastYear'].map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === p
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            {p === 'thisYear' ? 'This Year' : 'Last Year'}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent>
                {error && <p className="text-sm text-destructive mb-2">{error}</p>}

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
                        <EmptyState />
                    ) : (
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
                                    tick={(props) => <XAxisTick {...props} monthlyData={monthlyData} />}
                                    interval={0}
                                />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 4 }} />
                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40} minPointSize={3}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={
                                                entry.isEmpty ? '#f1f5f9'
                                                    : entry.isHighlighted ? HIGHLIGHT_FILL
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