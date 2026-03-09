/**
 * RevenueBreakDown.tsx
 *
 * ARCHITECTURE: Dumb display component.
 * - Fetches pre-aggregated data via useRevenueSummary()
 * - Zero business logic, zero paisa conversion, zero filtering
 * - All numbers arrive from the backend ready to render
 */

import { useState, useEffect } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw, ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { AddRevenueDialog } from "./AddRevenueDialog";
import { usePagination } from "../hooks/usePagination";
import { useRevenueSummary } from "../hooks/useAccounting";
import { useIsMobile } from "@/hooks/use-mobile";
import api from "../../../plugins/axios";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
    bg: "#FAFAF8", surface: "#FFFFFF", alt: "#F5F4F0",
    forest: "#1A5276", forestLight: "#2E86C1",
    amber: "#92400E", amberBg: "#FEF9C3",
    red: "#991B1B", redBg: "#FEE2E2",
    blue: "#1E40AF", blueBg: "#DBEAFE",
    violet: "#6D28D9", violetBg: "#EDE9FE",
    teal: "#0E7490", tealBg: "#ECFEFF",
    border: "#E7E5E0", text: "#1C1917", mid: "#44403C", muted: "#78716C",
    positive: "#166534", negative: "#991B1B",
};

const PALETTE = [C.forestLight, C.blue, C.violet, C.amber, C.teal, "#BE185D", "#D97706", "#0891B2"];
const REF_CFG = {
    RENT: { bg: C.forestLight + "22", color: C.forestLight },
    PARKING: { bg: C.blue + "22", color: C.blue },
    AD: { bg: C.violet + "22", color: C.violet },
    CAM: { bg: C.amber + "22", color: C.amber },
    ELECTRICITY: { bg: "#FEF9C3", color: "#A16207" },
    MAINTENANCE: { bg: C.teal + "22", color: C.teal },
    MANUAL: { bg: C.alt, color: C.muted },
};

// ─── Formatting (display only — no conversion) ────────────────────────────────
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = (v) => {
    const a = Math.abs(v);
    return a >= 100000 ? `${(a / 100000).toFixed(1)}L` : a >= 1000 ? `${(a / 1000).toFixed(0)}K` : String(a);
};

const Q_LABELS = {
    1: "Q1 · Shrawan–Ashwin", 2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra", 4: "Q4 · Baishakh–Ashadh",
};

// ─── Atoms ────────────────────────────────────────────────────────────────────
const S = `
  @keyframes rv-up   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes rv-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes rv-pulse{ 0%,100%{opacity:.45} 50%{opacity:.85} }
  .rv { font-family:'DM Sans',system-ui,sans-serif; }
  .rv-serif { font-family:'Instrument Serif',Georgia,serif; }
  .rv-card  { animation:rv-up .3s ease both; }
`;

