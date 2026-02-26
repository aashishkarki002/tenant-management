// AccountingPage.jsx
// Design: Editorial bento-grid financial dashboard
// Inspired by: Image 1 (dense widget grid, inline charts) + Image 2 (editorial giant numbers,
//              dark green blocks, greeting, asset table, health gauge)
// Palette: Warm off-white #FAFAF8 bg · Forest green #1C2B1C primary · Amber #C17A2A accent
// Type: Instrument Serif (display numbers) + Plus Jakarta Sans (UI)

import React, { useState, useMemo } from "react";
import {
    GitCompareArrowsIcon,
    CalendarIcon,
    ChevronDownIcon,
    RefreshCwIcon,
    PrinterIcon,
    DownloadIcon,
    FileTextIcon,
    ShareIcon,
    XIcon,
    BuildingIcon,
    ArrowUpRightIcon,
    ArrowDownRightIcon,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { useMonthlyChart, QUARTER_LABELS } from "../hooks/useMonthlyChart";
import DualCalendarTailwind from "../../components/dualDate";
import LedgerTable from "./LedgerTable";
import RevenueBreakDown from "./RevenueBreakDown";
import ExpenseBreakDown from "./ExpenseBreakDown";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    surfaceAlt: "#F4F4F1",
    forest: "#1C2B1C",
    forestMid: "#2D4A2D",
    forestLight: "#4A7C4A",
    amber: "#B8721E",
    amberBg: "#FDF3E3",
    red: "#B91C1C",
    redBg: "#FEF2F2",
    blue: "#1D4ED8",
    blueBg: "#EFF6FF",
    border: "#E8E8E4",
    text: "#1A1A18",
    textMid: "#4A4A44",
    textMuted: "#8A8A82",
    positive: "#15803D",
    negative: "#B91C1C",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtN = (n = 0) => Math.abs(n).toLocaleString("en-IN");
const fmtK = (v) => {
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(1)}L`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(0)}K`;
    return `${s}${a}`;
};

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

// ─── Google Fonts ─────────────────────────────────────────────────────────────
const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .ap { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: ${C.text}; }
  .ap-serif { font-family: 'Instrument Serif', Georgia, serif; }
  @keyframes ap-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes ap-pulse { 0%,100%{opacity:.5} 50%{opacity:.8} }
  .ap-card { animation: ap-up 0.35s ease both; }
  @media print {
    .no-print { display:none !important; }
    @page { margin: 18mm; }
  }
`;

// ─── Building blocks ──────────────────────────────────────────────────────────

// Bento card
function Card({ children, style = {}, delay = 0 }) {
    return (
        <div className="ap-card" style={{
            background: C.surface,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "20px 22px",
            animationDelay: `${delay * 0.05}s`,
            ...style,
        }}>
            {children}
        </div>
    );
}

// Dark forest card (like Image 2's green data blocks)
function DarkCard({ children, style = {}, delay = 0 }) {
    return (
        <div className="ap-card" style={{
            background: C.forest,
            borderRadius: 16,
            padding: "20px 22px",
            animationDelay: `${delay * 0.05}s`,
            ...style,
        }}>
            {children}
        </div>
    );
}

function Label({ children, light = false, style = {} }) {
    return (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: light ? "rgba(255,255,255,0.5)" : C.textMuted, marginBottom: 8, ...style }}>
            {children}
        </div>
    );
}

function BigNum({ value, size = 44, color = C.text, prefix = "₹" }) {
    return (
        <div className="ap-serif" style={{ fontSize: size, fontWeight: 400, color, lineHeight: 1.0, letterSpacing: "-0.02em" }}>
            {prefix}{fmtN(value)}
        </div>
    );
}

// Trend badge
function Delta({ value, label }) {
    const up = value >= 0;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 20,
            background: up ? "#DCFCE7" : "#FEE2E2",
            color: up ? C.positive : C.negative,
        }}>
            {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}
            {label ?? (Math.abs(value).toFixed(1) + "%")}
        </span>
    );
}

// Progress bar
function Bar2({ value, max, color = C.forest, height = 5 }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ height, borderRadius: height / 2, background: C.border, overflow: "hidden", flex: 1 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: height / 2, transition: "width .6s ease" }} />
        </div>
    );
}

// Mini sparkline
function Spark({ data = [], color = C.forest, h = 32 }) {
    if (data.length < 2) return <div style={{ height: h }} />;
    const vals = data.map(d => d.v ?? 0);
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const W = 110;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.9}`).join(" ");
    const last = { x: W, y: h - ((vals[vals.length - 1] - mn) / rng) * h * 0.9 };
    return (
        <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ overflow: "visible" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last.x} cy={last.y} r={3} fill={color} />
        </svg>
    );
}

