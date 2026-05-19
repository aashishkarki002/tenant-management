import { useState, useEffect } from "react";
import {
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, Legend,
} from "recharts";
import { Download, RefreshCw, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCollectionSummary } from "../hooks/useCollectionSummary";
import { formatPaisa } from "@/utils/formatter";
import { toBSDate, NEPALI_MONTH_NAMES } from "../utils/nepaliCalendar";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    alt: "var(--color-muted)",
    border: "var(--color-border)",
    text: "var(--color-text-strong)",
    body: "var(--color-text-body)",
    sub: "var(--color-text-sub)",
    weak: "var(--color-text-weak)",
    accent: "var(--color-accent)",
    revenue: "var(--color-info)",
    revenueBg: "var(--color-info-bg)",
    green: "var(--color-success)",
    greenBg: "var(--color-success-bg)",
    amber: "var(--color-warning)",
    amberBg: "var(--color-warning-bg)",
    amberBorder: "var(--color-warning-border)",
    red: "var(--color-danger)",
    redBg: "var(--color-danger-bg)",
    redBorder: "var(--color-danger-border)",
    blue: "var(--color-info)",
    blueBg: "var(--color-info-bg)",
};

// ─── Animation constants ──────────────────────────────────────────────────────
const EO = "cubic-bezier(0.22, 1, 0.36, 1)";
const EX = "cubic-bezier(0.16, 1, 0.3, 1)";

const ANIM_CSS = `
@keyframes rcb-up  { from { opacity:0; transform:translateY(7px) } to { opacity:1; transform:translateY(0) } }
@keyframes rcb-in  { from { opacity:0; transform:scale(0.97)     } to { opacity:1; transform:scale(1)     } }
@keyframes rcb-draw { to  { stroke-dashoffset:0 } }
@media (prefers-reduced-motion:reduce) {
  [data-rcb] * { animation-duration:0.01ms !important; transition-duration:0.01ms !important; }
}`;

// ─── Compact number formatter ─────────────────────────────────────────────────
const fmtK = (v) => {
    const a = Math.abs(v);
    return a >= 100000 ? `${(a / 100000).toFixed(1)}L`
        : a >= 1000 ? `${(a / 1000).toFixed(0)}K`
            : String(a);
};

