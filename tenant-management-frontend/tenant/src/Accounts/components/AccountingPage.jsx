import { useState, useMemo, useCallback } from "react";
import NepaliDate from "nepali-datetime";
import {
    GitCompareArrowsIcon, CalendarIcon, ChevronDownIcon,
    RefreshCwIcon, PrinterIcon, DownloadIcon, FileTextIcon,
    ShareIcon, XIcon, BuildingIcon, ArrowUpRightIcon,
    ArrowDownRightIcon, PlusIcon, TrendingUpIcon, TrendingDownIcon,
    MinusIcon, FilterIcon, MoreVerticalIcon,
} from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

import { useHeaderSlot } from "../../context/HeaderSlotContext";
import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { useMonthlyChart, QUARTER_LABELS } from "../hooks/useMonthlyChart";
import { useIsMobile } from "@/hooks/use-mobile";
import DualCalendarTailwind from "../../components/dualDate";
import LedgerTable from "./LedgerTable";
import RevenueBreakDown from "./RevenueBreakDown";
import ExpenseBreakDown from "./ExpenseBreakDown";

// ─── Nepali calendar constants ────────────────────────────────────────────────
const BS_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan",
    "Bhadra", "Ashwin", "Kartik", "Mangsir",
    "Poush", "Magh", "Falgun", "Chaitra",
];
const BS_MONTHS_SHORT = [
    "Bai", "Jes", "Ash", "Shr",
    "Bha", "Asw", "Kar", "Man",
    "Pou", "Mag", "Fal", "Cha",
];

/** Convert any ISO / JS Date → "15 Shrawan 2081" */
function toBSDate(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
    } catch { return "—"; }
}

/** "15 Shr" */
function toBSShort(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${nd.getDate()} ${BS_MONTHS_SHORT[nd.getMonth()]}`;
    } catch { return "—"; }
}

/** "Shrawan 2081" */
function toBSMonthYear(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
    } catch { return "—"; }
}

// ─── Design tokens — petrol theme ─────────────────────────────────────────────
const C = {
    bg: "#FAFAF8",           // --color-bg
    surface: "#FFFFFF",      // --color-surface-raised
    surfaceAlt: "#F5F4F0",   // --color-surface
    surfaceHover: "#FAFAF8", // --color-bg
    forest: "#1A5276",       // --color-accent (petrol)
    forestMid: "#154360",    // --color-accent-hover
    forestLight: "#2E86C1",  // lighter petrol, chart accent
    amber: "#92400E",        // --color-warning
    amberBg: "#FEF9C3",      // --color-warning-bg
    amberLight: "#FDE68A",   // --color-warning-border
    red: "#991B1B",          // --color-danger
    redBg: "#FEE2E2",        // --color-danger-bg
    blue: "#1E40AF",         // --color-info
    blueBg: "#DBEAFE",       // --color-info-bg
    violet: "#6D28D9",
    border: "#E7E5E0",       // --color-border
    borderStrong: "#D6D3CC", // --color-muted
    text: "#1C1917",         // --color-text-strong
    textMid: "#44403C",      // --color-text-body
    textMuted: "#78716C",    // --color-text-sub
    positive: "#166534",     // --color-success
    positiveBg: "#DCFCE7",   // --color-success-bg
    negative: "#991B1B",     // --color-danger
    negativeBg: "#FEE2E2",   // --color-danger-bg
    neutral: "#44403C",      // --color-text-body
};

const QUARTERS = [
    { label: "All", value: null },
    { label: "Q1", value: 1 },
    { label: "Q2", value: 2 },
    { label: "Q3", value: 3 },
    { label: "Q4", value: 4 },
];
const QUARTER_MONTHS = {
    1: "Shrawan–Ashwin",
    2: "Kartik–Poush",
    3: "Magh–Chaitra",
    4: "Baisakh–Ashadh",
};

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fmtN = (n = 0) => Math.abs(n).toLocaleString("en-IN");
const fmtK = (v) => {
    const a = Math.abs(v ?? 0), s = (v ?? 0) < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(2)} Cr`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(1)} L`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(0)}K`;
    return `${s}${a}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PURE DISPLAY PRIMITIVES ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, style = {}, delay = 0, className = "" }) {
    return (
        <div className={`ap-card ${className}`} style={{
            background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
            padding: "20px 22px", animationDelay: `${delay * 0.05}s`, ...style,
        }}>
            {children}
        </div>
    );
}

function DarkCard({ children, style = {}, delay = 0 }) {
    return (
        <div className="ap-card" style={{
            background: C.forest, borderRadius: 16, padding: "20px 22px",
            animationDelay: `${delay * 0.05}s`, ...style,
        }}>
            {children}
        </div>
    );
}

function Lbl({ children, light = false, style = {} }) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", marginBottom: 8,
            color: light ? "rgba(255,255,255,0.45)" : C.textMuted, ...style,
        }}>
            {children}
        </div>
    );
}

function Delta({ value, label }) {
    const up = value >= 0;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 20,
            background: up ? C.positiveBg : C.negativeBg,
            color: up ? C.positive : C.negative,
        }}>
            {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}
            {label ?? (`${Math.abs(value).toFixed(1)}%`)}
        </span>
    );
}

function ProgBar({ value, max, color = C.forest, h = 5 }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ height: h, borderRadius: h / 2, background: C.border, overflow: "hidden", flex: 1 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: h / 2, transition: "width .6s ease" }} />
        </div>
    );
}

function Spark({ data = [], color = C.forest, h = 32 }) {
    if (data.length < 2) return <div style={{ height: h }} />;
    const vals = data.map(d => d.v ?? 0);
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const W = 110;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.85}`).join(" ");
    const last = { x: W, y: h - ((vals.at(-1) - mn) / rng) * h * 0.85 };
    return (
        <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ overflow: "visible" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last.x} cy={last.y} r={3} fill={color} />
        </svg>
    );
}

