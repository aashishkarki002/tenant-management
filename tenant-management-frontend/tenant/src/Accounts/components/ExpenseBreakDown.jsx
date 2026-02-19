import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import api from "../../../plugins/axios";

// ─── Constants ────────────────────────────────────────────────────────────────
const NEPALI_MONTHS = ["Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const SOURCE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#d97706", "#dc2626", "#b45309", "#c2410c"];
const REF_TYPE_CFG = {
    MANUAL: { bg: "#f3f4f6", color: "#374151" },
    MAINTENANCE: { bg: "#fce7f3", color: "#9d174d" },
    UTILITY: { bg: "#dbeafe", color: "#1e40af" },
    SALARY: { bg: "#ede9fe", color: "#5b21b6" },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = (v) => v >= 100_000 ? `${(v / 100_000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v;
const toRs = (p) => (p ?? 0) / 100;  // paisa → rupees

// ─── Transform raw API data ───────────────────────────────────────────────────
function transformExpenses(expenses = []) {
    if (!expenses.length) return { bySource: [], byMonth: [], payeeSplit: [], byRefType: [], recentTxns: [], topPayees: [], totals: { total: 0, txnCount: 0 } };

    // By source: group on source._id
    const srcMap = {};
    expenses.forEach((e) => {
        const key = e.source?._id ?? e.source ?? "unknown";
        const name = e.source?.name ?? "Unknown";
        const amt = toRs(e.amountPaisa);
        if (!srcMap[key]) srcMap[key] = { key, name, code: e.source?.code ?? "?", amount: 0, count: 0 };
        srcMap[key].amount += amt;
        srcMap[key].count++;
    });
    const bySource = Object.values(srcMap).sort((a, b) => b.amount - a.amount);
    const totalAmt = bySource.reduce((s, x) => s + x.amount, 0);
    bySource.forEach((s) => { s.percent = totalAmt ? +((s.amount / totalAmt) * 100).toFixed(1) : 0; });

    // Monthly trend: group by nepaliYear-nepaliMonth
    const monthMap = {};
    expenses.forEach((e) => {
        if (!e.nepaliYear || !e.nepaliMonth) return;
        const key = `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}`;
        if (!monthMap[key]) monthMap[key] = { key, month: NEPALI_MONTHS[(e.nepaliMonth ?? 1) - 1], expenses: 0 };
        monthMap[key].expenses += toRs(e.amountPaisa);
    });
    const byMonth = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);

    // Payee split
    let externalAmt = 0, tenantAmt = 0;
    expenses.forEach((e) => {
        e.payeeType === "EXTERNAL" ? (externalAmt += toRs(e.amountPaisa)) : (tenantAmt += toRs(e.amountPaisa));
    });
    const payeeSplit = [
        { name: "External", value: totalAmt ? +((externalAmt / totalAmt) * 100).toFixed(0) : 0, color: "#ef4444" },
        { name: "Tenant", value: totalAmt ? +((tenantAmt / totalAmt) * 100).toFixed(0) : 0, color: "#f97316" },
    ].filter((p) => p.value > 0);

    // By reference type
    const refMap = {};
    expenses.forEach((e) => {
        const t = e.referenceType ?? "MANUAL";
        if (!refMap[t]) refMap[t] = { type: t, count: 0, amount: 0 };
        refMap[t].count++;
        refMap[t].amount += toRs(e.amountPaisa);
    });
    const byRefType = Object.values(refMap).sort((a, b) => b.amount - a.amount);

    // Recent 10 transactions
    const recentTxns = [...expenses]
        .sort((a, b) => new Date(b.EnglishDate ?? b.createdAt) - new Date(a.EnglishDate ?? a.createdAt))
        .slice(0, 10)
        .map((e) => ({
            id: e._id,
            source: e.source?.name ?? "—",
            refType: e.referenceType ?? "MANUAL",
            payeeType: e.payeeType,
            amount: toRs(e.amountPaisa),
            // Show nepali date if available, otherwise English
            date: e.nepaliYear
                ? `${e.nepaliYear}-${String(e.nepaliMonth).padStart(2, "0")}`
                : (e.EnglishDate ? new Date(e.EnglishDate).toLocaleDateString("en-IN") : "—"),
            status: e.status ?? "RECORDED",
            notes: e.notes ?? "",
        }));

    // Top payees: group by source (expense has no payee name for EXTERNAL — use source as proxy)
    // For TENANT expenses we can group by tenant if populated
    const payeeMap = {};
    expenses.forEach((e) => {
        const key = e.source?._id ?? "other";
        const name = e.source?.name ?? "Other";
        if (!payeeMap[key]) payeeMap[key] = { name, category: e.source?.code ?? "—", amount: 0, txns: 0 };
        payeeMap[key].amount += toRs(e.amountPaisa);
        payeeMap[key].txns++;
    });
    const topPayees = Object.values(payeeMap).sort((a, b) => b.amount - a.amount).slice(0, 5);

    return { bySource, byMonth, payeeSplit, byRefType, recentTxns, topPayees, totals: { total: totalAmt, txnCount: expenses.length } };
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
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
function RefBadge({ t }) {
    const cfg = REF_TYPE_CFG[t] ?? { bg: "#f3f4f6", color: "#374151" };
    return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>{t}</span>;
}
function PayeeBadge({ t }) {
    return <span style={{ background: t === "TENANT" ? "#fce7f3" : "#f3f4f6", color: t === "TENANT" ? "#9d174d" : "#374151", borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>{t}</span>;
}
function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</div>
            {payload.map((p) => <div key={p.dataKey} style={{ color: p.color || p.fill || p.stroke, marginBottom: 2 }}>{p.name}: <b>{fmt(p.value)}</b></div>)}
        </div>
    );
}
function SkeletonRow() {
    return <div style={{ height: 16, background: "#f3f4f6", borderRadius: 6, marginBottom: 10, animation: "pulse 1.5s infinite" }} />;
}
function EmptyState({ msg = "No data yet" }) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{msg}</div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExpenseBreakDown({ onExpenseAdded }) {
    const [activeTab, setActiveTab] = useState("overview");
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [expSources, setExpSources] = useState([]);

    const fetchExpenses = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const { data } = await api.get("/api/expense/get-all");
            // Controller returns: { success, expenses: [...] }
            setExpenses(data?.expenses ?? []);
        } catch (err) {
            setError(err?.response?.data?.message ?? "Failed to load expense data");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchExpenses();
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/expense/get-expense-sources").then(({ data }) => setExpSources(data?.expenseSources ?? [])).catch(() => { });
    }, [fetchExpenses]);

    const handleSuccess = useCallback(() => { fetchExpenses(); onExpenseAdded?.(); }, [fetchExpenses, onExpenseAdded]);

    const { bySource, byMonth, payeeSplit, byRefType, recentTxns, topPayees, totals } = useMemo(
        () => transformExpenses(expenses), [expenses],
    );

    const exportCSV = () => {
        const rows = [["Source", "Ref Type", "Payee Type", "Amount (₹)", "Date (BS)", "Status", "Notes"],
        ...recentTxns.map((t) => [t.source, t.refType, t.payeeType, t.amount, t.date, t.status, t.notes])];
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" })),
            download: `expenses_${new Date().toISOString().split("T")[0]}.csv`,
        });
        a.click();
    };

    return (
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f9fafb", minHeight: "100vh", padding: "28px 32px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Accounting · Expense</div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>Expense Overview</h1>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{loading ? "Loading…" : `${totals.txnCount} transactions`}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={fetchExpenses} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer" }}>
                        <RefreshCw size={15} color="#6b7280" style={{ display: "block", animation: loading ? "spin 1s linear infinite" : "none" }} />
                    </button>
                    <button onClick={exportCSV} style={{ fontSize: 13, padding: "9px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#374151", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => setDialogOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        <PlusIcon size={16} /> Add Expense
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#991b1b", fontSize: 13, marginBottom: 20 }}>
                    ⚠ {error} — <button onClick={fetchExpenses} style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>Retry</button>
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {loading ? [...Array(4)].map((_, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px" }}><SkeletonRow /><SkeletonRow /></div>
                )) : <>
                    <KPICard label="Total Expenses" value={fmt(totals.total)} sub={`${totals.txnCount} transactions`} color="#ef4444" />
                    <KPICard label="Expense Sources" value={bySource.length} sub="Active categories" color="#f97316" />
                    <KPICard label="Largest Category" value={bySource[0]?.name ?? "—"} sub={bySource[0] ? fmt(bySource[0].amount) : ""} color="#8b5cf6" />
                    <KPICard label="External Share" value={`${payeeSplit.find((p) => p.name === "External")?.value ?? 0}%`} sub="of total spend" color="#06b6d4" />
                </>}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
                {["overview", "transactions", "payees"].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeTab === tab ? "#fff" : "transparent", color: activeTab === tab ? "#111827" : "#6b7280", boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                        {tab[0].toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* ── Overview ── */}
            {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Card>
                        <SectionTitle>Expense Trend (Nepali Calendar)</SectionTitle>
                        {loading ? <SkeletonRow /> : byMonth.length === 0 ? <EmptyState msg="No monthly data yet — add some expense transactions." /> : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={byMonth} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip content={<Tip />} />
                                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#eg)" dot={{ r: 4, fill: "#ef4444" }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
                        <Card>
                            <SectionTitle>Expenses by Category</SectionTitle>
                            {loading ? <SkeletonRow /> : bySource.length === 0 ? <EmptyState /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={Math.max(100, bySource.length * 38)}>
                                        <BarChart data={bySource} layout="vertical" margin={{ left: 0, right: 16 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                            <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} tickLine={false} axisLine={false} width={90} />
                                            <Tooltip content={<Tip />} />
                                            <Bar dataKey="amount" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                                                {bySource.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                        {bySource.map((s, i) => (
                                            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{s.name}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmt(s.amount)}</span>
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
                                <SectionTitle>Payee Split</SectionTitle>
                                {loading ? <SkeletonRow /> : payeeSplit.length === 0 ? <EmptyState /> : (
                                    <ResponsiveContainer width="100%" height={140}>
                                        <PieChart>
                                            <Pie data={payeeSplit} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value"
                                                label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                                                {payeeSplit.map((p, i) => <Cell key={i} fill={p.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </Card>

                            <Card>
                                <SectionTitle>By Reference Type</SectionTitle>
                                {loading ? <SkeletonRow /> : byRefType.length === 0 ? <EmptyState /> : byRefType.map((r) => (
                                    <div key={r.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <RefBadge t={r.type} />
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmt(r.amount)}</div>
                                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.count} txns</div>
                                        </div>
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
                    <SectionTitle>Recent Transactions (latest {recentTxns.length})</SectionTitle>
                    {loading ? <SkeletonRow /> : recentTxns.length === 0 ? <EmptyState msg="No transactions yet." /> : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                                        {["Source", "Ref Type", "Payee Type", "Amount", "Date (BS)", "Status", "Notes"].map((h) => (
                                            <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTxns.map((t, i) => (
                                        <tr key={t.id} style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 500, color: "#111827" }}>{t.source}</td>
                                            <td style={{ padding: "10px 12px" }}><RefBadge t={t.refType} /></td>
                                            <td style={{ padding: "10px 12px" }}><PayeeBadge t={t.payeeType} /></td>
                                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#ef4444" }}>{fmt(t.amount)}</td>
                                            <td style={{ padding: "10px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{t.date}</td>
                                            <td style={{ padding: "10px 12px" }}><StatusBadge s={t.status} /></td>
                                            <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* ── Payees ── */}
            {activeTab === "payees" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Card>
                        <SectionTitle>Top Expense Sources</SectionTitle>
                        {loading ? <SkeletonRow /> : topPayees.length === 0 ? <EmptyState msg="No data yet." /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {topPayees.map((p, i) => (
                                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: ["#fee2e2", "#fce7f3", "#fef3c7", "#f3f4f6", "#ffedd5"][i % 5], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ["#991b1b", "#9d174d", "#78350f", "#374151", "#7c2d12"][i % 5] }}>
                                            {p.name[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>{p.name}</div>
                                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.category} · {p.txns} transaction{p.txns !== 1 ? "s" : ""}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: "#ef4444" }}>{fmt(p.amount)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <SectionTitle>Expense Classification</SectionTitle>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                            {(() => {
                                // Derive operating vs non-operating from ExpenseSource category if available
                                // Since we don't have that in populated data, group by known operating codes
                                const operatingCodes = ["MAINTENANCE", "UTILITY", "SALARY"];
                                let operatingAmt = 0, nonOperatingAmt = 0;
                                expenses.forEach((e) => {
                                    operatingCodes.includes(e.source?.code) ? (operatingAmt += toRs(e.amountPaisa)) : (nonOperatingAmt += toRs(e.amountPaisa));
                                });
                                return [
                                    { label: "Operating", value: fmt(operatingAmt), note: "Salary, Utility, Maintenance", color: "#ef4444", bg: "#fee2e2" },
                                    { label: "Non-Operating", value: fmt(nonOperatingAmt), note: "Vendor, Other", color: "#f97316", bg: "#ffedd5" },
                                ].map((s) => (
                                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "16px 18px" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 6 }}>{s.value}</div>
                                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.note}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </Card>
                </div>
            )}

            <AddExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} tenants={tenants} expenseSources={expSources} onSuccess={handleSuccess} />

            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
    );
}