import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from "recharts";
import api from "../plugins/axios";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const COLORS = {
    bg: "#070d1a",
    surface: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.07)",
    gold: "#f0b429",
    goldDim: "rgba(240,180,41,0.15)",
    red: "#e55353",
    green: "#22c55e",
    blue: "#60a5fa",
    purple: "#a78bfa",
    slate: "#94a3b8",
    muted: "#475569",
};

const ACCOUNT_TYPE_COLORS = {
    ASSET: "#22c55e",
    LIABILITY: "#e55353",
    REVENUE: "#f0b429",
    EXPENSE: "#a78bfa",
    EQUITY: "#60a5fa",
};

const fmt = (v) =>
    new Intl.NumberFormat("ne-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);
const fmtRs = (v) => `Rs. ${fmt(v)}`;

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiGet(path, params = {}) {
    const res = await api.get(`/api${path}`, { params });
    return res.data;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Pill({ label, active, onClick, color = COLORS.gold }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "7px 18px",
                borderRadius: 99,
                border: `1px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
                background: active ? `${color}18` : "transparent",
                color: active ? color : COLORS.slate,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.04em",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.18s",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
    );
}

function Kpi({ label, value, sub, color = COLORS.gold, icon }) {
    return (
        <div style={{
            background: COLORS.surface,
            border: `1px solid ${color}30`,
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 4,
        }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.15 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: COLORS.muted }}>{sub}</div>}
        </div>
    );
}

function Section({ title, children, right }) {
    return (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "13px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</span>
                {right}
            </div>
            <div style={{ padding: 20 }}>{children}</div>
        </div>
    );
}

// ─── CORRECTED ACCOUNT CODES (matching your accounts.js) ───────────────────
// 1200 = Accounts Receivable
// 4000 = Rental Income
// 4100 = Utility Revenue          ← NOT late fees
// 4200 = Late Fee Revenue         ← this is the correct late fee code

function BalanceHealthChart({ accounts }) {
    if (!accounts?.length) return null;

    // Match by code first, fall back to name — be explicit about each account
    const ar = accounts.find(a => a.accountCode === "1200");
    const rev = accounts.find(a => a.accountCode === "4000");
    const utility = accounts.find(a => a.accountCode === "4100");
    const lateFee = accounts.find(a => a.accountCode === "4200"); // ← was 4100, WRONG

    const arDebit = ar?.totalDebit ?? 0;
    const revCredit = rev?.totalCredit ?? 0;
    const utilityCredit = utility?.totalCredit ?? 0;
    const lateCredit = lateFee?.totalCredit ?? 0;
    const totalRevCredit = revCredit + utilityCredit + lateCredit;

    const diff = Math.abs(arDebit - totalRevCredit);
    // Industry note: ratio will be < 100% once payments come in (Dr Cash / Cr AR)
    // A ratio of 100% only holds at the moment of billing, before collection.
    // A ratio < 100% means some AR has been collected (good), not an error.
    // A ratio > 100% means AR was debited without matching revenue (bad).
    const balanced = arDebit <= totalRevCredit; // AR collected or equal — healthy
    const ratio = totalRevCredit > 0 ? (arDebit / totalRevCredit) : 0;

    const isOverBilled = arDebit > totalRevCredit + 1; // AR > Revenue = problem

    return (
        <div>
            {/* Health badge */}
            <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px",
                borderRadius: 99,
                background: isOverBilled ? "rgba(229,83,83,0.12)" : "rgba(34,197,94,0.12)",
                border: `1px solid ${isOverBilled ? COLORS.red : COLORS.green}40`,
                color: isOverBilled ? COLORS.red : COLORS.green,
                fontSize: 12, fontWeight: 700, marginBottom: 8,
            }}>
                <span>{isOverBilled ? "⚠" : "✓"}</span>
                {isOverBilled
                    ? `AR exceeds Revenue by ${fmtRs(diff)} — unbacked receivable`
                    : ratio < 1
                        ? `AR ${fmtRs(diff)} collected — ratio healthy`
                        : "AR = Revenue — billing matches"
                }
            </div>

            {/* Industry note */}
            <div style={{
                fontSize: 10, color: COLORS.muted,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid rgba(255,255,255,0.06)`,
                borderRadius: 8, padding: "7px 10px", marginBottom: 14,
                lineHeight: 1.6,
            }}>
                <span style={{ color: COLORS.gold, fontWeight: 700 }}>ℹ Industry standard: </span>
                AR Debit = Revenue Credit only at billing time. After tenant pays, AR credit clears
                the receivable (Dr Cash / Cr AR), so ratio drops below 100% — that means
                collection is happening, not an error. Ratio &gt; 100% = overbilled, needs review.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                        Accounts Receivable (1200) — Debit
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.blue, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmtRs(arDebit)}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>{ar?.entryCount ?? 0} billing entries</div>
                </div>
                <div style={{ background: "rgba(240,180,41,0.07)", border: "1px solid rgba(240,180,41,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                        Revenue Credits (4000 + 4100 + 4200)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.gold, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmtRs(totalRevCredit)}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                        Rent {fmtRs(revCredit)} · Utility {fmtRs(utilityCredit)} · Late {fmtRs(lateCredit)}
                    </div>
                </div>
            </div>

            {/* Ratio bar */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: COLORS.muted }}>
                    <span>AR/Revenue ratio</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: isOverBilled ? COLORS.red : COLORS.green }}>
                        {(ratio * 100).toFixed(1)}%
                    </span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                        height: "100%",
                        width: `${Math.min(ratio * 100, 100)}%`,
                        background: isOverBilled
                            ? `linear-gradient(90deg, ${COLORS.red}, #f87171)`
                            : `linear-gradient(90deg, ${COLORS.green}, #86efac)`,
                        borderRadius: 99,
                        transition: "width 0.6s ease",
                    }} />
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 5 }}>
                    &lt;100% = AR collected (healthy) · =100% = unbilled balance · &gt;100% = over-billed (review)
                </div>
            </div>
        </div>
    );
}