function Gauge({ pct, color = C.forest }) {
    const r = 48, cx = 60, cy = 58;
    const clamped = Math.max(0, Math.min(1, pct));
    const angle = Math.PI + clamped * Math.PI;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    return (
        <svg width={120} height={66} viewBox="0 0 120 66">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.border} strokeWidth={9} strokeLinecap="round" />
            {clamped > 0 && (
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${clamped > 0.5 ? 1 : 0} 1 ${x} ${y}`}
                    fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
            )}
            <circle cx={x} cy={y} r={5} fill={color} />
        </svg>
    );
}

function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: C.forest, borderRadius: 10, padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,.2)", border: "none", minWidth: 160,
        }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>
                {label}
            </div>
            {payload.map(p => (
                <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill ?? p.color, flexShrink: 0 }} />
                    <span style={{ opacity: .65, flex: 1 }}>{p.name}</span>
                    <span style={{ fontWeight: 700 }}>₹{fmtK(Math.abs(p.value || 0))}</span>
                </div>
            ))}
        </div>
    );
}

function Skeleton({ h = 32 }) {
    return <div style={{ height: h, borderRadius: 8, background: C.surfaceAlt, animation: "ap-pulse 1.5s infinite" }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CHART COMPONENTS (pure renderers) ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Normal mode: Revenue vs Expenses per BS month */
function RevExpChart({ data = [], loading }) {
    if (loading) return <Skeleton h={180} />;
    if (!data.length) return (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>
            No data for selected period
        </div>
    );
    return (
        <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="30%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} width={38} />
                <Tooltip content={<ChartTip />} cursor={{ fill: C.surfaceAlt, radius: 4 }} />
                <Bar dataKey="revenue" name="Revenue" fill={C.forestLight} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expenses" name="Expenses" fill={C.amber} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
        </ResponsiveContainer>
    );
}

/** Compare mode: Period A (solid) vs Period B (lighter) for both Revenue and Expenses */
function CompareChart({ data = [], loading, labelA, labelB }) {
    if (loading) return <Skeleton h={200} />;
    if (!data.length) return (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>
            No comparison data
        </div>
    );
    // Use clean X-axis labels: just the primary period month
    const plotData = data.map(d => ({ ...d, label: d.labelA ?? d.label }));
    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={plotData} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} width={38} />
                <Tooltip content={<ChartTip />} cursor={{ fill: C.surfaceAlt, radius: 4 }} />
                <Bar dataKey="revenueA" name={`Rev · ${labelA ?? "Period A"}`} fill={C.forestLight} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="revenueB" name={`Rev · ${labelB ?? "Period B"}`} fill={C.forestLight + "55"} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expensesA" name={`Exp · ${labelA ?? "Period A"}`} fill={C.amber} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expensesB" name={`Exp · ${labelB ?? "Period B"}`} fill={C.amber + "55"} radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
        </ResponsiveContainer>
    );
}

/** Cumulative net cash flow + monthly net overlay */
function CashFlowArea({ data = [], loading }) {
    const enriched = useMemo(() => {
        let cum = 0;
        return data.map(d => {
            const net = (d.revenue ?? 0) - (d.expenses ?? 0);
            cum += net;
            return { ...d, net, cumulative: cum };
        });
    }, [data]);

    if (loading) return <Skeleton h={140} />;
    if (!enriched.length) return (
        <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>
            No data
        </div>
    );
    return (
        <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={enriched} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <defs>
                    <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.forest} stopOpacity={.16} />
                        <stop offset="100%" stopColor={C.forest} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} width={38} />
                <ReferenceLine y={0} stroke={C.borderStrong} strokeDasharray="4 3" strokeOpacity={.5} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke={C.forest} strokeWidth={2.5}
                    fill="url(#cumG)" dot={false} activeDot={{ r: 4, fill: C.forest, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="net" name="Monthly Net" stroke={C.amber}
                    strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 3, fill: C.amber, strokeWidth: 0 }} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPARE STAT STRIP ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Three KPI delta cards rendered when compare mode is active */
function CompareStatStrip({ stats, labelA, labelB, loading }) {
    if (loading) {
        return (
                <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 640 ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
                    {[0, 1, 2].map(i => <Skeleton key={i} h={72} />)}
                </div>
        );
    }
    if (!stats) return null;

    const items = [
        { key: "revenue", label: "Revenue", positive: true },
        { key: "expenses", label: "Expenses", positive: false },
        { key: "netCashFlow", label: "Net Cash Flow", positive: true },
    ];

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {items.map(({ key, label, positive }) => {
                const s = stats[key] ?? {};
                const pct = s.pct ?? null;
                const isGood = positive ? (pct ?? 0) >= 0 : (pct ?? 0) <= 0;
                const TrendIcon = pct === null ? MinusIcon : pct >= 0 ? TrendingUpIcon : TrendingDownIcon;
                return (
                    <div key={key} style={{
                        borderRadius: 12, border: `1px solid ${C.border}`,
                        background: C.surface, padding: "14px 16px",
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                            {label}
                        </div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: window.innerWidth < 640 ? "1fr" : "1fr 1fr",
                            gap: 6,
                        }}>
                            <div>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{labelA}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>₹{fmtK(s.a ?? 0)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{labelB}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>₹{fmtK(s.b ?? 0)}</div>
                            </div>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                            <TrendIcon size={12} color={isGood ? C.positive : C.negative} />
                            <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: pct === null ? C.textMuted : (isGood ? C.positive : C.negative),
                            }}>
                                {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                            </span>
                            <span style={{ fontSize: 11, color: C.textMuted }}>vs {labelB}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SECTION COMPONENTS (dumb renderers) ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueStreamTable({ breakdown = [], loading }) {
    const total = breakdown.reduce((s, x) => s + (x.amount ?? 0), 0);
    const PALETTE = [C.forestLight, C.amber, C.blue, C.violet, "#0891B2"];

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} h={36} />)}
        </div>
    );
    if (!breakdown.length) return (
        <div style={{ padding: "20px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No revenue streams
        </div>
    );
    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px", padding: "0 4px 8px", borderBottom: `1px solid ${C.border}` }}>
                {["Source", "Share", "Amount"].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</span>
                ))}
            </div>
            {breakdown.map((item, i) => (
                <div key={item.code ?? i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px", alignItems: "center", padding: "10px 4px", borderBottom: `1px solid ${C.border}30` }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</div>
                        {item.code && <div style={{ fontSize: 10, color: C.textMuted }}>{item.code}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ProgBar value={item.amount} max={total} color={PALETTE[i % PALETTE.length]} />
                        <span style={{ fontSize: 11, color: C.textMuted, minWidth: 26 }}>
                            {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right" }}>
                        ₹{fmtK(item.amount)}
                    </div>
                </div>
            ))}
        </>
    );
}

function BreakdownPills({ breakdown = [], loading }) {
    if (loading) return <Skeleton h={56} />;
    if (!breakdown.length) return <div style={{ color: C.textMuted, fontSize: 12 }}>No breakdown data</div>;
    const total = breakdown.reduce((s, x) => s + x.amount, 0);
    const DOTS = [C.amber, C.red, C.violet, C.blue];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {breakdown.slice(0, 4).map((item, i) => (
                <div key={item.code ?? i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: DOTS[i % 4] }} />
                    <span style={{ fontSize: 13, color: C.textMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flexShrink: 0 }}>₹{fmtK(item.amount)}</span>
                    <span style={{ fontSize: 10, color: C.textMuted, minWidth: 24, textAlign: "right" }}>
                        {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                    </span>
                </div>
            ))}
        </div>
    );
}

function Scorecard({ totals, loading }) {
    const { totalRevenue: rev = 0, totalExpenses: exp = 0, totalLiabilities: liab = 0, netCashFlow: net = 0 } = totals;
    const margin = rev > 0 ? (net / rev) * 100 : 0;
    const expRatio = rev > 0 ? (exp / rev) * 100 : 0;
    const coverage = liab > 0 && rev > 0 ? rev / liab : null;
    const statusLabel = margin >= 25 ? "Excellent" : margin >= 10 ? "On Track" : margin >= 0 ? "Watch" : "At Risk";
    const statusColor = margin >= 25 ? C.positive : margin >= 10 ? C.amber : margin >= 0 ? C.amber : C.negative;
    const gaugePct = Math.max(0, Math.min(1, margin / 40));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                    color: statusColor, background: `${statusColor}18`, padding: "3px 12px", borderRadius: 20, marginBottom: 4,
                }}>{statusLabel}</span>
                <Gauge pct={gaugePct} color={statusColor} />
                {loading
                    ? <Skeleton h={28} />
                    : <div className="ap-serif" style={{ fontSize: 30, color: C.text, marginTop: -8, lineHeight: 1 }}>{margin.toFixed(1)}%</div>
                }
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Net Margin</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { label: "Expense Ratio", value: expRatio, max: 100, color: expRatio > 80 ? C.red : C.amber, display: `${expRatio.toFixed(1)}%` },
                    { label: "Revenue Retained", value: Math.max(0, 100 - expRatio), max: 100, color: C.forestLight, display: `${Math.max(0, 100 - expRatio).toFixed(1)}%` },
                ].map(m => (
                    <div key={m.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>{m.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{m.display}</span>
                        </div>
                        <ProgBar value={m.value} max={m.max} color={m.color} />
                    </div>
                ))}
                {coverage !== null && (
                    <div style={{ marginTop: 2, padding: "10px 12px", borderRadius: 10, background: coverage >= 1 ? C.positiveBg : C.negativeBg }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: coverage >= 1 ? C.positive : C.red, letterSpacing: ".07em", textTransform: "uppercase" }}>
                            Liability Coverage
                        </div>
                        <div className="ap-serif" style={{ fontSize: 24, color: C.text, marginTop: 2 }}>{coverage.toFixed(2)}×</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>revenue vs liabilities</div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Recent ledger feed — dates in BS */
function LedgerFeed({ entries = [], loading, onViewAll }) {
    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={44} />)}
        </div>
    );
    const recent = entries.slice(0, 8);
    if (!recent.length) return (
        <div style={{ padding: "20px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No ledger entries
        </div>
    );
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recent.map((e, i) => {
                const isDebit = (e.debit ?? 0) > 0;
                const amt = e.debit ?? e.credit ?? 0;
                return (
                    <div key={e._id ?? i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "9px 8px",
                        borderRadius: 9, background: i % 2 !== 0 ? C.surfaceAlt + "70" : "transparent",
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                            background: isDebit ? C.redBg : C.positiveBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {isDebit
                                ? <ArrowDownRightIcon size={14} color={C.red} />
                                : <ArrowUpRightIcon size={14} color={C.positive} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {e.description ?? e.account?.name ?? "—"}
                            </div>
                            {/* BS date */}
                            <div style={{ fontSize: 10, color: C.textMuted }}>{toBSDate(e.date)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDebit ? C.negative : C.positive, flexShrink: 0 }}>
                            {isDebit ? "−" : "+"}₹{fmtN(amt)}
                        </div>
                    </div>
                );
            })}
            <button onClick={onViewAll} style={{
                marginTop: 6, padding: "8px 0", borderRadius: 9, border: `1px solid ${C.border}`,
                background: "transparent", fontSize: 12, fontWeight: 600, color: C.textMid, cursor: "pointer",
            }}>
                View all {entries.length} entries →
            </button>
        </div>
    );
}

function ExportBtn({ summary, filterLabel }) {
    const dl = (data, name, type) => {
        const b = new Blob([data], { type });
        const u = URL.createObjectURL(b);
        Object.assign(document.createElement("a"), { href: u, download: name }).click();
        URL.revokeObjectURL(u);
    };
    const t = summary?.totals ?? {};
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 13px",
                    borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface,
                    fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer",
                }}>
                    <ShareIcon size={12} />Export<ChevronDownIcon size={10} style={{ opacity: .4 }} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ borderRadius: 12, minWidth: 176 }}>
                <DropdownMenuItem onClick={() => window.print()} style={{ gap: 8, cursor: "pointer" }}>
                    <PrinterIcon size={13} />Print Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem style={{ gap: 8, cursor: "pointer" }} onClick={() => {
                    const rows = [
                        ["Metric", "Value"],
                        ["Revenue", t.totalRevenue ?? 0],
                        ["Expenses", t.totalExpenses ?? 0],
                        ["Liabilities", t.totalLiabilities ?? 0],
                        ["Net Cash Flow", t.netCashFlow ?? 0],
                        ["Period", filterLabel],
                    ];
                    dl(rows.map(r => r.join(",")).join("\n"), `accounts-${Date.now()}.csv`, "text/csv");
                }}>
                    <DownloadIcon size={13} />Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem style={{ gap: 8, cursor: "pointer" }} onClick={() => {
                    dl(JSON.stringify(summary, null, 2), `accounts-${Date.now()}.json`, "application/json");
                }}>
                    <FileTextIcon size={13} />Export JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HEADER SLOT CONTENT (pure controlled component, no local filter state) ──
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Injected into the global header via useHeaderSlot.
 * Replaces GlobalSearch for the duration AccountingPage is mounted.
 * All state is owned by AccountingPage; this is a pure controlled renderer.
 * 
 * MOBILE-FIRST RESPONSIVE DESIGN:
 * - < 640px: Filter drawer pattern with essential CTAs only
 * - ≥ 640px: Inline filter pills with full action bar
 */
function AccountingHeaderSlot({
    selectedQuarter, onQuarterChange,
    customStart, customEnd, onCustomStartChange, onCustomEndChange,
    compareMode, onCompareModeToggle,
    compareQuarter, onCompareQuarterChange,
    onAddRevenue, onAddExpense, onRefresh,
    summary, filterLabel, bankAccounts,
}) {
    const isMobile = useIsMobile();
    const [showCustom, setShowCustom] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    const handleApplyCustom = () => {
        onQuarterChange("custom");
        setShowCustom(false);
    };

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (selectedQuarter !== null) count++;
        if (compareMode) count++;
        return count;
    }, [selectedQuarter, compareMode]);

    const QPill = ({ label, value }) => (
        <button onClick={() => onQuarterChange(value)} style={{
            padding: "6px 14px", borderRadius: 8, minHeight: 44,
            border: `1px solid ${selectedQuarter === value ? C.forest : C.border}`,
            background: selectedQuarter === value ? C.forest : "transparent",
            color: selectedQuarter === value ? "#fff" : C.textMid,
            fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .12s",
        }}>{label}</button>
    );

    // ─── MOBILE LAYOUT (< 640px) ──────────────────────────────────────────────
    // Simplified with clear hierarchy: Primary action → Filters → More
    if (isMobile) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Primary action row - Focus on essential actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Hero CTA: Add Revenue */}
                    <button onClick={onAddRevenue} style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 16px", borderRadius: 11, border: "none",
                        background: C.forestLight, color: "#fff",
                        fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 46,
                        boxShadow: "0 2px 12px rgba(26,43,26,0.2)",
                    }}>
                        <PlusIcon size={17} strokeWidth={2.5} />
                        Add Revenue
                    </button>

                    {/* Filter drawer trigger */}
                    <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                        <SheetTrigger asChild>
                            <button style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, 
                                padding: "10px 14px", borderRadius: 11, minHeight: 46,
                                border: `1.5px solid ${activeFilterCount > 0 ? C.forest : C.border}`,
                                background: activeFilterCount > 0 ? C.forest + "10" : C.surface,
                                color: activeFilterCount > 0 ? C.forest : C.textMid,
                                fontSize: 13, fontWeight: 600, cursor: "pointer",
                                position: "relative",
                            }}>
                                <FilterIcon size={17} strokeWidth={2.2} />
                                {activeFilterCount > 0 && (
                                    <span style={{
                                        position: "absolute", top: -4, right: -4,
                                        background: C.forest, color: "#fff",
                                        fontSize: 10, fontWeight: 700, borderRadius: "50%",
                                        width: 18, height: 18, display: "flex", alignItems: "center",
                                        justifyContent: "center", border: `2px solid ${C.bg}`,
                                    }}>{activeFilterCount}</span>
                                )}
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" style={{
                            borderTopLeftRadius: 20, borderTopRightRadius: 20,
                            maxHeight: "85vh", overflow: "auto",
                        }}>
                            <SheetHeader>
                                <SheetTitle style={{ fontSize: 18, fontWeight: 700, color: C.forest }}>
                                    Filter & Compare
                                </SheetTitle>
                            </SheetHeader>
                            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
                                {/* Period Selection */}
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                                        Period
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                        {QUARTERS.map(q => <QPill key={q.label} label={q.label} value={q.value} />)}
                                    </div>
                                    
                                    {/* Custom date range */}
                                    <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                                            Custom Range
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Start Date</div>
                                                <DualCalendarTailwind value={customStart} onChange={v => onCustomStartChange(v ?? "")} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>End Date</div>
                                                <DualCalendarTailwind value={customEnd} onChange={v => onCustomEndChange(v ?? "")} />
                                            </div>
                                        </div>
                                        <button
                                            disabled={!customStart || !customEnd}
                                            onClick={() => { handleApplyCustom(); setShowMobileFilters(false); }}
                                            style={{
                                                marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10,
                                                border: "none", background: C.forest, color: "#fff",
                                                fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 44,
                                                opacity: (!customStart || !customEnd) ? .4 : 1,
                                            }}>
                                            Apply Custom Range
                                        </button>
                                    </div>
                                </div>

                                {/* Compare Mode */}
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                                        Comparison
                                    </div>
                                    <button onClick={onCompareModeToggle} style={{
                                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        padding: "12px 16px", borderRadius: 11, minHeight: 46,
                                        border: `1.5px solid ${compareMode ? C.forest : C.border}`,
                                        background: compareMode ? C.forest : C.surface,
                                        color: compareMode ? "#fff" : C.textMid,
                                        fontSize: 14, fontWeight: 600, cursor: "pointer",
                                    }}>
                                        <GitCompareArrowsIcon size={17} strokeWidth={2.2} />
                                        {compareMode ? "Comparing Active" : "Enable Compare"}
                                    </button>

                                    {compareMode && (
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                                                Compare Against
                                            </div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                {QUARTERS.filter(q => q.value !== null).map(q => (
                                                    <button key={q.value} onClick={() => onCompareQuarterChange(q.value)} style={{
                                                        padding: "10px 12px", borderRadius: 10, minHeight: 46,
                                                        border: `1.5px solid ${compareQuarter === q.value ? C.amber : C.border}`,
                                                        background: compareQuarter === q.value ? C.amberBg : C.surface,
                                                        color: compareQuarter === q.value ? C.amber : C.textMid,
                                                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                                                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                                    }}>
                                                        <span style={{ fontWeight: 700 }}>{q.label}</span>
                                                        <span style={{ fontSize: 9, opacity: .7, marginTop: 3 }}>
                                                            {QUARTER_MONTHS[q.value]}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Apply button */}
                                <button onClick={() => setShowMobileFilters(false)} style={{
                                    width: "100%", padding: "14px 16px", borderRadius: 12, minHeight: 48,
                                    border: "none", background: C.forest, color: "#fff",
                                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                                }}>
                                    Apply Filters
                                </button>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* More actions menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button style={{
                                padding: "10px 12px", borderRadius: 11, minHeight: 46,
                                border: `1px solid ${C.border}`, background: C.surface,
                                cursor: "pointer", display: "flex", alignItems: "center",
                            }}>
                                <MoreVerticalIcon size={19} color={C.textMid} strokeWidth={2.2} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ borderRadius: 12, minWidth: 200 }}>
                            <DropdownMenuItem onClick={onAddExpense} style={{ gap: 10, cursor: "pointer", padding: "12px 16px" }}>
                                <PlusIcon size={16} color={C.amber} />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Add Expense</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onRefresh} style={{ gap: 10, cursor: "pointer", padding: "12px 16px" }}>
                                <RefreshCwIcon size={16} />
                                Refresh Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.print()} style={{ gap: 10, cursor: "pointer", padding: "12px 16px" }}>
                                <PrinterIcon size={16} />
                                Print Report
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem style={{ gap: 10, cursor: "pointer", padding: "12px 16px" }} onClick={() => {
                                const t = summary?.totals ?? {};
                                const rows = [
                                    ["Metric", "Value"],
                                    ["Revenue", t.totalRevenue ?? 0],
                                    ["Expenses", t.totalExpenses ?? 0],
                                    ["Liabilities", t.totalLiabilities ?? 0],
                                    ["Net Cash Flow", t.netCashFlow ?? 0],
                                    ["Period", filterLabel],
                                ];
                                const b = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
                                const u = URL.createObjectURL(b);
                                Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.csv` }).click();
                                URL.revokeObjectURL(u);
                            }}>
                                <DownloadIcon size={16} />
                                Export CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Active filter chip - Shows current selection */}
                {(selectedQuarter !== null || compareMode) && (
                    <div style={{
                        padding: "10px 14px", borderRadius: 10, 
                        background: `linear-gradient(135deg, ${C.forestLight}10 0%, ${C.surface} 100%)`,
                        border: `1px solid ${C.forest}20`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 10,
                    }}>
                        <div style={{ fontSize: 12, color: C.textMid, flex: 1 }}>
                            <span style={{ fontWeight: 700, color: C.forest }}>{filterLabel}</span>
                            {compareMode && (
                                <span style={{ marginLeft: 6, fontSize: 11, color: C.amber, fontWeight: 600 }}>
                                    · vs Q{compareQuarter}
                                </span>
                            )}
                        </div>
                        <button onClick={() => { 
                            onQuarterChange(null); 
                            onCustomStartChange(""); 
                            onCustomEndChange(""); 
                            if (compareMode) onCompareModeToggle();
                        }} style={{
                            display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                            color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`,
                            cursor: "pointer", padding: "4px 10px", borderRadius: 6,
                        }}>
                            <XIcon size={13} />
                            Clear
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─── DESKTOP LAYOUT (≥ 640px) ─────────────────────────────────────────────
    // Cleaner, more focused design with progressive disclosure
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* LEFT: Primary Action (Hero CTA) */}
            <button onClick={onAddRevenue} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 18px",
                borderRadius: 10, border: "none", background: C.forestLight, 
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(26,43,26,0.15)",
                transition: "all .2s",
            }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
               onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                <PlusIcon size={15} strokeWidth={2.5} />
                Add Revenue
            </button>

            <div style={{ width: 1, height: 28, background: C.border, margin: "0 4px" }} />

            {/* CENTER: Period Filter (Consolidated) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "7px 14px",
                        borderRadius: 9, border: `1.5px solid ${selectedQuarter !== null ? C.forest : C.border}`,
                        background: selectedQuarter !== null ? C.forest + "08" : "transparent",
                        color: selectedQuarter !== null ? C.forest : C.textMid,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        transition: "all .15s",
                    }}>
                        <CalendarIcon size={14} strokeWidth={2.2} />
                        <span>{selectedQuarter === "custom" ? `${toBSShort(customStart)}–${toBSShort(customEnd)}` : selectedQuarter ? `Q${selectedQuarter}` : "All Periods"}</span>
                        <ChevronDownIcon size={13} style={{ opacity: .5 }} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" style={{ padding: 20, borderRadius: 14, minWidth: 280 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>
                        Select Period
                    </div>
                    
                    {/* Quarter pills in dropdown */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                        {QUARTERS.map(q => (
                            <button key={q.label} onClick={() => { onQuarterChange(q.value); }} style={{
                                padding: "10px 8px", borderRadius: 8,
                                border: `1px solid ${selectedQuarter === q.value ? C.forest : C.border}`,
                                background: selectedQuarter === q.value ? C.forest : "transparent",
                                color: selectedQuarter === q.value ? "#fff" : C.textMid,
                                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                                textAlign: "center",
                            }}>
                                {q.label}
                                {q.value && (
                                    <div style={{ fontSize: 9, marginTop: 2, opacity: .7 }}>
                                        {QUARTER_MONTHS[q.value]?.split("–")[0]}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    <DropdownMenuSeparator />

                    {/* Custom range */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
                            Custom Range
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>Start</div>
                                <DualCalendarTailwind value={customStart} onChange={v => onCustomStartChange(v ?? "")} />
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>End</div>
                                <DualCalendarTailwind value={customEnd} onChange={v => onCustomEndChange(v ?? "")} />
                            </div>
                        </div>
                        <button
                            disabled={!customStart || !customEnd}
                            onClick={handleApplyCustom}
                            style={{
                                width: "100%", padding: "9px 0", borderRadius: 9,
                                border: "none", background: C.forest, color: "#fff",
                                fontSize: 13, fontWeight: 700, cursor: "pointer",
                                opacity: (!customStart || !customEnd) ? .4 : 1,
                            }}>
                            Apply Custom Range
                        </button>
                    </div>

                    {selectedQuarter !== null && (
                        <>
                            <DropdownMenuSeparator />
                            <button onClick={() => { onQuarterChange(null); onCustomStartChange(""); onCustomEndChange(""); }}
                                style={{ 
                                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", 
                                    gap: 5, fontSize: 12, fontWeight: 600, color: C.textMuted, 
                                    background: "none", border: "none", cursor: "pointer", padding: "8px 0" 
                                }}>
                                <XIcon size={13} />
                                Clear Filter
                            </button>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Compare Mode Toggle */}
            <button onClick={onCompareModeToggle} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 9,
                border: `1.5px solid ${compareMode ? C.forest : C.border}`,
                background: compareMode ? C.forest : "transparent",
                color: compareMode ? "#fff" : C.textMid,
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
            }}>
                <GitCompareArrowsIcon size={14} strokeWidth={2.2} />
                {compareMode ? "Comparing" : "Compare"}
            </button>

            {/* Compare quarter selector (inline when active) */}
            {compareMode && (
                <>
                    <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>vs</div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                                borderRadius: 9, border: `1.5px solid ${C.amber}`,
                                background: C.amberBg, color: C.amber,
                                fontSize: 13, fontWeight: 600, cursor: "pointer",
                            }}>
                                Q{compareQuarter}
                                <ChevronDownIcon size={12} style={{ opacity: .6 }} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" style={{ padding: 16, borderRadius: 12, minWidth: 200 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
                                Compare Against
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {QUARTERS.filter(q => q.value !== null).map(q => (
                                    <button key={q.value} onClick={() => onCompareQuarterChange(q.value)} style={{
                                        padding: "10px 12px", borderRadius: 8, textAlign: "left",
                                        border: `1px solid ${compareQuarter === q.value ? C.amber : C.border}`,
                                        background: compareQuarter === q.value ? C.amberBg : "transparent",
                                        color: compareQuarter === q.value ? C.amber : C.textMid,
                                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                        <span>{q.label}</span>
                                        <span style={{ fontSize: 10, opacity: .7 }}>
                                            {QUARTER_MONTHS[q.value]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            <div style={{ flex: 1, minWidth: 20 }} />

            {/* RIGHT: Secondary Actions (Consolidated) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                        borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, color: C.textMid,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>
                        <MoreVerticalIcon size={15} />
                        More
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" style={{ borderRadius: 12, minWidth: 200 }}>
                    <DropdownMenuItem onClick={onAddExpense} style={{ gap: 10, cursor: "pointer", padding: "10px 14px" }}>
                        <PlusIcon size={15} color={C.amber} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Add Expense</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onRefresh} style={{ gap: 10, cursor: "pointer", padding: "10px 14px" }}>
                        <RefreshCwIcon size={15} />
                        Refresh Data
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()} style={{ gap: 10, cursor: "pointer", padding: "10px 14px" }}>
                        <PrinterIcon size={15} />
                        Print Report
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem style={{ gap: 10, cursor: "pointer", padding: "10px 14px" }} onClick={() => {
                        const t = summary?.totals ?? {};
                        const rows = [
                            ["Metric", "Value"],
                            ["Revenue", t.totalRevenue ?? 0],
                            ["Expenses", t.totalExpenses ?? 0],
                            ["Liabilities", t.totalLiabilities ?? 0],
                            ["Net Cash Flow", t.netCashFlow ?? 0],
                            ["Period", filterLabel],
                        ];
                        const b = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
                        const u = URL.createObjectURL(b);
                        Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.csv` }).click();
                        URL.revokeObjectURL(u);
                    }}>
                        <DownloadIcon size={15} />
                        Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem style={{ gap: 10, cursor: "pointer", padding: "10px 14px" }} onClick={() => {
                        const b = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
                        const u = URL.createObjectURL(b);
                        Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.json` }).click();
                        URL.revokeObjectURL(u);
                    }}>
                        <FileTextIcon size={15} />
                        Export JSON
                    </DropdownMenuItem>
                    {bankAccounts[0] && (
                        <>
                            <DropdownMenuSeparator />
                            <div style={{ padding: "10px 14px", pointerEvents: "none" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <BuildingIcon size={14} color={C.textMuted} />
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{bankAccounts[0].bankName}</div>
                                        <div style={{ fontSize: 10, color: C.textMuted }}>Balance: ₹{bankAccounts[0].balance?.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function AccountingPage() {
    // ── Filter state ──────────────────────────────────────────────────────────
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [compareMode, setCompareMode] = useState(false);
    const [compareQuarter, setCompareQuarter] = useState(2);

    // ── Tab + dialog state ────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("overview");
    const [pendingAction, setPendingAction] = useState(null); // 'revenue' | 'expense' | null

    // ── Data (all heavy computation happens in these hooks / on the server) ───
    const activeCompareQuarter = compareMode ? compareQuarter : null;

    const { summary, loadingSummary, ledgerEntries, loadingLedger, refetch } =
        useAccounting(selectedQuarter, "all", customStart, customEnd);

    const { bankAccounts } = useBankAccounts();

    const { chartData, compareData, comparisonStats, loadingChart } =
        useMonthlyChart(selectedQuarter, activeCompareQuarter);

    // ── Derived display values (formatting only — no business logic) ──────────
    const totals = summary?.totals ?? {
        totalRevenue: 0, totalExpenses: 0, totalLiabilities: 0, netCashFlow: 0,
    };

    const netMargin = totals.totalRevenue > 0
        ? (totals.netCashFlow / totals.totalRevenue) * 100
        : 0;

    /** Human-readable period label using BS dates for custom range */
    const filterLabel = useMemo(() => {
        if (selectedQuarter === "custom") {
            return `${toBSDate(customStart)} → ${toBSDate(customEnd)}`;
        }
        if (selectedQuarter) {
            return `Q${selectedQuarter} · ${QUARTER_MONTHS[selectedQuarter]} · FY 2081`;
        }
        return "FY 2081/82 · All Periods";
    }, [selectedQuarter, customStart, customEnd]);

    /** Labels for compare mode headers */
    const labelA = selectedQuarter ? `Q${selectedQuarter} · ${QUARTER_MONTHS[selectedQuarter] ?? ""}` : "Current";
    const labelB = `Q${compareQuarter} · ${QUARTER_MONTHS[compareQuarter] ?? ""}`;

    // ── Quick-action handlers ─────────────────────────────────────────────────
    const handleAddRevenue = useCallback(() => {
        setActiveTab("revenue");
        setPendingAction("revenue");
    }, []);

    const handleAddExpense = useCallback(() => {
        setActiveTab("expenses");
        setPendingAction("expense");
    }, []);

    // ── Inject controls into global header ────────────────────────────────────
    useHeaderSlot(
        () => (
            <AccountingHeaderSlot
                selectedQuarter={selectedQuarter}
                onQuarterChange={setSelectedQuarter}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={setCustomStart}
                onCustomEndChange={setCustomEnd}
                compareMode={compareMode}
                onCompareModeToggle={() => setCompareMode(p => !p)}
                compareQuarter={compareQuarter}
                onCompareQuarterChange={setCompareQuarter}
                onAddRevenue={handleAddRevenue}
                onAddExpense={handleAddExpense}
                onRefresh={refetch}
                summary={summary}
                filterLabel={filterLabel}
                bankAccounts={bankAccounts}
            />
        ),
        // deps: every value that changes the slot's rendered output
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            selectedQuarter, customStart, customEnd,
            compareMode, compareQuarter,
            filterLabel, summary, bankAccounts,
            handleAddRevenue, handleAddExpense, refetch,
        ],
    );

    // ── Shared filter props passed to breakdown sub-pages ─────────────────────
    const filterProps = {
        selectedQuarter, compareMode, compareQuarter,
        customStartDate: customStart, customEndDate: customEnd,
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="ap" style={{ minHeight: "100vh", background: C.bg }}>
            <div className="no-print" style={{
                padding: window.innerWidth < 640 ? "8px 16px 0" : "8px 28px 0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 10,
            }}>
                <div style={{ display: "flex", gap: 3, background: C.surfaceAlt, borderRadius: 11, padding: 3 }}>
                    {[
                        { id: "overview", l: "Overview" },
                        { id: "revenue", l: "Revenue" },
                        { id: "expenses", l: "Expenses" },
                        { id: "ledger", l: "Ledger" },
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                            padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                            fontSize: 13, fontWeight: 600, transition: "all .15s",
                            background: activeTab === t.id ? C.forest : "transparent",
                            color: activeTab === t.id ? "#fff" : C.textMid,
                        }}>{t.l}</button>
                    ))}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                    {filterLabel}
                    {activeTab === "ledger" && ledgerEntries.length > 0 && (
                        <span style={{ marginLeft: 8, padding: "2px 9px", borderRadius: 20, background: C.surfaceAlt, fontWeight: 700, color: C.textMid }}>
                            {ledgerEntries.length} entries
                        </span>
                    )}
                </div>
            </div>

            {/* ── PAGE BODY ──────────────────────────────────────────────────── */}
            <div style={{
                padding: window.innerWidth < 640 ? "12px 16px 24px" : "16px 28px 32px",
                display: "flex", flexDirection: "column", gap: 18,
            }}>

                {/* ── HERO KPI CARDS ──────────────────────────────────────────── */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: window.innerWidth < 768 ? "1fr" : window.innerWidth < 1024 ? "1fr 1fr" : "minmax(260px,auto) 1fr 1fr 1fr",
                    gap: 14,
                }}>

                    {/* Net Cash Position — dark hero card */}
                    <DarkCard delay={0} style={{ padding: "22px 26px", minWidth: 260 }}>
                        <Lbl light>Net Cash Position</Lbl>
                        {loadingSummary
                            ? <div style={{ height: 54, borderRadius: 8, background: "rgba(255,255,255,.08)", animation: "ap-pulse 1.5s infinite" }} />
                            : <div className="ap-serif" style={{ fontSize: 52, color: "#fff", lineHeight: 1, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(Math.abs(totals.netCashFlow))}
                            </div>
                        }
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                            <Delta value={netMargin} label={`${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}% margin`} />
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                                {totals.netCashFlow >= 0 ? "Surplus" : "Deficit"}
                            </span>
                        </div>
                        <div style={{ marginTop: 14 }}>
                            <Spark data={(compareMode ? compareData : chartData).map(d =>
                                compareMode
                                    ? { v: (d.revenueA ?? 0) - (d.expensesA ?? 0) }
                                    : { v: (d.revenue ?? 0) - (d.expenses ?? 0) }
                            )} color={totals.netCashFlow >= 0 ? "#6EE7B7" : "#FCA5A5"} h={36} />
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
                            {[
                                { l: "Revenue", v: totals.totalRevenue, c: "#6EE7B7" },
                                { l: "Expenses", v: totals.totalExpenses, c: "#FCA5A5" },
                            ].map(x => (
                                <div key={x.l}>
                                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginBottom: 1 }}>{x.l}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: x.c }}>₹{fmtK(x.v)}</div>
                                </div>
                            ))}
                        </div>
                    </DarkCard>

                    {/* Revenue */}
                    <Card delay={1}>
                        <Lbl>Total Revenue</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif" style={{ fontSize: 40, fontWeight: 400, color: C.forest, lineHeight: 1, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalRevenue)}
                            </div>
                        }
                        <div style={{ marginTop: 10 }}>
                            <Spark data={chartData.map(d => ({ v: d.revenue ?? 0 }))} color={C.forestLight} h={28} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <BreakdownPills breakdown={summary?.incomeStreams?.breakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Expenses */}
                    <Card delay={2}>
                        <Lbl>Total Expenses</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif" style={{ fontSize: 40, fontWeight: 400, color: C.amber, lineHeight: 1, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalExpenses)}
                            </div>
                        }
                        <div style={{ marginTop: 10 }}>
                            <Spark data={chartData.map(d => ({ v: d.expenses ?? 0 }))} color={C.amber} h={28} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <BreakdownPills breakdown={summary?.expensesBreakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Liabilities */}
                    <Card delay={3}>
                        <Lbl>Outstanding Liabilities</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif" style={{ fontSize: 40, fontWeight: 400, color: C.red, lineHeight: 1, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalLiabilities)}
                            </div>
                        }
                        <div style={{ marginTop: 10 }}>
                            <BreakdownPills breakdown={summary?.liabilitiesBreakdown ?? []} loading={loadingSummary} />
                        </div>
                    </Card>
                </div>

                {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Compare stat strip — only visible in compare mode */}
                        {compareMode && (
                            <Card delay={0} style={{ padding: "16px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                                    <Lbl style={{ marginBottom: 0 }}>Quarter Comparison</Lbl>
                                    <div style={{ display: "flex", gap: 14 }}>
                                        {[
                                            { label: labelA, color: C.forestLight },
                                            { label: labelB, color: C.forestLight + "55" },
                                            { label: `Exp ${labelA}`, color: C.amber },
                                            { label: `Exp ${labelB}`, color: C.amber + "55" },
                                        ].map(x => (
                                            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textMuted }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 2, background: x.color, flexShrink: 0 }} />
                                                {x.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CompareChart data={compareData} loading={loadingChart} labelA={labelA} labelB={labelB} />
                            </Card>
                        )}

                        {/* Compare KPI deltas */}
                        {compareMode && comparisonStats && (
                            <CompareStatStrip stats={comparisonStats} labelA={labelA} labelB={labelB} loading={loadingChart} />
                        )}

                        {/* Normal cash flow trend + scorecard row */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "1fr 290px",
                            gap: 16,
                        }}>
                            <Card delay={compareMode ? 2 : 0}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <div>
                                        <Lbl style={{ marginBottom: 2 }}>
                                            {compareMode ? "Primary Period · Cash Flow" : "Cash Flow Trend"}
                                        </Lbl>
                                        <div style={{ fontSize: 11, color: C.textMuted }}>{filterLabel}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        {[{ c: C.forestLight, l: "Revenue" }, { c: C.amber, l: "Expenses" }].map(x => (
                                            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textMuted }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, flexShrink: 0 }} />{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <RevExpChart data={chartData} loading={loadingChart} />
                            </Card>

                            <Card delay={compareMode ? 3 : 1}>
                                <Lbl>Financial Scorecard</Lbl>
                                <Scorecard totals={totals} loading={loadingSummary} />
                            </Card>
                        </div>

                        {/* Cash position + revenue streams */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "1fr 1fr",
                            gap: 16,
                        }}>
                            <Card delay={compareMode ? 4 : 2}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                    <div>
                                        <Lbl style={{ marginBottom: 2 }}>Cash Flow Position</Lbl>
                                        <div style={{ fontSize: 11, color: C.textMuted }}>Cumulative · monthly net overlay</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        {[{ c: C.forest, l: "Cumulative" }, { c: C.amber, l: "Net" }].map(x => (
                                            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.textMuted }}>
                                                <span style={{ width: 14, height: 2, background: x.c, borderRadius: 1 }} />{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Always uses primary period data (non-compare) */}
                                <CashFlowArea data={chartData} loading={loadingChart} />
                            </Card>

                            <Card delay={compareMode ? 5 : 3}>
                                <Lbl>Revenue Streams</Lbl>
                                <RevenueStreamTable
                                    breakdown={summary?.incomeStreams?.breakdown ?? []}
                                    loading={loadingSummary}
                                />
                            </Card>
                        </div>

                        {/* Recent transactions */}
                        <Card delay={compareMode ? 6 : 4}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <Lbl style={{ marginBottom: 0 }}>Recent Transactions</Lbl>
                                <button onClick={() => setActiveTab("ledger")} style={{
                                    fontSize: 12, fontWeight: 700, color: C.forest, background: "none", border: "none", cursor: "pointer",
                                }}>
                                    View all →
                                </button>
                            </div>
                            <LedgerFeed entries={ledgerEntries} loading={loadingLedger} onViewAll={() => setActiveTab("ledger")} />
                        </Card>
                    </div>
                )}

                {/* ── REVENUE TAB ─────────────────────────────────────────────── */}
                {activeTab === "revenue" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Context indicator showing relationship to total KPIs */}
                        <Card delay={0} style={{ 
                            padding: "14px 20px", 
                            background: `linear-gradient(135deg, ${C.positiveBg} 0%, ${C.surface} 100%)`,
                            borderLeft: `4px solid ${C.forestLight}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: "50%",
                                        background: C.forestLight, display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        <TrendingUpIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em" }}>
                                            Revenue Detail View
                                        </div>
                                        <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>
                                            Analyzing revenue streams for <span style={{ fontWeight: 700, color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: "8px 16px", 
                                    borderRadius: 10, 
                                    background: C.surface,
                                    border: `1px solid ${C.border}`,
                                }}>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>Total Revenue (from KPIs above)</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: C.forestLight }}>₹{fmtN(totals.totalRevenue)}</div>
                                </div>
                            </div>
                        </Card>
                        <RevenueBreakDown
                            onRevenueAdded={refetch}
                            {...filterProps}
                            openDialog={pendingAction === "revenue"}
                            onDialogOpenHandled={() => setPendingAction(null)}
                        />
                    </div>
                )}

                {/* ── EXPENSES TAB ────────────────────────────────────────────── */}
                {activeTab === "expenses" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Context indicator showing relationship to total KPIs */}
                        <Card delay={0} style={{ 
                            padding: "14px 20px", 
                            background: `linear-gradient(135deg, ${C.amberBg} 0%, ${C.surface} 100%)`,
                            borderLeft: `4px solid ${C.amber}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: "50%",
                                        background: C.amber, display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        <TrendingDownIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em" }}>
                                            Expense Detail View
                                        </div>
                                        <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>
                                            Analyzing expense categories for <span style={{ fontWeight: 700, color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: "8px 16px", 
                                    borderRadius: 10, 
                                    background: C.surface,
                                    border: `1px solid ${C.border}`,
                                }}>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>Total Expenses (from KPIs above)</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: C.amber }}>₹{fmtN(totals.totalExpenses)}</div>
                                </div>
                            </div>
                        </Card>
                        <ExpenseBreakDown
                            onExpenseAdded={refetch}
                            {...filterProps}
                            openDialog={pendingAction === "expense"}
                            onDialogOpenHandled={() => setPendingAction(null)}
                        />
                    </div>
                )}

                {/* ── LEDGER TAB ──────────────────────────────────────────────── */}
                {activeTab === "ledger" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Context indicator showing relationship to total KPIs */}
                        <Card delay={0} style={{ 
                            padding: "14px 20px", 
                            background: `linear-gradient(135deg, ${C.blueBg} 0%, ${C.surface} 100%)`,
                            borderLeft: `4px solid ${C.blue}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: "50%",
                                        background: C.blue, display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        <FileTextIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em" }}>
                                            Ledger Detail View
                                        </div>
                                        <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>
                                            All transactions for <span style={{ fontWeight: 700, color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    display: "flex",
                                    gap: 12,
                                }}>
                                    <div style={{ 
                                        padding: "8px 14px", 
                                        borderRadius: 10, 
                                        background: C.positiveBg,
                                        border: `1px solid ${C.positive}30`,
                                    }}>
                                        <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 2 }}>Credits</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: C.positive }}>₹{fmtK(totals.totalRevenue)}</div>
                                    </div>
                                    <div style={{ 
                                        padding: "8px 14px", 
                                        borderRadius: 10, 
                                        background: C.negativeBg,
                                        border: `1px solid ${C.negative}30`,
                                    }}>
                                        <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 2 }}>Debits</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: C.negative }}>₹{fmtK(totals.totalExpenses)}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Card delay={0} style={{ padding: 0 }}>
                            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>General Ledger</div>
                                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{filterLabel}</div>
                                </div>
                                <button onClick={() => window.print()} style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9,
                                    border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.textMid, cursor: "pointer",
                                }}>
                                    <PrinterIcon size={13} />Print
                                </button>
                            </div>
                            <LedgerTable entries={ledgerEntries} loading={loadingLedger} itemsPerPage={20} />
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}