// Gauge arc (SVG semicircle)
function Gauge({ pct, color = C.forest }) {
    const r = 48, cx = 60, cy = 58;
    const clamped = Math.max(0, Math.min(1, pct));
    const angle = Math.PI + clamped * Math.PI;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    const la = clamped > 0.5 ? 1 : 0;
    return (
        <svg width={120} height={66} viewBox="0 0 120 66">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.border} strokeWidth={9} strokeLinecap="round" />
            {clamped > 0 && (
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${la} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
            )}
            <circle cx={x} cy={y} r={5} fill={color} />
        </svg>
    );
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────────
function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: C.forest, border: "none", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", marginBottom: 2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill ?? p.color, display: "inline-block" }} />
                    <span style={{ opacity: .65 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, marginLeft: "auto" }}>₹{Math.abs(p.value || 0).toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Revenue vs Expenses bar chart ────────────────────────────────────────────
function RevExpBar({ data = [], loading }) {
    if (loading) return <div style={{ height: 170, background: C.surfaceAlt, borderRadius: 8, animation: "ap-pulse 1.5s infinite" }} />;
    if (!data.length) return <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>No data for selected period</div>;
    return (
        <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="30%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted, fontFamily: "Plus Jakarta Sans" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<Tip />} cursor={{ fill: C.surfaceAlt, radius: 4 }} />
                <Bar dataKey="revenue" name="Revenue" fill={C.forestLight} radius={[3, 3, 0, 0]} maxBarSize={30} />
                <Bar dataKey="expenses" name="Expenses" fill={C.amber} radius={[3, 3, 0, 0]} maxBarSize={30} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── Cumulative cash flow area ────────────────────────────────────────────────
function CashArea({ data = [], loading }) {
    const enriched = useMemo(() => {
        let cum = 0;
        return data.map(d => {
            const net = (d.revenue ?? 0) - (d.expenses ?? 0);
            cum += net;
            return { ...d, net, cumulative: cum };
        });
    }, [data]);

    if (loading) return <div style={{ height: 130, background: C.surfaceAlt, borderRadius: 8, animation: "ap-pulse 1.5s infinite" }} />;
    if (!enriched.length) return <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>No data</div>;

    return (
        <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={enriched} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <defs>
                    <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.forest} stopOpacity={.18} />
                        <stop offset="100%" stopColor={C.forest} stopOpacity={.01} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.textMuted }} tickLine={false} axisLine={false} width={34} />
                <ReferenceLine y={0} stroke={C.textMuted} strokeDasharray="4 3" strokeOpacity={.35} />
                <Tooltip content={<Tip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke={C.forest} strokeWidth={2.5}
                    fill="url(#cumG)" dot={false} activeDot={{ r: 4, fill: C.forest, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="net" name="Monthly Net" stroke={C.amber}
                    strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 3, fill: C.amber, strokeWidth: 0 }} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ─── Revenue streams table (Image 2 "Asset distribution" style) ───────────────
function StreamTable({ breakdown = [], loading }) {
    const total = breakdown.reduce((s, x) => s + (x.amount ?? 0), 0);
    const COLORS = [C.forestLight, C.amber, C.blue, "#7C3AED", "#0891B2"];

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 34, background: C.surfaceAlt, borderRadius: 6, animation: "ap-pulse 1.5s infinite" }} />)}
        </div>
    );

    if (!breakdown.length) return <div style={{ padding: "20px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No revenue sources</div>;

    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr 64px", gap: "0 10px", padding: "0 4px 8px", borderBottom: `1px solid ${C.border}` }}>
                {["Source", "Txns", "Share", "Amount"].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                ))}
            </div>
            {breakdown.map((item, i) => (
                <div key={item.code ?? i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr 64px", gap: "0 10px", alignItems: "center", padding: "10px 4px", borderBottom: `1px solid ${C.border}40` }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{item.code}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{item.txnCount ?? "—"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Bar2 value={item.amount} max={total} color={COLORS[i % COLORS.length]} />
                        <span style={{ fontSize: 11, color: C.textMuted, minWidth: 26 }}>
                            {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right" }}>₹{fmtK(item.amount)}</div>
                </div>
            ))}
        </>
    );
}

