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

function toBSDate(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
    } catch { return "—"; }
}

function toBSShort(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${nd.getDate()} ${BS_MONTHS_SHORT[nd.getMonth()]}`;
    } catch { return "—"; }
}

function toBSMonthYear(isoOrDate) {
    if (!isoOrDate) return "—";
    try {
        const nd = new NepaliDate(new Date(isoOrDate));
        return `${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
    } catch { return "—"; }
}

// ─── Design tokens — petrol theme ─────────────────────────────────────────────
const C = {
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    surfaceAlt: "#F5F4F0",
    surfaceHover: "#FAFAF8",
    forest: "#1A5276",
    forestMid: "#154360",
    forestLight: "#2E86C1",
    amber: "#92400E",
    amberBg: "#FEF9C3",
    amberLight: "#FDE68A",
    red: "#991B1B",
    redBg: "#FEE2E2",
    blue: "#1E40AF",
    blueBg: "#DBEAFE",
    violet: "#6D28D9",
    border: "#E7E5E0",
    borderStrong: "#D6D3CC",
    text: "#1C1917",
    textMid: "#44403C",
    textMuted: "#78716C",
    positive: "#166534",
    positiveBg: "#DCFCE7",
    negative: "#991B1B",
    negativeBg: "#FEE2E2",
    neutral: "#44403C",
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
        <div
            className={`ap-card rounded-2xl border ${className}`}
            style={{ background: C.surface, borderColor: C.border, padding: "20px 22px", animationDelay: `${delay * 0.05}s`, ...style }}
        >
            {children}
        </div>
    );
}

function DarkCard({ children, style = {}, delay = 0 }) {
    return (
        <div
            className="ap-card rounded-2xl"
            style={{ background: C.forest, padding: "20px 22px", animationDelay: `${delay * 0.05}s`, ...style }}
        >
            {children}
        </div>
    );
}

function Lbl({ children, light = false, style = {} }) {
    return (
        <div
            className="text-[10px] font-bold tracking-[0.1em] uppercase mb-2"
            style={{ color: light ? "rgba(255,255,255,0.45)" : C.textMuted, ...style }}
        >
            {children}
        </div>
    );
}

function Delta({ value, label }) {
    const up = value >= 0;
    return (
        <span
            className="inline-flex items-center gap-[3px] text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: up ? C.positiveBg : C.negativeBg, color: up ? C.positive : C.negative }}
        >
            {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}
            {label ?? (`${Math.abs(value).toFixed(1)}%`)}
        </span>
    );
}

function ProgBar({ value, max, color = C.forest, h = 5 }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="flex-1 overflow-hidden" style={{ height: h, borderRadius: h / 2, background: C.border }}>
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
        <div className="rounded-xl shadow-xl min-w-[160px]" style={{ background: C.forest, padding: "10px 14px", border: "none" }}>
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-2" style={{ color: "rgba(255,255,255,.4)" }}>
                {label}
            </div>
            {payload.map(p => (
                <div key={p.dataKey} className="flex items-center gap-2 text-xs text-white mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill ?? p.color }} />
                    <span style={{ opacity: .65, flex: 1 }}>{p.name}</span>
                    <span className="font-bold">₹{fmtK(Math.abs(p.value || 0))}</span>
                </div>
            ))}
        </div>
    );
}

