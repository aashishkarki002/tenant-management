/**
 * ExpenseBreakDown.jsx
 *
 * ARCHITECTURE: Dumb display component.
 * - Fetches pre-aggregated data via useExpenseSummary()
 * - Zero business logic, zero paisa conversion, zero filtering
 * - All numbers arrive from the backend ready to render
 *
 * STYLE: Inline styles replaced with Tailwind utility classes.
 * style={} retained only for: dynamic/computed values, chart config,
 * SVG props, and CSS custom property references.
 */

import { useState, useEffect } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusIcon, Download, RefreshCw, ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { usePagination } from "../hooks/usePagination";
import { useExpenseSummary, useBankAccounts } from "../hooks/useAccounting";
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

const EXP_PALETTE = [C.red, C.amber, C.violet, C.blue, "#D97706", C.teal, "#BE185D", C.forestLight];
const REF_CFG = {
    MANUAL: { bg: C.alt, color: C.muted },
    MAINTENANCE: { bg: C.red + "18", color: C.red },
    UTILITY: { bg: C.blue + "18", color: C.blue },
    SALARY: { bg: C.violet + "18", color: C.violet },
    RENT: { bg: C.amber + "18", color: C.amber },
    VENDOR: { bg: C.teal + "18", color: C.teal },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtK = (v) => {
    const a = Math.abs(v);
    return a >= 100000 ? `${(a / 100000).toFixed(1)}L` : a >= 1000 ? `${(a / 1000).toFixed(0)}K` : String(a);
};

const Q_LABELS = {
    1: "Q1 · Shrawan–Ashwin", 2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra", 4: "Q4 · Baishakh–Ashadh",
};

// ─── Keyframes injected once ──────────────────────────────────────────────────
const S = `
  @keyframes ex-up   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ex-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes ex-pulse{ 0%,100%{opacity:.45} 50%{opacity:.85} }
  .ex { font-family:'DM Sans',system-ui,sans-serif; }
  .ex-serif { font-family:'Instrument Serif',Georgia,serif; }
  .ex-card  { animation:ex-up .3s ease both; }
`;

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Card({ children, style = {}, delay = 0 }) {
    return (
        <div
            className="ex-card rounded-2xl border"
            style={{ background: C.surface, borderColor: C.border, padding: "18px 20px", animationDelay: `${delay * 0.05}s`, ...style }}
        >
            {children}
        </div>
    );
}

function Dark({ children, style = {}, delay = 0 }) {
    return (
        <div
            className="ex-card rounded-2xl"
            style={{ background: C.forest, padding: "18px 20px", animationDelay: `${delay * 0.05}s`, ...style }}
        >
            {children}
        </div>
    );
}

function Lbl({ children, light, style = {} }) {
    return (
        <div
            className="text-[10px] font-bold tracking-[0.1em] uppercase mb-2"
            style={{ color: light ? "rgba(255,255,255,.45)" : C.muted, ...style }}
        >
            {children}
        </div>
    );
}

function Num({ v, size = 32, color = C.text }) {
    return (
        <div className="ex-serif leading-none" style={{ fontSize: size, color, letterSpacing: "-0.02em" }}>
            ₹{Number(Math.abs(v)).toLocaleString("en-IN")}
        </div>
    );
}

function Delta({ up, label }) {
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: up ? "#DCFCE7" : "#FEE2E2", color: up ? C.positive : C.negative }}
        >
            {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}{label}
        </span>
    );
}

function Bar2({ value, max, color = C.red, h = 5 }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="flex-1 overflow-hidden" style={{ height: h, borderRadius: h / 2, background: C.border }}>
            <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: h / 2, transition: "width .5s" }} />
        </div>
    );
}

function Sk({ h = 14 }) {
    return <div className="rounded-md mb-1.5" style={{ height: h, background: C.alt, animation: "ex-pulse 1.5s infinite" }} />;
}

