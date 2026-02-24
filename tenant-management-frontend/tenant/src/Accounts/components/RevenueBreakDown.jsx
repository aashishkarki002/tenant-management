import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw, GitCompareArrowsIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { AddRevenueDialog } from "./AddRevenueDialog";
import api from "../../../plugins/axios";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SOURCE_COLORS = ["#10b981", "#06b6d4", "#6366f1", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];

// Nepal fiscal quarter → approximate English months (0-indexed)
// Q1: Shrawan-Ashwin ≈ Jul-Sep | Q2: Kartik-Poush ≈ Oct-Dec
// Q3: Magh-Chaitra  ≈ Jan-Mar | Q4: Baishakh-Ashadh ≈ Apr-Jun
const QUARTER_ENG_MONTHS = {
    1: [6, 7, 8],
    2: [9, 10, 11],
    3: [0, 1, 2],
    4: [3, 4, 5],
};

const QUARTER_LABELS = {
    1: "Q1 · Shrawan–Ashwin",
    2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra",
    4: "Q4 · Baishakh–Ashadh",
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = (v) => v >= 100_000 ? `${(v / 100_000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v;
const toRs = (p) => (p ?? 0) / 100;

// ─── Filtering helpers ────────────────────────────────────────────────────────
function filterByQuarter(revenues, quarter) {
    if (!quarter || quarter === "custom") return revenues;
    const months = QUARTER_ENG_MONTHS[quarter] ?? [];
    return revenues.filter((r) => {
        const d = new Date(r.date);
        return !isNaN(d) && months.includes(d.getMonth());
    });
}

function filterByCustom(revenues, startDate, endDate) {
    if (!startDate || !endDate) return revenues;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return revenues.filter((r) => {
        const d = new Date(r.date);
        return !isNaN(d) && d >= start && d <= end;
    });
}

function applyFilter(revenues, selectedQuarter, customStartDate, customEndDate) {
    if (selectedQuarter === "custom") return filterByCustom(revenues, customStartDate, customEndDate);
    return filterByQuarter(revenues, selectedQuarter);
}

// ─── Data transform ───────────────────────────────────────────────────────────
function transform(revenues = []) {
    if (!revenues.length) return {
        incomeStreams: [], monthlyTrend: [], payerSplit: [], recentTxns: [], topTenants: [],
        totals: { totalRevenue: 0, txnCount: 0 },
    };

    const bySource = {};
    revenues.forEach((r) => {
        const key = r.source?._id ?? r.source ?? "unknown";
        const name = r.source?.name ?? "Unknown";
        if (!bySource[key]) bySource[key] = { key, name, code: r.source?.code ?? "?", amount: 0, count: 0 };
        bySource[key].amount += toRs(r.amountPaisa);
        bySource[key].count++;
    });
    const incomeStreams = Object.values(bySource).sort((a, b) => b.amount - a.amount);
    const totalRevenue = incomeStreams.reduce((s, x) => s + x.amount, 0);
    incomeStreams.forEach((s) => { s.percent = totalRevenue ? +((s.amount / totalRevenue) * 100).toFixed(1) : 0; });

    const byMonth = {};
    revenues.forEach((r) => {
        const d = new Date(r.date);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[key]) byMonth[key] = { key, month: MONTH_NAMES[d.getMonth()], revenue: 0 };
        byMonth[key].revenue += toRs(r.amountPaisa);
    });
    const monthlyTrend = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);

    let tenantAmt = 0, externalAmt = 0;
    revenues.forEach((r) => {
        r.payerType === "TENANT" ? (tenantAmt += toRs(r.amountPaisa)) : (externalAmt += toRs(r.amountPaisa));
    });
    const payerSplit = [
        { name: "Tenant", value: totalRevenue ? +((tenantAmt / totalRevenue) * 100).toFixed(0) : 0, color: "#10b981" },
        { name: "External", value: totalRevenue ? +((externalAmt / totalRevenue) * 100).toFixed(0) : 0, color: "#6366f1" },
    ].filter((p) => p.value > 0);

    const recentTxns = [...revenues]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10)
        .map((r) => ({
            id: r._id,
            payer: r.payerType === "TENANT" ? (r.tenant?.name ?? "Tenant") : (r.externalPayer?.name ?? "External"),
            source: r.source?.name ?? "—",
            refType: r.referenceType ?? "MANUAL",
            amount: toRs(r.amountPaisa),
            date: r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—",
            status: r.status ?? "RECORDED",
            payerType: r.payerType,
        }));

    const byTenant = {};
    revenues.filter((r) => r.payerType === "TENANT").forEach((r) => {
        const key = r.tenant?._id ?? r.tenant ?? "unknown";
        if (!byTenant[key]) byTenant[key] = { name: r.tenant?.name ?? "Tenant", amount: 0, source: r.source?.name ?? "—" };
        byTenant[key].amount += toRs(r.amountPaisa);
    });
    const topTenants = Object.values(byTenant).sort((a, b) => b.amount - a.amount).slice(0, 5);

    return { incomeStreams, monthlyTrend, payerSplit, recentTxns, topTenants, totals: { totalRevenue, txnCount: revenues.length } };
}

// ─── Compare trend merge ──────────────────────────────────────────────────────
function buildCompareTrend(revsA, revsB) {
    const buildMonthMap = (revs) => {
        const map = {};
        revs.forEach((r) => {
            const d = new Date(r.date);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map[key]) map[key] = { key, month: MONTH_NAMES[d.getMonth()], revenue: 0 };
            map[key].revenue += toRs(r.amountPaisa);
        });
        return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-3);
    };
    const a = buildMonthMap(revsA);
    const b = buildMonthMap(revsB);
    const len = Math.max(a.length, b.length);
    return Array.from({ length: len }, (_, i) => ({
        label: `${a[i]?.month ?? "–"} / ${b[i]?.month ?? "–"}`,
        revenueA: a[i]?.revenue ?? 0,
        revenueB: b[i]?.revenue ?? 0,
    }));
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color, borderRadius: "12px 0 0 12px" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>{value}</span>
            {sub && <span style={{ fontSize: 12, color: "#6b7280" }}>{sub}</span>}
        </div>
    );
}
function Card({ children, style = {} }) {
    return <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 22, ...style }}>{children}</div>;
}
function SectionTitle({ children }) {
    return <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>{children}</h3>;
}
function StatusBadge({ s }) {
    const cfg = { RECORDED: ["#fef3c7", "#92400e"], SYNCED: ["#d1fae5", "#065f46"] }[s] ?? ["#f3f4f6", "#374151"];
    return <span style={{ background: cfg[0], color: cfg[1], borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>{s}</span>;
}
function TypeBadge({ t }) {
    return <span style={{ background: t === "TENANT" ? "#ede9fe" : "#e0f2fe", color: t === "TENANT" ? "#5b21b6" : "#0369a1", borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>{t}</span>;
}
function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</div>
            {payload.map((p) => <div key={p.dataKey} style={{ color: p.color || p.stroke, marginBottom: 2 }}>{p.name}: <b>{fmt(p.value)}</b></div>)}
        </div>
    );
}
function SkeletonRow() {
    return <div style={{ height: 16, background: "#f3f4f6", borderRadius: 6, marginBottom: 10, animation: "pulse 1.5s infinite" }} />;
}
function EmptyState({ msg = "No data" }) {
    return <div style={{ padding: "32px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{msg}</div>;
}

// ─── Compare Banner ───────────────────────────────────────────────────────────
function CompareBanner({ totA, totB, quarterA, quarterB }) {
    const diff = totB - totA;
    const pct = totA ? ((diff / totA) * 100).toFixed(1) : null;
    const isUp = diff >= 0;
    const Icon = isUp ? TrendingUpIcon : TrendingDownIcon;
    const labelA = quarterA ? QUARTER_LABELS[quarterA] ?? `Q${quarterA}` : "All Periods";
    const labelB = quarterB ? QUARTER_LABELS[quarterB] ?? `Q${quarterB}` : "All Periods";
    return (
        <div style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", border: "1px solid #a7f3d0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GitCompareArrowsIcon size={16} color="#059669" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>Compare Mode</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>{labelA}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>{fmt(totA)}</div>
                </div>
                <div style={{ fontSize: 18, color: "#9ca3af" }}>→</div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>{labelB}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#06b6d4" }}>{fmt(totB)}</div>
                </div>
                {pct !== null && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: isUp ? "#d1fae5" : "#fee2e2", color: isUp ? "#065f46" : "#991b1b", fontSize: 12, fontWeight: 700 }}>
                        <Icon size={12} /> {Math.abs(pct)}%
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RevenueBreakDown({
    onRevenueAdded,
    selectedQuarter,
    compareMode,
    compareQuarter,
    customStartDate,
    customEndDate,
}) {
    const [activeTab, setActiveTab] = useState("overview");
    const [allRevenues, setAllRevenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [revSources, setRevSources] = useState([]);
    const [bankAccts, setBankAccts] = useState([]);

    const fetchRevenues = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const { data } = await api.get("/api/revenue/get-all");
            setAllRevenues(data?.revenue ?? []);
        } catch (err) {
            setError(err?.response?.data?.message ?? "Failed to load revenue");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchRevenues();
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/revenue/get-revenue-source").then(({ data }) => setRevSources(data?.revenueSource ?? [])).catch(() => { });
        api.get("/api/bank/get-bank-accounts").then(({ data }) => setBankAccts(data?.bankAccounts ?? [])).catch(() => { });
    }, [fetchRevenues]);

    const handleSuccess = useCallback(() => { fetchRevenues(); onRevenueAdded?.(); }, [fetchRevenues, onRevenueAdded]);

    // ── Filtered datasets ──────────────────────────────────────────────────────
    const filteredA = useMemo(
        () => applyFilter(allRevenues, selectedQuarter, customStartDate, customEndDate),
        [allRevenues, selectedQuarter, customStartDate, customEndDate],
    );
    const filteredB = useMemo(
        () => applyFilter(allRevenues, compareQuarter, customStartDate, customEndDate),
        [allRevenues, compareQuarter, customStartDate, customEndDate],
    );

    // displayRevenues is always filteredA (primary period); compare uses filteredB via compareTrend/totalsB
    const displayRevenues = filteredA;
    const { incomeStreams, monthlyTrend, payerSplit, recentTxns, topTenants, totals } = useMemo(
        () => transform(displayRevenues), [displayRevenues],
    );
    const totalsB = useMemo(
        () => compareMode ? transform(filteredB).totals : null, [compareMode, filteredB],
    );
    const compareTrend = useMemo(
        () => compareMode ? buildCompareTrend(filteredA, filteredB) : [],
        [compareMode, filteredA, filteredB],
    );

    // ── Period label ───────────────────────────────────────────────────────────
    const periodLabel = selectedQuarter === "custom"
        ? `${customStartDate} → ${customEndDate}`
        : selectedQuarter ? QUARTER_LABELS[selectedQuarter] ?? `Q${selectedQuarter}` : "All Periods";

    const exportCSV = () => {
        const rows = [["Payer", "Source", "Ref Type", "Payer Type", "Amount (₹)", "Date", "Status"],
        ...recentTxns.map((t) => [t.payer, t.source, t.refType, t.payerType, t.amount, t.date, t.status])];
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" })),
            download: `revenue_${new Date().toISOString().split("T")[0]}.csv`,
        });
        a.click();
    };

    return (
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

            {/* Compact sub-header — no standalone h1, page title comes from AccountingPage */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>
                        {periodLabel}
                    </p>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                        {loading ? "Loading…" : `${totals.txnCount} transactions · ${fmt(totals.totalRevenue)}`}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={fetchRevenues} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer" }}>
                        <RefreshCw size={15} color="#6b7280" style={{ display: "block", animation: loading ? "spin 1s linear infinite" : "none" }} />
                    </button>
                    <button onClick={exportCSV} style={{ fontSize: 13, padding: "9px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#374151", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => setDialogOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        <PlusIcon size={16} /> Add Revenue
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#991b1b", fontSize: 13, marginBottom: 16 }}>
                    ⚠ {error} — <button onClick={fetchRevenues} style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>Retry</button>
                </div>
            )}

            {/* Compare banner */}
            {compareMode && !loading && (
                <CompareBanner
                    totA={totals.totalRevenue}
                    totB={totalsB?.totalRevenue ?? 0}
                    quarterA={selectedQuarter}
                    quarterB={compareQuarter}
                />
            )}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                {loading ? [...Array(4)].map((_, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px" }}><SkeletonRow /><SkeletonRow /></div>
                )) : <>
                    <KPICard label="Total Revenue" value={fmt(totals.totalRevenue)} sub={`${totals.txnCount} transactions`} color="#10b981" />
                    <KPICard label="Revenue Streams" value={incomeStreams.length} sub="Active sources" color="#6366f1" />
                    <KPICard label="Top Source" value={incomeStreams[0]?.name ?? "—"} sub={incomeStreams[0] ? fmt(incomeStreams[0].amount) : ""} color="#f59e0b" />
                    <KPICard label="Tenant Share" value={`${payerSplit.find((p) => p.name === "Tenant")?.value ?? 0}%`} sub="of total revenue" color="#06b6d4" />
                </>}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
                {["overview", "transactions", "tenants"].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeTab === tab ? "#fff" : "transparent", color: activeTab === tab ? "#111827" : "#6b7280", boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                        {tab[0].toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* ── Overview ── */}
            {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Card>
                        <SectionTitle>{compareMode ? `Revenue Trend: ${QUARTER_LABELS[selectedQuarter] ?? "All"} vs ${QUARTER_LABELS[compareQuarter] ?? "All"}` : `Revenue Trend · ${periodLabel}`}</SectionTitle>
                        {loading ? <SkeletonRow /> : (compareMode ? compareTrend : monthlyTrend).length === 0 ? <EmptyState msg="No trend data for this period." /> : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={compareMode ? compareTrend : monthlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="rgA" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="rgB" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.18} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey={compareMode ? "label" : "month"} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip content={<Tip />} />
                                    {compareMode ? (
                                        <>
                                            <Area type="monotone" dataKey="revenueA" name={`Period A (${QUARTER_LABELS[selectedQuarter] ?? "All"})`} stroke="#10b981" strokeWidth={2} fill="url(#rgA)" dot={{ r: 3, fill: "#10b981" }} />
                                            <Area type="monotone" dataKey="revenueB" name={`Period B (${QUARTER_LABELS[compareQuarter] ?? "All"})`} stroke="#06b6d4" strokeWidth={2} fill="url(#rgB)" dot={{ r: 3, fill: "#06b6d4" }} />
                                        </>
                                    ) : (
                                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#rgA)" dot={{ r: 4, fill: "#10b981" }} />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
                        <Card>
                            <SectionTitle>Revenue by Source</SectionTitle>
                            {loading ? <SkeletonRow /> : incomeStreams.length === 0 ? <EmptyState /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={Math.max(100, incomeStreams.length * 38)}>
                                        <BarChart data={incomeStreams} layout="vertical" margin={{ left: 0, right: 16 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                            <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} tickLine={false} axisLine={false} width={90} />
                                            <Tooltip content={<Tip />} />
                                            <Bar dataKey="amount" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                                                {incomeStreams.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                        {incomeStreams.map((s, i) => (
                                            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{s.name}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(s.amount)}</span>
                                                    </div>
                                                    <div style={{ height: 5, background: "#f3f4f6", borderRadius: 4 }}>
                                                        <div style={{ height: "100%", width: `${s.percent}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length], borderRadius: 4 }} />
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 36, textAlign: "right" }}>{s.percent}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>

                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <Card>
                                <SectionTitle>Payer Split</SectionTitle>
                                {loading ? <SkeletonRow /> : payerSplit.length === 0 ? <EmptyState /> : (
                                    <ResponsiveContainer width="100%" height={140}>
                                        <PieChart>
                                            <Pie data={payerSplit} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value"
                                                label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                                                {payerSplit.map((p, i) => <Cell key={i} fill={p.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </Card>
                            <Card>
                                <SectionTitle>Quick Stats</SectionTitle>
                                {[
                                    { label: "Transactions", val: totals.txnCount },
                                    { label: "Avg / Transaction", val: totals.txnCount ? fmt(Math.round(totals.totalRevenue / totals.txnCount)) : "—" },
                                    { label: "Recorded", val: displayRevenues.filter((r) => r.status === "RECORDED").length },
                                    { label: "Synced", val: displayRevenues.filter((r) => r.status === "SYNCED").length },
                                ].map((s) => (
                                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.val}</span>
                                    </div>
                                ))}
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transactions ── */}
            {activeTab === "transactions" && (
                <Card>
                    <SectionTitle>Transactions · {periodLabel} (latest {recentTxns.length})</SectionTitle>
                    {loading ? <SkeletonRow /> : recentTxns.length === 0 ? <EmptyState msg="No transactions for this period." /> : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                                        {["Payer", "Source", "Ref Type", "Type", "Amount", "Date", "Status"].map((h) => (
                                            <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTxns.map((t, i) => (
                                        <tr key={t.id} style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 500 }}>{t.payer}</td>
                                            <td style={{ padding: "10px 12px", color: "#6b7280" }}>{t.source}</td>
                                            <td style={{ padding: "10px 12px" }}><span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>{t.refType}</span></td>
                                            <td style={{ padding: "10px 12px" }}><TypeBadge t={t.payerType} /></td>
                                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#059669" }}>{fmt(t.amount)}</td>
                                            <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{t.date}</td>
                                            <td style={{ padding: "10px 12px" }}><StatusBadge s={t.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* ── Tenants ── */}
            {activeTab === "tenants" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Card>
                        <SectionTitle>Top Tenant Contributors · {periodLabel}</SectionTitle>
                        {loading ? <SkeletonRow /> : topTenants.length === 0 ? <EmptyState msg="No tenant revenue for this period." /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {topTenants.map((t, i) => (
                                    <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: ["#d1fae5", "#dbeafe", "#ede9fe", "#fef3c7", "#fce7f3"][i % 5], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ["#065f46", "#1e3a8a", "#4c1d95", "#78350f", "#9d174d"][i % 5] }}>
                                            {t.name[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>{t.name}</div>
                                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.source}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(t.amount)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                    <Card>
                        <SectionTitle>Payer Breakdown</SectionTitle>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                            {payerSplit.map((p) => (
                                <div key={p.name} style={{ background: p.name === "Tenant" ? "#d1fae5" : "#dbeafe", borderRadius: 10, padding: "16px 18px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: p.name === "Tenant" ? "#065f46" : "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.name}</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{p.value}%</div>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>of total revenue</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            <AddRevenueDialog open={dialogOpen} onOpenChange={setDialogOpen} tenants={tenants} revenueSource={revSources} bankAccounts={bankAccts} onSuccess={handleSuccess} />
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
    );
}