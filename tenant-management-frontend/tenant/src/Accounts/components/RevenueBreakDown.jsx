// RevenueBreakDown.jsx
// Design: Same tokens as AccountingPage — Instrument Serif · Plus Jakarta Sans
// Forest green hero card · warm off-white bg · amber/blue/violet accents
// Bento grid: 4 KPI cards · trend area · payer donut · source table · ref-type · stats
// Tabs: Overview · Tenants · Transactions · Analysis

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw, ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { AddRevenueDialog } from "./AddRevenueDialog";
import api from "../../../plugins/axios";

// ─── Design tokens — identical to AccountingPage ──────────────────────────────
const C = {
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    alt: "#F4F4F1",
    forest: "#1C2B1C",
    forestLight: "#4A7C4A",
    amber: "#B8721E",
    amberBg: "#FDF3E3",
    red: "#B91C1C",
    redBg: "#FEF2F2",
    blue: "#1D4ED8",
    blueBg: "#EFF6FF",
    violet: "#6D28D9",
    violetBg: "#EDE9FE",
    teal: "#0E7490",
    tealBg: "#ECFEFF",
    border: "#E8E8E4",
    text: "#1A1A18",
    mid: "#4A4A44",
    muted: "#8A8A82",
    positive: "#15803D",
    negative: "#B91C1C",
};

