/**
 * OverviewTab — distilled
 *
 * Before: 9 card-chrome elements (5 health chips + 4 KPI cards) + sidebar + chart
 * After:  1 summary bar → full-width chart → 2-col detail row → transactions
 *
 * Changes from audit:
 *  - PortfolioHealthStrip + HeroCard + 3×KpiCard → single SummaryBar
 *  - DarkCard removed; size + color carry hierarchy instead
 *  - Sparklines + breakdown pills removed from KPI level
 *  - Chart always full-width (no competing sidebar)
 *  - ArrearsAgingCard + MiniCashFlow → compact 2-col panels below chart
 *  - Min text size 11px (was 9px throughout)
 *  - Max font weight: font-bold (was font-black)
 *  - Uppercase tracking removed from field-level labels
 */

import { Skeleton, ProgBar } from "../AccountingPrimitives";
import {
    RevExpChart,
    CompareChart,
} from "../AccountingCharts";
import ChartCard from "../ChartCard";
import LedgerFeed from "../LedgerFeed";
import { fmtK } from "../AccountingPage";
import { cn } from "@/lib/utils";
import {
    TrendingUpIcon, TrendingDownIcon,
    CheckCircle2Icon,
} from "lucide-react";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
    revenue:  "var(--color-info)",
    expenses: "var(--color-warning)",
    success:  "var(--color-success)",
    danger:   "var(--color-danger)",
    sub:      "var(--color-text-sub)",
    body:     "var(--color-text-body)",
    strong:   "var(--color-text-strong)",
    border:   "var(--color-border)",
    surface:  "var(--color-surface)",
    raised:   "var(--color-surface-raised)",
};

function paisaToRs(p) { return (p ?? 0) / 100; }

// ─── Trend badge — replaces YoYBadge, inline and token-correct ───────────────
function TrendBadge({ pct, loading }) {
    if (loading) return <div className="h-4 w-10 rounded animate-pulse" style={{ background: T.border }} />;
    if (pct == null) return null;
    const up = pct > 0, flat = pct === 0;
    const color = flat ? T.sub : up ? T.success : T.danger;
    return (
        <span className="inline-flex items-center gap-0.5" style={{ color }}>
            {!flat && (up ? <TrendingUpIcon size={10} /> : <TrendingDownIcon size={10} />)}
            <span className="text-[11px] font-semibold tabular-nums">
                {up ? "+" : ""}{pct.toFixed(1)}% YoY
            </span>
        </span>
    );
}

