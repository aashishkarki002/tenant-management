// components/RevenueExpensesChart.jsx

import { useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ─── Design tokens — petrol theme ──────────────────────────────────────────────
const TOKEN = {
    profit: "#166534",
    loss: "#991B1B",
    revenue: "#1A5276",
    expenses: "#92400E",
    revenueB: "#2E86C1",
    expensesB: "#FDE68A",
    grid: "var(--border)",
    muted: "var(--muted-foreground)",
};

const fmtY = (v) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${abs}`;
};

function CustomTooltip({ active, payload, label, view }) {
    if (!active || !payload?.length) return null;
    const isCompare = view === "compare";
    const [la, lb] = isCompare ? label.split(" / ") : [label, null];

    return (
        <div className="bg-popover border border-border rounded-xl shadow-lg min-w-[200px] p-4 font-sans">
            {isCompare ? (
                <div className="flex gap-3 mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TOKEN.revenue }}>{la}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TOKEN.revenueB }}>{lb}</span>
                </div>
            ) : (
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
                    {label}
                </p>
            )}
            <div className="flex flex-col gap-1.5">
                {payload.map((entry) => (
                    <div key={entry.dataKey} className="flex items-center justify-between gap-5">
                        <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                            <span
                                className="inline-block w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: entry.fill ?? entry.color }}
                            />
                            {entry.name}
                        </span>
                        <span
                            className="text-[13px] font-bold font-mono"
                            style={{ color: entry.value < 0 ? TOKEN.loss : undefined }}
                        >
                            {entry.value < 0 ? "-" : ""}₹{Math.abs(Number(entry.value)).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CustomLegend({ payload }) {
    return (
        <div className="flex flex-wrap gap-4 justify-center pt-3">
            {payload?.map((e) => (
                <div key={e.value} className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: e.color }}
                    />
                    <span className="text-xs text-muted-foreground font-medium">{e.value}</span>
                </div>
            ))}
        </div>
    );
}

function ChartSkeleton() {
    return (
        <div className="w-full h-[300px] flex items-end gap-2.5 px-8 pb-8 pt-4">
            {[55, 80, 40, 90, 65, 75, 50, 85, 60, 70, 45, 80].map((h, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t bg-muted opacity-50 animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }}
                />
            ))}
        </div>
    );
}

function ViewTab({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3.5 py-1.5 text-xs font-semibold tracking-wide rounded-md border-none cursor-pointer transition-colors ${active
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
        >
            {label}
        </button>
    );
}

function KpiStrip({ data, view }) {
    const totals = useMemo(() => {
        if (view === "net") {
            const net = data.reduce((s, d) => s + (d.net ?? 0), 0);
            return [{ label: "Net Profit", value: net, color: net >= 0 ? TOKEN.profit : TOKEN.loss }];
        }
        if (view === "breakdown") {
            const rev = data.reduce((s, d) => s + (d.revenue ?? 0), 0);
            const exp = data.reduce((s, d) => s + (d.expenses ?? 0), 0);
            return [
                { label: "Total Revenue", value: rev, color: TOKEN.revenue },
                { label: "Total Expenses", value: exp, color: TOKEN.expenses },
                { label: "Net", value: rev - exp, color: rev - exp >= 0 ? TOKEN.profit : TOKEN.loss },
            ];
        }
        return [];
    }, [data, view]);

    if (!totals.length) return null;

    return (
        <div className="flex gap-4 mb-5 flex-wrap">
            {totals.map((k) => (
                <div
                    key={k.label}
                    className="flex-1 basis-[120px] bg-muted rounded-xl px-4 py-3"
                    style={{ borderLeft: `3px solid ${k.color}` }}
                >
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-[0.07em] mb-1">
                        {k.label}
                    </p>
                    <p className="text-lg font-bold font-mono" style={{ color: k.color }}>
                        {k.value < 0 ? "-" : ""}₹{Math.abs(k.value).toLocaleString()}
                    </p>
                </div>
            ))}
        </div>
    );
}

export default function RevenueExpensesChart({
    data = [],
    compareData = [],
    loading = false,
    title = "Revenue vs Expenses",
    subtitle = "Monthly financial summary",
    compareMode = false,
    periodALabel = null,
    periodBLabel = null,
}) {
    const [view, setView] = useState("net");
    const hasCompare = compareData.length > 0;

    const netData = useMemo(() =>
        data.map((d) => ({ ...d, net: (d.revenue ?? 0) - (d.expenses ?? 0) })),
        [data]
    );

    const chartData = view === "compare" ? compareData : netData;

    return (
        <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
                @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.8; } }
            `}</style>

            {/* Header */}
            <div className="px-6 pt-5 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-base font-bold text-foreground m-0">{title}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
                    {compareMode && periodALabel && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                                A: {periodALabel}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">
                                <span className="inline-block w-2 h-2 rounded-sm bg-cyan-500" />
                                B: {periodBLabel}
                            </span>
                        </div>
                    )}
                </div>

                {/* View toggle */}
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <ViewTab label="Net Profit" active={view === "net"} onClick={() => setView("net")} />
                    <ViewTab label="Breakdown" active={view === "breakdown"} onClick={() => setView("breakdown")} />
                    {hasCompare && (
                        <ViewTab label="Compare" active={view === "compare"} onClick={() => setView("compare")} />
                    )}
                </div>
            </div>

            <div className="px-6 pb-6 pt-5">
                {loading ? (
                    <ChartSkeleton />
                ) : !chartData?.length ? (
                    <div className="h-[300px] flex flex-col items-center justify-center gap-1.5 border border-dashed border-border rounded-xl">
                        <p className="text-sm font-semibold text-foreground">No data available</p>
                        <p className="text-xs text-muted-foreground">Select a period to see results</p>
                    </div>
                ) : (
                    <>
                        {view !== "compare" && <KpiStrip data={netData} view={view} />}

                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={chartData}
                                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                                barCategoryGap="30%"
                                barGap={4}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke={TOKEN.grid}
                                    strokeOpacity={0.5}
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: TOKEN.muted, fontWeight: 500 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={8}
                                    interval={0}
                                />
                                <YAxis
                                    tickFormatter={fmtY}
                                    tick={{ fontSize: 11, fill: TOKEN.muted }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={44}
                                />
                                {view === "net" && (
                                    <ReferenceLine y={0} stroke={TOKEN.muted} strokeDasharray="4 4" strokeOpacity={0.6} />
                                )}
                                <Tooltip
                                    content={<CustomTooltip view={view} />}
                                    cursor={{ fill: "var(--muted)", opacity: 0.3, radius: 4 }}
                                />
                                <Legend content={<CustomLegend />} />

                                {view === "net" && (
                                    <Bar dataKey="net" name="Net Profit" radius={[5, 5, 0, 0]} maxBarSize={52}>
                                        {netData.map((entry, i) => (
                                            <Cell key={i} fill={entry.net >= 0 ? TOKEN.profit : TOKEN.loss} opacity={0.92} />
                                        ))}
                                    </Bar>
                                )}
                                {view === "breakdown" && (
                                    <>
                                        <Bar dataKey="revenue" name="Revenue" fill={TOKEN.revenue} radius={[5, 5, 0, 0]} maxBarSize={44} />
                                        <Bar dataKey="expenses" name="Expenses" fill={TOKEN.expenses} radius={[5, 5, 0, 0]} maxBarSize={44} />
                                    </>
                                )}
                                {view === "compare" && (
                                    <>
                                        <Bar dataKey="revenueA" name="Revenue (A)" fill={TOKEN.revenue} radius={[5, 5, 0, 0]} maxBarSize={32} />
                                        <Bar dataKey="revenueB" name="Revenue (B)" fill={TOKEN.revenueB} radius={[5, 5, 0, 0]} maxBarSize={32} />
                                        <Bar dataKey="expensesA" name="Expenses (A)" fill={TOKEN.expenses} radius={[5, 5, 0, 0]} maxBarSize={32} />
                                        <Bar dataKey="expensesB" name="Expenses (B)" fill={TOKEN.expensesB} radius={[5, 5, 0, 0]} maxBarSize={32} />
                                    </>
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </>
                )}
            </div>
        </div>
    );
}