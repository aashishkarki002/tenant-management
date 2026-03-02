import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

export function AnalyticsPanel({ data }) {
    const totalCollection = data.reduce((sum, item) => sum + item.collection, 0);
    const totalTarget = data.reduce((sum, item) => sum + item.target, 0);
    const collectionRate = ((totalCollection / totalTarget) * 100).toFixed(1);
    const lastMonthCollection = data[data.length - 1]?.collection || 0;
    const previousMonthCollection = data[data.length - 2]?.collection || 0;
    const trend = lastMonthCollection - previousMonthCollection;

    return (
        <div className="w-96 p-6 space-y-6">
            <Card className="p-6 shadow-lg border-gray-200 bg-white">
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Collection Analytics</h2>
                        <p className="text-sm text-gray-500">6-month overview</p>
                    </div>

                    {/* Collection Rate */}
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-emerald-700">Collection Rate</span>
                            <div className="flex items-center gap-1">
                                {trend >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className={`text-sm font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {Math.abs(trend).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-emerald-900 mb-2">{collectionRate}%</div>
                        <div className="flex items-center gap-2 text-xs text-emerald-700">
                            <DollarSign className="w-3 h-3" />
                            <span>NPR {totalCollection.toLocaleString()} / NPR {totalTarget.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Rent Collection</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                    axisLine={{ stroke: '#d1d5db' }}
                                />
                                <YAxis
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                    axisLine={{ stroke: '#d1d5db' }}
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value) => [`NPR ${value.toLocaleString()}`, '']}
                                />
                                <Bar dataKey="collection" fill="#10b981" radius={[8, 8, 0, 0]} />
                                <Line
                                    type="monotone"
                                    dataKey="target"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ fill: '#f59e0b', r: 4 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-emerald-500 rounded" />
                                <span className="text-gray-600">Collection</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-500 rounded" />
                                <span className="text-gray-600">Target</span>
                            </div>
                        </div>
                    </div>

                    {/* Overdue Trend */}
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                        <h3 className="text-sm font-semibold text-red-700 mb-2">Overdue Alerts</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-red-600">Total Overdue Amount</span>
                                <span className="font-bold text-red-900">NPR 46,000</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-red-600">Overdue Units</span>
                                <span className="font-bold text-red-900">3</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                        <button className="w-full p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all">
                            Generate Report
                        </button>
                        <button className="w-full p-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all">
                            Send Reminders
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