// ─── SummaryBar — replaces PortfolioHealthStrip + HeroCard + 3 KpiCards ──────
//
// One bordered container, four metric cells divided by hairline borders.
// Net Cash gets the dominant treatment via font size + color, not a black card.
// No sparklines, no breakdown pills, no nested card chrome.
function SummaryBar({ totals, netMargin, health, loadingSummary, healthLoading }) {
    const col = health?.collection;
    const yoy = health?.yoyDeltas;
    const isDeficit = (totals.netCashFlow ?? 0) < 0;
    const netColor = isDeficit ? T.danger : T.success;

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{ background: T.raised, border: `1px solid ${T.border}` }}
        >
            <div className="grid grid-cols-2 lg:grid-cols-4">

                {/* Net Cash — primary, slightly larger */}
                <div className="flex flex-col gap-1 px-5 py-4 border-r border-b lg:border-b-0"
                    style={{ borderColor: T.border }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium" style={{ color: T.sub }}>
                            Net cash flow
                        </span>
                        <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            isDeficit
                                ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                                : "bg-[var(--color-success-bg)] text-[var(--color-success)]",
                        )}>
                            {isDeficit ? "Deficit" : "Surplus"}
                        </span>
                    </div>
                    {loadingSummary
                        ? <Skeleton h={32} />
                        : (
                            <span
                                className="font-bold tabular-nums leading-none"
                                style={{
                                    fontSize: "clamp(20px, 2.5vw, 28px)",
                                    color: netColor,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {isDeficit ? "−" : "+"}RS {fmtK(Math.abs(totals.netCashFlow))}
                            </span>
                        )}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px]" style={{ color: T.sub }}>
                            {netMargin >= 0 ? "+" : ""}{netMargin.toFixed(1)}% margin
                        </span>
                        <TrendBadge pct={yoy?.netCashFlow?.pct} loading={healthLoading} />
                    </div>
                </div>

                {/* Revenue */}
                <div className="flex flex-col gap-1 px-5 py-4 border-b lg:border-b-0 lg:border-l"
                    style={{ borderColor: T.border }}>
                    <span className="text-[11px] font-medium" style={{ color: T.sub }}>Revenue</span>
                    {loadingSummary
                        ? <Skeleton h={28} />
                        : (
                            <span
                                className="text-[22px] font-bold tabular-nums leading-none"
                                style={{ color: T.revenue, letterSpacing: "-0.02em" }}
                            >
                                RS {fmtK(totals.totalRevenue)}
                            </span>
                        )}
                    <TrendBadge pct={yoy?.revenue?.pct} loading={healthLoading} />
                </div>

                {/* Expenses */}
                <div className="flex flex-col gap-1 px-5 py-4 border-r border-t lg:border-t-0 lg:border-l"
                    style={{ borderColor: T.border }}>
                    <span className="text-[11px] font-medium" style={{ color: T.sub }}>Expenses</span>
                    {loadingSummary
                        ? <Skeleton h={28} />
                        : (
                            <span
                                className="text-[22px] font-bold tabular-nums leading-none"
                                style={{ color: T.expenses, letterSpacing: "-0.02em" }}
                            >
                                RS {fmtK(totals.totalExpenses)}
                            </span>
                        )}
                    <TrendBadge pct={yoy?.expenses?.pct} loading={healthLoading} />
                </div>

                {/* NOI Margin */}
                <div className="flex flex-col gap-1 px-5 py-4 border-t lg:border-t-0 lg:border-l"
                    style={{ borderColor: T.border }}>
                    <span className="text-[11px] font-medium" style={{ color: T.sub }}>NOI margin</span>
                    {healthLoading
                        ? <Skeleton h={28} />
                        : (
                            <span
                                className="text-[22px] font-bold tabular-nums leading-none"
                                style={{
                                    color: (health?.noi?.noiMarginPct ?? 0) >= 40 ? T.success
                                        : (health?.noi?.noiMarginPct ?? 0) >= 20 ? "var(--color-warning)"
                                        : T.danger,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {(health?.noi?.noiMarginPct ?? 0).toFixed(1)}%
                            </span>
                        )}
                    <span className="text-[11px]" style={{ color: T.sub }}>
                        {healthLoading ? "" : `NOI: RS ${fmtK(paisaToRs(health?.noi?.noiPaisa ?? 0))}`}
                    </span>
                </div>

            </div>
        </div>
    );
}

// ─── ArrearsPanel — simplified list, no icon overload ────────────────────────
function ArrearsPanel({ aging, loading }) {
    const buckets = [
        { label: "1–30 days",  data: aging?.days30,     color: "var(--color-warning)" },
        { label: "31–60 days", data: aging?.days60,     color: "var(--color-danger)",  opacity: 0.7 },
        { label: "60+ days",   data: aging?.days90Plus, color: "var(--color-danger)" },
    ];

    const totalAmount = buckets.reduce((s, b) => s + (b.data?.amountPaisa ?? 0), 0);
    const totalCount  = buckets.reduce((s, b) => s + (b.data?.count ?? 0), 0);

    return (
        <div className="rounded-xl overflow-hidden" style={{ background: T.raised, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: T.border }}>
                <span className="text-[12px] font-semibold" style={{ color: T.body }}>Arrears aging</span>
                {!loading && totalCount > 0 && (
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: T.danger }}>
                        RS {fmtK(paisaToRs(totalAmount))}
                    </span>
                )}
            </div>

            {!loading && totalCount === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3.5">
                    <CheckCircle2Icon size={13} style={{ color: T.success }} />
                    <span className="text-[12px] font-medium" style={{ color: T.success }}>
                        No outstanding arrears
                    </span>
                </div>
            ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: T.border }}>
                    {buckets.map((b) => (
                        <div key={b.label} className="flex items-center justify-between px-4 py-2.5">
                            {loading
                                ? <Skeleton h={14} />
                                : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ background: b.color, opacity: b.opacity ?? 1 }}
                                            />
                                            <span className="text-[12px]" style={{ color: T.body }}>{b.label}</span>
                                            <span className="text-[11px]" style={{ color: T.sub }}>
                                                {b.data?.count ?? 0} rent{(b.data?.count ?? 0) !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span
                                                className="text-[12px] font-semibold tabular-nums"
                                                style={{ color: b.color, opacity: b.opacity ?? 1 }}
                                            >
                                                RS {fmtK(paisaToRs(b.data?.amountPaisa ?? 0))}
                                            </span>
                                            <ProgBar
                                                value={b.data?.amountPaisa ?? 0}
                                                max={totalAmount || 1}
                                                color={b.color}
                                                h={2}
                                            />
                                        </div>
                                    </>
                                )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── CompareTable — period comparison summary ─────────────────────────────────
function CompareTable({ comparisonStats, labelA, labelB }) {
    if (!comparisonStats) return null;
    const rows = [
        { label: "Revenue",       key: "revenue",     color: T.revenue },
        { label: "Expenses",      key: "expenses",    color: T.expenses },
        { label: "Net cash flow", key: "netCashFlow", color: T.success },
    ];
    return (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            <div
                className="grid grid-cols-4 text-[11px] font-semibold px-4 py-2.5 border-b"
                style={{ borderColor: T.border, background: T.surface, color: T.sub }}
            >
                <div>Metric</div>
                <div className="text-right truncate">{labelA}</div>
                <div className="text-right truncate">{labelB}</div>
                <div className="text-right">Change</div>
            </div>
            {rows.map((r) => {
                const s = comparisonStats[r.key];
                if (!s) return null;
                const up = s.pct > 0, flat = s.pct === 0;
                const changeColor = flat ? T.sub : up ? T.success : T.danger;
                return (
                    <div
                        key={r.label}
                        className="grid grid-cols-4 px-4 py-2.5 border-b last:border-b-0 items-center"
                        style={{ borderColor: T.border }}
                    >
                        <div className="text-[12px] font-medium" style={{ color: T.body }}>{r.label}</div>
                        <div className="text-[12px] font-semibold tabular-nums text-right" style={{ color: r.color }}>
                            RS {fmtK(s.a)}
                        </div>
                        <div className="text-[12px] font-semibold tabular-nums text-right" style={{ color: r.color, opacity: 0.6 }}>
                            RS {fmtK(s.b)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            {s.pct == null
                                ? <span className="text-[11px]" style={{ color: T.sub }}>—</span>
                                : (
                                    <>
                                        {!flat && (up
                                            ? <TrendingUpIcon size={10} style={{ color: changeColor }} />
                                            : <TrendingDownIcon size={10} style={{ color: changeColor }} />)}
                                        <span className="text-[12px] font-semibold tabular-nums" style={{ color: changeColor }}>
                                            {up ? "+" : ""}{s.pct?.toFixed(1)}%
                                        </span>
                                    </>
                                )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function OverviewTab({
    loadingSummary,
    totals,
    netMargin,
    chartData,
    compareData,
    comparisonStats,
    loadingChart,
    compareMode,
    labelA,
    labelB,
    filterLabel,
    ledgerEntries,
    loadingLedger,
    onViewLedger,
    currentBSMonth,
    health,
    healthLoading,
}) {
    return (
        <div className="flex flex-col gap-4">

            {/* ── 1. Summary bar — 4 metrics, one surface, no card-per-metric ── */}
            <SummaryBar
                totals={totals}
                netMargin={netMargin}
                health={health}
                loadingSummary={loadingSummary}
                healthLoading={healthLoading}
            />

            {/* ── 2. Compare mode banner ─────────────────────────────────────── */}
            {compareMode && (
                <div
                    className="rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap"
                    style={{
                        background: "var(--color-accent-light)",
                        border: "1px solid var(--color-accent-mid)",
                    }}
                >
                    <span className="text-[11px] font-semibold" style={{ color: "var(--color-accent)" }}>
                        Comparing
                    </span>
                    <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white font-semibold">
                        A: {labelA}
                    </span>
                    <span className="text-[12px]" style={{ color: T.sub }}>vs</span>
                    <span
                        className="text-[12px] px-2.5 py-0.5 rounded-full border font-semibold"
                        style={{
                            background: "var(--color-warning-bg)",
                            color: "var(--color-warning)",
                            borderColor: "var(--color-warning-border)",
                        }}
                    >
                        B: {labelB}
                    </span>
                </div>
            )}

            {/* ── 3. Chart — always full width ──────────────────────────────── */}
            <ChartCard
                title={compareMode
                    ? `Cash flow — ${labelA} vs ${labelB}`
                    : "Cash flow trend"}
                subtitle={filterLabel}
                actions={
                    <div className="flex gap-4">
                        {[
                            { color: T.revenue, label: "Revenue" },
                            { color: T.expenses, label: "Expenses" },
                        ].map(x => (
                            <div key={x.label} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm" style={{ background: x.color }} />
                                <span className="text-[11px]" style={{ color: T.sub }}>{x.label}</span>
                            </div>
                        ))}
                    </div>
                }
            >
                {compareMode
                    ? <CompareChart data={compareData} loading={loadingChart} labelA={labelA} labelB={labelB} />
                    : <RevExpChart data={chartData} loading={loadingChart} currentMonth={currentBSMonth} />}
            </ChartCard>

            {/* Compare table (compare mode only) */}
            {compareMode && comparisonStats && (
                <CompareTable comparisonStats={comparisonStats} labelA={labelA} labelB={labelB} />
            )}

            {/* ── 4. Arrears — full width, most actionable data on this page ── */}
            <ArrearsPanel aging={health?.arrearsAging} loading={healthLoading} />

            {/* ── 5. Recent transactions ────────────────────────────────────── */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: T.raised, border: `1px solid ${T.border}` }}
            >
                <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: T.border }}
                >
                    <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-semibold" style={{ color: T.body }}>
                            Recent transactions
                        </span>
                        {ledgerEntries.length > 0 && (
                            <span className="text-[11px]" style={{ color: T.sub }}>
                                {Math.min(8, ledgerEntries.length)} of {ledgerEntries.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onViewLedger}
                        className="text-[12px] font-semibold bg-transparent border-none cursor-pointer text-[var(--color-accent)] hover:opacity-75 transition-opacity"
                    >
                        View all →
                    </button>
                </div>
                <LedgerFeed entries={ledgerEntries} loading={loadingLedger} onViewAll={onViewLedger} />
            </div>

        </div>
    );
}
