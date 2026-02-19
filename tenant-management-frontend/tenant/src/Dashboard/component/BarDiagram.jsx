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

const MUTED_FILL = '#94a3b8';
const HIGHLIGHT_FILL = '#9a3412'; /* orange-800 */

function normalizeChartData(stats) {
  const raw = stats?.revenueTrend ?? stats?.monthlyRevenue ?? stats?.revenueByMonth;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => ({
    name: item.name ?? item.month ?? item.label ?? String(i + 1),
    revenue: Number(item.revenue ?? item.value ?? 0) || 0,
    isHighlighted: Boolean(item.isHighlighted ?? (i === raw.length - 1)),
  }));
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex flex-col justify-end gap-1 px-2">
      {[40, 65, 45, 80, 55, 70, 50, 60].map((h, i) => (
        <div
          key={i}
          className="rounded animate-pulse bg-muted"
          style={{ height: `${h}%`, minHeight: 12 }}
        />
      ))}
    </div>
  );
}

export default function BarDiagram({ stats, loading, error }) {
    const [period, setPeriod] = useState('thisYear');
    const monthlyData = normalizeChartData(stats);

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4 pb-2">
                <div>
                    <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Monthly rental collection comparison
                    </p>
                </div>
                <div className="flex rounded-md border border-input overflow-hidden shrink-0">
                    <button
                        type="button"
                        onClick={() => setPeriod('thisYear')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'thisYear'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        This Year
                    </button>
                    <button
                        type="button"
                        onClick={() => setPeriod('lastYear')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'lastYear'
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
                <div className="h-[260px] w-full">
                    {loading ? (
                        <ChartSkeleton />
                    ) : monthlyData.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                            No revenue data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyData}
                                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                            >
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={(props) => {
                                        const { x, y, payload } = props;
                                        const point = monthlyData.find((d) => d.name === payload.value);
                                        const isHighlighted = point?.isHighlighted ?? false;
                                        return (
                                            <g transform={`translate(${x},${y})`}>
                                                <text
                                                    x={0}
                                                    y={0}
                                                    dy={12}
                                                    textAnchor="middle"
                                                    fill={isHighlighted ? HIGHLIGHT_FILL : '#64748b'}
                                                    fontSize={12}
                                                    className="font-medium"
                                                >
                                                    {payload.value}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px' }}
                                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                                    labelFormatter={(label) => `${label} - Revenue`}
                                />
                                <Bar
                                    dataKey="revenue"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={48}
                                >
                                    {monthlyData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.isHighlighted ? HIGHLIGHT_FILL : MUTED_FILL}
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
