
import { useState, useEffect, useMemo } from "react";
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, Download, RefreshCw, ArrowUpRight, ArrowDownRight, BarChart2 } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { usePagination } from "../hooks/usePagination";
import { useExpenseSummary, useBankAccounts } from "../hooks/useAccounting";
import { useIsMobile } from "@/hooks/use-mobile";
import api from "../../../plugins/axios";
import { NEPALI_MONTH_NAMES, QUARTER_LABELS, toBSDate } from "../utils/nepaliCalendar";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ORDER } from "@/constants/paymentMethods";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
    bg:          "var(--color-bg)",
    surface:     "var(--color-surface)",
    alt:         "var(--color-muted)",
    border:      "var(--color-border)",
    text:        "var(--color-text-strong)",
    body:        "var(--color-text-body)",
    sub:         "var(--color-text-sub)",
    weak:        "var(--color-text-weak)",
    accent:      "var(--color-accent)",
    red:         "var(--color-danger)",
    redBg:       "var(--color-danger-bg)",
    redBorder:   "var(--color-danger-border)",
    amber:       "var(--color-warning)",
    amberBg:     "var(--color-warning-bg)",
    amberBorder: "var(--color-warning-border)",
    green:       "var(--color-success)",
    greenBg:     "var(--color-success-bg)",
    blue:        "var(--color-info)",
    blueBg:      "var(--color-info-bg)",
};

const REF_CFG = {
    MANUAL:      { bg: T.alt,     color: T.sub },
    MAINTENANCE: { bg: T.redBg,   color: T.red },
    UTILITY:     { bg: T.blueBg,  color: T.blue },
    SALARY:      { bg: "#EDE9FE", color: "#5B21B6" },
    RENT:        { bg: T.amberBg, color: T.amber },
    VENDOR:      { bg: "#ECFEFF", color: "#0E7490" },
};

const fmt  = (n) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
const fmtK = (v) => {
    const a = Math.abs(v);
    return a >= 100000 ? `${(a / 100000).toFixed(1)}L`
         : a >= 1000   ? `${(a / 1000).toFixed(0)}K`
         : String(a);
};