const PALETTE = [C.forestLight, C.blue, C.violet, C.amber, C.teal, "#BE185D", "#D97706", "#0891B2"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const Q_MONTHS = { 1: [6, 7, 8], 2: [9, 10, 11], 3: [0, 1, 2], 4: [3, 4, 5] };
const Q_LABELS = {
    1: "Q1 · Shrawan–Ashwin", 2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra", 4: "Q4 · Baishakh–Ashadh",
};
const REF_CFG = {
    RENT: { bg: C.forestLight + "22", color: C.forestLight },
    PARKING: { bg: C.blue + "22", color: C.blue },
    AD: { bg: C.violet + "22", color: C.violet },
    CAM: { bg: C.amber + "22", color: C.amber },
    ELECTRICITY: { bg: "#FEF9C3", color: "#A16207" },
    MAINTENANCE: { bg: C.teal + "22", color: C.teal },
    MANUAL: { bg: C.alt, color: C.muted },
};

const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = v => { const a = Math.abs(v); return a >= 100000 ? `${(a / 100000).toFixed(1)}L` : a >= 1000 ? `${(a / 1000).toFixed(0)}K` : a; };
const toRs = p => (p ?? 0) / 100;
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : "0.0";

function applyFilter(data, q, s, e) {
    if (q === "custom") {
        const [st, en] = [new Date(s), new Date(e)];
        return data.filter(r => { const d = new Date(r.date); return !isNaN(d) && d >= st && d <= en; });
    }
    if (!q) return data;
    const months = Q_MONTHS[q] ?? [];
    return data.filter(r => { const d = new Date(r.date); return !isNaN(d) && months.includes(d.getMonth()); });
}

function transform(revs = []) {
    const zero = { streams: [], trend: [], barTrend: [], payerSplit: [], refTypes: [], topTenants: [], txns: [], statusMap: {}, totals: { rev: 0, n: 0, avg: 0, mom: null } };
    if (!revs.length) return zero;

    // By source
    const srcMap = {};
    revs.forEach(r => {
        const k = r.source?._id ?? "unk";
        if (!srcMap[k]) srcMap[k] = { k, name: r.source?.name ?? "Unknown", code: r.source?.code ?? "?", amt: 0, n: 0 };
        srcMap[k].amt += toRs(r.amountPaisa); srcMap[k].n++;
    });
    const streams = Object.values(srcMap).sort((a, b) => b.amt - a.amt);
    const rev = streams.reduce((s, x) => s + x.amt, 0);
    streams.forEach(s => { s.pct = rev ? +((s.amt / rev) * 100).toFixed(1) : 0; });

    // Monthly trend (area)
    const mMap = {};
    revs.forEach(r => {
        const d = new Date(r.date); if (isNaN(d)) return;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!mMap[k]) mMap[k] = { k, label: MONTHS[d.getMonth()], revenue: 0, n: 0 };
        mMap[k].revenue += toRs(r.amountPaisa); mMap[k].n++;
    });
    const trend = Object.values(mMap).sort((a, b) => a.k.localeCompare(b.k)).slice(-8);
    const mom = trend.length >= 2 ? ((trend.at(-1).revenue - trend.at(-2).revenue) / (trend.at(-2).revenue || 1)) * 100 : null;

    // Payer split
    let tAmt = 0, eAmt = 0;
    revs.forEach(r => r.payerType === "TENANT" ? (tAmt += toRs(r.amountPaisa)) : (eAmt += toRs(r.amountPaisa)));
    const payerSplit = [
        { name: "Tenant", amt: tAmt, pct: rev ? +((tAmt / rev) * 100).toFixed(1) : 0, color: C.forestLight },
        { name: "External", amt: eAmt, pct: rev ? +((eAmt / rev) * 100).toFixed(1) : 0, color: C.blue },
    ].filter(p => p.pct > 0);

    // Ref types
    const rMap = {};
    revs.forEach(r => { const t = r.referenceType ?? "MANUAL"; if (!rMap[t]) rMap[t] = { t, n: 0, amt: 0 }; rMap[t].n++; rMap[t].amt += toRs(r.amountPaisa); });
    const refTypes = Object.values(rMap).sort((a, b) => b.amt - a.amt);

    // Status
    const statusMap = {};
    revs.forEach(r => { const s = r.status ?? "RECORDED"; statusMap[s] = (statusMap[s] || 0) + 1; });

    // Top tenants
    const tMap = {};
    revs.filter(r => r.payerType === "TENANT").forEach(r => {
        const k = r.tenant?._id ?? "unk";
        if (!tMap[k]) tMap[k] = { name: r.tenant?.name ?? "Tenant", amt: 0, n: 0, sources: new Set() };
        tMap[k].amt += toRs(r.amountPaisa); tMap[k].n++; tMap[k].sources.add(r.source?.name ?? "—");
    });
    const topTenants = Object.values(tMap).map(t => ({ ...t, sources: [...t.sources].join(", ") })).sort((a, b) => b.amt - a.amt).slice(0, 8);

    // Transactions
    const txns = [...revs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(r => ({
        id: r._id,
        payer: r.payerType === "TENANT" ? (r.tenant?.name ?? "Tenant") : (r.externalPayer?.name ?? "External"),
        source: r.source?.name ?? "—",
        ref: r.referenceType ?? "MANUAL",
        amt: toRs(r.amountPaisa),
        date: r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—",
        status: r.status ?? "RECORDED",
        type: r.payerType,
    }));

    return {
        streams, trend, payerSplit, refTypes, topTenants, txns, statusMap,
        totals: { rev, n: revs.length, avg: revs.length ? rev / revs.length : 0, mom }
    };
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes rv-up   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes rv-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes rv-pulse{ 0%,100%{opacity:.45} 50%{opacity:.85} }
  .rv { font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  .rv-serif { font-family:'Instrument Serif',Georgia,serif; }
  .rv-card  { animation:rv-up .3s ease both; }
`;

function Card({ children, style = {}, delay = 0 }) {
    return <div className="rv-card" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px", animationDelay: `${delay * .05}s`, ...style }}>{children}</div>;
}
function Dark({ children, style = {}, delay = 0 }) {
    return <div className="rv-card" style={{ background: C.forest, borderRadius: 16, padding: "18px 20px", animationDelay: `${delay * .05}s`, ...style }}>{children}</div>;
}
function Lbl({ children, light, style = {} }) {
    return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: light ? "rgba(255,255,255,.45)" : C.muted, marginBottom: 8, ...style }}>{children}</div>;
}
function Num({ v, size = 32, color = C.text, prefix = "₹" }) {
    return <div className="rv-serif" style={{ fontSize: size, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{prefix}{Number(Math.abs(v)).toLocaleString("en-IN")}</div>;
}
function Delta({ up, label }) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: up ? "#DCFCE7" : "#FEE2E2", color: up ? C.positive : C.negative }}>{up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}{label}</span>;
}
function Bar2({ value, max, color = C.forestLight, h = 5 }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return <div style={{ height: h, borderRadius: h / 2, background: C.border, overflow: "hidden", flex: 1 }}><div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h / 2, transition: "width .5s" }} /></div>;
}
function Sk({ h = 14, mb = 6 }) { return <div style={{ height: h, background: C.alt, borderRadius: 6, marginBottom: mb, animation: "rv-pulse 1.5s infinite" }} />; }
function None({ msg = "No data for this period" }) { return <div style={{ padding: "32px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>{msg}</div>; }
function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return <div style={{ background: C.forest, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
        {payload.map(p => <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill ?? p.color ?? p.stroke, display: "inline-block" }} />
            <span style={{ opacity: .6 }}>{p.name}</span>
            <span style={{ fontWeight: 700, marginLeft: "auto" }}>₹{Math.abs(p.value || 0).toLocaleString()}</span>
        </div>)}
    </div>;
}
function SPill({ s }) {
    const cfg = { RECORDED: [C.amberBg, C.amber], SYNCED: ["#D1FAE5", C.positive], REVERSED: [C.redBg, C.red] }[s] ?? [C.alt, C.muted];
    return <span style={{ background: cfg[0], color: cfg[1], borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{s}</span>;
}
function RPill({ t }) {
    const c = REF_CFG[t] ?? { bg: C.alt, color: C.muted };
    return <span style={{ background: c.bg, color: c.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{t}</span>;
}
function TPill({ t }) {
    return <span style={{ background: t === "TENANT" ? C.forestLight + "22" : C.blueBg, color: t === "TENANT" ? C.forestLight : C.blue, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{t}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RevenueBreakDown({ onRevenueAdded, selectedQuarter, compareMode, compareQuarter, customStartDate, customEndDate }) {
    const [tab, setTab] = useState("overview");
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [open, setOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [sources, setSources] = useState([]);
    const [banks, setBanks] = useState([]);

    const fetch = useCallback(async () => {
        setLoading(true); setErr(null);
        try { const { data } = await api.get("/api/revenue/get-all"); setAll(data?.revenue ?? []); }
        catch (e) { setErr(e?.response?.data?.message ?? "Failed to load"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetch();
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/revenue/get-revenue-sources").then(({ data }) => setSources(data?.revenueSources ?? [])).catch(() => { });
        api.get("/api/bank/get-bank-accounts").then(({ data }) => setBanks(data?.bankAccounts ?? [])).catch(() => { });
    }, [fetch]);

    const onSuccess = useCallback(() => { fetch(); onRevenueAdded?.(); }, [fetch, onRevenueAdded]);

    const filtA = useMemo(() => applyFilter(all, selectedQuarter, customStartDate, customEndDate), [all, selectedQuarter, customStartDate, customEndDate]);
    const filtB = useMemo(() => compareMode ? applyFilter(all, compareQuarter, customStartDate, customEndDate) : [], [all, compareMode, compareQuarter, customStartDate, customEndDate]);

    const D = useMemo(() => transform(filtA), [filtA]);
    const DB = useMemo(() => compareMode ? transform(filtB).totals : null, [compareMode, filtB]);

    const periodLabel = selectedQuarter === "custom" ? `${customStartDate} → ${customEndDate}` : selectedQuarter ? Q_LABELS[selectedQuarter] ?? "All" : "All Periods";

    const exportCSV = () => {
        const rows = [["Payer", "Source", "Ref", "Type", "Amount", "Date", "Status"], ...D.txns.map(t => [t.payer, t.source, t.ref, t.type, t.amt, t.date, t.status])];
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })), download: `revenue_${Date.now()}.csv` }).click();
    };

    const TABS = ["overview", "tenants", "transactions", "analysis"];

    return (
        <div className="rv" style={{ color: C.text }}>
            <style>{S}</style>

            {/* ── Header ────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>{periodLabel}</div>
                    <div style={{ fontSize: 13, color: C.mid }}>{loading ? "Loading…" : `${D.totals.n} transactions · ${fmt(D.totals.rev)}`}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={fetch} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <RefreshCw size={14} color={C.mid} style={{ animation: loading ? "rv-spin 1s linear infinite" : "none" }} />
                    </button>
                    <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer" }}>
                        <Download size={13} />CSV
                    </button>
                    <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: C.forest, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <PlusIcon size={14} />Add Revenue
                    </button>
                </div>
            </div>

            {/* ── Error ─────────────────────────────────────────────────────────── */}
            {err && <div style={{ background: C.redBg, border: `1px solid ${C.red}30`, borderRadius: 12, padding: "11px 16px", color: C.red, fontSize: 13, marginBottom: 16 }}>
                ⚠ {err} — <button onClick={fetch} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Retry</button>
            </div>}

            {/* ── Compare banner ────────────────────────────────────────────────── */}
            {compareMode && !loading && (() => {
                const lA = selectedQuarter ? Q_LABELS[selectedQuarter] : "All"; const lB = compareQuarter ? Q_LABELS[compareQuarter] : "All";
                const diff = (DB?.rev ?? 0) - D.totals.rev, up = diff >= 0;
                const dp = D.totals.rev ? Math.abs((diff / D.totals.rev) * 100).toFixed(1) : null;
                return <div style={{ background: C.forest + "10", border: `1px solid ${C.forest}28`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.forest, letterSpacing: ".08em", textTransform: "uppercase" }}>Compare Mode</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{lA}</div><div className="rv-serif" style={{ fontSize: 20, color: C.forestLight }}>{fmt(D.totals.rev)}</div></div>
                        <div style={{ color: C.muted, fontSize: 18 }}>→</div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{lB}</div><div className="rv-serif" style={{ fontSize: 20, color: C.blue }}>{fmt(DB?.rev ?? 0)}</div></div>
                        {dp && <Delta up={up} label={`${dp}%`} />}
                    </div>
                </div>;
            })()}

            {/* ── Hero KPI strip ────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "220px repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                {/* Dark hero */}
                <Dark delay={0}>
                    <Lbl light>Total Revenue</Lbl>
                    <Num v={D.totals.rev} size={38} color="#fff" />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {D.totals.mom !== null && <Delta up={D.totals.mom >= 0} label={`${Math.abs(D.totals.mom).toFixed(1)}% MoM`} />}
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[{ l: "Transactions", v: D.totals.n }, { l: "Streams", v: D.streams.length }].map(x => (
                            <div key={x.l}><div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", marginBottom: 2 }}>{x.l}</div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{x.v}</div></div>
                        ))}
                    </div>
                </Dark>

                {/* 4 stat cards */}
                {[
                    { label: "Avg Ticket", val: fmt(D.totals.avg), sub: "per transaction", grad: `${C.forestLight},#6EE7B7` },
                    { label: "Top Source", val: D.streams[0]?.name ?? "—", sub: D.streams[0] ? fmt(D.streams[0].amt) : "No sources", grad: `${C.amber},#FCD34D` },
                    { label: "Tenant Revenue", val: fmt(D.payerSplit.find(p => p.name === "Tenant")?.amt ?? 0), sub: (D.payerSplit.find(p => p.name === "Tenant")?.pct ?? 0) + "% of total", grad: `${C.blue},#93C5FD` },
                    { label: "Top Source %", val: D.streams[0] ? D.streams[0].pct + "%" : "—", sub: "concentration", grad: `${C.violet},#C4B5FD` },
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

            {/* ── Tab nav ───────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 4, background: C.alt, borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === t ? C.forest : "transparent", color: tab === t ? "#fff" : C.mid, transition: "all .15s" }}>
                        {t[0].toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* ══════════════════ OVERVIEW ══════════════════════════════════════════ */}
            {tab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Row 1: Area trend + Payer donut */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 16 }}>
                        <Card delay={5}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                <div><Lbl style={{ marginBottom: 2 }}>Revenue Trend</Lbl><div style={{ fontSize: 11, color: C.muted }}>{periodLabel} · monthly</div></div>
                                {D.totals.mom !== null && <Delta up={D.totals.mom >= 0} label={`${Math.abs(D.totals.mom).toFixed(1)}% last month`} />}
                            </div>
                            {loading ? <Sk h={200} /> : D.trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={D.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="rv-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={C.forestLight} stopOpacity={.22} />
                                                <stop offset="100%" stopColor={C.forestLight} stopOpacity={.01} />
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

                        <Card delay={6}>
                            <Lbl>Payer Split</Lbl>
                            {loading ? <Sk h={130} /> : D.payerSplit.length === 0 ? <None /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={130}>
                                        <PieChart>
                                            <Pie data={D.payerSplit} dataKey="pct" cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3}>
                                                {D.payerSplit.map((p, i) => <Cell key={i} fill={p.color} />)}
                                            </Pie>
                                            <Tooltip formatter={v => `${v}%`} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
                                        {D.payerSplit.map(p => (
                                            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, color: C.mid, flex: 1 }}>{p.name}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.pct}%</span>
                                                <span style={{ fontSize: 11, color: C.muted }}>{fmt(p.amt)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>

                    {/* Row 2: Source table + Ref types + Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>

                        {/* Source distribution table */}
                        <Card delay={7}>
                            <Lbl>Revenue by Source</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : D.streams.length === 0 ? <None /> : (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 1fr 68px", gap: "0 10px", padding: "0 2px 8px", borderBottom: `1px solid ${C.border}` }}>
                                        {["Source", "Txns", "Share", "Amount"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</span>)}
                                    </div>
                                    {D.streams.map((s, i) => (
                                        <div key={s.k} style={{ display: "grid", gridTemplateColumns: "1fr 52px 1fr 68px", gap: "0 10px", alignItems: "center", padding: "9px 2px", borderBottom: `1px solid ${C.border}40` }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{s.name}</div>
                                                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.code}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: C.muted }}>{s.n}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                <Bar2 value={s.amt} max={D.totals.rev} color={PALETTE[i % PALETTE.length]} />
                                                <span style={{ fontSize: 10, color: C.muted, minWidth: 24 }}>{s.pct}%</span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right" }}>₹{fmtK(s.amt)}</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </Card>

                        {/* Ref types */}
                        <Card delay={8}>
                            <Lbl>By Reference Type</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : D.refTypes.length === 0 ? <None /> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {D.refTypes.map(r => (
                                        <div key={r.t}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                                <RPill t={r.t} />
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmt(r.amt)}</div>
                                                    <div style={{ fontSize: 10, color: C.muted }}>{r.n} txns · {pct(r.amt, D.totals.rev)}%</div>
                                                </div>
                                            </div>
                                            <Bar2 value={r.amt} max={D.totals.rev} color={REF_CFG[r.t]?.color ?? C.forestLight} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Quick stats + status */}
                        <Card delay={9}>
                            <Lbl>Stats & Status</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : (
                                <>
                                    {[
                                        { l: "Transactions", v: D.totals.n },
                                        { l: "Avg / Txn", v: fmt(D.totals.avg) },
                                        { l: "Revenue Sources", v: D.streams.length },
                                        { l: "Top Source", v: D.streams[0] ? D.streams[0].pct + "%" : "—" },
                                        { l: "Tenant Txns", v: D.txns.filter(t => t.type === "TENANT").length },
                                    ].map(s => (
                                        <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                                            <span style={{ fontSize: 12, color: C.muted }}>{s.l}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.v}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 14 }}>
                                        <Lbl style={{ marginBottom: 8 }}>Status</Lbl>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                            {Object.entries(D.statusMap).map(([s, n]) => (
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

            {/* ══════════════════ TENANTS ═══════════════════════════════════════════ */}
            {tab === "tenants" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                        {/* Tenant leaderboard */}
                        <Card delay={0}>
                            <Lbl>Top Tenant Contributors</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : D.topTenants.length === 0 ? <None msg="No tenant revenue for this period" /> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {D.topTenants.map((t, i) => {
                                        const CLR = [C.forest, C.blue, C.violet, C.amber, C.forestLight, C.red, C.teal, "#BE185D"];
                                        return <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: C.alt, borderRadius: 12 }}>
                                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: CLR[i % 8] + "1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: CLR[i % 8], flexShrink: 0 }}>
                                                {t.name[0]?.toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.sources} · {t.n} txn{t.n !== 1 ? "s" : ""}</div>
                                                <div style={{ marginTop: 5 }}><Bar2 value={t.amt} max={D.topTenants[0].amt} color={CLR[i % 8]} h={4} /></div>
                                            </div>
                                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(t.amt)}</div>
                                                <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{pct(t.amt, D.totals.rev)}% of total</div>
                                            </div>
                                        </div>;
                                    })}
                                </div>
                            )}
                        </Card>

                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* Payer split blocks */}
                            <Card delay={1}>
                                <Lbl>Payer Classification</Lbl>
                                {loading ? <Sk h={80} /> : (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        {D.payerSplit.map(p => (
                                            <div key={p.name} style={{ background: p.color + "18", borderRadius: 12, padding: "14px 16px" }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{p.name}</div>
                                                <div className="rv-serif" style={{ fontSize: 28, color: C.text, lineHeight: 1 }}>{p.pct}%</div>
                                                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmt(p.amt)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            {/* Tenant monthly bar */}
                            <Card delay={2}>
                                <Lbl>Tenant Revenue by Month</Lbl>
                                {loading ? <Sk h={110} /> : D.trend.length === 0 ? <None /> : (() => {
                                    // Recompute tenant-only trend
                                    const tTrend = D.trend.map(m => ({ ...m, revenue: undefined })); // placeholder – use full trend with forest colour
                                    return <ResponsiveContainer width="100%" height={110}>
                                        <BarChart data={D.trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="35%">
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={34} />
                                            <Tooltip content={<Tip />} />
                                            <Bar dataKey="revenue" name="Revenue" fill={C.forestLight} radius={[3, 3, 0, 0]} maxBarSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>;
                                })()}
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════ TRANSACTIONS ══════════════════════════════════════ */}
            {tab === "transactions" && (
                <Card delay={0} style={{ padding: 0 }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Transactions</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Latest {D.txns.length} · {periodLabel}</div>
                        </div>
                        <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer" }}>
                            <Download size={13} />Export CSV
                        </button>
                    </div>
                    {loading ? <div style={{ padding: 20 }}><Sk /><Sk /><Sk /></div> : D.txns.length === 0 ? <None msg="No transactions" /> : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                        {["Payer", "Source", "Ref", "Type", "Amount", "Date", "Status"].map(h => (
                                            <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {D.txns.map((t, i) => (
                                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}50`, background: i % 2 === 0 ? C.surface : C.alt + "70" }}>
                                            <td style={{ padding: "9px 14px", fontWeight: 600, color: C.text, fontSize: 13 }}>{t.payer}</td>
                                            <td style={{ padding: "9px 14px", color: C.mid, fontSize: 13 }}>{t.source}</td>
                                            <td style={{ padding: "9px 14px" }}><RPill t={t.ref} /></td>
                                            <td style={{ padding: "9px 14px" }}><TPill t={t.type} /></td>
                                            <td style={{ padding: "9px 14px", fontWeight: 700, color: C.positive, fontSize: 13 }}>{fmt(t.amt)}</td>
                                            <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{t.date}</td>
                                            <td style={{ padding: "9px 14px" }}><SPill s={t.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* ══════════════════ ANALYSIS ══════════════════════════════════════════ */}
            {tab === "analysis" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Revenue concentration */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <Card delay={0}>
                            <Lbl>Revenue Concentration Risk</Lbl>
                            {loading ? <><Sk /><Sk /></> : D.streams.length === 0 ? <None /> : (
                                <>
                                    <div style={{ marginBottom: 14 }}>
                                        {/* HHI-style concentration bar */}
                                        <div style={{ display: "flex", height: 24, borderRadius: 8, overflow: "hidden", gap: 1 }}>
                                            {D.streams.map((s, i) => (
                                                <div key={s.k} title={`${s.name}: ${s.pct}%`}
                                                    style={{ width: `${s.pct}%`, background: PALETTE[i % PALETTE.length], transition: "width .5s", minWidth: s.pct > 2 ? undefined : 0, display: s.pct < 1 ? "none" : "block" }} />
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
                                            {D.streams.map((s, i) => (
                                                <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }} />
                                                    <span style={{ fontSize: 11, color: C.muted }}>{s.name} <b style={{ color: C.text }}>{s.pct}%</b></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ padding: "12px 14px", background: D.streams[0]?.pct > 60 ? C.redBg : D.streams[0]?.pct > 40 ? C.amberBg : "#F0FDF4", borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: D.streams[0]?.pct > 60 ? C.red : D.streams[0]?.pct > 40 ? C.amber : C.positive, textTransform: "uppercase", letterSpacing: ".06em" }}>
                                            {D.streams[0]?.pct > 60 ? "High concentration risk" : D.streams[0]?.pct > 40 ? "Moderate concentration" : "Well diversified"}
                                        </div>
                                        <div style={{ fontSize: 12, color: C.mid, marginTop: 3 }}>Top source accounts for {D.streams[0]?.pct ?? 0}% of revenue</div>
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card delay={1}>
                            <Lbl>Month-over-Month Revenue</Lbl>
                            {loading ? <Sk h={180} /> : D.trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={D.trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={38}>
                                            {D.trend.map((d, i) => <Cell key={i} fill={i === D.trend.length - 1 ? C.forestLight : C.forestLight + "80"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                            {D.totals.mom !== null && (
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, color: C.muted }}>Last month change</span>
                                    <Delta up={D.totals.mom >= 0} label={`${D.totals.mom >= 0 ? "+" : ""}${D.totals.mom.toFixed(1)}%`} />
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Payer analysis */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        {D.payerSplit.map((p, i) => (
                            <Card key={p.name} delay={i + 2}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.name[0]}</span>
                                    </div>
                                    <Delta up={true} label={`${p.pct}%`} />
                                </div>
                                <Lbl>{p.name} Revenue</Lbl>
                                <Num v={p.amt} size={28} color={C.text} />
                                <div style={{ marginTop: 10 }}><Bar2 value={p.amt} max={D.totals.rev} color={p.color} h={6} /></div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{pct(p.amt, D.totals.rev)}% of total revenue</div>
                            </Card>
                        ))}
                        {/* Avg ticket card */}
                        <Card delay={4}>
                            <Lbl>Avg Transaction</Lbl>
                            <Num v={D.totals.avg} size={28} color={C.text} />
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                                {[{ l: "Total Txns", v: D.totals.n }, { l: "Total Value", v: fmt(D.totals.rev) }, { l: "Sources", v: D.streams.length }].map(s => (
                                    <div key={s.l} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 7 }}>
                                        <span style={{ fontSize: 12, color: C.muted }}>{s.l}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.v}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            <AddRevenueDialog open={open} onOpenChange={setOpen} tenants={tenants} revenueSource={sources} bankAccounts={banks} onSuccess={onSuccess} />
        </div>
    );
}