function AccountBarChart({ accounts }) {
    if (!accounts?.length) return null;
    const data = accounts.map(a => ({
        code: a.accountCode,
        name: a.accountName?.split(" ")[0] ?? a.accountCode,
        debit: a.totalDebit,
        credit: a.totalCredit,
        type: a.accountType,
    })).slice(0, 10);

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: "#0f1929", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                <div style={{ color: COLORS.gold, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                {payload.map(p => (
                    <div key={p.name} style={{ color: p.color }}>{p.name}: {fmtRs(p.value)}</div>
                ))}
            </div>
        );
    };

    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="code" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="debit" name="Debit" fill={COLORS.red} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Bar dataKey="credit" name="Credit" fill={COLORS.green} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function AccountTypePie({ accounts }) {
    if (!accounts?.length) return null;

    const byType = accounts.reduce((acc, a) => {
        const t = a.accountType;
        if (!acc[t]) acc[t] = { name: t, value: 0, entries: 0 };
        acc[t].value += Math.abs(a.netBalance);
        acc[t].entries += a.entryCount;
        return acc;
    }, {});

    const data = Object.values(byType).filter(d => d.value > 0);

    const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return percent > 0.05 ? (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        ) : null;
    };

    return (
        <ResponsiveContainer width="100%" height={200}>
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    dataKey="value" labelLine={false} label={<CustomLabel />}>
                    {data.map((d, i) => <Cell key={d.name} fill={ACCOUNT_TYPE_COLORS[d.name] ?? "#64748b"} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtRs(v)} contentStyle={{ background: "#0f1929", border: `1px solid ${COLORS.border}`, borderRadius: 10 }} />
                <Legend formatter={(v) => <span style={{ color: COLORS.slate, fontSize: 11 }}>{v}</span>} />
            </PieChart>
        </ResponsiveContainer>
    );
}

function LedgerTable({ entries, loading }) {
    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                    height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 8,
                    animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 100}ms`
                }} />
            ))}
        </div>
    );

    if (!entries?.length) return (
        <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.muted, fontSize: 13 }}>No entries for this entity</div>
    );

    const cols = ["BS Date", "English", "Account", "Description", "Debit", "Credit", "Running Bal"];
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                    <tr>
                        {cols.map(c => (
                            <th key={c} style={{
                                padding: "8px 12px",
                                background: "rgba(255,255,255,0.03)",
                                color: COLORS.muted, fontWeight: 700, fontSize: 10,
                                letterSpacing: "0.07em", textTransform: "uppercase",
                                textAlign: ["Debit", "Credit", "Running Bal"].includes(c) ? "right" : "left",
                                borderBottom: `1px solid ${COLORS.border}`,
                                whiteSpace: "nowrap",
                            }}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e, i) => {
                        const isDebit = (e.debit ?? 0) > 0;
                        return (
                            <tr key={e._id}
                                style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}
                                onMouseEnter={ev => ev.currentTarget.style.background = "rgba(240,180,41,0.04)"}
                                onMouseLeave={ev => ev.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"}
                            >
                                <td style={{ padding: "9px 12px", color: COLORS.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    {e.nepaliDate ?? `${e.nepaliYear ?? "?"}-${String(e.nepaliMonth ?? "?").padStart(2, "0")}`}
                                </td>
                                <td style={{ padding: "9px 12px", color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    {e.date ? new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                </td>
                                <td style={{ padding: "9px 12px", borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>{e.account?.name ?? "—"}</div>
                                    <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace" }}>{e.account?.code}</div>
                                </td>
                                <td style={{ padding: "9px 12px", color: COLORS.muted, borderBottom: `1px solid rgba(255,255,255,0.04)`, maxWidth: 240 }}>
                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.description}>{e.description}</div>
                                    {e.tenant && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1 }}>👤 {e.tenant.name}</div>}
                                </td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: isDebit ? COLORS.red : COLORS.muted, fontFamily: "'JetBrains Mono', monospace", fontWeight: isDebit ? 600 : 400, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    {(e.debit ?? 0) > 0 ? fmtRs(e.debit) : "—"}
                                </td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: !isDebit ? COLORS.green : COLORS.muted, fontFamily: "'JetBrains Mono', monospace", fontWeight: !isDebit ? 600 : 400, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    {(e.credit ?? 0) > 0 ? fmtRs(e.credit) : "—"}
                                </td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: (e.runningBalance ?? 0) >= 0 ? COLORS.blue : COLORS.red, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                                    {fmtRs(e.runningBalance ?? 0)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LedgerTestUI() {
    // Entity state
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [entityError, setEntityError] = useState(null);

    // Manual entity input
    const [manualId, setManualId] = useState("");
    const [manualName, setManualName] = useState("");

    // Data
    const [ledgerData, setLedgerData] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // View
    const [activeView, setActiveView] = useState("charts"); // charts | entries

    const abortRef = useRef(null);

    // Fetch entities on mount
    useEffect(() => {
        apiGet("/ownership")
            .then(res => {
                const list = res.data ?? res.entities ?? res ?? [];
                if (Array.isArray(list) && list.length) {
                    setEntities(list);
                    setSelectedEntity(list[0]);
                }
            })
            .catch(() => {
                setEntityError("Could not auto-load entities — use manual input below");
            });
    }, []);

    const fetchLedger = useCallback(async (entity) => {
        if (!entity) return;
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);
        try {
            const params = { entityId: entity._id ?? entity.id };
            const [lRes, sRes] = await Promise.all([
                apiGet("/ledger/get-ledger", params),
                apiGet("/ledger/get-ledger-summary", params),
            ]);
            setLedgerData(lRes.data);
            setSummaryData(sRes.data);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedEntity) fetchLedger(selectedEntity);
    }, [selectedEntity]);

    const handleManualLoad = () => {
        if (!manualId.trim()) return;
        const e = { _id: manualId.trim(), name: manualName.trim() || manualId.trim() };
        setEntities(prev => {
            const exists = prev.find(x => (x._id ?? x.id) === e._id);
            return exists ? prev : [...prev, e];
        });
        setSelectedEntity(e);
    };

    const summary = ledgerData?.summary;
    const accounts = summaryData?.accounts ?? [];

    return (
        <div style={{
            minHeight: "100vh",
            background: COLORS.bg,
            color: "#e2e8f0",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            padding: "0 0 80px",
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(240,180,41,0.3); border-radius: 99px; }
        select option { background: #0f1929; }
      `}</style>

            {/* ── Header ── */}
            <div style={{
                background: "rgba(7,13,26,0.9)",
                backdropFilter: "blur(16px)",
                borderBottom: `1px solid ${COLORS.border}`,
                padding: "16px 28px",
                position: "sticky", top: 0, zIndex: 30,
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: "linear-gradient(135deg, #f0b429, #d97706)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, boxShadow: "0 4px 14px rgba(240,180,41,0.3)",
                    }}>🔬</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>Ledger Test Inspector</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>EasyManage · Double-Entry Verification</div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill label="📊 Charts" active={activeView === "charts"} onClick={() => setActiveView("charts")} />
                    <Pill label="📋 Entries" active={activeView === "entries"} onClick={() => setActiveView("entries")} />
                    <button
                        onClick={() => selectedEntity && fetchLedger(selectedEntity)}
                        disabled={loading}
                        style={{
                            padding: "7px 16px", borderRadius: 99,
                            border: `1px solid ${COLORS.gold}50`,
                            background: `${COLORS.gold}12`, color: COLORS.gold,
                            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? "⟳ Loading…" : "⟳ Refresh"}
                    </button>
                </div>
            </div>

            <div style={{ padding: "24px 28px", animation: "fadeUp 0.35s ease both" }}>

                {/* ── Entity Toggle ── */}
                <Section title="Ownership Entity" right={
                    <span style={{ fontSize: 10, color: COLORS.muted }}>{entities.length} loaded</span>
                }>
                    {/* Auto-loaded pills */}
                    {entities.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                            {entities.map(e => {
                                const id = e._id ?? e.id;
                                const selId = selectedEntity?._id ?? selectedEntity?.id;
                                return (
                                    <Pill
                                        key={id}
                                        label={e.name ?? e.entityName ?? id}
                                        active={selId === id}
                                        onClick={() => setSelectedEntity(e)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {entityError && (
                        <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)" }}>
                            ⚠ {entityError}
                        </div>
                    )}

                    {/* Manual ID input */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Entity ObjectId</label>
                            <input
                                value={manualId}
                                onChange={e => setManualId(e.target.value)}
                                placeholder="6841abc123..."
                                style={{
                                    background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                                    borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontSize: 12,
                                    outline: "none", fontFamily: "'JetBrains Mono', monospace", width: 260,
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Label (optional)</label>
                            <input
                                value={manualName}
                                onChange={e => setManualName(e.target.value)}
                                placeholder="Entity name…"
                                style={{
                                    background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                                    borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontSize: 12,
                                    outline: "none", fontFamily: "inherit", width: 180,
                                }}
                            />
                        </div>
                        <button
                            onClick={handleManualLoad}
                            style={{
                                padding: "7px 18px", borderRadius: 8,
                                background: "linear-gradient(135deg, #f0b429, #d97706)",
                                color: "#070d1a", border: "none",
                                fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                            }}
                        >
                            Load Entity
                        </button>
                    </div>
                </Section>

                {/* ── Error ── */}
                {error && (
                    <div style={{
                        background: "rgba(229,83,83,0.1)", border: "1px solid rgba(229,83,83,0.3)",
                        borderRadius: 12, padding: "11px 16px", color: COLORS.red, marginBottom: 20, fontSize: 13,
                    }}>
                        ⚠ {error}
                    </div>
                )}

                {/* ── KPI Strip ── */}
                {summary && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                        <Kpi icon="📤" label="Total Debit" value={fmtRs(summary.totalDebit)} color={COLORS.red} sub={`${summary.totalEntries} entries`} />
                        <Kpi icon="📥" label="Total Credit" value={fmtRs(summary.totalCredit)} color={COLORS.green} />
                        <Kpi icon="⚖️" label="Net Balance" value={fmtRs(Math.abs(summary.netBalance))}
                            color={summary.netBalance === 0 ? COLORS.green : COLORS.gold}
                            sub={summary.netBalance === 0 ? "✓ Balanced" : summary.netBalance > 0 ? "Net Debit" : "Net Credit"} />
                        <Kpi icon="📚" label="Accounts" value={accounts.length} color={COLORS.purple} sub="with activity" />
                    </div>
                )}

                {/* Double-entry sanity check */}
                {summary && (
                    <div style={{ marginBottom: 20, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Double-Entry Sanity</div>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                            {(() => {
                                const d = summary.totalDebit;
                                const c = summary.totalCredit;
                                const diff = Math.abs(d - c);
                                const ok = diff < 0.01;
                                return (
                                    <>
                                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.slate }}>
                                            <span style={{ color: COLORS.red }}>{fmtRs(d)}</span>
                                            <span style={{ color: COLORS.muted }}> DR = </span>
                                            <span style={{ color: COLORS.green }}>{fmtRs(c)}</span>
                                            <span style={{ color: COLORS.muted }}> CR</span>
                                        </div>
                                        <div style={{
                                            display: "inline-flex", alignItems: "center", gap: 6,
                                            padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                                            background: ok ? "rgba(34,197,94,0.12)" : "rgba(229,83,83,0.12)",
                                            border: `1px solid ${ok ? COLORS.green : COLORS.red}40`,
                                            color: ok ? COLORS.green : COLORS.red,
                                        }}>
                                            {ok ? "✓ Books balance" : `⚠ Δ ${fmtRs(diff)}`}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* ── Charts View ── */}
                {activeView === "charts" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <Section title="AR ↔ Revenue Balance Check">
                            <BalanceHealthChart accounts={accounts} />
                        </Section>

                        <Section title="Account Type Mix">
                            <AccountTypePie accounts={accounts} />
                        </Section>

                        <Section title="Debit vs Credit by Account" right={<span style={{ fontSize: 10, color: COLORS.muted }}>Top 10</span>}>
                            <AccountBarChart accounts={accounts} />
                        </Section>

                        <Section title="Account Balances">
                            {accounts.length === 0 && !loading ? (
                                <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No data</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {accounts.map(a => {
                                        const maxVal = Math.max(...accounts.map(x => Math.max(x.totalDebit, x.totalCredit)));
                                        const debitPct = maxVal > 0 ? (a.totalDebit / maxVal) * 100 : 0;
                                        const creditPct = maxVal > 0 ? (a.totalCredit / maxVal) * 100 : 0;
                                        return (
                                            <div key={a.accountCode}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10 }}>
                                                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                                                        <span style={{ color: ACCOUNT_TYPE_COLORS[a.accountType] ?? COLORS.muted, marginRight: 6, fontSize: 9 }}>●</span>
                                                        {a.accountCode} · {a.accountName}
                                                    </span>
                                                    <span style={{ color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace" }}>{a.entryCount} tx</span>
                                                </div>
                                                <div style={{ display: "flex", gap: 3, height: 6 }}>
                                                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${debitPct}%`, background: COLORS.red, borderRadius: 3, transition: "width 0.5s ease" }} />
                                                    </div>
                                                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${creditPct}%`, background: COLORS.green, borderRadius: 3, transition: "width 0.5s ease" }} />
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                                                    <span style={{ color: COLORS.red }}>DR {fmtRs(a.totalDebit)}</span>
                                                    <span style={{ color: COLORS.green }}>CR {fmtRs(a.totalCredit)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Section>
                    </div>
                )}

                {/* ── Entries View ── */}
                {activeView === "entries" && (
                    <Section
                        title={`Journal Entries${selectedEntity ? ` — ${selectedEntity.name ?? selectedEntity._id}` : ""}`}
                        right={summary && <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace" }}>{summary.totalEntries} rows</span>}
                    >
                        <LedgerTable entries={ledgerData?.entries} loading={loading} />
                    </Section>
                )}
            </div>
        </div>
    );
}