// ─── Mini SVG Sparkline ───────────────────────────────────────────────────────
function MiniSparkline({ data, color = "var(--color-danger)", width = 96, height = 32, highlightIdx = -1 }) {
    if (!data || data.length < 2) return null;
    const vals = data.map(d => d.expenses);
    const min  = Math.min(...vals);
    const max  = Math.max(...vals);
    const rng  = max - min || 1;
    const pad  = 3;
    const pts  = vals.map((v, i) => [
        (i / (vals.length - 1)) * (width - pad * 2) + pad,
        height - pad - ((v - min) / rng) * (height - pad * 2),
    ]);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const hi   = highlightIdx >= 0 && highlightIdx < pts.length ? pts[highlightIdx] : null;
    return (
        <svg width={width} height={height} style={{ overflow: "visible", flexShrink: 0 }}>
            <path d={path} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            {hi && (
                <circle cx={hi[0]} cy={hi[1]} r="3" fill={color} stroke="white" strokeWidth="1.5" />
            )}
        </svg>
    );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ up, label, size = "sm" }) {
    return (
        <span
            className="inline-flex items-center gap-[3px] rounded font-bold"
            style={{
                padding:    size === "sm" ? "1px 7px" : "3px 10px",
                fontSize:   size === "sm" ? 10 : 12,
                background: up ? T.greenBg : T.redBg,
                color:      up ? T.green   : T.red,
            }}
        >
            {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {label}
        </span>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 14, w = "100%" }) {
    return (
        <div className="rounded animate-pulse mb-1.5"
            style={{ height: h, width: w, background: T.alt }} />
    );
}

// ─── Empty ────────────────────────────────────────────────────────────────────
function Empty({ msg = "No data for this period" }) {
    return (
        <div className="py-8 text-center" style={{ color: T.sub }}>
            <BarChart2 size={18} className="mx-auto mb-2 opacity-30" />
            <div className="text-xs">{msg}</div>
        </div>
    );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg px-3.5 py-2.5" style={{
            background: "linear-gradient(140deg, #0a2f46 0%, #1a5276 100%)",
            boxShadow:  "0 8px 24px rgba(0,0,0,.22)",
            minWidth:   140,
            border:     "1px solid rgba(255,255,255,0.08)",
        }}>
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-2"
                style={{ color: "rgba(255,255,255,.38)" }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs text-white">
                    <span style={{ opacity: 0.6 }}>{p.name}</span>
                    <span className="font-bold tabular-nums">
                        ₹{Number(Math.abs(p.value || 0)).toLocaleString("en-IN")}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusBadge({ s }) {
    const cfgs = {
        RECORDED: { bg: T.amberBg, color: T.amber },
        SYNCED:   { bg: T.greenBg, color: T.green },
        REVERSED: { bg: T.redBg,   color: T.red },
    };
    const { bg, color } = cfgs[s] ?? { bg: T.alt, color: T.sub };
    return (
        <span className="rounded text-[9px] font-bold px-1.5 py-0.5" style={{ background: bg, color }}>{s}</span>
    );
}

function RefBadge({ t }) {
    const c = REF_CFG[t] ?? { bg: T.alt, color: T.sub };
    return (
        <span className="rounded text-[9px] font-bold px-1.5 py-0.5" style={{ background: c.bg, color: c.color }}>{t}</span>
    );
}

function PayeeBadge({ t }) {
    return (
        <span className="rounded text-[9px] font-bold px-1.5 py-0.5" style={{
            background: t === "EXTERNAL" ? T.redBg : T.amberBg,
            color:      t === "EXTERNAL" ? T.red   : T.amber,
        }}>{t}</span>
    );
}

// ─── Hairline separator ───────────────────────────────────────────────────────
function Sep({ my = 32 }) {
    return <div style={{ height: 1, background: T.border, marginTop: my, marginBottom: my }} />;
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children, right }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: T.sub }}>
                {children}
            </div>
            {right && <div className="text-[10px]" style={{ color: T.weak }}>{right}</div>}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ExpenseBreakDown({
    onExpenseAdded,
    selectedQuarter  = null,
    selectedMonth    = null,
    fiscalYear       = null,
    compareMode      = false,
    compareQuarter   = null,
    customStartDate  = "",
    customEndDate    = "",
    openDialog       = false,
    onDialogOpenHandled,
    entityId         = null,
}) {
    const isMobile = useIsMobile();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tenants, setTenants] = useState([]);
    const [expSources, setExpSources] = useState([]);
    const [payMethodFilter, setPayMethodFilter] = useState(null);
    const { bankAccounts } = useBankAccounts();

    const { data: D, loading, error, refetch } = useExpenseSummary(
        selectedQuarter, customStartDate, customEndDate, selectedMonth, fiscalYear, entityId
    );
    const { data: DB, loading: loadingB } = useExpenseSummary(
        compareMode ? compareQuarter : null, "", "", null, fiscalYear, entityId
    );

    useEffect(() => {
        if (openDialog) { setDialogOpen(true); onDialogOpenHandled?.(); }
    }, [openDialog]); // eslint-disable-line

    useEffect(() => {
        api.get("/api/tenant/get-tenants")
            .then(({ data }) => setTenants(data?.tenants ?? []))
            .catch(() => {});
        api.get("/api/expense/get-expense-sources")
            .then(({ data }) => setExpSources(data?.expenseSources ?? []))
            .catch(() => {});
    }, []);

    const onSuccess = () => { refetch(); onExpenseAdded?.(); };

    const q = selectedQuarter != null ? Number(selectedQuarter) : null;
    const periodLabel =
        customStartDate && customEndDate
            ? `${toBSDate(customStartDate)} → ${toBSDate(customEndDate)}`
            : selectedMonth
                ? `${NEPALI_MONTH_NAMES[selectedMonth - 1] ?? "—"}${fiscalYear ? ` ${fiscalYear}` : ""}`
                : q && QUARTER_LABELS[q]
                    ? `Q${q} · ${QUARTER_LABELS[q]}`
                    : selectedQuarter
                        ? "All"
                        : fiscalYear
                            ? `FY ${fiscalYear}/${String(fiscalYear + 1).slice(2)}`
                            : "All Periods";

    const exportCSV = () => {
        if (!D) return;
        const rows = [
            ["Source", "Ref", "Payee", "Amount", "Date", "Status", "Notes"],
            ...D.transactions.map(t => [t.source, t.refType, t.payeeType, t.amount, t.bsDate, t.status, `"${t.notes}"`]),
        ];
        const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
        Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `expenses_${Date.now()}.csv`,
        }).click();
    };

    const totals         = D?.totals            ?? { total: 0, count: 0, avg: 0, momPct: null };
    const categories     = D?.categories        ?? [];
    const trend          = D?.trend             ?? [];
    const payeeSplit     = D?.payeeSplit        ?? [];
    const refTypes       = D?.refTypes          ?? [];
    const operatingAmt   = D?.operatingAmt      ?? 0;
    const nonOpAmt       = D?.nonOpAmt          ?? 0;
    const payMethodSplit = D?.paymentMethodSplit ?? [];
    const transactions   = D?.transactions      ?? [];

    const filteredTxns = payMethodFilter
        ? transactions.filter(t => t.paymentMethod === payMethodFilter)
        : transactions;
    const TXN_PAGE_SIZE = 20;
    const {
        paginatedItems: pageTxns,
        currentPage, totalPages,
        nextPage, prevPage, startIndex,
    } = usePagination(filteredTxns, TXN_PAGE_SIZE);

    // Derived hero insight (mirrors Revenue pattern, adapted for expenses)
    const insight = useMemo(() => {
        if (!trend || trend.length < 2) return null;
        const vals = trend.map(d => d.expenses).filter(v => v > 0);
        if (!vals.length) return null;
        const avg         = vals.reduce((a, b) => a + b, 0) / vals.length;
        const peak        = trend.reduce((a, b) => b.expenses > a.expenses ? b : a);
        const peakIdx     = trend.indexOf(peak);
        const topCategory = categories[0]?.name ?? "general expenses";
        const opRatio     = totals.total > 0 ? Math.round((operatingAmt / totals.total) * 100) : 0;
        if (peak.expenses > avg * 1.3) {
            return {
                text:      `Spending peaked in ${peak.label} — driven by ${topCategory.toLowerCase()}`,
                peakIdx,
                peakLabel: peak.label,
                peakValue: peak.expenses,
                isPeak:    true,
            };
        }
        return {
            text:    `${opRatio}% operating costs · ${totals.count} transaction${totals.count !== 1 ? "s" : ""} across ${categories.length} categor${categories.length !== 1 ? "ies" : "y"} · ${periodLabel}`,
            peakIdx: trend.length - 1,
            isPeak:  false,
        };
    }, [trend, categories, totals, operatingAmt, periodLabel]);

    return (
        <div style={{ color: T.text }}>

            {/* ── 1. Header (Notion-style, pure typography) ─────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-3"
                        style={{ color: T.sub }}>
                        Expenses · {periodLabel}
                    </div>

                    {loading ? (
                        <Skeleton h={48} w={220} />
                    ) : (
                        <div
                            className="font-black leading-none tabular-nums"
                            style={{
                                fontSize:      isMobile ? 40 : 52,
                                color:         T.red,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            <span style={{ fontSize: isMobile ? 26 : 34, opacity: 0.5, marginRight: 2, verticalAlign: "baseline" }}>−</span>
                            ₹{Number(Math.abs(totals.total)).toLocaleString("en-IN")}
                        </div>
                    )}

                    {!loading && (
                        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                            {totals.momPct !== null && (
                                <Chip
                                    up={(totals.momPct ?? 0) <= 0}
                                    label={`${Math.abs(totals.momPct ?? 0).toFixed(1)}% from last month`}
                                />
                            )}
                            <span className="text-[12px]" style={{ color: T.sub }}>
                                {totals.count} transaction{totals.count !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>

                <div className={`flex items-center gap-2 ${isMobile ? "w-full" : ""}`}>
                    <button
                        onClick={refetch}
                        title="Refresh"
                        className="flex items-center justify-center h-8 w-8 rounded-lg border cursor-pointer transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: T.border }}
                    >
                        <RefreshCw size={13} color={T.body} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors"
                        style={{ borderColor: T.border, background: T.surface, color: T.body }}
                    >
                        <Download size={12} />
                        {!isMobile && "Export"}
                    </button>
                    <button
                        onClick={() => setDialogOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[13px] font-bold text-white cursor-pointer transition-colors"
                        style={{ background: T.accent }}
                    >
                        <Plus size={13} />
                        Add Expense
                    </button>
                </div>
            </div>

            {/* ── Error ─────────────────────────────────────────────────────── */}
            {error && (
                <div className="rounded-lg px-4 py-3 text-xs mb-6 flex items-center gap-2"
                    style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}>
                    <span>⚠ {error}</span>
                    <button onClick={refetch} className="ml-auto font-bold underline bg-transparent border-none cursor-pointer"
                        style={{ color: T.red }}>Retry</button>
                </div>
            )}

            {/* ── Compare banner ────────────────────────────────────────────── */}
            {compareMode && !loading && !loadingB && DB && (
                <div className="rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-4 mb-6"
                    style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
                    <div>
                        <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1"
                            style={{ color: T.amber }}>Compare Mode</div>
                        <div className="text-xs" style={{ color: T.body }}>Period vs period expense analysis</div>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap">
                        {[
                            { lbl: periodLabel, val: totals.total, color: T.red },
                            {
                                lbl: compareQuarter && QUARTER_LABELS[compareQuarter]
                                    ? `Q${compareQuarter} · ${QUARTER_LABELS[compareQuarter]}`
                                    : "Compare",
                                val: DB.totals.total,
                                color: T.amber,
                            },
                        ].map(x => (
                            <div key={x.lbl} className="text-right">
                                <div className="text-[9px] font-bold uppercase tracking-[0.08em] mb-0.5"
                                    style={{ color: T.sub }}>{x.lbl}</div>
                                <div className="font-black tabular-nums text-xl" style={{ color: x.color }}>
                                    {fmt(x.val)}
                                </div>
                            </div>
                        ))}
                        {totals.total > 0 && (
                            <Chip
                                up={(DB.totals.total - totals.total) <= 0}
                                label={`${Math.abs(((DB.totals.total - totals.total) / totals.total) * 100).toFixed(1)}%`}
                                size="md"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ── 2. Hero Insight Block ─────────────────────────────────────── */}
            {loading ? (
                <div className="rounded-xl mb-8"
                    style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 22px" }}>
                    <Skeleton h={9} w={72} />
                    <Skeleton h={16} w={300} />
                </div>
            ) : insight ? (
                <div
                    className="rounded-xl flex items-center justify-between gap-6 mb-8"
                    style={{
                        background: T.surface,
                        border:     `1px solid ${T.border}`,
                        padding:    "18px 22px",
                    }}
                >
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5"
                            style={{ color: T.sub }}>
                            {insight.isPeak ? "Key Insight" : "Period Summary"}
                        </div>
                        <div className="text-[14px] font-medium leading-snug" style={{ color: T.text }}>
                            {insight.text}
                        </div>
                        {insight.isPeak && (
                            <div className="mt-1.5 text-[11px]" style={{ color: T.sub }}>
                                Peak: {fmt(insight.peakValue)} in {insight.peakLabel}
                            </div>
                        )}
                    </div>
                    {trend.length >= 2 && (
                        <MiniSparkline
                            data={trend}
                            color={T.red}
                            width={isMobile ? 56 : 96}
                            height={32}
                            highlightIdx={insight.peakIdx}
                        />
                    )}
                </div>
            ) : null}

            {/* ── 3. Trend Section ──────────────────────────────────────────── */}
            <div className="mb-0">
                <SectionLabel right={`${periodLabel} · Nepali calendar`}>
                    Expense Trend
                </SectionLabel>

                {loading ? (
                    <Skeleton h={180} />
                ) : trend.length === 0 ? (
                    <Empty msg="No monthly data — add expenses with Nepali dates" />
                ) : (
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={trend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                            <defs>
                                <linearGradient id="ex-fill-v2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor={T.red} stopOpacity={0.08} />
                                    <stop offset="100%" stopColor={T.red} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 5" vertical={false} stroke={T.border} />
                            <XAxis dataKey="label"
                                tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={fmtK}
                                tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} width={34} />
                            <Tooltip content={<ChartTip />} />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                name="Expenses"
                                stroke={T.red}
                                strokeWidth={1.5}
                                fill="url(#ex-fill-v2)"
                                dot={false}
                                activeDot={{ r: 3.5, fill: T.red, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            <Sep my={28} />

            {/* ── 4. Expense Categories + Side Insights ─────────────────────── */}
            <div className={`flex gap-10 ${isMobile ? "flex-col" : ""}`}>

                {/* Categories bar list */}
                <div className="flex-1 min-w-0">
                    <SectionLabel>Expense Categories</SectionLabel>

                    {loading ? (
                        <><Skeleton /><Skeleton /><Skeleton /></>
                    ) : categories.length === 0 ? (
                        <Empty />
                    ) : (
                        <div className="flex flex-col gap-4">
                            {categories.map((c, i) => {
                                const barW = categories[0].amount > 0
                                    ? (c.amount / categories[0].amount) * 100
                                    : 0;
                                return (
                                    <div key={c.code ?? i}>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-[13px] font-medium"
                                                style={{ color: T.text }}>{c.name}</span>
                                            <div className="flex items-baseline gap-3 flex-shrink-0">
                                                <span className="text-[11px] font-semibold tabular-nums"
                                                    style={{ color: T.sub }}>{c.pct}%</span>
                                                <span className="text-[13px] font-bold tabular-nums"
                                                    style={{ color: T.text }}>{fmt(c.amount)}</span>
                                            </div>
                                        </div>
                                        <div style={{
                                            height: 3, borderRadius: 2,
                                            background: T.border, overflow: "hidden",
                                        }}>
                                            <div style={{
                                                height: "100%",
                                                width: `${barW}%`,
                                                borderRadius: 2,
                                                background: i === 0 ? T.red : `color-mix(in srgb, ${T.red} 45%, transparent)`,
                                                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Vertical divider */}
                {!isMobile && (
                    <div style={{ width: 1, background: T.border, flexShrink: 0 }} />
                )}

                {/* At a Glance */}
                <div style={{ width: isMobile ? "100%" : 188, flexShrink: 0 }}>
                    <SectionLabel>At a Glance</SectionLabel>

                    {loading ? (
                        <><Skeleton /><Skeleton /><Skeleton /></>
                    ) : (
                        <div>
                            {[
                                { label: "Avg per transaction", value: fmt(totals.avg), large: true },
                                { label: "Expense categories",  value: categories.length },
                                { label: "Total transactions",  value: totals.count },
                                ...(categories[0]
                                    ? [{ label: "Top category", value: categories[0].name }]
                                    : []),
                                {
                                    label: "Operating ratio",
                                    value: totals.total > 0
                                        ? `${Math.round((operatingAmt / totals.total) * 100)}%`
                                        : "—",
                                },
                            ].map(s => (
                                <div
                                    key={s.label}
                                    className="py-3 border-b"
                                    style={{ borderColor: `${T.border}99` }}
                                >
                                    <div className="text-[10px] mb-0.5" style={{ color: T.sub }}>{s.label}</div>
                                    <div
                                        className="font-bold tabular-nums leading-snug"
                                        style={{
                                            fontSize:      s.large ? 17 : 14,
                                            color:         T.text,
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Sep my={32} />

            {/* ── 5a. Intel: Payee Split · Ref Types · Payment Methods ──────── */}
            <div className={`grid gap-10 mb-8 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>

                {/* Payee Split */}
                <div>
                    <SectionLabel>Payee Split</SectionLabel>
                    {loading ? <><Skeleton /><Skeleton /></> : payeeSplit.length === 0 ? <Empty msg="No payee data" /> : (
                        <div className="flex flex-col gap-4">
                            {payeeSplit.map((p, i) => {
                                const barW = totals.total > 0 ? (p.amount / totals.total) * 100 : 0;
                                const color = i === 0 ? T.red : T.amber;
                                return (
                                    <div key={p.name}>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-[13px] font-medium" style={{ color: T.text }}>{p.name}</span>
                                            <div className="flex items-baseline gap-2 flex-shrink-0">
                                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: T.sub }}>{p.pct}%</span>
                                                <span className="text-[13px] font-bold tabular-nums" style={{ color: T.text }}>{fmt(p.amount)}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${barW}%`, borderRadius: 2, background: color, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* By Reference */}
                <div>
                    <SectionLabel>By Reference</SectionLabel>
                    {loading ? <><Skeleton /><Skeleton /><Skeleton /></> : refTypes.length === 0 ? <Empty msg="No ref data" /> : (
                        <div className="flex flex-col gap-3.5">
                            {refTypes.map(r => {
                                const cfg = REF_CFG[r.type] ?? { bg: T.alt, color: T.sub };
                                return (
                                    <div key={r.type}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <RefBadge t={r.type} />
                                            <div className="text-right">
                                                <div className="text-[12px] font-bold tabular-nums" style={{ color: T.text }}>{fmt(r.amount)}</div>
                                                <div className="text-[9px]" style={{ color: T.weak }}>{r.count} txns · {r.pct}%</div>
                                            </div>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${totals.total > 0 ? (r.amount / totals.total) * 100 : 0}%`, borderRadius: 2, background: cfg.color, transition: "width 0.5s ease" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Payment Methods */}
                <div>
                    <SectionLabel>Payment Methods</SectionLabel>
                    {loading ? <><Skeleton /><Skeleton /></> : payMethodSplit.length === 0 ? <Empty msg="No payment data" /> : (
                        <div className="flex flex-col gap-4">
                            {payMethodSplit.map((m, i) => {
                                const barW = totals.total > 0 ? (m.amount / totals.total) * 100 : 0;
                                return (
                                    <div key={m.method}>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-[13px] font-medium" style={{ color: T.text }}>
                                                {PAYMENT_METHOD_LABELS[m.method] ?? m.method}
                                            </span>
                                            <div className="flex items-baseline gap-2 flex-shrink-0">
                                                <span className="text-[11px]" style={{ color: T.sub }}>{m.pct}%</span>
                                                <span className="text-[13px] font-bold tabular-nums" style={{ color: T.text }}>{fmt(m.amount)}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${barW}%`, borderRadius: 2, background: i === 0 ? T.red : `color-mix(in srgb, ${T.red} 45%, transparent)`, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                                        </div>
                                        <div className="mt-1 text-[9px]" style={{ color: T.weak }}>{m.count} transaction{m.count !== 1 ? "s" : ""}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 5b. Cost Classification ───────────────────────────────────── */}
            {!loading && (operatingAmt > 0 || nonOpAmt > 0) && (
                <>
                    <Sep my={28} />
                    <div className="mb-8">
                        <SectionLabel right={totals.total > 0 ? `${Math.round((operatingAmt / totals.total) * 100)}% operating` : ""}>
                            Cost Classification
                        </SectionLabel>
                        <div className={`flex gap-10 ${isMobile ? "flex-col" : ""}`}>
                            {[
                                { label: "Operating",     value: operatingAmt, note: "Salary · Utility · Maintenance", color: T.red },
                                { label: "Non-Operating", value: nonOpAmt,     note: "Vendor · Manual · Other",         color: T.amber },
                            ].map(x => {
                                const barW = totals.total > 0 ? (x.value / totals.total) * 100 : 0;
                                return (
                                    <div key={x.label} className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-[13px] font-medium" style={{ color: T.text }}>{x.label}</span>
                                            <span className="text-[13px] font-bold tabular-nums" style={{ color: T.text }}>{fmt(x.value)}</span>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${barW}%`, borderRadius: 2, background: x.color, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                                        </div>
                                        <div className="mt-1.5 text-[10px]" style={{ color: T.weak }}>
                                            {barW.toFixed(1)}% · {x.note}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            <Sep my={32} />

            {/* ── 6. Transactions ───────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <SectionLabel>Transactions</SectionLabel>
                        <div className="text-[11px] -mt-2" style={{ color: T.weak }}>
                            {payMethodFilter
                                ? `${filteredTxns.length} of ${transactions.length} · ${PAYMENT_METHOD_LABELS[payMethodFilter]}`
                                : `${transactions.length} entries · ${periodLabel}`}
                        </div>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors"
                        style={{ borderColor: T.border, background: T.surface, color: T.body }}
                    >
                        <Download size={11} /> Export CSV
                    </button>
                </div>

                {/* Payment method filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-5">
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase mr-1"
                        style={{ color: T.weak }}>Method</span>
                    {[
                        { value: null, label: "All" },
                        ...PAYMENT_METHOD_ORDER.map(v => ({ value: v, label: PAYMENT_METHOD_LABELS[v] })),
                    ].map(opt => {
                        const isActive = payMethodFilter === opt.value;
                        const split    = opt.value ? payMethodSplit.find(s => s.method === opt.value) : null;
                        const isEmpty  = opt.value && (!split || split.count === 0);
                        return (
                            <button
                                key={opt.value ?? "all"}
                                onClick={() => setPayMethodFilter(isActive && opt.value ? null : opt.value)}
                                disabled={isEmpty}
                                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors border"
                                style={{
                                    cursor:      isEmpty ? "default" : "pointer",
                                    background:  isActive ? T.red : "transparent",
                                    borderColor: isActive ? T.red : T.border,
                                    color:       isActive ? "#fff" : isEmpty ? T.weak : T.sub,
                                    opacity:     isEmpty ? 0.4 : 1,
                                }}
                            >
                                {opt.label}
                                {split && split.count > 0 && (
                                    <span
                                        className="rounded px-1 tabular-nums text-[9px]"
                                        style={{
                                            background: isActive ? "rgba(255,255,255,0.2)" : T.alt,
                                            color:      isActive ? "#fff" : T.sub,
                                        }}
                                    >
                                        {split.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                {loading ? (
                    <><Skeleton /><Skeleton /><Skeleton /></>
                ) : filteredTxns.length === 0 ? (
                    <Empty msg="No transactions for this period" />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        {[
                                            { key: "Date",   align: "left"  },
                                            { key: "Source", align: "left"  },
                                            { key: "Ref",    align: "left"  },
                                            { key: "Payee",  align: "left"  },
                                            { key: "Amount", align: "right" },
                                            { key: "Status", align: "left"  },
                                        ].map(h => (
                                            <th
                                                key={h.key}
                                                className="py-2.5 text-[9px] font-bold tracking-[0.08em] uppercase border-b"
                                                style={{
                                                    color:        T.weak,
                                                    borderColor:  T.border,
                                                    textAlign:    h.align,
                                                    paddingLeft:  h.key === "Date" ? 0 : 14,
                                                    paddingRight: h.key === "Status" ? 0 : 14,
                                                }}
                                            >
                                                {h.key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageTxns.map(t => (
                                        <tr
                                            key={t.id}
                                            className="transition-colors hover:bg-[var(--color-muted)]"
                                            style={{ borderBottom: `1px solid ${T.border}55` }}
                                        >
                                            <td className="py-4 pr-4" style={{ color: T.weak, fontSize: 11, whiteSpace: "nowrap" }}>
                                                {t.bsDate}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="text-[13px] font-semibold" style={{ color: T.text }}>{t.source}</div>
                                                {t.notes && (
                                                    <div className="text-[10px] mt-0.5 truncate max-w-[180px]" style={{ color: T.sub }}>{t.notes}</div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4">
                                                <RefBadge t={t.refType} />
                                            </td>
                                            <td className="py-4 px-4">
                                                <PayeeBadge t={t.payeeType} />
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="text-[14px] font-bold tabular-nums"
                                                    style={{ color: T.red, letterSpacing: "-0.01em" }}>
                                                    −{fmt(t.amount)}
                                                </div>
                                            </td>
                                            <td className="py-4 pl-4 pr-0">
                                                <StatusBadge s={t.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 mt-1 border-t"
                                style={{ borderColor: T.border }}>
                                <span className="text-[10px]" style={{ color: T.sub }}>
                                    {startIndex + 1}–{Math.min(startIndex + TXN_PAGE_SIZE, filteredTxns.length)} of {filteredTxns.length}
                                </span>
                                <div className="flex gap-1">
                                    {[
                                        ["← Prev", prevPage, currentPage === 1],
                                        ["Next →", nextPage, currentPage === totalPages],
                                    ].map(([label, fn, disabled]) => (
                                        <button
                                            key={label}
                                            onClick={fn}
                                            disabled={disabled}
                                            className="px-3 py-1 rounded-md border text-[11px] font-semibold"
                                            style={{
                                                borderColor: T.border,
                                                background:  T.surface,
                                                color:       disabled ? T.weak : T.text,
                                                cursor:      disabled ? "default" : "pointer",
                                                opacity:     disabled ? 0.45 : 1,
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
            </div>

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