function None({ msg = "No data for this period" }) {
    return <div className="py-8 text-center text-[13px]" style={{ color: C.muted }}>{msg}</div>;
}

function Tip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl p-3.5" style={{ background: C.forest, boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,.4)" }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} className="flex items-center gap-2 text-xs text-white mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.fill ?? p.color ?? p.stroke }} />
                    <span style={{ opacity: 0.6 }}>{p.name}</span>
                    <span className="font-bold ml-auto">₹{Math.abs(p.value || 0).toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

function SPill({ s }) {
    const cfg = { RECORDED: [C.amberBg, C.amber], SYNCED: ["#D1FAE5", C.positive], REVERSED: [C.redBg, C.red] };
    const [bg, color] = cfg[s] ?? [C.alt, C.muted];
    return <span className="rounded text-[10px] font-bold px-2 py-0.5" style={{ background: bg, color }}>{s}</span>;
}

function RPill({ t }) {
    const c = REF_CFG[t] ?? { bg: C.alt, color: C.muted };
    return <span className="rounded text-[10px] font-bold px-2 py-0.5" style={{ background: c.bg, color: c.color }}>{t}</span>;
}

function PPill({ t }) {
    return (
        <span
            className="rounded text-[10px] font-bold px-2 py-0.5"
            style={{ background: t === "EXTERNAL" ? C.redBg : C.amberBg, color: t === "EXTERNAL" ? C.red : C.amber }}
        >
            {t}
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExpenseBreakDown({
    onExpenseAdded,
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
    const [expSources, setExpSources] = useState([]);
    const { bankAccounts } = useBankAccounts();

    const { data: D, loading, error, refetch } = useExpenseSummary(
        selectedQuarter,
        selectedQuarter === "custom" ? customStartDate : "",
        selectedQuarter === "custom" ? customEndDate : "",
    );

    const { data: DB, loading: loadingB } = useExpenseSummary(
        compareMode ? compareQuarter : null, "", "",
    );

    useEffect(() => {
        if (openDialog) { setDialogOpen(true); onDialogOpenHandled?.(); }
    }, [openDialog]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/expense/get-expense-sources").then(({ data }) => setExpSources(data?.expenseSources ?? [])).catch(() => { });
    }, []);

    const onSuccess = () => { refetch(); onExpenseAdded?.(); };

    const periodLabel =
        selectedQuarter === "custom" ? `${customStartDate} → ${customEndDate}`
            : selectedQuarter ? Q_LABELS[Number(selectedQuarter)] ?? "All"
                : "All Periods";

    const exportCSV = () => {
        if (!D) return;
        const rows = [
            ["Source", "Ref", "Payee", "Amount", "Date", "Status", "Notes"],
            ...D.transactions.map(t => [t.source, t.refType, t.payeeType, t.amount, t.bsDate, t.status, `"${t.notes}"`]),
        ];
        const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `expenses_${Date.now()}.csv` }).click();
    };

    const TABS = ["overview", "transactions", "analysis"];
    const totals = D?.totals ?? { total: 0, count: 0, avg: 0, momPct: null };
    const categories = D?.categories ?? [];
    const trend = D?.trend ?? [];
    const payeeSplit = D?.payeeSplit ?? [];
    const refTypes = D?.refTypes ?? [];
    const operatingAmt = D?.operatingAmt ?? 0;
    const nonOpAmt = D?.nonOpAmt ?? 0;
    const statusMap = D?.statusMap ?? {};
    const transactions = D?.transactions ?? [];

    return (
        <div className="ex" style={{ color: C.text }}>
            <style>{S}</style>

            {/* ── Header ──────────────────────────────────────────────────────────── */}
            <div className="flex justify-between items-center mb-[18px] flex-wrap gap-3">
                <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-0.5" style={{ color: C.muted }}>{periodLabel}</div>
                    <div className="text-[13px]" style={{ color: C.mid }}>
                        {loading ? "Loading…" : `${totals.count} transactions · ${fmt(totals.total)}`}
                    </div>
                </div>
                <div className={`flex gap-2 ${isMobile ? "flex-wrap w-full" : "flex-nowrap"}`}>
                    <button
                        onClick={refetch}
                        className="flex items-center rounded-[9px] border cursor-pointer"
                        style={{ padding: isMobile ? "10px 12px" : "8px 10px", borderColor: C.border, background: C.surface, minHeight: isMobile ? 44 : undefined }}
                    >
                        <RefreshCw size={14} color={C.mid} style={{ animation: loading ? "ex-spin 1s linear infinite" : "none" }} />
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 rounded-[9px] border text-xs font-semibold cursor-pointer"
                        style={{ padding: isMobile ? "10px 16px" : "8px 14px", borderColor: C.border, background: C.surface, color: C.mid, minHeight: isMobile ? 44 : undefined }}
                    >
                        <Download size={13} />{isMobile ? "" : "CSV"}
                    </button>
                    <button
                        onClick={() => setDialogOpen(true)}
                        className="flex items-center gap-1.5 rounded-[9px] border-none text-[13px] font-bold cursor-pointer text-white"
                        style={{ padding: isMobile ? "10px 16px" : "8px 16px", background: C.red, flex: isMobile ? 1 : undefined, justifyContent: isMobile ? "center" : undefined, minHeight: isMobile ? 44 : undefined }}
                    >
                        <PlusIcon size={14} />Add Expense
                    </button>
                </div>
            </div>

            {/* ── Error ──────────────────────────────────────────────────────────── */}
            {error && (
                <div className="rounded-xl px-4 py-3 text-[13px] mb-4" style={{ background: C.redBg, border: `1px solid ${C.red}30`, color: C.red }}>
                    ⚠ {error} — <button onClick={refetch} className="bg-transparent border-none cursor-pointer font-bold underline" style={{ color: C.red }}>Retry</button>
                </div>
            )}

            {/* ── Compare banner ──────────────────────────────────────────────────── */}
            {compareMode && !loading && !loadingB && DB && (
                <div className="rounded-2xl px-[18px] py-[13px] flex items-center justify-between flex-wrap gap-3 mb-[18px]" style={{ background: C.red + "0E", border: `1px solid ${C.red}28` }}>
                    <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: C.red }}>Compare Mode</span>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-center">
                            <div className="text-[10px] font-bold uppercase mb-0.5" style={{ color: C.muted }}>{periodLabel}</div>
                            <div className="ex-serif text-xl" style={{ color: C.red }}>{fmt(totals.total)}</div>
                        </div>
                        <div className="text-lg" style={{ color: C.muted }}>→</div>
                        <div className="text-center">
                            <div className="text-[10px] font-bold uppercase mb-0.5" style={{ color: C.muted }}>
                                {compareQuarter ? Q_LABELS[compareQuarter] : "Compare"}
                            </div>
                            <div className="ex-serif text-xl" style={{ color: C.amber }}>{fmt(DB.totals.total)}</div>
                        </div>
                        {totals.total > 0 && (
                            <Delta
                                up={(DB.totals.total - totals.total) <= 0}
                                label={`${Math.abs(((DB.totals.total - totals.total) / totals.total) * 100).toFixed(1)}%`}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ── Hero KPI strip ──────────────────────────────────────────────────── */}
            <div className={`grid gap-3.5 mb-[18px] ${isMobile ? "grid-cols-1" : "grid-cols-[220px_repeat(4,1fr)]"}`}>
                <Dark delay={0}>
                    <Lbl light>Total Expenses</Lbl>
                    <Num v={totals.total} size={38} color="#fff" />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {totals.momPct !== null && (
                            <Delta up={(totals.momPct ?? 0) <= 0} label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% MoM`} />
                        )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {[{ l: "Transactions", v: totals.count }, { l: "Categories", v: categories.length }].map(x => (
                            <div key={x.l}>
                                <div className="text-[10px] mb-0.5" style={{ color: "rgba(255,255,255,.38)" }}>{x.l}</div>
                                <div className="text-base font-bold text-white">{x.v}</div>
                            </div>
                        ))}
                    </div>
                </Dark>

                {[
                    { label: "Avg Ticket", val: fmt(totals.avg), sub: "per transaction", grad: `${C.red},#FCA5A5` },
                    { label: "Top Category", val: categories[0]?.name ?? "—", sub: categories[0] ? fmt(categories[0].amount) : "No data", grad: `${C.amber},#FCD34D` },
                    { label: "Operating Cost", val: fmt(operatingAmt), sub: "Salary · Utility · Maintenance", grad: `${C.violet},#C4B5FD` },
                    { label: "Non-Operating", val: fmt(nonOpAmt), sub: "Vendor · Manual · Other", grad: `${C.blue},#93C5FD` },
                ].map((k, i) => (
                    <Card key={k.label} delay={i + 1} style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ height: 3, background: `linear-gradient(90deg,${k.grad})`, borderRadius: "16px 16px 0 0" }} />
                        <div className="px-[18px] py-3.5">
                            <Lbl>{k.label}</Lbl>
                            <div className="ex-serif text-2xl leading-none mb-1" style={{ color: C.text }}>{k.val}</div>
                            <div className="text-[11px]" style={{ color: C.muted }}>{k.sub}</div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* ── Tab nav ─────────────────────────────────────────────────────────── */}
            <div
                className={`flex gap-1 rounded-xl p-1 mb-[18px] ${isMobile ? "w-full overflow-x-auto" : "w-fit"}`}
                style={{ background: C.alt }}
            >
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="rounded-[9px] border-none cursor-pointer text-[13px] font-semibold transition-all whitespace-nowrap"
                        style={{
                            padding: isMobile ? "9px 16px" : "7px 18px",
                            background: tab === t ? C.forest : "transparent",
                            color: tab === t ? "#fff" : C.mid,
                            flex: isMobile ? 1 : undefined,
                            minHeight: isMobile ? 44 : undefined,
                        }}
                    >
                        {t[0].toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ OVERVIEW ═════════════════════════════════════════ */}
            {tab === "overview" && (
                <div className="flex flex-col gap-4">
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[1fr_250px]"}`}>
                        <Card delay={5}>
                            <div className="flex justify-between items-start mb-3.5">
                                <div>
                                    <Lbl style={{ marginBottom: 2 }}>Expense Trend</Lbl>
                                    <div className="text-[11px]" style={{ color: C.muted }}>{periodLabel} · Nepali calendar</div>
                                </div>
                                {totals.momPct !== null && <Delta up={(totals.momPct ?? 0) <= 0} label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% last month`} />}
                            </div>
                            {loading ? <Sk h={200} /> : trend.length === 0 ? <None msg="No monthly data — add expenses with Nepali dates" /> : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="ex-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={C.red} stopOpacity={0.2} />
                                                <stop offset="100%" stopColor={C.red} stopOpacity={0.01} />
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
                            <Lbl>By Category</Lbl>
                            {loading ? <Sk h={130} /> : categories.length === 0 ? <None /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={130}>
                                        <PieChart>
                                            <Pie data={categories} dataKey="pct" cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3}>
                                                {categories.map((_, i) => <Cell key={i} fill={EXP_PALETTE[i % EXP_PALETTE.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-col gap-2.5 mt-1">
                                        {categories.map((c, i) => (
                                            <div key={c.code ?? i} className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EXP_PALETTE[i % EXP_PALETTE.length] }} />
                                                <span className="text-xs flex-1" style={{ color: C.mid }}>{c.name}</span>
                                                <span className="text-xs font-bold" style={{ color: C.text }}>{c.pct}%</span>
                                                <span className="text-[11px]" style={{ color: C.muted }}>{fmt(c.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>

                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[2fr_1fr_1fr]"}`}>
                        <Card delay={7}>
                            <Lbl>Payee Split</Lbl>
                            {loading ? <><Sk /><Sk /></> : payeeSplit.length === 0 ? <None /> : (
                                <>
                                    <div className="grid gap-x-2.5 pb-2 border-b" style={{ gridTemplateColumns: "1fr 1fr 68px", borderColor: C.border }}>
                                        {["Payee", "Share", "Amount"].map(h => (
                                            <span key={h} className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: C.muted }}>{h}</span>
                                        ))}
                                    </div>
                                    {payeeSplit.map((p, i) => (
                                        <div key={p.name} className="grid items-center py-2.5 border-b" style={{ gridTemplateColumns: "1fr 1fr 68px", gap: "0 10px", borderColor: C.border + "40" }}>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EXP_PALETTE[i] }} />
                                                <div className="text-[13px] font-semibold" style={{ color: C.text }}>{p.name}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Bar2 value={p.amount} max={totals.total} color={EXP_PALETTE[i]} />
                                                <span className="text-[10px] min-w-[24px]" style={{ color: C.muted }}>{p.pct}%</span>
                                            </div>
                                            <div className="text-[13px] font-bold text-right" style={{ color: C.text }}>₹{fmtK(p.amount)}</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </Card>

                        <Card delay={8}>
                            <Lbl>By Reference Type</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : refTypes.length === 0 ? <None /> : (
                                <div className="flex flex-col gap-3">
                                    {refTypes.map(r => (
                                        <div key={r.type}>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <RPill t={r.type} />
                                                <div className="text-right">
                                                    <div className="text-xs font-bold" style={{ color: C.text }}>{fmt(r.amount)}</div>
                                                    <div className="text-[10px]" style={{ color: C.muted }}>{r.count} txns · {r.pct}%</div>
                                                </div>
                                            </div>
                                            <Bar2 value={r.amount} max={totals.total} color={REF_CFG[r.type]?.color ?? C.red} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card delay={9}>
                            <Lbl>Stats & Status</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : (
                                <>
                                    {[
                                        { l: "Transactions", v: totals.count },
                                        { l: "Avg / Txn", v: fmt(totals.avg) },
                                        { l: "Categories", v: categories.length },
                                        { l: "Top Cat %", v: categories[0] ? `${categories[0].pct}%` : "—" },
                                        { l: "External Txns", v: transactions.filter(t => t.payeeType === "EXTERNAL").length },
                                    ].map(s => (
                                        <div key={s.l} className="flex justify-between items-center py-2 border-b" style={{ borderColor: C.border }}>
                                            <span className="text-xs" style={{ color: C.muted }}>{s.l}</span>
                                            <span className="text-[13px] font-bold" style={{ color: C.text }}>{s.v}</span>
                                        </div>
                                    ))}
                                    <div className="mt-3.5">
                                        <Lbl style={{ marginBottom: 8 }}>Status</Lbl>
                                        <div className="flex flex-col gap-1.5">
                                            {Object.entries(statusMap).map(([s, n]) => (
                                                <div key={s} className="flex justify-between items-center">
                                                    <SPill s={s} />
                                                    <span className="text-[13px] font-bold" style={{ color: C.text }}>{n}</span>
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

            {/* ═══════════════════ TRANSACTIONS ════════════════════════════════════ */}
            {tab === "transactions" && (() => {
                const TXN_PAGE_SIZE = 20;
                const { paginatedItems: pageTxns, currentPage, totalPages, nextPage, prevPage, startIndex } = usePagination(transactions, TXN_PAGE_SIZE);
                return (
                    <Card delay={0} style={{ padding: 0 }}>
                        <div className="px-5 py-4 flex justify-between items-center border-b" style={{ borderColor: C.border }}>
                            <div>
                                <div className="text-sm font-bold" style={{ color: C.text }}>All Transactions</div>
                                <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{transactions.length} total · {periodLabel}</div>
                            </div>
                            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border text-xs font-semibold cursor-pointer" style={{ borderColor: C.border, background: C.surface, color: C.mid }}>
                                <Download size={13} />Export CSV
                            </button>
                        </div>
                        {loading ? <div className="p-5"><Sk /><Sk /><Sk /></div> : transactions.length === 0 ? <None msg="No transactions for this period" /> : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                                {["#", "Source", "Ref", "Payee", "Amount", "Date", "Status", "Notes"].map(h => (
                                                    <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: C.muted }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageTxns.map((t, i) => (
                                                <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}50`, background: i % 2 === 0 ? C.surface : C.alt + "70" }}>
                                                    <td className="px-3.5 py-2.5 text-xs" style={{ color: C.muted }}>{startIndex + i + 1}</td>
                                                    <td className="px-3.5 py-2.5 font-semibold text-[13px]" style={{ color: C.text }}>{t.source}</td>
                                                    <td className="px-3.5 py-2.5"><RPill t={t.refType} /></td>
                                                    <td className="px-3.5 py-2.5"><PPill t={t.payeeType} /></td>
                                                    <td className="px-3.5 py-2.5 font-bold text-[13px]" style={{ color: C.negative }}>−{fmt(t.amount)}</td>
                                                    <td className="px-3.5 py-2.5 text-xs" style={{ color: C.muted }}>{t.bsDate}</td>
                                                    <td className="px-3.5 py-2.5"><SPill s={t.status} /></td>
                                                    <td className="px-3.5 py-2.5 text-xs max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: C.muted }}>{t.notes || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                                        <span className="text-xs" style={{ color: C.muted }}>
                                            Showing {startIndex + 1}–{Math.min(startIndex + TXN_PAGE_SIZE, transactions.length)} of {transactions.length}
                                        </span>
                                        <div className="flex gap-1.5">
                                            <button onClick={prevPage} disabled={currentPage === 1} className="px-3 py-1 rounded-lg border text-xs font-semibold" style={{ borderColor: C.border, background: C.surface, color: currentPage === 1 ? C.muted : C.text, cursor: currentPage === 1 ? "default" : "pointer" }}>← Prev</button>
                                            <span className="px-3 py-1 text-xs" style={{ color: C.muted }}>{currentPage} / {totalPages}</span>
                                            <button onClick={nextPage} disabled={currentPage === totalPages} className="px-3 py-1 rounded-lg border text-xs font-semibold" style={{ borderColor: C.border, background: C.surface, color: currentPage === totalPages ? C.muted : C.text, cursor: currentPage === totalPages ? "default" : "pointer" }}>Next →</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                );
            })()}

            {/* ═══════════════════ ANALYSIS ════════════════════════════════════════ */}
            {tab === "analysis" && (
                <div className="flex flex-col gap-4">
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                        <Card delay={0}>
                            <Lbl>Operating vs Non-Operating</Lbl>
                            {loading ? <Sk h={160} /> : (
                                <>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {[
                                            { l: "Operating", v: operatingAmt, note: "Salary · Utility · Maintenance", color: C.violet, bg: C.violetBg },
                                            { l: "Non-Operating", v: nonOpAmt, note: "Vendor · Manual · Other", color: C.blue, bg: C.blueBg },
                                        ].map(x => (
                                            <div key={x.l} className="rounded-xl px-4 py-3.5" style={{ background: x.bg }}>
                                                <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1.5" style={{ color: x.color }}>{x.l}</div>
                                                <Num v={x.v} size={22} color={C.text} />
                                                <div className="mt-2"><Bar2 value={x.v} max={totals.total} color={x.color} h={5} /></div>
                                                <div className="text-[11px] mt-1.5" style={{ color: C.muted }}>
                                                    {totals.total > 0 ? ((x.v / totals.total) * 100).toFixed(1) : 0}% of total · {x.note}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <div className="text-[11px] mb-1.5" style={{ color: C.muted }}>Spending mix</div>
                                        <div className="h-2.5 rounded-full overflow-hidden flex gap-px">
                                            <div style={{ width: `${totals.total > 0 ? (operatingAmt / totals.total) * 100 : 0}%`, background: C.violet, transition: "width .6s" }} />
                                            <div style={{ width: `${totals.total > 0 ? (nonOpAmt / totals.total) * 100 : 0}%`, background: C.blue, transition: "width .6s" }} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card delay={1}>
                            <div className="flex justify-between items-start mb-3.5">
                                <Lbl style={{ marginBottom: 0 }}>Month-by-Month Spend</Lbl>
                                {totals.momPct !== null && <Delta up={(totals.momPct ?? 0) <= 0} label={`${(totals.momPct ?? 0) >= 0 ? "+" : ""}${(totals.momPct ?? 0).toFixed(1)}% MoM`} />}
                            </div>
                            {loading ? <Sk h={180} /> : trend.length === 0 ? <None /> : (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} />
                                        <Tooltip content={<Tip />} />
                                        <Bar dataKey="expenses" name="Expenses" radius={[4, 4, 0, 0]} maxBarSize={38}>
                                            {trend.map((_, i) => <Cell key={i} fill={i === trend.length - 1 ? C.red : C.red + "70"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </div>

                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[1fr_1.2fr]"}`}>
                        <Card delay={2}>
                            <Lbl>Category Concentration</Lbl>
                            {loading ? <Sk h={140} /> : categories.length === 0 ? <None /> : (
                                <>
                                    <div className="flex h-[22px] rounded overflow-hidden gap-px mb-3">
                                        {categories.map((c, i) => (
                                            <div key={c.code ?? i} title={`${c.name}: ${c.pct}%`}
                                                style={{ width: `${c.pct}%`, background: EXP_PALETTE[i % EXP_PALETTE.length], display: c.pct < 0.5 ? "none" : "block" }} />
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3.5">
                                        {categories.map((c, i) => (
                                            <div key={c.code ?? i} className="flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ background: EXP_PALETTE[i % EXP_PALETTE.length] }} />
                                                <span className="text-[10px]" style={{ color: C.muted }}>{c.name} <b style={{ color: C.text }}>{c.pct}%</b></span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-xl px-3.5 py-3" style={{ background: (categories[0]?.pct ?? 0) > 60 ? C.redBg : (categories[0]?.pct ?? 0) > 40 ? C.amberBg : "#F0FDF4" }}>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: (categories[0]?.pct ?? 0) > 60 ? C.red : (categories[0]?.pct ?? 0) > 40 ? C.amber : C.positive }}>
                                            {(categories[0]?.pct ?? 0) > 60 ? "High concentration" : (categories[0]?.pct ?? 0) > 40 ? "Moderate concentration" : "Diversified spend"}
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: C.mid }}>"{categories[0]?.name}" drives {categories[0]?.pct ?? 0}% of expenses</div>
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card delay={3}>
                            <Lbl>Top Expense Sources — Ranked</Lbl>
                            {loading ? <><Sk /><Sk /><Sk /></> : categories.length === 0 ? <None /> : (
                                <div className="flex flex-col gap-2">
                                    {categories.slice(0, 7).map((c, i) => (
                                        <div key={c.code ?? i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: C.alt }}>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                                                style={{ background: EXP_PALETTE[i % EXP_PALETTE.length] + "20", color: EXP_PALETTE[i % EXP_PALETTE.length] }}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[13px] font-semibold" style={{ color: C.text }}>{c.name}</span>
                                                    <span className="text-[13px] font-bold" style={{ color: C.text }}>{fmt(c.amount)}</span>
                                                </div>
                                                <Bar2 value={c.amount} max={categories[0].amount} color={EXP_PALETTE[i % EXP_PALETTE.length]} h={4} />
                                                <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{c.count} txns · {c.pct}% of total</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            <AddExpenseDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                tenants={tenants}
                expenseSources={expSources}
                bankAccounts={bankAccounts}
                onSuccess={onSuccess}
            />
        </div>
    );
}