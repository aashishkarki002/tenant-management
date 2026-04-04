/**
 * RevenueBreakDown.jsx — Redesigned
 *
 * Design direction: Editorial data-dense financial dashboard.
 * Monochrome base with precise green accent for revenue (positivity / growth).
 * Typography-first hierarchy. No gradients, no glow, no generic AI cards.
 * Matches ExpenseBreakDown system precisely — both components feel unified.
 */

import { useState, useEffect } from "react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, Download, RefreshCw, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import SectionToggle from "./SectionToggle";
import { AddRevenueDialog } from "./AddRevenueDialog";
import { usePagination } from "../hooks/usePagination";
import { useRevenueSummary } from "../hooks/useAccounting";
import { useIsMobile } from "@/hooks/use-mobile";
import api from "../../../plugins/axios";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const T = {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    raised: "var(--color-surface-raised)",
    alt: "var(--color-muted)",
    border: "var(--color-border)",
    text: "var(--color-text-strong)",
    body: "var(--color-text-body)",
    sub: "var(--color-text-sub)",
    weak: "var(--color-text-weak)",
    accent: "var(--color-accent)",
    green: "var(--color-success)",
    greenBg: "var(--color-success-bg)",
    greenBorder: "var(--color-success-border)",
    amber: "var(--color-warning)",
    amberBg: "var(--color-warning-bg)",
    red: "var(--color-danger)",
    redBg: "var(--color-danger-bg)",
    blue: "var(--color-info)",
    blueBg: "var(--color-info-bg)",
    violet: "#5B21B6",
    violetBg: "#EDE9FE",
    teal: "#0E7490",
    tealBg: "#ECFEFF",
};

const PALETTE = [
    "var(--color-info)",
    "#1D4ED8",
    "#6D28D9",
    "#B45309",
    "#0E7490",
    "#BE185D",
    "#D97706",
    "#0891B2",
];

const REF_CFG = {
    RENT: { bg: T.blueBg, color: T.blue },
    PARKING: { bg: "#DBEAFE", color: "#1D4ED8" },
    AD: { bg: T.violetBg, color: T.violet },
    CAM: { bg: T.amberBg, color: T.amber },
    ELECTRICITY: { bg: "#FEF9C3", color: "#A16207" },
    MAINTENANCE: { bg: T.tealBg, color: T.teal },
    MANUAL: { bg: T.alt, color: T.sub },
};

const fmt = (n) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
const fmtK = (v) => {
    const a = Math.abs(v);
    return a >= 100000 ? `${(a / 100000).toFixed(1)}L`
        : a >= 1000 ? `${(a / 1000).toFixed(0)}K`
            : String(a);
};

const Q_LABELS = {
    1: "Q1 · Shrawan–Ashwin", 2: "Q2 · Kartik–Poush",
    3: "Q3 · Magh–Chaitra", 4: "Q4 · Baishakh–Ashadh",
};

const KEYFRAMES = `
  @keyframes rb-up     { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes rb-spin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes rb-shimmer{ 0%,100%{ opacity:.4 } 50%{ opacity:.75 } }
  .rb-root { font-family: 'DM Sans', system-ui, sans-serif; }
  .rb-num  { font-family: 'Instrument Serif', Georgia, serif; letter-spacing: -0.025em; }
  .rb-card { animation: rb-up .28s ease both; }
  .rb-spin { animation: rb-spin .9s linear infinite; }
  .rb-row:hover td { background: var(--color-muted) !important; }
`;

// ─── Primitives ───────────────────────────────────────────────────────────────

