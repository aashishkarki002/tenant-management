// components/RevenueExpensesChart.jsx
// ─── Design direction: Refined financial dashboard — dark-tinted card surface,
//     monochromatic slate base with two sharp accent hues (emerald for profit,
//     rose for loss). Typography: DM Mono for numbers, DM Sans for labels.
//     The default view tells the PROFIT STORY (net = revenue - expenses).
//     A toggle switches to the full Revenue vs Expenses breakdown.
//     Compare mode (period A vs B) is available as a third view.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const TOKEN = {
    profit: "#10b981",   // emerald-500 — positive net
    loss: "#f43f5e",   // rose-500    — negative net
    revenue: "#10b981",   // emerald-500
    expenses: "#f43f5e",   // rose-500
    revenueB: "#06b6d4",   // cyan-500    — period B revenue
    expensesB: "#f97316",   // orange-500  — period B expenses
    grid: "var(--border)",
    muted: "var(--muted-foreground)",
};

// ─── Y-axis formatter ──────────────────────────────────────────────────────────
const fmtY = (v) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${abs}`;
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, view }) {
    if (!active || !payload?.length) return null;
    const isCompare = view === "compare";
    const [la, lb] = isCompare ? label.split(" / ") : [label, null];

    return (
        <div style={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            minWidth: 200,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            fontFamily: "'DM Sans', sans-serif",
        }}>
            {isCompare ? (
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.revenue, textTransform: "uppercase", letterSpacing: "0.08em" }}>{la}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TOKEN.revenueB, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lb}</span>
                </div>
            ) : (
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                    {label}
                </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {payload.map((entry) => (
                    <div key={entry.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)" }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: entry.fill ?? entry.color, display: "inline-block" }} />
                            {entry.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: entry.value < 0 ? TOKEN.loss : "var(--foreground)" }}>
                            {entry.value < 0 ? "-" : ""}₹{Math.abs(Number(entry.value)).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Custom Legend ─────────────────────────────────────────────────────────────
function CustomLegend({ payload }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", paddingTop: 12 }}>
            {payload?.map((e) => (
                <div key={e.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: e.color, display: "inline-block" }} />
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{e.value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function ChartSkeleton() {
    return (
        <div style={{ width: "100%", height: 300, display: "flex", alignItems: "flex-end", gap: 10, padding: "16px 32px 32px" }}>
            {[55, 80, 40, 90, 65, 75, 50, 85, 60, 70, 45, 80].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", background: "var(--muted)", opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

// ─── View toggle button ────────────────────────────────────────────────────────
function ViewTab({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.02em",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                background: active ? "var(--primary)" : "transparent",
                color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
        >
            {label}
        </button>
    );
}

// ─── Summary KPI strip ─────────────────────────────────────────────────────────
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
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            {totals.map((k) => (
                <div key={k.label} style={{
                    flex: "1 1 120px",
                    background: "var(--muted)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    borderLeft: `3px solid ${k.color}`,
                }}>
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                        {k.label}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: k.color }}>
                        {k.value < 0 ? "-" : ""}₹{Math.abs(k.value).toLocaleString()}
                    </p>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
/**
 * RevenueExpensesChart
 *
 * Props:
 *   data        — [{ label, revenue, expenses }]           ← normal mode
 *   compareData — [{ label, revenueA, revenueB, expensesA, expensesB }]  ← compare mode
 *   loading     — boolean
 *   title       — string (optional)
 *   subtitle    — string (optional)
 */
export default function RevenueExpensesChart({
    data = [],
    compareData = [],
    loading = false,
    title = "Financial Summary",
    subtitle = "Revenue, expenses & net profit",
}) {
    // "net" | "breakdown" | "compare"
    const [view, setView] = useState("net");

    const hasCompare = compareData.length > 0;

    // Derive net data from normal data
    const netData = useMemo(() =>
        data.map((d) => ({
            ...d,
            net: (d.revenue ?? 0) - (d.expenses ?? 0),
        })),
        [data]
    );

    const chartData = view === "compare" ? compareData : netData;

    const showCompareTab = hasCompare;

    return (
        <Card className="w-full" style={{ overflow: "hidden" }}>
            {/* Google Fonts — DM Sans + DM Mono */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
                @keyframes pulse {
                    0%,100% { opacity: 0.5; }
                    50%      { opacity: 0.8; }
                }
            `}</style>

            <CardHeader style={{ paddingBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                        <CardTitle style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                            {title}
                        </CardTitle>
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                            {subtitle}
                        </p>
                    </div>

                    {/* View toggle */}
                    <div style={{
                        display: "flex",
                        gap: 4,
                        background: "var(--muted)",
                        borderRadius: 8,
                        padding: 4,
                    }}>
                        <ViewTab label="Net Profit" active={view === "net"} onClick={() => setView("net")} />
                        <ViewTab label="Breakdown" active={view === "breakdown"} onClick={() => setView("breakdown")} />
                        {showCompareTab && (
                            <ViewTab label="Compare" active={view === "compare"} onClick={() => setView("compare")} />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent style={{ paddingTop: 20 }}>
                {loading ? (
                    <ChartSkeleton />
                ) : !chartData?.length ? (
                    <div style={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: "1px dashed var(--border)", borderRadius: 12 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", fontFamily: "'DM Sans', sans-serif" }}>No data available</p>
                        <p style={{ fontSize: 12, color: "var(--muted-foreground)", fontFamily: "'DM Sans', sans-serif" }}>Select a period to see results</p>
                    </div>
                ) : (
                    <>
                        {/* KPI strip — only for net & breakdown views */}
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
                                    tick={{ fontSize: 11, fill: TOKEN.muted, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={8}
                                    interval={0}
                                />

                                <YAxis
                                    tickFormatter={fmtY}
                                    tick={{ fontSize: 11, fill: TOKEN.muted, fontFamily: "'DM Mono', monospace" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={44}
                                />

                                {/* Zero line for net profit view */}
                                {view === "net" && (
                                    <ReferenceLine y={0} stroke={TOKEN.muted} strokeDasharray="4 4" strokeOpacity={0.6} />
                                )}

                                <Tooltip
                                    content={<CustomTooltip view={view} />}
                                    cursor={{ fill: "var(--muted)", opacity: 0.3, radius: 4 }}
                                />

                                <Legend content={<CustomLegend />} />

                                {/* ── NET PROFIT VIEW ─────────────────────────── */}
                                {view === "net" && (
                                    <Bar dataKey="net" name="Net Profit" radius={[5, 5, 0, 0]} maxBarSize={52}>
                                        {netData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={entry.net >= 0 ? TOKEN.profit : TOKEN.loss}
                                                opacity={0.92}
                                            />
                                        ))}
                                    </Bar>
                                )}

                                {/* ── BREAKDOWN VIEW ──────────────────────────── */}
                                {view === "breakdown" && (
                                    <>
                                        <Bar dataKey="revenue" name="Revenue" fill={TOKEN.revenue} radius={[5, 5, 0, 0]} maxBarSize={44} />
                                        <Bar dataKey="expenses" name="Expenses" fill={TOKEN.expenses} radius={[5, 5, 0, 0]} maxBarSize={44} />
                                    </>
                                )}

                                {/* ── COMPARE VIEW ────────────────────────────── */}
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
            </CardContent>
        </Card>
    );
}