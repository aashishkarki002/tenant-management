// ExpenseBreakDown.jsx
// Design: Identical tokens to AccountingPage + RevenueBreakDown
// Forest green hero · amber/red expense accents · Instrument Serif display · Plus Jakarta Sans UI
// Bento grid: 4 KPI cards · trend area · payee donut · category table · ref-type · stats
// Tabs: Overview · Transactions · Analysis

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw, ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { useBankAccounts } from "../hooks/useAccounting";
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

const EXP_PALETTE = [C.red, C.amber, C.violet, C.blue, "#D97706", C.teal, "#BE185D", C.forestLight];

const NEP_MONTHS = ["Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const Q_NEP = { 1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3] };
const Q_LABELS = {
    1: "Q1 · Shrawan–Ashwin", 2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra", 4: "Q4 · Baishakh–Ashadh",
};
const REF_CFG = {
    MANUAL: { bg: C.alt, color: C.muted },
    MAINTENANCE: { bg: C.red + "18", color: C.red },
    UTILITY: { bg: C.blue + "18", color: C.blue },
    SALARY: { bg: C.violet + "18", color: C.violet },
    RENT: { bg: C.amber + "18", color: C.amber },
    VENDOR: { bg: C.teal + "18", color: C.teal },
};
const OPERATING = ["MAINTENANCE", "UTILITY", "SALARY"];

const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = v => { const a = Math.abs(v); return a >= 100000 ? `${(a / 100000).toFixed(1)}L` : a >= 1000 ? `${(a / 1000).toFixed(0)}K` : a; };
const toRs = p => (p ?? 0) / 100;
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : "0.0";

function applyFilter(data, q, s, e) {
    if (q === "custom") {
        const [st, en] = [new Date(s), new Date(e)];
        return data.filter(r => { const d = new Date(r.EnglishDate ?? r.createdAt); return !isNaN(d) && d >= st && d <= en; });
    }
    if (!q) return data;
    const months = Q_NEP[q] ?? [];
    return data.filter(r => months.includes(r.nepaliMonth));
}

function transform(expenses = []) {
    const zero = { cats: [], trend: [], payeeSplit: [], refTypes: [], txns: [], statusMap: {}, operAmt: 0, nonOperAmt: 0, totals: { total: 0, n: 0, avg: 0, mom: null } };
    if (!expenses.length) return zero;

    // By category/source
    const cMap = {};
    expenses.forEach(e => {
        const k = e.source?._id ?? "unk";
        if (!cMap[k]) cMap[k] = { k, name: e.source?.name ?? "Unknown", code: e.source?.code ?? "?", amt: 0, n: 0 };
        cMap[k].amt += toRs(e.amountPaisa); cMap[k].n++;
    });
    const cats = Object.values(cMap).sort((a, b) => b.amt - a.amt);
    const total = cats.reduce((s, x) => s + x.amt, 0);
    cats.forEach(c => { c.pct = total ? +((c.amt / total) * 100).toFixed(1) : 0; });

    // Monthly trend (Nepali)
    const mMap = {};
    expenses.forEach(e => {
        if (!e.nepaliYear || !e.nepaliMonth) return;
        const k = `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}`;
        if (!mMap[k]) mMap[k] = { k, label: NEP_MONTHS[(e.nepaliMonth - 1) % 12], expenses: 0, n: 0 };
        mMap[k].expenses += toRs(e.amountPaisa); mMap[k].n++;
    });
    const trend = Object.values(mMap).sort((a, b) => a.k.localeCompare(b.k)).slice(-8);
    const mom = trend.length >= 2 ? ((trend.at(-1).expenses - trend.at(-2).expenses) / (trend.at(-2).expenses || 1)) * 100 : null;

    // Payee split
    let extAmt = 0, tenAmt = 0;
    expenses.forEach(e => e.payeeType === "EXTERNAL" ? (extAmt += toRs(e.amountPaisa)) : (tenAmt += toRs(e.amountPaisa)));
    const payeeSplit = [
        { name: "External", amt: extAmt, pct: total ? +((extAmt / total) * 100).toFixed(1) : 0, color: C.red },
        { name: "Tenant", amt: tenAmt, pct: total ? +((tenAmt / total) * 100).toFixed(1) : 0, color: C.amber },
    ].filter(p => p.pct > 0);

    // Ref types
    const rMap = {};
    expenses.forEach(e => { const t = e.referenceType ?? "MANUAL"; if (!rMap[t]) rMap[t] = { t, n: 0, amt: 0 }; rMap[t].n++; rMap[t].amt += toRs(e.amountPaisa); });
    const refTypes = Object.values(rMap).sort((a, b) => b.amt - a.amt);

    // Operating vs non-operating
    let operAmt = 0, nonOperAmt = 0;
    expenses.forEach(e => OPERATING.includes(e.referenceType) ? (operAmt += toRs(e.amountPaisa)) : (nonOperAmt += toRs(e.amountPaisa)));

    // Status
    const statusMap = {};
    expenses.forEach(e => { const s = e.status ?? "RECORDED"; statusMap[s] = (statusMap[s] || 0) + 1; });

    // Transactions
    const txns = [...expenses].sort((a, b) => new Date(b.EnglishDate ?? b.createdAt) - new Date(a.EnglishDate ?? a.createdAt)).slice(0, 50).map(e => ({
        id: e._id,
        source: e.source?.name ?? "—",
        ref: e.referenceType ?? "MANUAL",
        payee: e.payeeType,
        amt: toRs(e.amountPaisa),
        date: e.nepaliYear ? `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}` : (e.EnglishDate ? new Date(e.EnglishDate).toLocaleDateString("en-IN") : "—"),
        status: e.status ?? "RECORDED",
        notes: e.notes ?? "",
    }));

    return {
        cats, trend, payeeSplit, refTypes, txns, statusMap, operAmt, nonOperAmt,
        totals: { total, n: expenses.length, avg: expenses.length ? total / expenses.length : 0, mom }
    };
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes ex-up   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ex-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes ex-pulse{ 0%,100%{opacity:.45} 50%{opacity:.85} }
  .ex { font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  .ex-serif { font-family:'Instrument Serif',Georgia,serif; }
  .ex-card  { animation:ex-up .3s ease both; }
`;

function Card({ children, style = {}, delay = 0 }) {
    return <div className="ex-card" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px", animationDelay: `${delay * .05}s`, ...style }}>{children}</div>;
}
function Dark({ children, style = {}, delay = 0 }) {
    return <div className="ex-card" style={{ background: C.forest, borderRadius: 16, padding: "18px 20px", animationDelay: `${delay * .05}s`, ...style }}>{children}</div>;
}
function Lbl({ children, light, style = {} }) {
    return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: light ? "rgba(255,255,255,.45)" : C.muted, marginBottom: 8, ...style }}>{children}</div>;
}
function Num({ v, size = 32, color = C.text, prefix = "₹" }) {
    return <div className="ex-serif" style={{ fontSize: size, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{prefix}{Number(Math.abs(v)).toLocaleString("en-IN")}</div>;
}
function Delta({ up, label }) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: up ? "#DCFCE7" : "#FEE2E2", color: up ? C.positive : C.negative }}>{up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}{label}</span>;
}
function Bar2({ value, max, color = C.red, h = 5 }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return <div style={{ height: h, borderRadius: h / 2, background: C.border, overflow: "hidden", flex: 1 }}><div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h / 2, transition: "width .5s" }} /></div>;
}
function Sk({ h = 14, mb = 6 }) { return <div style={{ height: h, background: C.alt, borderRadius: 6, marginBottom: mb, animation: "ex-pulse 1.5s infinite" }} />; }
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
function PPill({ t }) {
    return <span style={{ background: t === "EXTERNAL" ? C.redBg : C.amberBg, color: t === "EXTERNAL" ? C.red : C.amber, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{t}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExpenseBreakDown({ onExpenseAdded, selectedQuarter = null, compareMode = false, compareQuarter = null, customStartDate = "", customEndDate = "" }) {
    const [tab, setTab] = useState("overview");
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [open, setOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [expSources, setExpSources] = useState([]);
    const { bankAccounts } = useBankAccounts();

    const fetch = useCallback(async () => {
        setLoading(true); setErr(null);
        try { const { data } = await api.get("/api/expense/get-all"); setAll(data?.expenses ?? []); }
        catch (e) { setErr(e?.response?.data?.message ?? "Failed to load expenses"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetch();
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/expense/get-expense-sources").then(({ data }) => setExpSources(data?.expenseSources ?? [])).catch(() => { });
    }, [fetch]);

    const onSuccess = useCallback(() => { fetch(); onExpenseAdded?.(); }, [fetch, onExpenseAdded]);

    const filtA = useMemo(() => applyFilter(all, selectedQuarter, customStartDate, customEndDate), [all, selectedQuarter, customStartDate, customEndDate]);
    const filtB = useMemo(() => compareMode ? applyFilter(all, compareQuarter, customStartDate, customEndDate) : [], [all, compareMode, compareQuarter, customStartDate, customEndDate]);

    const D = useMemo(() => transform(filtA), [filtA]);
    const DB = useMemo(() => compareMode ? transform(filtB).totals : null, [compareMode, filtB]);

    const periodLabel = selectedQuarter === "custom" ? `${customStartDate} → ${customEndDate}` : selectedQuarter ? Q_LABELS[selectedQuarter] ?? "All" : "All Periods";

    const exportCSV = () => {
        const rows = [["Source", "Ref", "Payee", "Amount", "Date", "Status", "Notes"], ...D.txns.map(t => [t.source, t.ref, t.payee, t.amt, t.date, t.status, t.notes])];
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type: "text/csv" })), download: `expenses_${Date.now()}.csv` }).click();
    };

    const TABS = ["overview", "transactions", "analysis"];

    return (
        <div className="ex" style={{ color: C.text }}>
            <style>{S}</style>

            {/* ── Header ────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>{periodLabel}</div>
                    <div style={{ fontSize: 13, color: C.mid }}>{loading ? "Loading…" : `${D.totals.n} transactions · ${fmt(D.totals.total)}`}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={fetch} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <RefreshCw size={14} color={C.mid} style={{ animation: loading ? "ex-spin 1s linear infinite" : "none" }} />
                    </button>
                    <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer" }}>
                        <Download size={13} />CSV
                    </button>
                    <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: C.red, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <PlusIcon size={14} />Add Expense
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
                const diff = (DB?.total ?? 0) - D.totals.total, up = diff <= 0; // lower expense = good
                const dp = D.totals.total ? Math.abs((diff / D.totals.total) * 100).toFixed(1) : null;
                return <div style={{ background: C.red + "0E", border: `1px solid ${C.red}28`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.red, letterSpacing: ".08em", textTransform: "uppercase" }}>Compare Mode</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{lA}</div><div className="ex-serif" style={{ fontSize: 20, color: C.red }}>{fmt(D.totals.total)}</div></div>
                        <div style={{ color: C.muted, fontSize: 18 }}>→</div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{lB}</div><div className="ex-serif" style={{ fontSize: 20, color: C.amber }}>{fmt(DB?.total ?? 0)}</div></div>
                        {dp && <Delta up={up} label={`${dp}%`} />}
                    </div>
                </div>;
            })()}

            {/* ── Hero KPI strip ────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "220px repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                {/* Dark hero — same forest green as revenue, same treatment */}
                <Dark delay={0}>
                    <Lbl light>Total Expenses</Lbl>
                    <Num v={D.totals.total} size={38} color="#fff" />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {D.totals.mom !== null && <Delta up={D.totals.mom <= 0} label={`${Math.abs(D.totals.mom).toFixed(1)}% MoM`} />}
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[{ l: "Transactions", v: D.totals.n }, { l: "Categories", v: D.cats.length }].map(x => (
                            <div key={x.l}><div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", marginBottom: 2 }}>{x.l}</div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{x.v}</div></div>
                        ))}
                    </div>
                </Dark>

                {/* 4 stat cards */}
                {[
                    { label: "Avg Ticket", val: fmt(D.totals.avg), sub: "per transaction", grad: `${C.red},#FCA5A5` },
                    { label: "Top Category", val: D.cats[0]?.name ?? "—", sub: D.cats[0] ? fmt(D.cats[0].amt) : "No data", grad: `${C.amber},#FCD34D` },
                    { label: "Operating Cost", val: fmt(D.operAmt), sub: "Salary · Utility · Maintenance", grad: `${C.violet},#C4B5FD` },
                    { label: "Non-Operating", val: fmt(D.nonOperAmt), sub: "Vendor · Manual · Other", grad: `${C.blue},#93C5FD` },
                ].map((k, i) => (
                    <Card key={k.label} delay={i + 1} style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ height: 3, background: `linear-gradient(90deg,${k.grad})`, borderRadius: "16px 16px 0 0" }} />
                        <div style={{ padding: "14px 18px" }}>
                            <Lbl>{k.label}</Lbl>
                            <div className="ex-serif" style={{ fontSize: 24, color: C.text, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
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

                    {/* Row 1: Trend area + Payee donut */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 16 }}>
                        <Card delay={5}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                <div><Lbl style={{ marginBottom: 2 }}>Expense Trend</Lbl><div style={{ fontSize: 11, color: C.muted }}>{periodLabel} · Nepali calendar</div></div>
                                {D.totals.mom !== null && <Delta up={D.totals.mom <= 0} label={`${Math.abs(D.totals.mom).toFixed(1)}% last month`} />}
                            </div>
                            {loading ? <Sk h={200} /> : D.trend.length === 0 ? <None msg="No monthly data — add expenses with Nepali dates" /> : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={D.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="ex-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={C.red} stopOpacity={.2} />
                                                <stop offset="100%" stopColor={C.red} stopOpacity={.01} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.red} strokeWidth={2.5} fill="url(#ex-grad)" dot={{ r: 3, fill: C.red, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </Card>

                        <Card delay={6}>
                            <Lbl>Payee Split</Lbl>
                            {loading ? <Sk h={130} /> : D.payeeSplit.length === 0 ? <None /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={130}>
                                        <PieChart>
                                            <Pie data={D.payeeSplit} dataKey="pct" cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3}>
                                                {D.payeeSplit.map((p, i) => <Cell key={i} fill={p.color} />)}
                                            </Pie>
                                            <Tooltip formatter={v => `${v}%`} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
                                        {D.payeeSplit.map(p => (
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

                    {/* Row 2: Category table + Ref types + Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>

                        {/* Category table */}
                        <Card delay={7}>
                            <Lbl>Expenses by Category</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : D.cats.length === 0 ? <None /> : (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 1fr 68px", gap: "0 10px", padding: "0 2px 8px", borderBottom: `1px solid ${C.border}` }}>
                                        {["Category", "Txns", "Share", "Amount"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</span>)}
                                    </div>
                                    {D.cats.map((c, i) => (
                                        <div key={c.k} style={{ display: "grid", gridTemplateColumns: "1fr 52px 1fr 68px", gap: "0 10px", alignItems: "center", padding: "9px 2px", borderBottom: `1px solid ${C.border}40` }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{c.name}</div>
                                                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{c.code}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: C.muted }}>{c.n}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                <Bar2 value={c.amt} max={D.totals.total} color={EXP_PALETTE[i % EXP_PALETTE.length]} />
                                                <span style={{ fontSize: 10, color: C.muted, minWidth: 24 }}>{c.pct}%</span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right" }}>₹{fmtK(c.amt)}</div>
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
                                                    <div style={{ fontSize: 10, color: C.muted }}>{r.n} txns · {pct(r.amt, D.totals.total)}%</div>
                                                </div>
                                            </div>
                                            <Bar2 value={r.amt} max={D.totals.total} color={REF_CFG[r.t]?.color ?? C.red} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Stats + status */}
                        <Card delay={9}>
                            <Lbl>Stats & Status</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : (
                                <>
                                    {[
                                        { l: "Transactions", v: D.totals.n },
                                        { l: "Avg / Txn", v: fmt(D.totals.avg) },
                                        { l: "Categories", v: D.cats.length },
                                        { l: "Top Cat %", v: D.cats[0] ? D.cats[0].pct + "%" : "—" },
                                        { l: "External Txns", v: D.txns.filter(t => t.payee === "EXTERNAL").length },
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
                                                    <SPill s={s} /><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{n}</span>
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
                    {loading ? <div style={{ padding: 20 }}><Sk /><Sk /><Sk /></div> : D.txns.length === 0 ? <None msg="No transactions for this period" /> : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                        {["Source", "Ref", "Payee", "Amount", "Date", "Status", "Notes"].map(h => (
                                            <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {D.txns.map((t, i) => (
                                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}50`, background: i % 2 === 0 ? C.surface : C.alt + "70" }}>
                                            <td style={{ padding: "9px 14px", fontWeight: 600, color: C.text, fontSize: 13 }}>{t.source}</td>
                                            <td style={{ padding: "9px 14px" }}><RPill t={t.ref} /></td>
                                            <td style={{ padding: "9px 14px" }}><PPill t={t.payee} /></td>
                                            <td style={{ padding: "9px 14px", fontWeight: 700, color: C.negative, fontSize: 13 }}>−{fmt(t.amt)}</td>
                                            <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{t.date}</td>
                                            <td style={{ padding: "9px 14px" }}><SPill s={t.status} /></td>
                                            <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes || "—"}</td>
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

                    {/* Row 1: Operating vs Non-Op + MoM bar */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <Card delay={0}>
                            <Lbl>Operating vs Non-Operating</Lbl>
                            {loading ? <Sk h={160} /> : (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                                        {[
                                            { l: "Operating", v: D.operAmt, note: "Salary · Utility · Maintenance", color: C.violet, bg: C.violetBg },
                                            { l: "Non-Operating", v: D.nonOperAmt, note: "Vendor · Manual · Other", color: C.blue, bg: C.blueBg },
                                        ].map(x => (
                                            <div key={x.l} style={{ background: x.bg, borderRadius: 12, padding: "14px 16px" }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: x.color, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{x.l}</div>
                                                <Num v={x.v} size={22} color={C.text} />
                                                <div style={{ marginTop: 8 }}><Bar2 value={x.v} max={D.totals.total} color={x.color} h={5} /></div>
                                                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{pct(x.v, D.totals.total)}% of total · {x.note}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Spend mix bar */}
                                    <div>
                                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Spending mix</div>
                                        <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", gap: 1 }}>
                                            <div style={{ width: `${pct(D.operAmt, D.totals.total)}%`, background: C.violet, transition: "width .6s" }} />
                                            <div style={{ width: `${pct(D.nonOperAmt, D.totals.total)}%`, background: C.blue, transition: "width .6s" }} />
                                        </div>
                                        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                                            {[{ l: "Operating", c: C.violet }, { l: "Non-Op", c: C.blue }].map(x => (
                                                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: "inline-block" }} />
                                                    <span style={{ fontSize: 10, color: C.muted }}>{x.l}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card delay={1}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                <Lbl style={{ marginBottom: 0 }}>Month-by-Month Spend</Lbl>
                                {D.totals.mom !== null && <Delta up={D.totals.mom <= 0} label={`${D.totals.mom >= 0 ? "+" : ""}${D.totals.mom.toFixed(1)}% MoM`} />}
                            </div>
                            {loading ? <Sk h={180} /> : D.trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={D.trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Bar dataKey="expenses" name="Expenses" radius={[4, 4, 0, 0]} maxBarSize={38}>
                                            {D.trend.map((_, i) => <Cell key={i} fill={i === D.trend.length - 1 ? C.red : C.red + "70"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </div>

                    {/* Row 2: Category concentration + top sources ranked */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
                        <Card delay={2}>
                            <Lbl>Category Concentration</Lbl>
                            {loading ? <Sk h={140} /> : D.cats.length === 0 ? <None /> : (
                                <>
                                    <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", gap: 1, marginBottom: 12 }}>
                                        {D.cats.map((c, i) => (
                                            <div key={c.k} title={`${c.name}: ${c.pct}%`}
                                                style={{ width: `${c.pct}%`, background: EXP_PALETTE[i % EXP_PALETTE.length], minWidth: c.pct < 1 ? 0 : undefined, display: c.pct < 0.5 ? "none" : "block" }} />
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 12px", marginBottom: 14 }}>
                                        {D.cats.map((c, i) => (
                                            <div key={c.k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span style={{ width: 7, height: 7, borderRadius: 2, background: EXP_PALETTE[i % EXP_PALETTE.length], display: "inline-block" }} />
                                                <span style={{ fontSize: 10, color: C.muted }}>{c.name} <b style={{ color: C.text }}>{c.pct}%</b></span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: "12px 14px", background: D.cats[0]?.pct > 60 ? C.redBg : D.cats[0]?.pct > 40 ? C.amberBg : "#F0FDF4", borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: D.cats[0]?.pct > 60 ? C.red : D.cats[0]?.pct > 40 ? C.amber : C.positive, textTransform: "uppercase", letterSpacing: ".06em" }}>
                                            {D.cats[0]?.pct > 60 ? "High concentration" : D.cats[0]?.pct > 40 ? "Moderate concentration" : "Diversified spend"}
                                        </div>
                                        <div style={{ fontSize: 12, color: C.mid, marginTop: 3 }}>"{D.cats[0]?.name}" drives {D.cats[0]?.pct ?? 0}% of expenses</div>
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card delay={3}>
                            <Lbl>Top Expense Sources — Ranked</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : D.cats.length === 0 ? <None /> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {D.cats.slice(0, 7).map((c, i) => (
                                        <div key={c.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: C.alt, borderRadius: 11 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: EXP_PALETTE[i % EXP_PALETTE.length] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: EXP_PALETTE[i % EXP_PALETTE.length], flexShrink: 0 }}>
                                                {i + 1}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</span>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(c.amt)}</span>
                                                </div>
                                                <Bar2 value={c.amt} max={D.cats[0].amt} color={EXP_PALETTE[i % EXP_PALETTE.length]} h={4} />
                                                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{c.n} txns · {c.pct}% of total</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            <AddExpenseDialog open={open} onOpenChange={setOpen} tenants={tenants} expenseSources={expSources} bankAccounts={bankAccounts} onSuccess={onSuccess} />
        </div>
    );
}