function Card({ children, style = {}, delay = 0 }) {
    return <div className="rv-card" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px", animationDelay: `${delay * 0.05}s`, ...style }}>{children}</div>;
}
function Dark({ children, style = {}, delay = 0 }) {
    return <div className="rv-card" style={{ background: C.forest, borderRadius: 16, padding: "18px 20px", animationDelay: `${delay * 0.05}s`, ...style }}>{children}</div>;
}
function Lbl({ children, light, style = {} }) {
    return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: light ? "rgba(255,255,255,.45)" : C.muted, marginBottom: 8, ...style }}>{children}</div>;
}
function Num({ v, size = 32, color = C.text }) {
    return <div className="rv-serif" style={{ fontSize: size, color, lineHeight: 1, letterSpacing: "-0.02em" }}>₹{Number(Math.abs(v)).toLocaleString("en-IN")}</div>;
}
function Delta({ up, label }) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: up ? "#DCFCE7" : "#FEE2E2", color: up ? C.positive : C.negative }}>
        {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}{label}
    </span>;
}
function Bar2({ value, max, color = C.forestLight, h = 5 }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return <div style={{ height: h, borderRadius: h / 2, background: C.border, overflow: "hidden", flex: 1 }}><div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h / 2, transition: "width .5s" }} /></div>;
}
function Sk({ h = 14 }) {
    return <div style={{ height: h, background: C.alt, borderRadius: 6, marginBottom: 6, animation: "rv-pulse 1.5s infinite" }} />;
}
function None({ msg = "No data for this period" }) {
    return <div style={{ padding: "32px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>{msg}</div>;
}
function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return <div style={{ background: C.forest, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
        {payload.map(p => <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill ?? p.color ?? p.stroke, display: "inline-block" }} />
            <span style={{ opacity: 0.6 }}>{p.name}</span>
            <span style={{ fontWeight: 700, marginLeft: "auto" }}>₹{Math.abs(p.value || 0).toLocaleString()}</span>
        </div>)}
    </div>;
}
function SPill({ s }) {
    const cfg = { RECORDED: [C.amberBg, C.amber], SYNCED: ["#D1FAE5", C.positive], REVERSED: [C.redBg, C.red] };
    const [bg, color] = cfg[s] ?? [C.alt, C.muted];
    return <span style={{ background: bg, color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{s}</span>;
}
function RPill({ t }) {
    const c = REF_CFG[t] ?? { bg: C.alt, color: C.muted };
    return <span style={{ background: c.bg, color: c.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{t}</span>;
}
function TPill({ t }) {
    return <span style={{ background: t === "TENANT" ? C.forestLight + "22" : C.blueBg, color: t === "TENANT" ? C.forestLight : C.blue, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{t}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────



export default function RevenueBreakDown({
    onRevenueAdded,
    selectedQuarter = null,
    compareMode = false,
    compareQuarter = null,
    customStartDate = "",
    customEndDate = "",
    openDialog = false,
    onDialogOpenHandled,
}) {
    const isMobile = useIsMobile();
    const [tab, setTab] = useState("overview");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [sources, setSources] = useState([]);
    const [banks, setBanks] = useState([]);

    // Primary period data
    const {
        data: D,
        loading,
        error,
        refetch,
    } = useRevenueSummary(
        selectedQuarter,
        selectedQuarter === "custom" ? customStartDate : "",
        selectedQuarter === "custom" ? customEndDate : "",
    );

    // Compare period data (only fetched when compare mode is active)
    const {
        data: DB,
        loading: loadingB,
    } = useRevenueSummary(
        compareMode ? compareQuarter : null,
        "",
        "",
    );

    // Parent can trigger dialog open via prop
    useEffect(() => {
        if (openDialog) {
            setDialogOpen(true);
            onDialogOpenHandled?.();
        }
    }, [openDialog]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load dialog dependencies in parallel
    useEffect(() => {
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/revenue/get-revenue-sources").then(({ data }) => setSources(data?.revenueSources ?? [])).catch(() => { });
        api.get("/api/bank/get-bank-accounts").then(({ data }) => setBanks(data?.bankAccounts ?? [])).catch(() => { });
    }, []);

    const onSuccess = () => { refetch(); onRevenueAdded?.(); };

    const periodLabel =
        selectedQuarter === "custom" ? `${customStartDate} → ${customEndDate}`
            : selectedQuarter ? Q_LABELS[Number(selectedQuarter)] ?? "All"
                : "All Periods";

    const exportCSV = () => {
        if (!D) return;
        const rows = [
            ["Payer", "Source", "Ref", "Type", "Amount", "Date", "Status"],
            ...D.transactions.map(t => [t.payer, t.source, t.refType, t.payerType, t.amount, t.bsDate, t.status]),
        ];
        const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `revenue_${Date.now()}.csv` }).click();
    };

    const TABS = ["overview", "tenants", "transactions", "analysis"];

    // Safe defaults while data loads
    const totals = D?.totals ?? { total: 0, count: 0, avg: 0, momPct: null };
    const streams = D?.streams ?? [];
    const trend = D?.trend ?? [];
    const payerSplit = D?.payerSplit ?? [];
    const refTypes = D?.refTypes ?? [];
    const topTenants = D?.topTenants ?? [];
    const statusMap = D?.statusMap ?? {};
    const transactions = D?.transactions ?? [];

    return (
        <div className="rv" style={{ color: C.text }}>
            <style>{S}</style>

            {/* ── Header ──────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>{periodLabel}</div>
                    <div style={{ fontSize: 13, color: C.mid }}>
                        {loading ? "Loading…" : `${totals.count} transactions · ${fmt(totals.total)}`}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", width: isMobile ? "100%" : "auto" }}>
                    <button onClick={refetch} style={{ padding: isMobile ? "10px 12px" : "8px 10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", minHeight: isMobile ? 44 : undefined }}>
                        <RefreshCw size={14} color={C.mid} style={{ animation: loading ? "rv-spin 1s linear infinite" : "none" }} />
                    </button>
                    <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "10px 16px" : "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer", minHeight: isMobile ? 44 : undefined }}>
                        <Download size={13} />{isMobile ? "" : "CSV"}
                    </button>
                    <button onClick={() => setDialogOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "10px 16px" : "8px 16px", borderRadius: 9, border: "none", background: C.forest, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: isMobile ? 1 : undefined, justifyContent: "center", minHeight: isMobile ? 44 : undefined }}>
                        <PlusIcon size={14} />Add Revenue
                    </button>
                </div>
            </div>

            {/* ── Error ──────────────────────────────────────────────────────────────── */}
            {error && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}30`, borderRadius: 12, padding: "11px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>
                    ⚠ {error} — <button onClick={refetch} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Retry</button>
                </div>
            )}

            {/* ── Compare banner ────────────────────────────────────────────────────── */}
            {compareMode && !loading && !loadingB && DB && (
                <div style={{ background: C.forest + "10", border: `1px solid ${C.forest}28`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.forest, letterSpacing: ".08em", textTransform: "uppercase" }}>Compare Mode</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{periodLabel}</div>
                            <div className="rv-serif" style={{ fontSize: 20, color: C.forestLight }}>{fmt(totals.total)}</div>
                        </div>
                        <div style={{ color: C.muted, fontSize: 18 }}>→</div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
                                {compareQuarter ? Q_LABELS[compareQuarter] : "Compare"}
                            </div>
                            <div className="rv-serif" style={{ fontSize: 20, color: C.blue }}>{fmt(DB.totals.total)}</div>
                        </div>
                        {totals.total > 0 && (
                            <Delta
                                up={(DB.totals.total - totals.total) >= 0}
                                label={`${Math.abs(((DB.totals.total - totals.total) / totals.total) * 100).toFixed(1)}%`}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ── Hero KPI strip ────────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "220px repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                <Dark delay={0}>
                    <Lbl light>Total Revenue</Lbl>
                    <Num v={totals.total} size={38} color="#fff" />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {totals.momPct !== null && (
                            <Delta up={(totals.momPct ?? 0) >= 0} label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% MoM`} />
                        )}
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[{ l: "Transactions", v: totals.count }, { l: "Streams", v: streams.length }].map(x => (
                            <div key={x.l}>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", marginBottom: 2 }}>{x.l}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{x.v}</div>
                            </div>
                        ))}
                    </div>
                </Dark>

                {[
                    { label: "Avg Ticket", val: fmt(totals.avg), sub: "per transaction", grad: `${C.forestLight},#6EE7B7` },
                    { label: "Top Source", val: streams[0]?.name ?? "—", sub: streams[0] ? fmt(streams[0].amount) : "No sources", grad: `${C.amber},#FCD34D` },
                    { label: "Tenant Revenue", val: fmt(payerSplit.find(p => p.name === "Tenant")?.amount ?? 0), sub: `${payerSplit.find(p => p.name === "Tenant")?.pct ?? 0}% of total`, grad: `${C.blue},#93C5FD` },
                    { label: "Top Source %", val: streams[0] ? `${streams[0].pct}%` : "—", sub: "concentration", grad: `${C.violet},#C4B5FD` },
                ].map((k, i) => (
                    <Card key={k.label} delay={i + 1} style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ height: 3, background: `linear-gradient(90deg,${k.grad})`, borderRadius: "16px 16px 0 0" }} />
                        <div style={{ padding: "14px 18px" }}>
                            <Lbl>{k.label}</Lbl>
                            <div className="rv-serif" style={{ fontSize: 24, color: C.text, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{k.sub}</div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* ── Tab nav ───────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 4, background: C.alt, borderRadius: 12, padding: 4, width: isMobile ? "100%" : "fit-content", marginBottom: 18, overflowX: isMobile ? "auto" : "visible" }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: isMobile ? "9px 16px" : "7px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === t ? C.forest : "transparent", color: tab === t ? "#fff" : C.mid, transition: "all .15s", flex: isMobile ? 1 : undefined, minHeight: isMobile ? 44 : undefined, whiteSpace: "nowrap" }}>
                        {t[0].toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ OVERVIEW ══════════════════════════════════════════ */}
            {tab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 250px", gap: 16 }}>
                        {/* Revenue trend area chart */}
                        <Card delay={5}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                <div><Lbl style={{ marginBottom: 2 }}>Revenue Trend</Lbl><div style={{ fontSize: 11, color: C.muted }}>{periodLabel} · monthly</div></div>
                                {totals.momPct !== null && <Delta up={(totals.momPct ?? 0) >= 0} label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% last month`} />}
                            </div>
                            {loading ? <Sk h={200} /> : trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="rv-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={C.forestLight} stopOpacity={0.22} />
                                                <stop offset="100%" stopColor={C.forestLight} stopOpacity={0.01} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.forestLight} strokeWidth={2.5} fill="url(#rv-grad)" dot={{ r: 3, fill: C.forestLight, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </Card>

                        {/* Revenue by source donut */}
                        <Card delay={6}>
                            <Lbl>Revenue by Source</Lbl>
                            {loading ? <Sk h={130} /> : streams.length === 0 ? <None /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={130}>
                                        <PieChart>
                                            <Pie data={streams} dataKey="pct" cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3}>
                                                {streams.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
                                        {streams.map((s, i) => (
                                            <div key={s.code ?? i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, color: C.mid, flex: 1 }}>{s.name}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.pct}%</span>
                                                <span style={{ fontSize: 11, color: C.muted }}>{fmt(s.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 16 }}>
                        {/* Payer split */}
                        <Card delay={7}>
                            <Lbl>Payer Split</Lbl>
                            {loading ? <><Sk /><Sk /></> : payerSplit.length === 0 ? <None /> : (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 68px", gap: "0 10px", padding: "0 2px 8px", borderBottom: `1px solid ${C.border}` }}>
                                        {["Payer", "Share", "Amount"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</span>)}
                                    </div>
                                    {payerSplit.map((p, i) => (
                                        <div key={p.name} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 68px", gap: "0 10px", alignItems: "center", padding: "9px 2px", borderBottom: `1px solid ${C.border}40` }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[i], flexShrink: 0 }} />
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                <Bar2 value={p.amount} max={totals.total} color={PALETTE[i]} />
                                                <span style={{ fontSize: 10, color: C.muted, minWidth: 24 }}>{p.pct}%</span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right" }}>₹{fmtK(p.amount)}</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </Card>

                        {/* Ref types */}
                        <Card delay={8}>
                            <Lbl>By Reference Type</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : refTypes.length === 0 ? <None /> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {refTypes.map(r => (
                                        <div key={r.type}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                                <RPill t={r.type} />
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmt(r.amount)}</div>
                                                    <div style={{ fontSize: 10, color: C.muted }}>{r.count} txns · {r.pct}%</div>
                                                </div>
                                            </div>
                                            <Bar2 value={r.amount} max={totals.total} color={REF_CFG[r.type]?.color ?? C.forestLight} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Stats & status */}
                        <Card delay={9}>
                            <Lbl>Stats & Status</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : (
                                <>
                                    {[
                                        { l: "Transactions", v: totals.count },
                                        { l: "Avg / Txn", v: fmt(totals.avg) },
                                        { l: "Revenue Sources", v: streams.length },
                                        { l: "Top Source", v: streams[0] ? `${streams[0].pct}%` : "—" },
                                        { l: "Tenant Txns", v: transactions.filter(t => t.payerType === "TENANT").length },
                                    ].map(s => (
                                        <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                                            <span style={{ fontSize: 12, color: C.muted }}>{s.l}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.v}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 14 }}>
                                        <Lbl style={{ marginBottom: 8 }}>Status</Lbl>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                            {Object.entries(statusMap).map(([s, n]) => (
                                                <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <SPill s={s} />
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{n}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ═══════════════════ TENANTS ═════════════════════════════════════════════ */}
            {tab === "tenants" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 16 }}>
                        <Card delay={0}>
                            <Lbl>Top Tenant Contributors</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : topTenants.length === 0 ? <None msg="No tenant revenue for this period" /> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {topTenants.map((t, i) => {
                                        const CLR = [C.forest, C.blue, C.violet, C.amber, C.forestLight, C.red, C.teal, "#BE185D"];
                                        return (
                                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: C.alt, borderRadius: 12 }}>
                                                <div style={{ width: 34, height: 34, borderRadius: "50%", background: CLR[i % 8] + "1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: CLR[i % 8], flexShrink: 0 }}>
                                                    {t.name[0]?.toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                                                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.sources} · {t.count} txn{t.count !== 1 ? "s" : ""}</div>
                                                    <div style={{ marginTop: 5 }}><Bar2 value={t.amount} max={topTenants[0].amount} color={CLR[i % 8]} h={4} /></div>
                                                </div>
                                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(t.amount)}</div>
                                                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{t.pctOfTotal}% of total</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <Card delay={1}>
                                <Lbl>Payer Classification</Lbl>
                                {loading ? <Sk h={80} /> : (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        {payerSplit.map((p, i) => (
                                            <div key={p.name} style={{ background: PALETTE[i] + "18", borderRadius: 12, padding: "14px 16px" }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: PALETTE[i], letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{p.name}</div>
                                                <div className="rv-serif" style={{ fontSize: 28, color: C.text, lineHeight: 1 }}>{p.pct}%</div>
                                                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmt(p.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            <Card delay={2}>
                                <Lbl>Revenue by Month</Lbl>
                                {loading ? <Sk h={110} /> : trend.length === 0 ? <None /> : (
                                    <ResponsiveContainer width="100%" height={110}>
                                        <BarChart data={trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="35%">
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={34} />
                                            <Tooltip content={<Tip />} />
                                            <Bar dataKey="revenue" name="Revenue" fill={C.forestLight} radius={[3, 3, 0, 0]} maxBarSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ TRANSACTIONS ════════════════════════════════════════ */}
            {tab === "transactions" && (() => {
                const TXN_PAGE_SIZE = 20;
                const { paginatedItems: pageTxns, currentPage, totalPages, nextPage, prevPage, startIndex } = usePagination(transactions, TXN_PAGE_SIZE);
                return (
                    <Card delay={0} style={{ padding: 0 }}>
                        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Transactions</div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{transactions.length} total · {periodLabel}</div>
                            </div>
                            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer" }}>
                                <Download size={13} />Export CSV
                            </button>
                        </div>
                        {loading ? <div style={{ padding: 20 }}><Sk /><Sk /><Sk /></div> : transactions.length === 0 ? <None msg="No transactions" /> : (
                            <>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                                {["#", "Payer", "Source", "Ref", "Type", "Amount", "Date", "Status"].map(h => (
                                                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageTxns.map((t, i) => (
                                                <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}50`, background: i % 2 === 0 ? C.surface : C.alt + "70" }}>
                                                    <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{startIndex + i + 1}</td>
                                                    <td style={{ padding: "9px 14px", fontWeight: 600, color: C.text, fontSize: 13 }}>{t.payer}</td>
                                                    <td style={{ padding: "9px 14px", color: C.mid, fontSize: 13 }}>{t.source}</td>
                                                    <td style={{ padding: "9px 14px" }}><RPill t={t.refType} /></td>
                                                    <td style={{ padding: "9px 14px" }}><TPill t={t.payerType} /></td>
                                                    <td style={{ padding: "9px 14px", fontWeight: 700, color: C.positive, fontSize: 13 }}>{fmt(t.amount)}</td>
                                                    <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{t.bsDate}</td>
                                                    <td style={{ padding: "9px 14px" }}><SPill s={t.status} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: `1px solid ${C.border}` }}>
                                        <span style={{ fontSize: 12, color: C.muted }}>
                                            Showing {startIndex + 1}–{Math.min(startIndex + TXN_PAGE_SIZE, transactions.length)} of {transactions.length}
                                        </span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button onClick={prevPage} disabled={currentPage === 1} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: currentPage === 1 ? C.muted : C.text, cursor: currentPage === 1 ? "default" : "pointer" }}>← Prev</button>
                                            <span style={{ padding: "5px 12px", fontSize: 12, color: C.muted }}>{currentPage} / {totalPages}</span>
                                            <button onClick={nextPage} disabled={currentPage === totalPages} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: currentPage === totalPages ? C.muted : C.text, cursor: currentPage === totalPages ? "default" : "pointer" }}>Next →</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                );
            })()}

            {/* ═══════════════════ ANALYSIS ════════════════════════════════════════════ */}
            {tab === "analysis" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                        {/* Concentration risk */}
                        <Card delay={0}>
                            <Lbl>Revenue Concentration Risk</Lbl>
                            {loading ? <><Sk /><Sk /></> : streams.length === 0 ? <None /> : (
                                <>
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ display: "flex", height: 24, borderRadius: 8, overflow: "hidden", gap: 1 }}>
                                            {streams.map((s, i) => (
                                                <div key={s.code ?? i} title={`${s.name}: ${s.pct}%`}
                                                    style={{ width: `${s.pct}%`, background: PALETTE[i % PALETTE.length], display: s.pct < 1 ? "none" : "block" }} />
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
                                            {streams.map((s, i) => (
                                                <div key={s.code ?? i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }} />
                                                    <span style={{ fontSize: 11, color: C.muted }}>{s.name} <b style={{ color: C.text }}>{s.pct}%</b></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ padding: "12px 14px", background: (streams[0]?.pct ?? 0) > 60 ? C.redBg : (streams[0]?.pct ?? 0) > 40 ? C.amberBg : "#F0FDF4", borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: (streams[0]?.pct ?? 0) > 60 ? C.red : (streams[0]?.pct ?? 0) > 40 ? C.amber : C.positive, textTransform: "uppercase", letterSpacing: ".06em" }}>
                                            {(streams[0]?.pct ?? 0) > 60 ? "High concentration risk" : (streams[0]?.pct ?? 0) > 40 ? "Moderate concentration" : "Well diversified"}
                                        </div>
                                        <div style={{ fontSize: 12, color: C.mid, marginTop: 3 }}>Top source accounts for {streams[0]?.pct ?? 0}% of revenue</div>
                                    </div>
                                </>
                            )}
                        </Card>

                        {/* MoM bar */}
                        <Card delay={1}>
                            <Lbl>Month-over-Month Revenue</Lbl>
                            {loading ? <Sk h={180} /> : trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={38}>
                                            {trend.map((_, i) => <Cell key={i} fill={i === trend.length - 1 ? C.forestLight : C.forestLight + "80"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                            {totals.momPct !== null && (
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, color: C.muted }}>Last month change</span>
                                    <Delta up={(totals.momPct ?? 0) >= 0} label={`${(totals.momPct ?? 0) >= 0 ? "+" : ""}${(totals.momPct ?? 0).toFixed(1)}%`} />
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            <AddRevenueDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                tenants={tenants}
                revenueSource={sources}
                bankAccounts={banks}
                onSuccess={onSuccess}
            />
        </div>
    );
}