function Panel({ children, style = {}, delay = 0, noPad = false }) {
    return (
        <div
            className="rb-card rounded-xl border"
            style={{
                background: T.surface,
                borderColor: T.border,
                padding: noPad ? 0 : "18px 20px",
                animationDelay: `${delay * 0.045}s`,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function InkPanel({ children, style = {}, delay = 0 }) {
    return (
        <div
            className="rb-card rounded-xl"
            style={{
                background: T.accent,
                padding: "18px 20px",
                animationDelay: `${delay * 0.045}s`,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function Label({ children, inverted, className = "", style = {} }) {
    return (
        <div
            className={`text-[10px] font-bold tracking-[0.09em] uppercase mb-2 ${className}`}
            style={{ color: inverted ? "rgba(255,255,255,.4)" : T.sub, ...style }}
        >
            {children}
        </div>
    );
}

function BigNum({ v, size = 36, inverted = false }) {
    return (
        <div
            className="rb-num leading-none"
            style={{ fontSize: size, color: inverted ? "#fff" : T.text }}
        >
            ₹{Number(Math.abs(v)).toLocaleString("en-IN")}
        </div>
    );
}

function Chip({ up, label, size = "sm" }) {
    const pad = size === "sm" ? "1px 7px" : "3px 10px";
    const fs = size === "sm" ? 10 : 12;
    return (
        <span
            className="inline-flex items-center gap-[3px] rounded-sm font-bold"
            style={{
                padding: pad,
                fontSize: fs,
                background: up ? T.greenBg : T.redBg,
                color: up ? T.green : T.red,
            }}
        >
            {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {label}
        </span>
    );
}

function MiniBar({ value, max, color = T.blue, h = 4 }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="w-full overflow-hidden" style={{ height: h, borderRadius: 2, background: T.border }}>
            <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
        </div>
    );
}

function Skeleton({ h = 14 }) {
    return (
        <div
            className="rounded mb-1.5"
            style={{ height: h, background: T.alt, animation: "rb-shimmer 1.6s ease-in-out infinite" }}
        />
    );
}

function Empty({ msg = "No data for this period" }) {
    return (
        <div className="py-10 text-center" style={{ color: T.sub }}>
            <Minus size={20} className="mx-auto mb-2 opacity-30" />
            <div className="text-xs">{msg}</div>
        </div>
    );
}

function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="rounded-lg px-3.5 py-2.5"
            style={{ background: T.text, boxShadow: "0 8px 24px rgba(0,0,0,.22)", minWidth: 140 }}
        >
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-2" style={{ color: "rgba(255,255,255,.38)" }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs text-white">
                    <span style={{ opacity: 0.6 }}>{p.name}</span>
                    <span className="font-bold">₹{Number(Math.abs(p.value || 0)).toLocaleString("en-IN")}</span>
                </div>
            ))}
        </div>
    );
}

function StatusBadge({ s }) {
    const cfgs = {
        RECORDED: { bg: T.amberBg, color: T.amber },
        SYNCED: { bg: T.greenBg, color: T.green },
        REVERSED: { bg: T.redBg, color: T.red },
    };
    const { bg, color } = cfgs[s] ?? { bg: T.alt, color: T.sub };
    return <span className="rounded-sm text-[9px] font-bold px-1.5 py-0.5" style={{ background: bg, color }}>{s}</span>;
}

function RefBadge({ t }) {
    const c = REF_CFG[t] ?? { bg: T.alt, color: T.sub };
    return <span className="rounded-sm text-[9px] font-bold px-1.5 py-0.5" style={{ background: c.bg, color: c.color }}>{t}</span>;
}

function TypeBadge({ t }) {
    return (
        <span
            className="rounded-sm text-[9px] font-bold px-1.5 py-0.5"
            style={{
                background: t === "TENANT" ? T.blueBg : T.amberBg,
                color: t === "TENANT" ? T.blue : T.amber,
            }}
        >
            {t}
        </span>
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function RevenueBreakDown({
    onRevenueAdded,
    selectedQuarter = null,
    selectedMonth = null,
    fiscalYear = null,
    compareMode = false,
    compareQuarter = null,
    customStartDate = "",
    customEndDate = "",
    openDialog = false,
    onDialogOpenHandled,
    entityId = null,
}) {
    const isMobile = useIsMobile();
    const [tab, setTab] = useState("overview");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [sources, setSources] = useState([]);
    const [banks, setBanks] = useState([]);

    const { data: D, loading, error, refetch } = useRevenueSummary(
        selectedQuarter, customStartDate, customEndDate, selectedMonth, fiscalYear, entityId
    );
    const { data: DB, loading: loadingB } = useRevenueSummary(
        compareMode ? compareQuarter : null, "", "", null, fiscalYear, entityId
    );

    useEffect(() => {
        if (openDialog) { setDialogOpen(true); onDialogOpenHandled?.(); }
    }, [openDialog]); // eslint-disable-line

    useEffect(() => {
        api.get("/api/tenant/get-tenants").then(({ data }) => setTenants(data?.tenants ?? [])).catch(() => { });
        api.get("/api/revenue/get-revenue-sources").then(({ data }) => setSources(data?.revenueSources ?? [])).catch(() => { });
        api.get("/api/accounting/get-bank-accounts").then(({ data }) => setBanks(data?.bankAccounts ?? [])).catch(() => { });
    }, []);

    const onSuccess = () => { refetch(); onRevenueAdded?.(); };

    const BS_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
    const periodLabel =
        customStartDate && customEndDate ? `${customStartDate} → ${customEndDate}`
            : selectedMonth ? `${BS_MONTHS[selectedMonth - 1]}${fiscalYear ? ` ${fiscalYear}` : ""}`
                : selectedQuarter ? (Q_LABELS[Number(selectedQuarter)] ?? "All")
                    : fiscalYear ? `FY ${fiscalYear}/${String(fiscalYear + 1).slice(2)}`
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

    const TABS = ["overview", "transactions", "analysis"];
    const totals = D?.totals ?? { total: 0, count: 0, avg: 0, momPct: null };
    const streams = D?.streams ?? [];
    const trend = D?.trend ?? [];
    const tenantSplit = D?.tenantSplit ?? [];
    const refTypes = D?.refTypes ?? [];
    const statusMap = D?.statusMap ?? {};
    const transactions = D?.transactions ?? [];
    const TXN_PAGE_SIZE = 20;
    const { paginatedItems: pageTxns, currentPage, totalPages, nextPage, prevPage, startIndex } = usePagination(transactions, TXN_PAGE_SIZE);

    return (
        <div className="rb-root" style={{ color: T.text }}>
            <style>{KEYFRAMES}</style>

            {/* ── Header ───────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-0.5" style={{ color: T.sub }}>
                        {periodLabel}
                    </div>
                    <div className="text-xs" style={{ color: T.body }}>
                        {loading ? "Loading…" : `${totals.count} transactions · ${fmt(totals.total)}`}
                    </div>
                </div>

                <div className={`flex gap-2 ${isMobile ? "flex-wrap w-full" : ""}`}>
                    <button
                        onClick={refetch}
                        className="flex items-center justify-center rounded-lg border "

                    >
                        <RefreshCw size={13} color={T.body} className={loading ? "rb-spin" : ""} />
                    </button>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 rounded-lg border text-xs font-semibold"
                        style={{ padding: "7px 14px", borderColor: T.border, background: T.surface, color: T.body, cursor: "pointer" }}
                    >
                        <Download size={12} />
                        {isMobile ? "" : "Export"}
                    </button>

                    <button
                        onClick={() => setDialogOpen(true)}
                        className="flex items-center gap-1.5 p-2 rounded-lg text-[13px] font-bold text-white bg-primary hover:bg-primary/80"

                    >
                        <Plus size={13} />
                        Add Revenue
                    </button>
                </div>
            </div>

            {/* ── Error ────────────────────────────────────────────────────────── */}
            {error && (
                <div className="rounded-lg px-4 py-3 text-xs mb-4 flex items-center gap-2"
                    style={{ background: T.redBg, border: `1px solid var(--color-danger-border)`, color: T.red }}>
                    <span>⚠ {error}</span>
                    <button onClick={refetch} className="ml-auto font-bold underline bg-transparent border-none cursor-pointer" style={{ color: T.red }}>
                        Retry
                    </button>
                </div>
            )}

            {/* ── Compare banner ───────────────────────────────────────────────── */}
            {compareMode && !loading && !loadingB && DB && (
                <div className="rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-4 mb-5"
                    style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
                    <div>
                        <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: T.green }}>Compare Mode</div>
                        <div className="text-xs" style={{ color: T.body }}>Period vs period revenue analysis</div>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap">
                        {[
                            { lbl: periodLabel, val: totals.total, color: T.green },
                            { lbl: compareQuarter ? Q_LABELS[compareQuarter] : "Compare", val: DB.totals.total, color: T.blue },
                        ].map(x => (
                            <div key={x.lbl} className="text-right">
                                <div className="text-[9px] font-bold uppercase tracking-[0.08em] mb-0.5" style={{ color: T.sub }}>{x.lbl}</div>
                                <div className="rb-num text-xl" style={{ color: x.color }}>{fmt(x.val)}</div>
                            </div>
                        ))}
                        {totals.total > 0 && (
                            <Chip
                                up={(DB.totals.total - totals.total) >= 0}
                                label={`${Math.abs(((DB.totals.total - totals.total) / totals.total) * 100).toFixed(1)}%`}
                                size="md"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ── Hero KPI strip ───────────────────────────────────────────────── */}
            <div className={`grid gap-3 mb-5 ${isMobile ? "grid-cols-1" : "grid-cols-[200px_repeat(4,1fr)]"}`}>
                <InkPanel delay={0}>
                    <Label inverted>Total Revenue</Label>
                    <BigNum v={totals.total} size={34} inverted />
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {totals.momPct !== null && (
                            <Chip
                                up={(totals.momPct ?? 0) >= 0}
                                label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% MoM`}
                            />
                        )}
                    </div>
                    <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 gap-y-3">
                        {[
                            { l: "Transactions", v: totals.count },
                            { l: "Streams", v: streams.length },
                        ].map(x => (
                            <div key={x.l}>
                                <div className="text-[9px] mb-0.5" style={{ color: "rgba(255,255,255,.32)" }}>{x.l}</div>
                                <div className="text-sm font-bold text-white">{x.v}</div>
                            </div>
                        ))}
                    </div>
                </InkPanel>

                {[
                    {
                        label: "Avg per Transaction",
                        value: fmt(totals.avg),
                        sub: `across ${totals.count} txns`,
                    },
                    {
                        label: "Top Revenue Stream",
                        value: streams[0]?.name ?? "—",
                        sub: streams[0] ? `${fmt(streams[0].amount)} · ${streams[0].pct}% share` : "No data",

                    },
                    {
                        label: "Rent Revenue",
                        value: fmt(streams.find(s => s.code === "RENT")?.amount ?? 0),
                        sub: "Primary collection stream",

                    },
                    {
                        label: "Other Streams",
                        value: fmt(streams.filter(s => s.code !== "RENT").reduce((a, s) => a + s.amount, 0)),
                        sub: "Parking · CAM · Electricity · etc",
                    },
                ].map((k, i) => (
                    <Panel key={k.label} delay={i + 1} noPad>
                        <div />
                        <div className="px-4 py-3.5">
                            <Label>{k.label}</Label>
                            <div className="rb-num text-[22px] leading-tight mb-1" style={{ color: T.text }}>{k.value}</div>
                            <div className="text-[10px]" style={{ color: T.sub }}>{k.sub}</div>
                        </div>
                    </Panel>
                ))}
            </div>

            {/* ── Section toggle ────────────────────────────────────────────── */}
            <div className="mb-5">
                <SectionToggle
                    options={["Overview", "Transactions", "Analysis"]}
                    value={tab}
                    onChange={setTab}
                />
            </div>

            {/* ═══════════════════ OVERVIEW ════════════════════════════════════ */}
            {tab === "overview" && (
                <div className="flex flex-col gap-4">

                    {/* Area chart + Pie */}
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[1fr_260px]"}`}>
                        <Panel delay={5}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <Label style={{ marginBottom: 2 }}>Revenue Trend</Label>
                                    <div className="text-[10px]" style={{ color: T.weak }}>{periodLabel} · Nepali calendar</div>
                                </div>
                                {totals.momPct !== null && (
                                    <Chip
                                        up={(totals.momPct ?? 0) >= 0}
                                        label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% last mo`}
                                    />
                                )}
                            </div>
                            {loading ? <Skeleton h={200} /> : trend.length === 0
                                ? <Empty msg="No monthly data — add revenue with Nepali dates" />
                                : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="rv-fill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={T.green} stopOpacity={0.13} />
                                                    <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.border} />
                                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} width={34} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="revenue"
                                                name="Revenue"
                                                stroke={T.green}
                                                strokeWidth={2}
                                                fill="url(#rv-fill)"
                                                dot={{ r: 2.5, fill: T.green, strokeWidth: 0 }}
                                                activeDot={{ r: 4, strokeWidth: 0 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                        </Panel>

                        <Panel delay={6}>
                            <Label>By Stream</Label>
                            {loading ? <Skeleton h={130} /> : streams.length === 0 ? <Empty /> : (
                                <>
                                    <ResponsiveContainer width="100%" height={120}>
                                        <PieChart>
                                            <Pie
                                                data={streams}
                                                dataKey="pct"
                                                cx="50%" cy="50%"
                                                innerRadius={34} outerRadius={52}
                                                paddingAngle={2}
                                                strokeWidth={0}
                                            >
                                                {streams.map((_, i) => (
                                                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={v => `${v}%`}
                                                contentStyle={{
                                                    borderRadius: 8,
                                                    border: `1px solid ${T.border}`,
                                                    fontSize: 11,
                                                    background: T.surface,
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className="flex flex-col gap-1.5 mt-1">
                                        {streams.map((s, i) => (
                                            <div key={s.code ?? i} className="flex items-center gap-2">
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ background: PALETTE[i % PALETTE.length] }}
                                                />
                                                <span className="text-[11px] flex-1 truncate" style={{ color: T.body }}>{s.name}</span>
                                                <span className="text-[10px] font-bold" style={{ color: T.text }}>{s.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Panel>
                    </div>

                    {/* Tenant split + Ref types + Stats */}
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[2fr_1fr_1fr]"}`}>

                        <Panel delay={7}>
                            <Label>Tenant Distribution</Label>
                            {loading ? <><Skeleton /><Skeleton /></> : tenantSplit.length === 0 ? <Empty /> : (
                                <>
                                    <div
                                        className="grid pb-2 mb-2 border-b"
                                        style={{ gridTemplateColumns: "1fr 1fr 60px", gap: "0 10px", borderColor: T.border }}
                                    >
                                        {["Payer", "Share", "Amount"].map(h => (
                                            <span key={h} className="text-[9px] font-bold tracking-[0.08em] uppercase" style={{ color: T.weak }}>{h}</span>
                                        ))}
                                    </div>
                                    {tenantSplit.map((p, i) => (
                                        <div
                                            key={p.name}
                                            className="grid items-center py-2.5 border-b"
                                            style={{ gridTemplateColumns: "1fr 1fr 60px", gap: "0 10px", borderColor: `${T.border}55` }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ background: PALETTE[i % PALETTE.length] }} />
                                                <span className="text-[12px] font-semibold truncate" style={{ color: T.text }}>{p.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MiniBar value={p.amount} max={totals.total} color={PALETTE[i % PALETTE.length]} />
                                                <span className="text-[10px] flex-shrink-0" style={{ color: T.sub }}>{p.pct}%</span>
                                            </div>
                                            <div className="text-[12px] font-bold text-right" style={{ color: T.text }}>
                                                ₹{fmtK(p.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </Panel>

                        <Panel delay={8}>
                            <Label>By Reference</Label>
                            {loading ? <><Skeleton /><Skeleton /><Skeleton /></> : refTypes.length === 0 ? <Empty /> : (
                                <div className="flex flex-col gap-3.5">
                                    {refTypes.map(r => (
                                        <div key={r.type}>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <RefBadge t={r.type} />
                                                <div className="text-right">
                                                    <div className="text-[12px] font-bold" style={{ color: T.text }}>{fmt(r.amount)}</div>
                                                    <div className="text-[9px]" style={{ color: T.weak }}>{r.count} txns · {r.pct}%</div>
                                                </div>
                                            </div>
                                            <MiniBar value={r.amount} max={totals.total} color={REF_CFG[r.type]?.color ?? T.blue} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>

                        <Panel delay={9}>
                            <Label>Quick Stats</Label>
                            {loading ? <><Skeleton /><Skeleton /><Skeleton /></> : (
                                <>
                                    {[
                                        { l: "Transactions", v: totals.count },
                                        { l: "Avg / Txn", v: fmt(totals.avg) },
                                        { l: "Streams", v: streams.length },
                                        { l: "Top Stream %", v: streams[0] ? `${streams[0].pct}%` : "—" },
                                        { l: "Tenant Payers", v: tenantSplit.length },
                                    ].map(s => (
                                        <div key={s.l} className="flex justify-between items-center py-2 border-b"
                                            style={{ borderColor: `${T.border}66` }}>
                                            <span className="text-[11px]" style={{ color: T.sub }}>{s.l}</span>
                                            <span className="text-[12px] font-bold" style={{ color: T.text }}>{s.v}</span>
                                        </div>
                                    ))}

                                    <div className="mt-4">
                                        <Label style={{ marginBottom: 8 }}>By Status</Label>
                                        <div className="flex flex-col gap-1.5">
                                            {Object.entries(statusMap).map(([s, n]) => (
                                                <div key={s} className="flex justify-between items-center">
                                                    <StatusBadge s={s} />
                                                    <span className="text-[12px] font-bold" style={{ color: T.text }}>{n}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </Panel>
                    </div>
                </div>
            )}

            {/* ═══════════════════ TRANSACTIONS ════════════════════════════════ */}
            {tab === "transactions" && (
                <Panel delay={0} noPad>
                    <div
                        className="px-5 py-3.5 flex justify-between items-center border-b"
                        style={{ borderColor: T.border }}
                    >
                        <div>
                            <div className="text-[13px] font-bold" style={{ color: T.text }}>All Transactions</div>
                            <div className="text-[10px] mt-0.5" style={{ color: T.sub }}>
                                {transactions.length} total · {periodLabel}
                            </div>
                        </div>
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer"
                            style={{ borderColor: T.border, background: T.surface, color: T.body }}
                        >
                            <Download size={11} /> Export CSV
                        </button>
                    </div>

                    {loading
                        ? <div className="p-5"><Skeleton /><Skeleton /><Skeleton /></div>
                        : transactions.length === 0
                            ? <Empty msg="No transactions for this period" />
                            : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr style={{ background: T.bg }}>
                                                    {["#", "Payer", "Source", "Ref", "Type", "Amount", "Date", "Status"].map(h => (
                                                        <th key={h} className="text-left px-3.5 py-2.5 text-[9px] font-bold tracking-[0.08em] uppercase border-b"
                                                            style={{ color: T.weak, borderColor: T.border }}>
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageTxns.map((t, i) => (
                                                    <tr
                                                        key={t.id}
                                                        className="rb-row transition-colors"
                                                        style={{ borderBottom: `1px solid ${T.border}44` }}
                                                    >
                                                        <td className="px-3.5 py-2.5 text-[10px]" style={{ color: T.weak }}>{startIndex + i + 1}</td>
                                                        <td className="px-3.5 py-2.5 text-[12px] font-semibold" style={{ color: T.text }}>{t.payer}</td>
                                                        <td className="px-3.5 py-2.5 text-[12px]" style={{ color: T.body }}>{t.source}</td>
                                                        <td className="px-3.5 py-2.5"><RefBadge t={t.refType} /></td>
                                                        <td className="px-3.5 py-2.5"><TypeBadge t={t.payerType} /></td>
                                                        <td className="px-3.5 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: T.green }}>
                                                            {fmt(t.amount)}
                                                        </td>
                                                        <td className="px-3.5 py-2.5 text-[10px] tabular-nums" style={{ color: T.sub }}>{t.bsDate}</td>
                                                        <td className="px-3.5 py-2.5"><StatusBadge s={t.status} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: T.border }}>
                                            <span className="text-[10px]" style={{ color: T.sub }}>
                                                {startIndex + 1}–{Math.min(startIndex + TXN_PAGE_SIZE, transactions.length)} of {transactions.length}
                                            </span>
                                            <div className="flex gap-1">
                                                {[["← Prev", prevPage, currentPage === 1], ["Next →", nextPage, currentPage === totalPages]].map(([label, fn, disabled]) => (
                                                    <button
                                                        key={label}
                                                        onClick={fn}
                                                        disabled={disabled}
                                                        className="px-3 py-1 rounded-md border text-[11px] font-semibold"
                                                        style={{
                                                            borderColor: T.border,
                                                            background: T.surface,
                                                            color: disabled ? T.weak : T.text,
                                                            cursor: disabled ? "default" : "pointer",
                                                            opacity: disabled ? 0.45 : 1,
                                                        }}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                </Panel>
            )}

            {/* ═══════════════════ ANALYSIS ════════════════════════════════════ */}
            {tab === "analysis" && (
                <div className="flex flex-col gap-4">
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>

                        {/* Concentration Risk */}
                        <Panel delay={0}>
                            <Label>Revenue Concentration Risk</Label>
                            {loading ? <><Skeleton /><Skeleton /></> : streams.length === 0 ? <Empty /> : (
                                <>
                                    <div className="flex h-5 rounded overflow-hidden gap-px mb-3">
                                        {streams.map((s, i) => (
                                            <div
                                                key={s.code ?? i}
                                                title={`${s.name}: ${s.pct}%`}
                                                style={{
                                                    width: `${s.pct}%`,
                                                    background: PALETTE[i % PALETTE.length],
                                                    display: s.pct < 1 ? "none" : "block",
                                                }}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-4">
                                        {streams.map((s, i) => (
                                            <div key={s.code ?? i} className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-sm inline-block"
                                                    style={{ background: PALETTE[i % PALETTE.length] }} />
                                                <span className="text-[9px]" style={{ color: T.sub }}>
                                                    {s.name} <b style={{ color: T.text }}>{s.pct}%</b>
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        className="rounded-lg px-3.5 py-2.5"
                                        style={{
                                            background:
                                                (streams[0]?.pct ?? 0) > 60 ? T.redBg
                                                    : (streams[0]?.pct ?? 0) > 40 ? T.amberBg
                                                        : T.greenBg,
                                        }}
                                    >
                                        <div
                                            className="text-[10px] font-bold uppercase tracking-[0.07em]"
                                            style={{
                                                color:
                                                    (streams[0]?.pct ?? 0) > 60 ? T.red
                                                        : (streams[0]?.pct ?? 0) > 40 ? T.amber
                                                            : T.green,
                                            }}
                                        >
                                            {(streams[0]?.pct ?? 0) > 60 ? "High concentration risk"
                                                : (streams[0]?.pct ?? 0) > 40 ? "Moderate concentration"
                                                    : "Well diversified"}
                                        </div>
                                        <div className="text-[10px] mt-0.5" style={{ color: T.body }}>
                                            Top source accounts for {streams[0]?.pct ?? 0}% of revenue
                                        </div>
                                    </div>
                                </>
                            )}
                        </Panel>

                        {/* MoM Bar */}
                        <Panel delay={1}>
                            <div className="flex justify-between items-start mb-3.5">
                                <Label style={{ marginBottom: 0 }}>Month-over-Month Revenue</Label>
                                {totals.momPct !== null && (
                                    <Chip
                                        up={(totals.momPct ?? 0) >= 0}
                                        label={`${(totals.momPct ?? 0) >= 0 ? "+" : ""}${(totals.momPct ?? 0).toFixed(1)}%`}
                                    />
                                )}
                            </div>
                            {loading ? <Skeleton h={180} /> : trend.length === 0 ? <Empty /> : (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={trend} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="32%">
                                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.border} />
                                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} width={34} />
                                        <Tooltip content={<ChartTip />} />
                                        <Bar dataKey="revenue" name="Revenue" radius={[3, 3, 0, 0]} maxBarSize={36}>
                                            {trend.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={i === trend.length - 1 ? T.green : `${T.green}55`}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Panel>
                    </div>

                    {/* Top Revenue Streams Ranked */}
                    <Panel delay={2}>
                        <Label>Top Revenue Streams — Ranked</Label>
                        {loading ? <><Skeleton /><Skeleton /><Skeleton /></> : streams.length === 0 ? <Empty /> : (
                            <div className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                                {streams.slice(0, 8).map((s, i) => (
                                    <div
                                        key={s.code ?? i}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg"
                                        style={{ background: T.bg }}
                                    >
                                        <div
                                            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                                            style={{
                                                background: `${PALETTE[i % PALETTE.length]}18`,
                                                color: PALETTE[i % PALETTE.length],
                                            }}
                                        >
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[12px] font-semibold truncate" style={{ color: T.text }}>{s.name}</span>
                                                <span className="text-[12px] font-bold tabular-nums ml-2 flex-shrink-0" style={{ color: T.text }}>{fmt(s.amount)}</span>
                                            </div>
                                            <MiniBar value={s.amount} max={streams[0].amount} color={PALETTE[i % PALETTE.length]} h={3} />
                                            <div className="text-[9px] mt-0.5" style={{ color: T.weak }}>
                                                {s.count} txns · {s.pct}% of total
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
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