// ─── Financial scorecard metrics ──────────────────────────────────────────────
function Scorecard({ totals, loading }) {
    const { totalRevenue: rev = 0, totalExpenses: exp = 0, totalLiabilities: liab = 0, netCashFlow: net = 0 } = totals;
    const margin = rev > 0 ? (net / rev) * 100 : 0;
    const expRatio = rev > 0 ? (exp / rev) * 100 : 0;
    const coverage = liab > 0 && rev > 0 ? rev / liab : null;

    const statusLabel = margin >= 20 ? "Excellent" : margin >= 5 ? "On Track" : margin >= 0 ? "Watch" : "At Risk";
    const statusColor = margin >= 20 ? C.positive : margin >= 5 ? C.amber : margin >= 0 ? C.amber : C.negative;
    const gaugePct = Math.max(0, Math.min(1, (margin + 50) / 100));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status + gauge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusColor + "18", padding: "3px 12px", borderRadius: 20, marginBottom: 4 }}>
                    {statusLabel}
                </span>
                <Gauge pct={gaugePct} color={statusColor} />
                {loading
                    ? <div style={{ width: 70, height: 26, background: C.surfaceAlt, borderRadius: 6 }} />
                    : <div className="ap-serif" style={{ fontSize: 30, color: C.text, marginTop: -8, lineHeight: 1 }}>{margin.toFixed(1)}%</div>
                }
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>net margin</div>
            </div>

            {/* Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { label: "Expense Ratio", value: expRatio, max: 100, color: expRatio > 80 ? C.negative : C.amber, display: `${expRatio.toFixed(1)}%` },
                    { label: "Revenue Retained", value: Math.max(0, 100 - expRatio), max: 100, color: C.forestLight, display: `${Math.max(0, 100 - expRatio).toFixed(1)}%` },
                ].map(m => (
                    <div key={m.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>{m.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{m.display}</span>
                        </div>
                        <Bar2 value={m.value} max={m.max} color={m.color} />
                    </div>
                ))}

                {coverage !== null && (
                    <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 10, background: coverage >= 1 ? "#DCFCE7" : "#FEE2E2" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: coverage >= 1 ? C.positive : C.negative, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Liability Coverage
                        </div>
                        <div className="ap-serif" style={{ fontSize: 22, color: C.text, marginTop: 2 }}>{coverage.toFixed(2)}×</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>revenue vs liabilities</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Mini ledger feed ─────────────────────────────────────────────────────────
function LedgerFeed({ entries = [], loading, onViewAll }) {
    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 40, background: C.surfaceAlt, borderRadius: 8, animation: "ap-pulse 1.5s infinite" }} />)}
        </div>
    );

    const recent = entries.slice(0, 7);
    if (!recent.length) return <div style={{ padding: "16px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No entries</div>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recent.map((e, i) => {
                const isDebit = (e.debit ?? 0) > 0;
                const amt = e.debit ?? e.credit ?? 0;
                return (
                    <div key={e._id ?? i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "8px 8px",
                        borderRadius: 9, background: i % 2 === 0 ? "transparent" : C.surfaceAlt + "70",
                    }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: isDebit ? C.redBg : "#DCFCE7",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {isDebit
                                ? <ArrowDownRightIcon size={13} color={C.red} />
                                : <ArrowUpRightIcon size={13} color={C.positive} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {e.description ?? e.account?.name ?? "—"}
                            </div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>
                                {e.date ? new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                            </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDebit ? C.negative : C.positive, flexShrink: 0 }}>
                            {isDebit ? "−" : "+"}₹{fmtN(amt)}
                        </div>
                    </div>
                );
            })}
            <button
                onClick={onViewAll}
                style={{ marginTop: 6, padding: "8px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", fontSize: 12, fontWeight: 600, color: C.textMid, cursor: "pointer" }}
            >
                View all {entries.length} entries →
            </button>
        </div>
    );
}

// ─── Liability pills ──────────────────────────────────────────────────────────
function LiabPills({ breakdown = [], loading }) {
    if (loading) return <div style={{ height: 48, background: C.surfaceAlt, borderRadius: 8 }} />;
    if (!breakdown.length) return <div style={{ color: C.textMuted, fontSize: 12 }}>No outstanding liabilities</div>;
    const total = breakdown.reduce((s, x) => s + x.amount, 0);
    const DOT_COLORS = [C.amber, C.red, "#7C3AED", C.blue];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {breakdown.map((item, i) => (
                <div key={item.code ?? i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: DOT_COLORS[i % 4] }} />
                    <span style={{ fontSize: 13, color: C.textMid, flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>₹{fmtK(item.amount)}</span>
                    <span style={{ fontSize: 10, color: C.textMuted, minWidth: 28, textAlign: "right" }}>
                        {total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0}%
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Export menu ──────────────────────────────────────────────────────────────
function ExportBtn({ summary, label }) {
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
                <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer" }}>
                    <ShareIcon size={13} />Export<ChevronDownIcon size={11} style={{ opacity: .5 }} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ borderRadius: 12, minWidth: 176 }}>
                <DropdownMenuItem onClick={() => window.print()} style={{ gap: 8, cursor: "pointer" }}>
                    <PrinterIcon size={14} />Print Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem style={{ gap: 8, cursor: "pointer" }} onClick={() => {
                    const rows = [["Metric", "Value"], ["Revenue", t.totalRevenue ?? 0], ["Expenses", t.totalExpenses ?? 0], ["Liabilities", t.totalLiabilities ?? 0], ["Net", t.netCashFlow ?? 0], ["Period", label]];
                    dl(rows.map(r => r.join(",")).join("\n"), `accounting-${Date.now()}.csv`, "text/csv");
                }}>
                    <DownloadIcon size={14} />Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem style={{ gap: 8, cursor: "pointer" }} onClick={() => dl(JSON.stringify(summary, null, 2), `accounting-${Date.now()}.json`, "application/json")}>
                    <FileTextIcon size={14} />Export JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AccountingPage() {
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [compareMode, setCompareMode] = useState(false);
    const [compareQuarter, setCompareQuarter] = useState(2);
    const [showCustom, setShowCustom] = useState(false);

    const activeCompareQuarter = compareMode ? compareQuarter : null;

    const { summary, loadingSummary, ledgerEntries, loadingLedger, refetch } = useAccounting(selectedQuarter, "all");
    const { bankAccounts } = useBankAccounts();
    const { chartData, compareData, comparisonStats, loadingChart } = useMonthlyChart(selectedQuarter, activeCompareQuarter);

    const totals = summary?.totals ?? { totalRevenue: 0, totalLiabilities: 0, totalExpenses: 0, netCashFlow: 0 };
    const netMargin = totals.totalRevenue > 0 ? (totals.netCashFlow / totals.totalRevenue) * 100 : 0;
    const filterLabel = selectedQuarter === "custom"
        ? `${customStart} → ${customEnd}`
        : selectedQuarter ? `Q${selectedQuarter} · ${QUARTER_MONTHS[selectedQuarter]} · FY 2081` : "FY 2081/82 · All Periods";

    const filterProps = { selectedQuarter, compareMode, compareQuarter, customStartDate: customStart, customEndDate: customEnd };

    // Quarter picker button
    const QPill = ({ label, value }) => (
        <button onClick={() => setSelectedQuarter(value)} style={{
            padding: "5px 12px", borderRadius: 8, border: `1px solid ${selectedQuarter === value ? C.forest : C.border}`,
            background: selectedQuarter === value ? C.forest : C.surface,
            color: selectedQuarter === value ? "#fff" : C.textMid,
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s",
        }}>{label}</button>
    );

    return (
        <div className="ap" style={{ minHeight: "100vh", background: C.bg }}>
            <style>{FONTS}</style>

            {/* ── STICKY NAV ─────────────────────────────────────────────────────── */}
            <nav className="no-print" style={{
                position: "sticky", top: 0, zIndex: 30,
                background: `${C.bg}EC`, backdropFilter: "blur(14px)",
                borderBottom: `1px solid ${C.border}`,
            }}>
                <div style={{ width: "100%", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    {/* Left */}
                    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>

                        <div style={{ width: 1, height: 26, background: C.border }} />
                        {/* Quarter pills */}
                        <div style={{ display: "flex", gap: 4 }}>
                            {QUARTERS.map(q => <QPill key={q.label} label={q.label} value={q.value} />)}
                        </div>
                        {/* Custom */}
                        <DropdownMenu open={showCustom} onOpenChange={setShowCustom}>
                            <DropdownMenuTrigger asChild>
                                <button style={{
                                    display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
                                    border: `1px solid ${selectedQuarter === "custom" ? C.forest : C.border}`,
                                    background: selectedQuarter === "custom" ? C.forest : C.surface,
                                    color: selectedQuarter === "custom" ? "#fff" : C.textMid,
                                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                                }}>
                                    <CalendarIcon size={11} />
                                    {selectedQuarter === "custom" ? `${customStart}→${customEnd}` : "Custom"}
                                    <ChevronDownIcon size={10} style={{ opacity: .5 }} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="bottom" style={{ padding: 18, borderRadius: 14, minWidth: 340 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>Custom Range</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>Start</div>
                                        <DualCalendarTailwind value={customStart} onChange={e => setCustomStart(e ?? "")} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>End</div>
                                        <DualCalendarTailwind value={customEnd} onChange={e => setCustomEnd(e ?? "")} />
                                    </div>
                                </div>
                                <button disabled={!customStart || !customEnd}
                                    onClick={() => { setSelectedQuarter("custom"); setShowCustom(false); }}
                                    style={{ marginTop: 12, width: "100%", padding: "8px 0", borderRadius: 9, border: "none", background: C.forest, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !customStart || !customEnd ? .4 : 1 }}>
                                    Apply Range
                                </button>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Right */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {selectedQuarter !== null && (
                            <button onClick={() => { setSelectedQuarter(null); setCustomStart(""); setCustomEnd(""); }}
                                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: C.textMuted, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                                <XIcon size={12} />Clear
                            </button>
                        )}
                        <button onClick={() => setCompareMode(p => !p)} style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "7px 13px",
                            borderRadius: 10, border: `1px solid ${compareMode ? C.forest : C.border}`,
                            background: compareMode ? C.forest : C.surface,
                            color: compareMode ? "#fff" : C.textMid,
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}>
                            <GitCompareArrowsIcon size={13} />
                            {compareMode ? "Exit Compare" : "Compare"}
                        </button>
                        <button onClick={refetch} style={{ padding: 8, borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <RefreshCwIcon size={14} color={C.textMid} />
                        </button>
                        <ExportBtn summary={summary} label={filterLabel} />
                        {bankAccounts[0] && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface }}>
                                <BuildingIcon size={12} color={C.textMuted} />
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1 }}>{bankAccounts[0].bankName}</div>
                                    <div style={{ fontSize: 10, color: C.textMuted }}>₹{bankAccounts[0].balance?.toLocaleString()}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── PAGE BODY ─────────────────────────────────────────────────────── */}
            <div style={{ width: "100%", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* ── HERO ROW: editorial big numbers ───────────────────────────────── */}
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 16 }}>

                    {/* Net position — the centrepiece (Image 2 inspired) */}
                    <DarkCard delay={0} style={{ padding: "24px 28px", minWidth: 270 }}>
                        <Label light>Net Cash Position</Label>
                        <div className="ap-serif" style={{ fontSize: 54, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.02em" }}>
                            ₹{fmtN(Math.abs(totals.netCashFlow))}
                        </div>
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                            <Delta value={netMargin} label={`${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}% margin`} />
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                                {totals.netCashFlow >= 0 ? "Surplus" : "Deficit"}
                            </span>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <Spark
                                data={chartData.map(d => ({ v: (d.revenue ?? 0) - (d.expenses ?? 0) }))}
                                color={totals.netCashFlow >= 0 ? "#6EE7B7" : "#FCA5A5"}
                                h={36}
                            />
                        </div>
                        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
                            {[{ l: "Revenue", v: totals.totalRevenue, c: "#6EE7B7" }, { l: "Expenses", v: totals.totalExpenses, c: "#FCA5A5" }].map(x => (
                                <div key={x.l}>
                                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{x.l}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: x.c }}>₹{fmtK(x.v)}</div>
                                </div>
                            ))}
                        </div>
                    </DarkCard>

                    {/* Revenue */}
                    <Card delay={1}>
                        <Label>Total Revenue</Label>
                        <BigNum value={totals.totalRevenue} size={40} color={C.forest} />
                        <div style={{ marginTop: 12 }}>
                            <Spark data={chartData.map(d => ({ v: d.revenue ?? 0 }))} color={C.forestLight} h={32} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <LiabPills breakdown={summary?.incomeStreams?.breakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Expenses */}
                    <Card delay={2}>
                        <Label>Total Expenses</Label>
                        <BigNum value={totals.totalExpenses} size={40} color={C.amber} />
                        <div style={{ marginTop: 12 }}>
                            <Spark data={chartData.map(d => ({ v: d.expenses ?? 0 }))} color={C.amber} h={32} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <LiabPills breakdown={summary?.expensesBreakdown?.slice(0, 3) ?? []} loading={loadingSummary} />
                        </div>
                    </Card>

                    {/* Liabilities */}
                    <Card delay={3}>
                        <Label>Outstanding Liabilities</Label>
                        <BigNum value={totals.totalLiabilities} size={40} color={C.red} />
                        <div style={{ marginTop: 14 }}>
                            <LiabPills breakdown={summary?.liabilitiesBreakdown ?? []} loading={loadingSummary} />
                        </div>
                    </Card>
                </div>

                {/* ── TAB NAV ───────────────────────────────────────────────────────── */}
                <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 4, background: C.surfaceAlt, borderRadius: 12, padding: 4 }}>
                        {[
                            { id: "overview", l: "Overview" },
                            { id: "revenue", l: "Revenue" },
                            { id: "expenses", l: "Expenses" },
                            { id: "ledger", l: "Ledger" },
                        ].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                                padding: "7px 20px", borderRadius: 9, border: "none", cursor: "pointer",
                                fontSize: 13, fontWeight: 600,
                                background: activeTab === t.id ? C.forest : "transparent",
                                color: activeTab === t.id ? "#fff" : C.textMid,
                                transition: "all .18s",
                            }}>{t.l}</button>
                        ))}
                    </div>
                    {activeTab === "ledger" && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, background: C.surfaceAlt, padding: "4px 12px", borderRadius: 20 }}>
                            {ledgerEntries.length} entries
                        </span>
                    )}
                </div>

                {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                        {/* Row: bar chart + scorecard */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
                            <Card delay={4}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                    <div>
                                        <Label style={{ marginBottom: 2 }}>Monthly Financial Rhythm</Label>
                                        <div style={{ fontSize: 11, color: C.textMuted }}>{filterLabel}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        {[{ c: C.forestLight, l: "Revenue" }, { c: C.amber, l: "Expenses" }].map(x => (
                                            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textMuted }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: "inline-block" }} />{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <RevExpBar data={compareMode ? compareData : chartData} loading={loadingChart} />
                            </Card>

                            <Card delay={5}>
                                <Label>Financial Scorecard</Label>
                                <Scorecard totals={totals} loading={loadingSummary} />
                            </Card>
                        </div>

                        {/* Row: cash flow + revenue streams table */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                            <Card delay={6}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <div>
                                        <Label style={{ marginBottom: 2 }}>Cash Flow Position</Label>
                                        <div style={{ fontSize: 11, color: C.textMuted }}>Cumulative · monthly net overlay</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        {[{ c: C.forest, l: "Cumulative" }, { c: C.amber, l: "Net" }].map(x => (
                                            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.textMuted }}>
                                                <span style={{ width: 14, height: 2, background: x.c, display: "inline-block", borderRadius: 1 }} />{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CashArea data={chartData} loading={loadingChart} />
                            </Card>

                            <Card delay={7}>
                                <Label>Revenue Streams</Label>
                                <StreamTable breakdown={summary?.incomeStreams?.breakdown ?? []} loading={loadingSummary} />
                            </Card>
                        </div>

                        {/* Row: recent transactions */}
                        <Card delay={8}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <Label style={{ marginBottom: 0 }}>Recent Transactions</Label>
                                <button onClick={() => setActiveTab("ledger")}
                                    style={{ fontSize: 12, fontWeight: 700, color: C.forest, background: "none", border: "none", cursor: "pointer" }}>
                                    View all →
                                </button>
                            </div>
                            <LedgerFeed entries={ledgerEntries} loading={loadingLedger} onViewAll={() => setActiveTab("ledger")} />
                        </Card>
                    </div>
                )}

                {/* ── REVENUE TAB ───────────────────────────────────────────────────── */}
                {activeTab === "revenue" && (
                    <RevenueBreakDown onRevenueAdded={refetch} {...filterProps} />
                )}

                {/* ── EXPENSES TAB ──────────────────────────────────────────────────── */}
                {activeTab === "expenses" && (
                    <ExpenseBreakDown onExpenseAdded={refetch} {...filterProps} />
                )}

                {/* ── LEDGER TAB ────────────────────────────────────────────────────── */}
                {activeTab === "ledger" && (
                    <Card delay={0} style={{ padding: 0 }}>
                        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>General Ledger</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{filterLabel}</div>
                            </div>
                            <button onClick={() => window.print()}
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.textMid, cursor: "pointer" }}>
                                <PrinterIcon size={13} />Print
                            </button>
                        </div>
                        <LedgerTable entries={ledgerEntries} loading={loadingLedger} itemsPerPage={20} />
                    </Card>
                )}
            </div>
        </div>
    );
}