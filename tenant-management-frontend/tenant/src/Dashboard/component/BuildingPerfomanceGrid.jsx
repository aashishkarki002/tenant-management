// src/pages/component/BuildingPerformanceGrid.jsx
//
// Building-level performance cards.
// All colors use CSS variables — no zinc-* hardcodes.

import React from "react";
import { AlertTriangle } from "lucide-react";

// ─── Status color tokens (semantic: green / yellow / red) ────────────────────
const S = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--destructive)",
    dangerBg: "color-mix(in oklch, var(--destructive) 14%, transparent)",  // red-100 style
    dangerBorder: "color-mix(in oklch, var(--destructive) 30%, transparent)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCompact(val) {
    if (val == null || isNaN(val)) return "—";
    const n = Number(val);
    if (n >= 10_000_000) return `Rs. ${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `Rs. ${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n}`;
}

function ProgressBar({ value = 0, danger = false, warning = false }) {
    const color = danger ? S.danger : warning ? S.warning : S.success;
    return (
        <div className="h-1 w-full rounded-full overflow-hidden bg-secondary">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, value)}%`, background: color }}
            />
        </div>
    );
}

// ─── Building Card ────────────────────────────────────────────────────────────

function BuildingCard({ building }) {
    const { name, occupancy, collection, revenue, overdueAmount } = building;
    const collectionRate = collection.rate;
    const occupancyRate = occupancy.rate;
    const collectionDanger = collectionRate < 70;
    const occupancyDanger = occupancyRate < 60;
    const hasRisk = collectionDanger || occupancyDanger;

    return (
        <div
            className="rounded-xl border bg-card p-4 flex flex-col gap-3
                 transition-shadow hover:shadow-md"
            style={{
                borderColor: hasRisk ? S.dangerBorder : "var(--color-border)",
                boxShadow: hasRisk
                    ? "0 1px 4px oklch(0.45 0.14 19 / 8%)"
                    : "0 1px 4px oklch(0 0 0 / 4%)",
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                {hasRisk && (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: S.danger }} />
                )}
            </div>

            {/* Revenue */}
            <div>
                <p className="text-xl font-bold text-foreground tabular-nums leading-none">
                    {fmtCompact(revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    collected this month
                </p>
            </div>

            <div className="h-px w-full bg-secondary" />

            {/* Collection Rate */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">Collection</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground tabular-nums text-[10px]">
                            {fmtCompact(collection.collected)} / {fmtCompact(collection.target)}
                        </span>
                        <span
                            className="font-bold tabular-nums"
                            style={{
                                color: collectionRate >= 90 ? S.success
                                    : collectionRate >= 70 ? S.warning
                                        : S.danger,
                            }}
                        >
                            {collectionRate}%
                        </span>
                    </div>
                </div>
                <ProgressBar
                    value={collectionRate}
                    danger={collectionDanger}
                    warning={!collectionDanger && collectionRate < 90}
                />
            </div>

            {/* Occupancy Rate */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">Occupancy</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground tabular-nums text-[10px]">
                            {occupancy.occupied}/{occupancy.total} units
                        </span>
                        <span
                            className="font-bold tabular-nums"
                            style={{
                                color: occupancyRate >= 80 ? S.success
                                    : occupancyRate >= 60 ? S.warning
                                        : S.danger,
                            }}
                        >
                            {occupancyRate}%
                        </span>
                    </div>
                </div>
                <ProgressBar
                    value={occupancyRate}
                    danger={occupancyDanger}
                    warning={!occupancyDanger && occupancyRate < 80}
                />
            </div>

            {/* Overdue balance */}
            {overdueAmount > 0 && (
                <div
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                    style={{ background: S.dangerBg }}
                >
                    <span className="text-[11px] font-medium" style={{ color: S.danger }}>Overdue</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: S.danger }}>
                        {fmtCompact(overdueAmount)}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function BuildingCardSkeleton() {
    return (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="h-4 w-32 rounded animate-pulse bg-secondary" />
            <div className="h-7 w-24 rounded animate-pulse bg-secondary" />
            <div className="h-px w-full bg-secondary" />
            <div className="space-y-1.5">
                <div className="h-3 w-full rounded animate-pulse bg-secondary" />
                <div className="h-1.5 w-full rounded animate-pulse bg-muted" />
            </div>
            <div className="space-y-1.5">
                <div className="h-3 w-full rounded animate-pulse bg-secondary" />
                <div className="h-1.5 w-full rounded animate-pulse bg-muted" />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BuildingPerformanceGrid({ stats, loading }) {
    const buildings = stats?.buildings ?? [];
    const atRisk = buildings.filter(
        (b) => b.collection.rate < 70 || b.occupancy.rate < 60
    ).length;

    if (loading && buildings.length === 0) {
        return (
            <section className="px-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-40 rounded animate-pulse bg-secondary" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {[1, 2].map((i) => <BuildingCardSkeleton key={i} />)}
                </div>
            </section>
        );
    }

    if (!loading && buildings.length === 0) return null;

    return (
        <section className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-sm font-semibold text-foreground">Building Performance</p>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {buildings.length} {buildings.length === 1 ? "building" : "buildings"}
                        {atRisk > 0 && (
                            <span className="ml-2 font-semibold" style={{ color: S.danger }}>
                                · {atRisk} needs attention
                            </span>
                        )}
                    </p>
                </div>
                {atRisk > 0 && (
                    <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                        style={{
                            background: S.dangerBg,
                            color: S.danger,
                            borderColor: S.dangerBorder,
                        }}
                    >
                        {atRisk} at risk
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {buildings.map((b, i) => (
                    <BuildingCard key={b._id ?? i} building={b} />
                ))}
            </div>
        </section>
    );
}