// ─── Inline mini sparkline (revenue data-key) ─────────────────────────────────
function MiniSparkline({ data, color = "var(--color-info)", width = 96, height = 32 }) {
    if (!data || data.length < 2) return null;
    const vals = data.map((d) => d.revenue);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const rng = max - min || 1;
    const pad = 3;
    const pts = vals.map((v, i) => [
        (i / (vals.length - 1)) * (width - pad * 2) + pad,
        height - pad - ((v - min) / rng) * (height - pad * 2),
    ]);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return (
        <svg width={width} height={height} style={{ overflow: "visible", flexShrink: 0 }}>
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                style={{
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    opacity: 0.6,
                    animation: `rcb-draw 0.9s ${EX} 0.15s both`,
                }}
            />
        </svg>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 14, w = "100%" }) {
    return (
        <div
            className="rounded animate-pulse mb-1.5"
            style={{ height: h, width: w, background: T.alt }}
        />
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

// ─── Hairline separator ───────────────────────────────────────────────────────
function Sep({ my = 32 }) {
    return <div style={{ height: 1, background: T.border, marginTop: my, marginBottom: my }} />;
}

// ─── Collection rate color tier ───────────────────────────────────────────────
function rateColors(ratePct) {
    if (ratePct >= 80) return { bg: T.greenBg, color: T.green };
    if (ratePct >= 60) return { bg: T.amberBg, color: T.amber };
    return { bg: T.redBg, color: T.red };
}

// ─── Stream display config ────────────────────────────────────────────────────
const STREAM_CFG = {
    RENT: { label: "Rental Income", color: "var(--color-accent)" },
    CAM: { label: "CAM Charges", color: "var(--color-warning)" },
    ELECTRICITY: { label: "Electricity", color: "#A16207" },
    LATE_FEE: { label: "Late Fees", color: "var(--color-success)" },
    OTHER: { label: "Other Revenue", color: "var(--color-text-sub)" },
};

const STREAM_ORDER = ["RENT", "CAM", "ELECTRICITY", "LATE_FEE", "OTHER"];

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function CollectionChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="rounded-lg px-3.5 py-2.5"
            style={{
                background: "linear-gradient(140deg, #0a2f46 0%, #1a5276 100%)",
                boxShadow: "0 8px 24px rgba(0,0,0,.22)",
                minWidth: 180,
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <div
                className="text-[9px] font-bold tracking-[0.1em] uppercase mb-2"
                style={{ color: "rgba(255,255,255,.38)" }}
            >
                {label}
            </div>
            {payload.map((p) => (
                <div
                    key={p.dataKey}
                    className="flex items-center justify-between gap-4 text-xs text-white mb-0.5"
                >
                    <span style={{ opacity: 0.6 }}>{p.name}</span>
                    <span className="font-bold tabular-nums">
                        {p.dataKey === "ratePct" ? `${(p.value ?? 0).toFixed(1)}%` : `RS ${Number(Math.abs(p.value ?? 0)).toLocaleString("en-IN")}`}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Stream table tooltip ─────────────────────────────────────────────────────
function StreamChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const BASIS = { RENT: "collected", CAM: "booked", ELECTRICITY: "booked", LATE_FEE: "booked", OTHER: "booked" };
    return (
        <div
            className="rounded-lg px-3.5 py-2.5"
            style={{
                background: "linear-gradient(140deg, #0a2f46 0%, #1a5276 100%)",
                boxShadow: "0 8px 24px rgba(0,0,0,.22)",
                minWidth: 200,
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <div
                className="text-[9px] font-bold tracking-[0.1em] uppercase mb-2"
                style={{ color: "rgba(255,255,255,.38)" }}
            >
                {label}
            </div>
            {payload.map((p) => (
                <div
                    key={p.dataKey}
                    className="flex items-center justify-between gap-4 text-xs text-white mb-0.5"
                >
                    <span style={{ opacity: 0.6 }}>
                        {STREAM_CFG[p.dataKey]?.label ?? p.dataKey}{" "}
                        <span style={{ opacity: 0.5, fontSize: 9 }}>({BASIS[p.dataKey] ?? "booked"})</span>
                    </span>
                    <span className="font-bold tabular-nums">
                        RS {Number(Math.abs(p.value ?? 0)).toLocaleString("en-IN")}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, sublabel, value, valueColor, bg, border, sparklineData, sparklineColor, isLoading }) {
    return (
        <div
            className="flex-1 min-w-[180px] rounded-xl p-4 flex flex-col gap-1"
            style={{
                background: bg ?? T.surface,
                border: `1px solid ${border ?? T.border}`,
                animation: `rcb-in 0.35s ${EO} both`,
            }}
        >
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: T.sub }}>
                {label}
            </div>
            {sublabel && (
                <div className="text-[9px]" style={{ color: T.weak }}>{sublabel}</div>
            )}
            {isLoading ? (
                <Skeleton h={28} w={120} />
            ) : (
                <div
                    className="text-[22px] font-black tabular-nums leading-tight mt-1"
                    style={{ color: valueColor ?? T.text, letterSpacing: "-0.02em" }}
                >
                    {value}
                </div>
            )}
            {sparklineData && sparklineData.length >= 2 && (
                <div className="mt-2">
                    <MiniSparkline
                        data={sparklineData}
                        color={sparklineColor ?? T.revenue}
                        width={80}
                        height={24}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Section 3 — Who Hasn't Paid ─────────────────────────────────────────────
function UnpaidRentsSection({ unpaidRents, collectionRatePct, loading }) {
    const navigate = useNavigate();

    if (loading || collectionRatePct >= 80) return null;

    const handleNavigateToRentPayment = () => {
        navigate("/rent-payment");
    };

    return (
        <div style={{ animation: `rcb-up 0.4s ${EO} both` }}>
            <div
                className="rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-xs font-semibold"
                style={{
                    background: T.redBg,
                    border: `1px solid ${T.redBorder}`,
                    color: T.red,
                }}
            >
                <span>!</span>
                <span>
                    {unpaidRents.length} unit{unpaidRents.length !== 1 ? "s" : ""} outstanding — Collection rate{" "}
                    {collectionRatePct.toFixed(1)}% is below 80% threshold
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {[
                                { key: "Block", align: "left" },
                                { key: "Tenant", align: "left" },
                                { key: "Unit", align: "left" },
                                { key: "Owed", align: "right" },
                                { key: "Status", align: "left" },
                                { key: "Due (BS)", align: "left" },
                            ].map((h) => (
                                <th
                                    key={h.key}
                                    className="py-2.5 text-[9px] font-bold tracking-[0.08em] uppercase border-b"
                                    style={{
                                        color: T.weak,
                                        borderColor: T.border,
                                        textAlign: h.align,
                                        paddingLeft: h.key === "Block" ? 0 : 12,
                                        paddingRight: h.key === "Due (BS)" ? 0 : 12,
                                    }}
                                >
                                    {h.key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {unpaidRents.map((rent, i) => (
                            <UnpaidRentRow key={rent._id ?? i} rent={rent} index={i} />
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end mt-4">
                <button
                    onClick={handleNavigateToRentPayment}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12px] font-bold cursor-pointer transition-opacity hover:opacity-90 active:opacity-75 border"
                    style={{
                        background: T.surface,
                        borderColor: T.border,
                        color: T.body,
                    }}
                >
                    Go to Rent Payment Dashboard →
                </button>
            </div>
        </div>
    );
}

function UnpaidRentRow({ rent, index }) {
    const isOverdue = rent.status === "overdue";

    return (
        <tr
            className="transition-colors hover:bg-[var(--color-muted)]"
            style={{
                borderBottom: `1px solid ${T.border}55`,
                animation: `rcb-up 0.25s ${EO} ${index * 22}ms both`,
            }}
        >
            <td className="py-3 pr-3" style={{ color: T.sub, fontSize: 12 }}>
                {rent.blockName}
            </td>
            <td className="py-3 px-3">
                <div className="text-[13px] font-semibold" style={{ color: T.text }}>
                    {rent.tenantName}
                </div>
            </td>
            <td className="py-3 px-3 text-[12px]" style={{ color: T.sub }}>
                {rent.unitLabel}
            </td>
            <td className="py-3 px-3 text-right">
                <span className="text-[13px] font-bold tabular-nums" style={{ color: T.red }}>
                    RS {formatPaisa(rent.outstandingPaisa)}
                </span>
            </td>
            <td className="py-3 px-3">
                <span
                    className="rounded text-[9px] font-bold px-1.5 py-0.5"
                    style={{
                        background: isOverdue ? T.redBg : T.amberBg,
                        color: isOverdue ? T.red : T.amber,
                    }}
                >
                    {isOverdue ? "Overdue" : "Partial"}
                </span>
            </td>
            <td className="py-3 pl-3 pr-0 text-[11px]" style={{ color: T.weak }}>
                {rent.englishDueDate ? toBSDate(rent.englishDueDate) : "—"}
            </td>
        </tr>
    );
}

// ─── Section 2 Table View ─────────────────────────────────────────────────────
function StreamTableView({ incomeStreams, collectionGap, loading }) {
    if (loading) return <><Skeleton /><Skeleton /><Skeleton /></>;

    const breakdown = incomeStreams?.breakdown;
    if (!breakdown || !Array.isArray(breakdown) || breakdown.length === 0) {
        return <Empty msg="No stream data for this period" />;
    }

    const streamMap = {};
    breakdown.forEach((item) => {
        streamMap[item.code] = item;
    });

    const totalAmount = breakdown.reduce((acc, item) => {
        const numericAmount = parseFloat(String(item.amount ?? "0").replace(/,/g, "")) || 0;
        return acc + numericAmount;
    }, 0);

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {[
                                { key: "Stream", align: "left" },
                                { key: "Booked (Accrual)", align: "right" },
                                { key: "Collected (Cash)", align: "right" },
                                { key: "Note", align: "left" },
                            ].map((h) => (
                                <th
                                    key={h.key}
                                    className="py-2.5 text-[9px] font-bold tracking-[0.08em] uppercase border-b"
                                    style={{
                                        color: T.weak,
                                        borderColor: T.border,
                                        textAlign: h.align,
                                        paddingLeft: h.key === "Stream" ? 0 : 12,
                                        paddingRight: h.key === "Note" ? 0 : 12,
                                    }}
                                >
                                    {h.key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {STREAM_ORDER.map((code, i) => {
                            const stream = streamMap[code];
                            if (!stream) return null;
                            const isRent = code === "RENT";
                            return (
                                <tr
                                    key={code}
                                    className="transition-colors hover:bg-[var(--color-muted)]"
                                    style={{
                                        borderBottom: `1px solid ${T.border}55`,
                                        animation: `rcb-up 0.25s ${EO} ${i * 30}ms both`,
                                    }}
                                >
                                    <td className="py-3 pr-3">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ background: STREAM_CFG[code]?.color ?? T.sub }}
                                            />
                                            <span className="text-[13px] font-medium" style={{ color: T.text }}>
                                                {stream.name ?? STREAM_CFG[code]?.label ?? code}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <span className="text-[13px] font-bold tabular-nums" style={{ color: T.text }}>
                                            RS {stream.amount}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <span className="text-[13px] tabular-nums" style={{ color: isRent ? T.green : T.weak }}>
                                            {isRent && collectionGap
                                                ? `RS ${formatPaisa(collectionGap.collectedPaisa)}`
                                                : "—"}
                                        </span>
                                    </td>
                                    <td className="py-3 pl-3 pr-0">
                                        <span className="text-[10px]" style={{ color: T.sub }}>
                                            {isRent ? "cash basis" : "accrual only ¹"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}

                        <tr style={{ borderTop: `1px solid ${T.border}` }}>
                            <td className="pt-3 pb-2 pr-3">
                                <span className="text-[12px] font-semibold italic" style={{ color: T.sub }}>
                                    Rent Total
                                </span>
                            </td>
                            <td className="pt-3 pb-2 px-3 text-right">
                                <span className="text-[12px] font-bold tabular-nums italic" style={{ color: T.sub }}>
                                    {streamMap.RENT ? `RS ${streamMap.RENT.amount}` : "—"}
                                </span>
                            </td>
                            <td className="pt-3 pb-2 px-3 text-right">
                                <span className="text-[12px] font-bold tabular-nums italic" style={{ color: T.green }}>
                                    {collectionGap ? `RS ${formatPaisa(collectionGap.collectedPaisa)}` : "—"}
                                </span>
                            </td>
                            <td className="pt-3 pb-2 pl-3 pr-0">
                                <span className="text-[10px] italic" style={{ color: T.sub }}>cash basis</span>
                            </td>
                        </tr>

                        <tr>
                            <td className="py-2 pr-3">
                                <span className="text-[12px] font-semibold italic" style={{ color: T.sub }}>
                                    All Streams
                                </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                                <span className="text-[12px] font-bold tabular-nums italic" style={{ color: T.sub }}>
                                    RS {totalAmount.toLocaleString("en-IN")}
                                </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                                <span className="text-[12px] italic" style={{ color: T.weak }}>—</span>
                            </td>
                            <td className="py-2 pl-3 pr-0">
                                <span className="text-[10px] italic" style={{ color: T.sub }}>mixed-basis ²</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-col gap-1">
                <div className="text-[10px]" style={{ color: T.weak }}>
                    ¹ Collection tracking not available — accrual figures only.
                </div>
                <div className="text-[10px]" style={{ color: T.weak }}>
                    ² Cash collection is rent-only. Do not use for cash position analysis.
                </div>
            </div>
        </div>
    );
}

// ─── Section 2 Chart View ─────────────────────────────────────────────────────
function StreamChartView({ incomeStreams, loading }) {
    if (loading) return <Skeleton h={200} />;

    const breakdown = incomeStreams?.breakdown;
    if (!breakdown || !Array.isArray(breakdown) || breakdown.length === 0) {
        return <Empty msg="No stream data for this period" />;
    }

    const streamMap = {};
    breakdown.forEach((item) => {
        streamMap[item.code] = parseFloat(String(item.amount ?? "0").replace(/,/g, "")) || 0;
    });

    const chartData = [
        {
            label: "This Period",
            RENT: streamMap.RENT ?? 0,
            CAM: streamMap.CAM ?? 0,
            ELECTRICITY: streamMap.ELECTRICITY ?? 0,
            LATE_FEE: streamMap.LATE_FEE ?? 0,
            OTHER: streamMap.OTHER ?? 0,
        },
    ];

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" vertical={false} stroke={T.border} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: T.weak }} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<StreamChartTip />} />
                {STREAM_ORDER.map((code) => (
                    <Bar
                        key={code}
                        dataKey={code}
                        name={STREAM_CFG[code]?.label ?? code}
                        stackId="streams"
                        fill={STREAM_CFG[code]?.color ?? T.sub}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RevenueCollectionBreakdown({
    selectedQuarter = null,
    selectedMonth = null,
    fiscalYear = null,
    customStartDate = "",
    customEndDate = "",
    entityId = null,
}) {
    const [streamView, setStreamView] = useState(null);

    const { collectionGap, incomeStreams, trend, unpaidRents, loading, error, refetch } =
        useCollectionSummary(
            selectedQuarter,
            customStartDate,
            customEndDate,
            selectedMonth,
            fiscalYear,
            entityId,
        );

    const isFullYear = !selectedMonth && !customStartDate;

    const defaultStreamView = isFullYear ? "chart" : "table";
    const activeStreamView = streamView ?? defaultStreamView;

    const periodLabel =
        customStartDate && customEndDate
            ? `${toBSDate(customStartDate)} → ${toBSDate(customEndDate)}`
            : selectedMonth
                ? `${NEPALI_MONTH_NAMES[selectedMonth - 1] ?? "—"}${fiscalYear ? ` ${fiscalYear}` : ""}`
                : fiscalYear
                    ? `FY ${fiscalYear}/${String(fiscalYear + 1).slice(2)}`
                    : "All Periods";

    const ratePct = collectionGap?.collectionRatePct ?? 0;
    const rateStyle = rateColors(ratePct);

    const sparklineData = trend.map((d) => ({ revenue: d.revenue }));

    const handleStreamViewChart = () => setStreamView("chart");
    const handleStreamViewTable = () => setStreamView("table");

    return (
        <div data-rcb style={{ color: T.text }}>
            <style>{ANIM_CSS}</style>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div
                        className="text-[11px] font-bold tracking-[0.1em] uppercase mb-1"
                        style={{ color: T.sub }}
                    >
                        Collection Health · {periodLabel}
                    </div>
                    <div className="text-[14px] font-medium" style={{ color: T.body }}>
                        Rent billed vs collected — cash basis tracking
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={refetch}
                        title="Refresh"
                        className="flex items-center justify-center h-8 w-8 rounded-lg border cursor-pointer transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: T.border }}
                    >
                        <RefreshCw size={13} color={T.body} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        disabled
                        title="Coming soon"
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold cursor-not-allowed opacity-40 transition-colors"
                        style={{ borderColor: T.border, background: T.surface, color: T.body }}
                    >
                        <Download size={12} />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div
                    className="rounded-lg px-4 py-3 text-xs mb-6 flex items-center gap-2"
                    style={{
                        background: T.redBg,
                        border: `1px solid ${T.redBorder}`,
                        color: T.red,
                    }}
                >
                    <span>⚠ {error}</span>
                    <button
                        onClick={refetch}
                        className="ml-auto font-bold underline bg-transparent border-none cursor-pointer"
                        style={{ color: T.red }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── SECTION 1 — KPI Strip ───────────────────────────────────── */}
            <SectionLabel>Collection Health</SectionLabel>

            <div className="flex gap-4 flex-wrap mb-6">
                <KpiCard
                    label="Billed"
                    sublabel="Rent only"
                    value={collectionGap ? `RS ${formatPaisa(collectionGap.billedPaisa)}` : "—"}
                    bg={T.surface}
                    border={T.border}
                    isLoading={loading}
                />
                <KpiCard
                    label="Collected"
                    sublabel="Rent only"
                    value={collectionGap ? `RS ${formatPaisa(collectionGap.collectedPaisa)}` : "—"}
                    valueColor={T.green}
                    bg={T.greenBg}
                    border={T.border}
                    isLoading={loading}
                />
                <KpiCard
                    label="Outstanding"
                    sublabel="Billed − Collected"
                    value={collectionGap ? `RS ${formatPaisa(collectionGap.outstandingPaisa)}` : "—"}
                    valueColor={collectionGap && collectionGap.outstandingPaisa > 0 ? T.red : T.text}
                    bg={collectionGap && collectionGap.outstandingPaisa > 0 ? T.redBg : T.surface}
                    border={T.border}
                    isLoading={loading}
                />
                <KpiCard
                    label="Collection Rate"
                    sublabel="% of billed collected"
                    value={collectionGap ? `${ratePct.toFixed(1)}%` : "—"}
                    valueColor={rateStyle.color}
                    bg={rateStyle.bg}
                    border={T.border}
                    sparklineData={sparklineData.length >= 2 ? sparklineData : null}
                    sparklineColor={rateStyle.color}
                    isLoading={loading}
                />
            </div>

            {/* ── KPI detail row ────────────────────────────────────────────── */}
            {!loading && collectionGap && (
                <div
                    className="flex gap-6 flex-wrap text-[11px] mb-2"
                    style={{ color: T.sub, animation: `rcb-up 0.35s ${EO} 0.1s both` }}
                >
                    <span>
                        <span style={{ color: T.weak }}>Total rents: </span>
                        <span style={{ color: T.body }}>{collectionGap.totalRents ?? "—"}</span>
                    </span>
                    <span>
                        <span style={{ color: T.weak }}>Paid: </span>
                        <span style={{ color: T.green }}>{collectionGap.paidCount ?? "—"}</span>
                    </span>
                    <span>
                        <span style={{ color: T.weak }}>Gross billed: </span>
                        <span style={{ color: T.body }}>
                            RS {formatPaisa(collectionGap.grossBilledPaisa)}
                        </span>
                    </span>
                    {collectionGap.tdsPaisa > 0 && (
                        <span>
                            <span style={{ color: T.weak }}>TDS deducted: </span>
                            <span style={{ color: T.amber }}>RS {formatPaisa(collectionGap.tdsPaisa)}</span>
                        </span>
                    )}
                </div>
            )}

            <Sep my={28} />

            {/* ── SECTION 2 — Revenue Stream Summary ──────────────────────── */}
            <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: T.sub }}>
                    Revenue Stream Summary
                </div>
                <div className="flex items-center gap-1">
                    <button
                        aria-pressed={activeStreamView === "chart"}
                        onClick={handleStreamViewChart}
                        className="h-7 px-3 rounded-l-md border text-[11px] font-semibold transition-colors"
                        style={{
                            background: activeStreamView === "chart" ? T.accent : "transparent",
                            borderColor: T.border,
                            color: activeStreamView === "chart" ? "#fff" : T.sub,
                            cursor: "pointer",
                        }}
                    >
                        Chart
                    </button>
                    <button
                        aria-pressed={activeStreamView === "table"}
                        onClick={handleStreamViewTable}
                        className="h-7 px-3 rounded-r-md border-t border-r border-b text-[11px] font-semibold transition-colors"
                        style={{
                            background: activeStreamView === "table" ? T.accent : "transparent",
                            borderColor: T.border,
                            color: activeStreamView === "table" ? "#fff" : T.sub,
                            cursor: "pointer",
                        }}
                    >
                        Table
                    </button>
                </div>
            </div>

            {activeStreamView === "table" ? (
                <StreamTableView
                    incomeStreams={incomeStreams}
                    collectionGap={collectionGap}
                    loading={loading}
                />
            ) : (
                <StreamChartView incomeStreams={incomeStreams} loading={loading} />
            )}

            {/* ── SECTION 3 — Who Hasn't Paid ─────────────────────────────── */}
            {!loading && collectionGap && collectionGap.collectionRatePct < 80 && (
                <>
                    <Sep my={28} />
                    <SectionLabel>Who Hasn't Paid</SectionLabel>
                    <UnpaidRentsSection
                        unpaidRents={unpaidRents}
                        collectionRatePct={ratePct}
                        loading={loading}
                    />
                </>
            )}
        </div>
    );
}
