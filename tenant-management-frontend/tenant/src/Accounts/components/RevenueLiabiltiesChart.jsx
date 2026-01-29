

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";




export default function RevenueLiabilitiesChart({
    data,
    loading = false,
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-80">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80">
                <p className="text-muted-foreground">No data available</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                    formatter={(value) => `₹${value.toLocaleString()}`}
                    contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                    }}
                />
                <Legend />
                <Bar
                    dataKey="revenue"
                    fill="#10b981"
                    name="Revenue"
                    radius={[8, 8, 0, 0]}
                />
                <Bar
                    dataKey="liabilities"
                    fill="#ef4444"
                    name="Liabilities"
                    radius={[8, 8, 0, 0]}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