function Skeleton({ h = 32 }) {
    return <div className="rounded-lg" style={{ height: h, background: C.surfaceAlt, animation: "ap-pulse 1.5s infinite" }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CHART COMPONENTS ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function RevExpChart({ data = [], loading }) {
    if (loading) return <Skeleton h={180} />;
    if (!data.length) return (
        <div className="flex items-center justify-center text-[13px]" style={{ height: 180, color: C.textMuted }}>
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

function CompareChart({ data = [], loading, labelA, labelB }) {
    if (loading) return <Skeleton h={200} />;
    if (!data.length) return (
        <div className="flex items-center justify-center text-[13px]" style={{ height: 200, color: C.textMuted }}>
            No comparison data
        </div>
    );
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
        <div className="flex items-center justify-center text-[13px]" style={{ height: 140, color: C.textMuted }}>No data</div>
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

function CompareStatStrip({ stats, labelA, labelB, loading }) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="grid grid-cols-3 gap-3">
            {items.map(({ key, label, positive }) => {
                const s = stats[key] ?? {};
                const pct = s.pct ?? null;
                const isGood = positive ? (pct ?? 0) >= 0 : (pct ?? 0) <= 0;
                const TrendIcon = pct === null ? MinusIcon : pct >= 0 ? TrendingUpIcon : TrendingDownIcon;
                return (
                    <div key={key} className="rounded-xl border p-4" style={{ borderColor: C.border, background: C.surface }}>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: C.textMuted }}>
                            {label}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div>
                                <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>{labelA}</div>
                                <div className="text-[15px] font-bold" style={{ color: C.text }}>₹{fmtK(s.a ?? 0)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>{labelB}</div>
                                <div className="text-[15px] font-bold" style={{ color: C.text }}>₹{fmtK(s.b ?? 0)}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5">
                            <TrendIcon size={12} color={isGood ? C.positive : C.negative} />
                            <span className="text-xs font-bold" style={{ color: pct === null ? C.textMuted : (isGood ? C.positive : C.negative) }}>
                                {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                            </span>
                            <span className="text-[11px]" style={{ color: C.textMuted }}>vs {labelB}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SECTION COMPONENTS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueStreamTable({ breakdown = [], loading }) {
    const total = breakdown.reduce((s, x) => s + (x.amount ?? 0), 0);
    const PALETTE = [C.forestLight, C.amber, C.blue, C.violet, "#0891B2"];

    if (loading) return (
        <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map(i => <Skeleton key={i} h={36} />)}
        </div>
    );
    if (!breakdown.length) return (
        <div className="py-5 text-center text-[13px]" style={{ color: C.textMuted }}>No revenue streams</div>
    );
    return (
        <>
            <div className="grid pb-2 border-b px-1" style={{ gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px", borderColor: C.border }}>
                {["Source", "Share", "Amount"].map(h => (
                    <span key={h} className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: C.textMuted }}>{h}</span>
                ))}
            </div>
            {breakdown.map((item, i) => (
                <div key={item.code ?? i} className="grid items-center px-1 py-2.5 border-b" style={{ gridTemplateColumns: "1fr 1fr 70px", gap: "0 8px", borderColor: C.border + "30" }}>
                    <div>
                        <div className="text-[13px] font-semibold" style={{ color: C.text }}>{item.name}</div>
                        {item.code && <div className="text-[10px]" style={{ color: C.textMuted }}>{item.code}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <ProgBar value={item.amount} max={total} color={PALETTE[i % PALETTE.length]} />
                        <span className="text-[11px] min-w-[26px]" style={{ color: C.textMuted }}>
                            {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className="text-[13px] font-bold text-right" style={{ color: C.text }}>
                        ₹{fmtK(item.amount)}
                    </div>
                </div>
            ))}
        </>
    );
}

function BreakdownPills({ breakdown = [], loading }) {
    if (loading) return <Skeleton h={56} />;
    if (!breakdown.length) return <div className="text-xs" style={{ color: C.textMuted }}>No breakdown data</div>;
    const total = breakdown.reduce((s, x) => s + x.amount, 0);
    const DOTS = [C.amber, C.red, C.violet, C.blue];
    return (
        <div className="flex flex-col gap-2">
            {breakdown.slice(0, 4).map((item, i) => (
                <div key={item.code ?? i} className="flex items-center gap-2.5">
                    <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: DOTS[i % 4] }} />
                    <span className="text-[13px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: C.textMid }}>{item.name}</span>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: C.text }}>₹{fmtK(item.amount)}</span>
                    <span className="text-[10px] min-w-[24px] text-right" style={{ color: C.textMuted }}>
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
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center">
                <span
                    className="text-[10px] font-bold tracking-[0.06em] uppercase px-3 py-0.5 rounded-full mb-1"
                    style={{ color: statusColor, background: `${statusColor}18` }}
                >
                    {statusLabel}
                </span>
                <Gauge pct={gaugePct} color={statusColor} />
                {loading
                    ? <Skeleton h={28} />
                    : <div className="ap-serif text-[30px] -mt-2 leading-none" style={{ color: C.text }}>{margin.toFixed(1)}%</div>
                }
                <div className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>Net Margin</div>
            </div>
            <div className="flex flex-col gap-2.5">
                {[
                    { label: "Expense Ratio", value: expRatio, max: 100, color: expRatio > 80 ? C.red : C.amber, display: `${expRatio.toFixed(1)}%` },
                    { label: "Revenue Retained", value: Math.max(0, 100 - expRatio), max: 100, color: C.forestLight, display: `${Math.max(0, 100 - expRatio).toFixed(1)}%` },
                ].map(m => (
                    <div key={m.label}>
                        <div className="flex justify-between mb-1.5">
                            <span className="text-[11px]" style={{ color: C.textMuted }}>{m.label}</span>
                            <span className="text-[11px] font-bold" style={{ color: C.text }}>{m.display}</span>
                        </div>
                        <ProgBar value={m.value} max={m.max} color={m.color} />
                    </div>
                ))}
                {coverage !== null && (
                    <div className="mt-0.5 px-3 py-2.5 rounded-xl" style={{ background: coverage >= 1 ? C.positiveBg : C.negativeBg }}>
                        <div className="text-[10px] font-bold tracking-[0.07em] uppercase" style={{ color: coverage >= 1 ? C.positive : C.red }}>
                            Liability Coverage
                        </div>
                        <div className="ap-serif text-2xl mt-0.5" style={{ color: C.text }}>{coverage.toFixed(2)}×</div>
                        <div className="text-[11px]" style={{ color: C.textMuted }}>revenue vs liabilities</div>
                    </div>
                )}
            </div>
        </div>
    );
}

function LedgerFeed({ entries = [], loading, onViewAll }) {
    if (loading) return (
        <div className="flex flex-col gap-1.5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={44} />)}
        </div>
    );
    const recent = entries.slice(0, 8);
    if (!recent.length) return (
        <div className="py-5 text-center text-[13px]" style={{ color: C.textMuted }}>No ledger entries</div>
    );
    return (
        <div className="flex flex-col gap-0.5">
            {recent.map((e, i) => {
                const isDebit = (e.debit ?? 0) > 0;
                const amt = e.debit ?? e.credit ?? 0;
                return (
                    <div
                        key={e._id ?? i}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-[9px]"
                        style={{ background: i % 2 !== 0 ? C.surfaceAlt + "70" : "transparent" }}
                    >
                        <div
                            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                            style={{ background: isDebit ? C.redBg : C.positiveBg }}
                        >
                            {isDebit
                                ? <ArrowDownRightIcon size={14} color={C.red} />
                                : <ArrowUpRightIcon size={14} color={C.positive} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: C.text }}>
                                {e.description ?? e.account?.name ?? "—"}
                            </div>
                            <div className="text-[10px]" style={{ color: C.textMuted }}>{toBSDate(e.date)}</div>
                        </div>
                        <div className="text-[13px] font-bold flex-shrink-0" style={{ color: isDebit ? C.negative : C.positive }}>
                            {isDebit ? "−" : "+"}₹{fmtN(amt)}
                        </div>
                    </div>
                );
            })}
            <button
                onClick={onViewAll}
                className="mt-1.5 py-2 rounded-[9px] border bg-transparent text-xs font-semibold cursor-pointer"
                style={{ borderColor: C.border, color: C.textMid }}
            >
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
                <button
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border text-xs font-semibold cursor-pointer"
                    style={{ borderColor: C.border, background: C.surface, color: C.text }}
                >
                    <ShareIcon size={12} />Export<ChevronDownIcon size={10} style={{ opacity: .4 }} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl min-w-[176px]">
                <DropdownMenuItem onClick={() => window.print()} className="gap-2 cursor-pointer">
                    <PrinterIcon size={13} />Print Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
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
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                    dl(JSON.stringify(summary, null, 2), `accounts-${Date.now()}.json`, "application/json");
                }}>
                    <FileTextIcon size={13} />Export JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HEADER SLOT ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
        <button
            onClick={() => onQuarterChange(value)}
            className="rounded-lg text-[13px] font-semibold cursor-pointer transition-all"
            style={{
                padding: "6px 14px", minHeight: 44,
                border: `1px solid ${selectedQuarter === value ? C.forest : C.border}`,
                background: selectedQuarter === value ? C.forest : "transparent",
                color: selectedQuarter === value ? "#fff" : C.textMid,
            }}
        >
            {label}
        </button>
    );

    // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                    {/* Hero CTA */}
                    <button
                        onClick={onAddRevenue}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-none text-sm font-bold cursor-pointer text-white"
                        style={{ padding: "10px 16px", background: C.forestLight, minHeight: 46, boxShadow: "0 2px 12px rgba(26,43,26,0.2)" }}
                    >
                        <PlusIcon size={17} strokeWidth={2.5} />
                        Add Revenue
                    </button>

                    {/* Filter drawer trigger */}
                    <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                        <SheetTrigger asChild>
                            <button
                                className="flex items-center justify-center gap-1.5 rounded-xl cursor-pointer relative text-[13px] font-semibold"
                                style={{
                                    padding: "10px 14px", minHeight: 46,
                                    border: `1.5px solid ${activeFilterCount > 0 ? C.forest : C.border}`,
                                    background: activeFilterCount > 0 ? C.forest + "10" : C.surface,
                                    color: activeFilterCount > 0 ? C.forest : C.textMid,
                                }}
                            >
                                <FilterIcon size={17} strokeWidth={2.2} />
                                {activeFilterCount > 0 && (
                                    <span
                                        className="absolute -top-1 -right-1 flex items-center justify-center text-[10px] font-bold text-white rounded-full border-2"
                                        style={{ width: 18, height: 18, background: C.forest, borderColor: C.bg }}
                                    >
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="overflow-auto" style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85vh" }}>
                            <SheetHeader>
                                <SheetTitle className="text-lg font-bold" style={{ color: C.forest }}>
                                    Filter & Compare
                                </SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 flex flex-col gap-6">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.08em] mb-3" style={{ color: C.textMuted }}>Period</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {QUARTERS.map(q => <QPill key={q.label} label={q.label} value={q.value} />)}
                                    </div>
                                    <div className="mt-4 p-4 rounded-xl border" style={{ borderColor: C.border, background: C.surfaceAlt }}>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: C.textMuted }}>Custom Range</div>
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold mb-1.5" style={{ color: C.textMuted }}>Start Date</div>
                                                <DualCalendarTailwind value={customStart} onChange={v => onCustomStartChange(v ?? "")} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold mb-1.5" style={{ color: C.textMuted }}>End Date</div>
                                                <DualCalendarTailwind value={customEnd} onChange={v => onCustomEndChange(v ?? "")} />
                                            </div>
                                        </div>
                                        <button
                                            disabled={!customStart || !customEnd}
                                            onClick={() => { handleApplyCustom(); setShowMobileFilters(false); }}
                                            className="mt-3 w-full rounded-xl border-none text-sm font-bold cursor-pointer text-white"
                                            style={{ padding: "10px 0", background: C.forest, minHeight: 44, opacity: (!customStart || !customEnd) ? .4 : 1 }}
                                        >
                                            Apply Custom Range
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.08em] mb-3" style={{ color: C.textMuted }}>Comparison</div>
                                    <button
                                        onClick={onCompareModeToggle}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                        style={{
                                            padding: "12px 16px", minHeight: 46,
                                            border: `1.5px solid ${compareMode ? C.forest : C.border}`,
                                            background: compareMode ? C.forest : C.surface,
                                            color: compareMode ? "#fff" : C.textMid,
                                        }}
                                    >
                                        <GitCompareArrowsIcon size={17} strokeWidth={2.2} />
                                        {compareMode ? "Comparing Active" : "Enable Compare"}
                                    </button>
                                    {compareMode && (
                                        <div className="mt-4">
                                            <div className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: C.textMuted }}>Compare Against</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {QUARTERS.filter(q => q.value !== null).map(q => (
                                                    <button
                                                        key={q.value}
                                                        onClick={() => onCompareQuarterChange(q.value)}
                                                        className="flex flex-col items-center justify-center rounded-xl text-[13px] font-semibold cursor-pointer"
                                                        style={{
                                                            padding: "10px 12px", minHeight: 46,
                                                            border: `1.5px solid ${compareQuarter === q.value ? C.amber : C.border}`,
                                                            background: compareQuarter === q.value ? C.amberBg : C.surface,
                                                            color: compareQuarter === q.value ? C.amber : C.textMid,
                                                        }}
                                                    >
                                                        <span className="font-bold">{q.label}</span>
                                                        <span className="text-[9px] mt-0.5" style={{ opacity: .7 }}>
                                                            {QUARTER_MONTHS[q.value]}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setShowMobileFilters(false)}
                                    className="w-full rounded-xl border-none text-[15px] font-bold cursor-pointer text-white"
                                    style={{ padding: "14px 16px", minHeight: 48, background: C.forest }}
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* More actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex items-center rounded-xl cursor-pointer border"
                                style={{ padding: "10px 12px", minHeight: 46, borderColor: C.border, background: C.surface }}
                            >
                                <MoreVerticalIcon size={19} color={C.textMid} strokeWidth={2.2} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl min-w-[200px]">
                            <DropdownMenuItem onClick={onAddExpense} className="gap-2.5 cursor-pointer py-3 px-4">
                                <PlusIcon size={16} color={C.amber} />
                                <span className="text-sm font-semibold">Add Expense</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onRefresh} className="gap-2.5 cursor-pointer py-3 px-4">
                                <RefreshCwIcon size={16} />Refresh Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.print()} className="gap-2.5 cursor-pointer py-3 px-4">
                                <PrinterIcon size={16} />Print Report
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2.5 cursor-pointer py-3 px-4" onClick={() => {
                                const t = summary?.totals ?? {};
                                const rows = [["Metric", "Value"], ["Revenue", t.totalRevenue ?? 0], ["Expenses", t.totalExpenses ?? 0], ["Net Cash Flow", t.netCashFlow ?? 0], ["Period", filterLabel]];
                                const b = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
                                const u = URL.createObjectURL(b);
                                Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.csv` }).click();
                                URL.revokeObjectURL(u);
                            }}>
                                <DownloadIcon size={16} />Export CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Active filter chip */}
                {(selectedQuarter !== null || compareMode) && (
                    <div
                        className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border"
                        style={{ background: `linear-gradient(135deg, ${C.forestLight}10 0%, ${C.surface} 100%)`, borderColor: C.forest + "20" }}
                    >
                        <div className="text-xs flex-1" style={{ color: C.textMid }}>
                            <span className="font-bold" style={{ color: C.forest }}>{filterLabel}</span>
                            {compareMode && (
                                <span className="ml-1.5 text-[11px] font-semibold" style={{ color: C.amber }}>
                                    · vs Q{compareQuarter}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                onQuarterChange(null);
                                onCustomStartChange("");
                                onCustomEndChange("");
                                if (compareMode) onCompareModeToggle();
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded cursor-pointer border"
                            style={{ color: C.textMuted, background: C.surface, borderColor: C.border }}
                        >
                            <XIcon size={13} />Clear
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
    return (
        <div className="flex items-center gap-2.5 flex-wrap">
            {/* Add Revenue */}
            <button
                onClick={onAddRevenue}
                className="flex items-center gap-1.5 rounded-xl border-none text-sm font-bold cursor-pointer text-white transition-transform hover:-translate-y-px"
                style={{ padding: "7px 18px", background: C.forestLight, boxShadow: "0 2px 8px rgba(26,43,26,0.15)" }}
            >
                <PlusIcon size={15} strokeWidth={2.5} />
                Add Revenue
            </button>

            <div className="w-px h-7 mx-1" style={{ background: C.border }} />

            {/* Period filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex items-center gap-1.5 rounded-[9px] text-[13px] font-semibold cursor-pointer transition-all"
                        style={{
                            padding: "7px 14px",
                            border: `1.5px solid ${selectedQuarter !== null ? C.forest : C.border}`,
                            background: selectedQuarter !== null ? C.forest + "08" : "transparent",
                            color: selectedQuarter !== null ? C.forest : C.textMid,
                        }}
                    >
                        <CalendarIcon size={14} strokeWidth={2.2} />
                        <span>{selectedQuarter === "custom" ? `${toBSShort(customStart)}–${toBSShort(customEnd)}` : selectedQuarter ? `Q${selectedQuarter}` : "All Periods"}</span>
                        <ChevronDownIcon size={13} style={{ opacity: .5 }} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-2xl p-5 min-w-[280px]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3.5" style={{ color: C.textMuted }}>Select Period</div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {QUARTERS.map(q => (
                            <button
                                key={q.label}
                                onClick={() => onQuarterChange(q.value)}
                                className="rounded-lg text-center text-[13px] font-semibold cursor-pointer transition-all"
                                style={{
                                    padding: "10px 8px",
                                    border: `1px solid ${selectedQuarter === q.value ? C.forest : C.border}`,
                                    background: selectedQuarter === q.value ? C.forest : "transparent",
                                    color: selectedQuarter === q.value ? "#fff" : C.textMid,
                                }}
                            >
                                {q.label}
                                {q.value && (
                                    <div className="text-[9px] mt-0.5" style={{ opacity: .7 }}>
                                        {QUARTER_MONTHS[q.value]?.split("–")[0]}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: C.textMuted }}>Custom Range</div>
                        <div className="grid grid-cols-2 gap-2.5 mb-3">
                            <div>
                                <div className="text-[10px] font-semibold mb-1.5" style={{ color: C.textMuted }}>Start</div>
                                <DualCalendarTailwind value={customStart} onChange={v => onCustomStartChange(v ?? "")} />
                            </div>
                            <div>
                                <div className="text-[10px] font-semibold mb-1.5" style={{ color: C.textMuted }}>End</div>
                                <DualCalendarTailwind value={customEnd} onChange={v => onCustomEndChange(v ?? "")} />
                            </div>
                        </div>
                        <button
                            disabled={!customStart || !customEnd}
                            onClick={handleApplyCustom}
                            className="w-full rounded-[9px] border-none text-[13px] font-bold cursor-pointer text-white"
                            style={{ padding: "9px 0", background: C.forest, opacity: (!customStart || !customEnd) ? .4 : 1 }}
                        >
                            Apply Custom Range
                        </button>
                    </div>
                    {selectedQuarter !== null && (
                        <>
                            <DropdownMenuSeparator />
                            <button
                                onClick={() => { onQuarterChange(null); onCustomStartChange(""); onCustomEndChange(""); }}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-transparent border-none cursor-pointer py-2"
                                style={{ color: C.textMuted }}
                            >
                                <XIcon size={13} />Clear Filter
                            </button>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Compare toggle */}
            <button
                onClick={onCompareModeToggle}
                className="flex items-center gap-1.5 rounded-[9px] text-[13px] font-semibold cursor-pointer transition-all"
                style={{
                    padding: "7px 14px",
                    border: `1.5px solid ${compareMode ? C.forest : C.border}`,
                    background: compareMode ? C.forest : "transparent",
                    color: compareMode ? "#fff" : C.textMid,
                }}
            >
                <GitCompareArrowsIcon size={14} strokeWidth={2.2} />
                {compareMode ? "Comparing" : "Compare"}
            </button>

            {compareMode && (
                <>
                    <div className="text-xs font-semibold" style={{ color: C.textMuted }}>vs</div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex items-center gap-1.5 rounded-[9px] text-[13px] font-semibold cursor-pointer"
                                style={{ padding: "7px 12px", border: `1.5px solid ${C.amber}`, background: C.amberBg, color: C.amber }}
                            >
                                Q{compareQuarter}
                                <ChevronDownIcon size={12} style={{ opacity: .6 }} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl p-4 min-w-[200px]">
                            <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: C.textMuted }}>Compare Against</div>
                            <div className="flex flex-col gap-1.5">
                                {QUARTERS.filter(q => q.value !== null).map(q => (
                                    <button
                                        key={q.value}
                                        onClick={() => onCompareQuarterChange(q.value)}
                                        className="flex justify-between items-center px-3 py-2.5 rounded-lg text-left text-[13px] font-semibold cursor-pointer"
                                        style={{
                                            border: `1px solid ${compareQuarter === q.value ? C.amber : C.border}`,
                                            background: compareQuarter === q.value ? C.amberBg : "transparent",
                                            color: compareQuarter === q.value ? C.amber : C.textMid,
                                        }}
                                    >
                                        <span>{q.label}</span>
                                        <span className="text-[10px]" style={{ opacity: .7 }}>{QUARTER_MONTHS[q.value]}</span>
                                    </button>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            <div className="flex-1 min-w-5" />

            {/* More actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex items-center gap-1.5 rounded-[9px] border text-[13px] font-semibold cursor-pointer"
                        style={{ padding: "7px 14px", borderColor: C.border, background: C.surface, color: C.textMid }}
                    >
                        <MoreVerticalIcon size={15} />More
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl min-w-[200px]">
                    <DropdownMenuItem onClick={onAddExpense} className="gap-2.5 cursor-pointer py-2.5 px-3.5">
                        <PlusIcon size={15} color={C.amber} />
                        <span className="text-[13px] font-semibold">Add Expense</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onRefresh} className="gap-2.5 cursor-pointer py-2.5 px-3.5">
                        <RefreshCwIcon size={15} />Refresh Data
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()} className="gap-2.5 cursor-pointer py-2.5 px-3.5">
                        <PrinterIcon size={15} />Print Report
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2.5 cursor-pointer py-2.5 px-3.5" onClick={() => {
                        const t = summary?.totals ?? {};
                        const rows = [["Metric", "Value"], ["Revenue", t.totalRevenue ?? 0], ["Expenses", t.totalExpenses ?? 0], ["Liabilities", t.totalLiabilities ?? 0], ["Net Cash Flow", t.netCashFlow ?? 0], ["Period", filterLabel]];
                        const b = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
                        const u = URL.createObjectURL(b);
                        Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.csv` }).click();
                        URL.revokeObjectURL(u);
                    }}>
                        <DownloadIcon size={15} />Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2.5 cursor-pointer py-2.5 px-3.5" onClick={() => {
                        const b = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
                        const u = URL.createObjectURL(b);
                        Object.assign(document.createElement("a"), { href: u, download: `accounts-${Date.now()}.json` }).click();
                        URL.revokeObjectURL(u);
                    }}>
                        <FileTextIcon size={15} />Export JSON
                    </DropdownMenuItem>
                    {bankAccounts[0] && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-3.5 py-2.5 pointer-events-none">
                                <div className="flex items-center gap-2">
                                    <BuildingIcon size={14} color={C.textMuted} />
                                    <div>
                                        <div className="text-[11px] font-bold" style={{ color: C.text }}>{bankAccounts[0].bankName}</div>
                                        <div className="text-[10px]" style={{ color: C.textMuted }}>Balance: ₹{bankAccounts[0].balance?.toLocaleString()}</div>
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
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [compareMode, setCompareMode] = useState(false);
    const [compareQuarter, setCompareQuarter] = useState(2);
    const [activeTab, setActiveTab] = useState("overview");
    const [pendingAction, setPendingAction] = useState(null);

    const activeCompareQuarter = compareMode ? compareQuarter : null;

    const { summary, loadingSummary, ledgerEntries, loadingLedger, refetch } =
        useAccounting(selectedQuarter, "all", customStart, customEnd);

    const { bankAccounts } = useBankAccounts();

    const { chartData, compareData, comparisonStats, loadingChart } =
        useMonthlyChart(selectedQuarter, activeCompareQuarter);

    const totals = summary?.totals ?? { totalRevenue: 0, totalExpenses: 0, totalLiabilities: 0, netCashFlow: 0 };

    const netMargin = totals.totalRevenue > 0 ? (totals.netCashFlow / totals.totalRevenue) * 100 : 0;

    const filterLabel = useMemo(() => {
        if (selectedQuarter === "custom") return `${toBSDate(customStart)} → ${toBSDate(customEnd)}`;
        if (selectedQuarter) return `Q${selectedQuarter} · ${QUARTER_MONTHS[selectedQuarter]} · FY 2081`;
        return "FY 2081/82 · All Periods";
    }, [selectedQuarter, customStart, customEnd]);

    const labelA = selectedQuarter ? `Q${selectedQuarter} · ${QUARTER_MONTHS[selectedQuarter] ?? ""}` : "Current";
    const labelB = `Q${compareQuarter} · ${QUARTER_MONTHS[compareQuarter] ?? ""}`;

    const handleAddRevenue = useCallback(() => { setActiveTab("revenue"); setPendingAction("revenue"); }, []);
    const handleAddExpense = useCallback(() => { setActiveTab("expenses"); setPendingAction("expense"); }, []);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedQuarter, customStart, customEnd, compareMode, compareQuarter, filterLabel, summary, bankAccounts, handleAddRevenue, handleAddExpense, refetch],
    );

    const filterProps = { selectedQuarter, compareMode, compareQuarter, customStartDate: customStart, customEndDate: customEnd };

    return (
        <div className="ap min-h-screen" style={{ background: C.bg }}>
            {/* ── Tab bar + period label ─────────────────────────────────────── */}
            <div
                className="no-print flex items-center justify-between flex-wrap gap-2.5"
                style={{ padding: "8px 28px 0" }}
            >
                <div className="flex gap-0.5 rounded-xl p-0.5" style={{ background: C.surfaceAlt }}>
                    {[
                        { id: "overview", l: "Overview" },
                        { id: "revenue", l: "Revenue" },
                        { id: "expenses", l: "Expenses" },
                        { id: "ledger", l: "Ledger" },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className="px-[18px] py-1.5 rounded-lg border-none cursor-pointer text-[13px] font-semibold transition-all"
                            style={{
                                background: activeTab === t.id ? C.forest : "transparent",
                                color: activeTab === t.id ? "#fff" : C.textMid,
                            }}
                        >
                            {t.l}
                        </button>
                    ))}
                </div>
                <div className="text-[11px]" style={{ color: C.textMuted }}>
                    {filterLabel}
                    {activeTab === "ledger" && ledgerEntries.length > 0 && (
                        <span className="ml-2 px-2.5 py-0.5 rounded-full font-bold" style={{ background: C.surfaceAlt, color: C.textMid }}>
                            {ledgerEntries.length} entries
                        </span>
                    )}
                </div>
            </div>

            {/* ── Page body ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-[18px]" style={{ padding: "16px 28px 32px" }}>

                {/* ── HERO KPI CARDS ─────────────────────────────────────────── */}
                <div className="grid gap-3.5" style={{ gridTemplateColumns: "minmax(260px,auto) 1fr 1fr 1fr" }}>

                    {/* Net Cash Position — dark hero card */}
                    <DarkCard delay={0} style={{ padding: "22px 26px", minWidth: 260 }}>
                        <Lbl light>Net Cash Position</Lbl>
                        {loadingSummary
                            ? <div className="h-[54px] rounded-lg" style={{ background: "rgba(255,255,255,.08)", animation: "ap-pulse 1.5s infinite" }} />
                            : <div className="ap-serif text-[52px] text-white leading-none" style={{ letterSpacing: "-0.02em" }}>
                                ₹{fmtN(Math.abs(totals.netCashFlow))}
                            </div>
                        }
                        <div className="mt-2 flex items-center gap-2">
                            <Delta value={netMargin} label={`${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}% margin`} />
                            <span className="text-[11px]" style={{ color: "rgba(255,255,255,.4)" }}>
                                {totals.netCashFlow >= 0 ? "Surplus" : "Deficit"}
                            </span>
                        </div>
                        <div className="mt-3.5">
                            <Spark
                                data={(compareMode ? compareData : chartData).map(d =>
                                    compareMode
                                        ? { v: (d.revenueA ?? 0) - (d.expensesA ?? 0) }
                                        : { v: (d.revenue ?? 0) - (d.expenses ?? 0) }
                                )}
                                color={totals.netCashFlow >= 0 ? "#6EE7B7" : "#FCA5A5"}
                                h={36}
                            />
                        </div>
                        <div className="mt-2.5 flex gap-4">
                            {[
                                { l: "Revenue", v: totals.totalRevenue, c: "#6EE7B7" },
                                { l: "Expenses", v: totals.totalExpenses, c: "#FCA5A5" },
                            ].map(x => (
                                <div key={x.l}>
                                    <div className="text-[10px] mb-0.5" style={{ color: "rgba(255,255,255,.35)" }}>{x.l}</div>
                                    <div className="text-sm font-bold" style={{ color: x.c }}>₹{fmtK(x.v)}</div>
                                </div>
                            ))}
                        </div>
                    </DarkCard>

                    {/* Revenue */}
                    <Card delay={1}>
                        <Lbl>Total Revenue</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif text-[40px] font-normal leading-none" style={{ color: C.forest, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalRevenue)}
                            </div>
                        }
                        <div className="mt-2.5">
                            <Spark data={chartData.map(d => ({ v: d.revenue ?? 0 }))} color={C.forestLight} h={28} />
                        </div>
                        <div className="mt-2.5">
                            <BreakdownPills breakdown={summary?.incomeStreams?.breakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Expenses */}
                    <Card delay={2}>
                        <Lbl>Total Expenses</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif text-[40px] font-normal leading-none" style={{ color: C.amber, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalExpenses)}
                            </div>
                        }
                        <div className="mt-2.5">
                            <Spark data={chartData.map(d => ({ v: d.expenses ?? 0 }))} color={C.amber} h={28} />
                        </div>
                        <div className="mt-2.5">
                            <BreakdownPills breakdown={summary?.expensesBreakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Liabilities */}
                    <Card delay={3}>
                        <Lbl>Outstanding Liabilities</Lbl>
                        {loadingSummary
                            ? <Skeleton h={40} />
                            : <div className="ap-serif text-[40px] font-normal leading-none" style={{ color: C.red, letterSpacing: "-0.02em" }}>
                                ₹{fmtN(totals.totalLiabilities)}
                            </div>
                        }
                        <div className="mt-2.5">
                            <BreakdownPills breakdown={summary?.liabilitiesBreakdown ?? []} loading={loadingSummary} />
                        </div>
                    </Card>
                </div>

                {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div className="flex flex-col gap-4">
                        {compareMode && (
                            <Card delay={0} style={{ padding: "16px 20px" }}>
                                <div className="flex items-center justify-between mb-3.5">
                                    <Lbl style={{ marginBottom: 0 }}>Quarter Comparison</Lbl>
                                    <div className="flex gap-3.5">
                                        {[
                                            { label: labelA, color: C.forestLight },
                                            { label: labelB, color: C.forestLight + "55" },
                                            { label: `Exp ${labelA}`, color: C.amber },
                                            { label: `Exp ${labelB}`, color: C.amber + "55" },
                                        ].map(x => (
                                            <div key={x.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: C.textMuted }}>
                                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: x.color }} />
                                                {x.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CompareChart data={compareData} loading={loadingChart} labelA={labelA} labelB={labelB} />
                            </Card>
                        )}

                        {compareMode && comparisonStats && (
                            <CompareStatStrip stats={comparisonStats} labelA={labelA} labelB={labelB} loading={loadingChart} />
                        )}

                        {/* Cash flow trend + scorecard */}
                        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 290px" }}>
                            <Card delay={compareMode ? 2 : 0}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <Lbl style={{ marginBottom: 2 }}>
                                            {compareMode ? "Primary Period · Cash Flow" : "Cash Flow Trend"}
                                        </Lbl>
                                        <div className="text-[11px]" style={{ color: C.textMuted }}>{filterLabel}</div>
                                    </div>
                                    <div className="flex gap-3">
                                        {[{ c: C.forestLight, l: "Revenue" }, { c: C.amber, l: "Expenses" }].map(x => (
                                            <div key={x.l} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                                                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: x.c }} />{x.l}
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
                        <div className="grid grid-cols-2 gap-4">
                            <Card delay={compareMode ? 4 : 2}>
                                <div className="flex justify-between mb-2.5">
                                    <div>
                                        <Lbl style={{ marginBottom: 2 }}>Cash Flow Position</Lbl>
                                        <div className="text-[11px]" style={{ color: C.textMuted }}>Cumulative · monthly net overlay</div>
                                    </div>
                                    <div className="flex gap-2.5">
                                        {[{ c: C.forest, l: "Cumulative" }, { c: C.amber, l: "Net" }].map(x => (
                                            <div key={x.l} className="flex items-center gap-1 text-[10px]" style={{ color: C.textMuted }}>
                                                <span className="w-3.5 h-0.5 rounded-sm" style={{ background: x.c }} />{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CashFlowArea data={chartData} loading={loadingChart} />
                            </Card>

                            <Card delay={compareMode ? 5 : 3}>
                                <Lbl>Revenue Streams</Lbl>
                                <RevenueStreamTable breakdown={summary?.incomeStreams?.breakdown ?? []} loading={loadingSummary} />
                            </Card>
                        </div>

                        {/* Recent transactions */}
                        <Card delay={compareMode ? 6 : 4}>
                            <div className="flex justify-between items-center mb-3.5">
                                <Lbl style={{ marginBottom: 0 }}>Recent Transactions</Lbl>
                                <button
                                    onClick={() => setActiveTab("ledger")}
                                    className="text-xs font-bold bg-transparent border-none cursor-pointer"
                                    style={{ color: C.forest }}
                                >
                                    View all →
                                </button>
                            </div>
                            <LedgerFeed entries={ledgerEntries} loading={loadingLedger} onViewAll={() => setActiveTab("ledger")} />
                        </Card>
                    </div>
                )}

                {/* ── REVENUE TAB ─────────────────────────────────────────────── */}
                {activeTab === "revenue" && (
                    <div className="flex flex-col gap-4">
                        <Card
                            delay={0}
                            style={{
                                padding: "14px 20px",
                                background: `linear-gradient(135deg, ${C.positiveBg} 0%, ${C.surface} 100%)`,
                                borderLeft: `4px solid ${C.forestLight}`,
                            }}
                        >
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.forestLight }}>
                                        <TrendingUpIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>Revenue Detail View</div>
                                        <div className="text-[13px] mt-0.5" style={{ color: C.textMid }}>
                                            Analyzing revenue streams for <span className="font-bold" style={{ color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-2 rounded-xl border" style={{ background: C.surface, borderColor: C.border }}>
                                    <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>Total Revenue (from KPIs above)</div>
                                    <div className="text-lg font-bold" style={{ color: C.forestLight }}>₹{fmtN(totals.totalRevenue)}</div>
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
                    <div className="flex flex-col gap-4">
                        <Card
                            delay={0}
                            style={{
                                padding: "14px 20px",
                                background: `linear-gradient(135deg, ${C.amberBg} 0%, ${C.surface} 100%)`,
                                borderLeft: `4px solid ${C.amber}`,
                            }}
                        >
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.amber }}>
                                        <TrendingDownIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>Expense Detail View</div>
                                        <div className="text-[13px] mt-0.5" style={{ color: C.textMid }}>
                                            Analyzing expense categories for <span className="font-bold" style={{ color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-2 rounded-xl border" style={{ background: C.surface, borderColor: C.border }}>
                                    <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>Total Expenses (from KPIs above)</div>
                                    <div className="text-lg font-bold" style={{ color: C.amber }}>₹{fmtN(totals.totalExpenses)}</div>
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
                    <div className="flex flex-col gap-4">
                        <Card
                            delay={0}
                            style={{
                                padding: "14px 20px",
                                background: `linear-gradient(135deg, ${C.blueBg} 0%, ${C.surface} 100%)`,
                                borderLeft: `4px solid ${C.blue}`,
                            }}
                        >
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.blue }}>
                                        <FileTextIcon size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>Ledger Detail View</div>
                                        <div className="text-[13px] mt-0.5" style={{ color: C.textMid }}>
                                            All transactions for <span className="font-bold" style={{ color: C.text }}>{filterLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="px-3.5 py-2 rounded-xl border" style={{ background: C.positiveBg, borderColor: C.positive + "30" }}>
                                        <div className="text-[9px]" style={{ color: C.textMuted }}>Credits</div>
                                        <div className="text-base font-bold" style={{ color: C.positive }}>₹{fmtK(totals.totalRevenue)}</div>
                                    </div>
                                    <div className="px-3.5 py-2 rounded-xl border" style={{ background: C.negativeBg, borderColor: C.negative + "30" }}>
                                        <div className="text-[9px]" style={{ color: C.textMuted }}>Debits</div>
                                        <div className="text-base font-bold" style={{ color: C.negative }}>₹{fmtK(totals.totalExpenses)}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card delay={0} style={{ padding: 0 }}>
                            <div className="px-[22px] py-4 flex justify-between items-center border-b" style={{ borderColor: C.border }}>
                                <div>
                                    <div className="text-sm font-bold" style={{ color: C.text }}>General Ledger</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>{filterLabel}</div>
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border text-xs font-semibold cursor-pointer"
                                    style={{ borderColor: C.border, background: C.surface, color: C.textMid }}
                                >
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