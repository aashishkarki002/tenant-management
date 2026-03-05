import React from 'react';
import { AlertTriangle } from 'lucide-react';

// ─── BuildingPerformanceGrid ──────────────────────────────────────────────────
//
// DATA MODEL (your actual schema):
//
//   Block  ←  "Building" in this UI
//     e.g.  "Narendra Sadhan",  "Birendra Sadhan"
//
//   InnerBlock  ←  "Block" in this UI
//     e.g.  "Umanga Block", "Saurya Block", "Sagar Block", "Jyoti Block"
//
// Each card here represents ONE Block document.
// Occupancy  → aggregated from Unit.block
// Collection → aggregated from Rent.block for the current Nepali month
// Overdue    → aggregated from Rent.block where nepaliDueDate < today
//
// DATA CONTRACT (from UseStats normalization):
//   stats.buildings: Array<{
//     _id:  string,
//     name: string,                            ← Block.name
//     occupancy:  { occupied, total, rate },
//     collection: { collected, target, rate },
//     revenue:    number,                      ← = collection.collected
//     overdueAmount: number,
//   }>
//
// RISK THRESHOLDS (consistent with backend comments):
//   Collection < 70%  → red border + warning icon
//   Occupancy  < 60%  → red border + warning icon

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCompact(val) {
    if (val == null || isNaN(val)) return '—';
    const n = Number(val);
    if (n >= 10_000_000) return `Rs. ${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `Rs. ${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n}`;
}

function ProgressBar({ value = 0, danger = false, warning = false }) {
    const color = danger ? 'bg-red-500'
        : warning ? 'bg-amber-400'
            : 'bg-emerald-500';
    return (
        <div className="h-1 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.max(2, value)}%` }}
            />
        </div>
    );
}

// ─── Building Card ────────────────────────────────────────────────────────────

function BuildingCard({ building }) {
    const { name, occupancy, collection, revenue, overdueAmount } = building;

    // Use server-computed rates — no re-derivation needed here
    const collectionRate = collection.rate;
    const occupancyRate = occupancy.rate;

    const collectionDanger = collectionRate < 70;
    const occupancyDanger = occupancyRate < 60;
    const hasRisk = collectionDanger || occupancyDanger;

    return (
        <div
            className={`
        rounded-xl border bg-white p-4 flex flex-col gap-3
        transition-shadow hover:shadow-md
        ${hasRisk
                    ? 'border-red-200 shadow-[0_1px_4px_rgba(239,68,68,0.08)]'
                    : 'border-zinc-200 shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                }
      `}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900 truncate">{name}</p>
                {hasRisk && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                )}
            </div>

            {/* Revenue this month (= rent collected) */}
            <div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums leading-none">
                    {fmtCompact(revenue)}
                </p>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                    collected this month
                </p>
            </div>

            <div className="h-px w-full bg-zinc-100" />

            {/* Collection Rate */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 font-medium">Collection</span>
                    <div className="flex items-center gap-1.5">
                        {/* collected / target — gives owner the raw numbers at a glance */}
                        <span className="text-zinc-400 tabular-nums text-[10px]">
                            {fmtCompact(collection.collected)} / {fmtCompact(collection.target)}
                        </span>
                        <span className={`font-bold tabular-nums ${collectionRate >= 90 ? 'text-emerald-600'
                                : collectionRate >= 70 ? 'text-amber-600'
                                    : 'text-red-600'
                            }`}>{collectionRate}%</span>
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
                    <span className="text-zinc-500 font-medium">Occupancy</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 tabular-nums text-[10px]">
                            {occupancy.occupied}/{occupancy.total} units
                        </span>
                        <span className={`font-bold tabular-nums ${occupancyRate >= 80 ? 'text-emerald-600'
                                : occupancyRate >= 60 ? 'text-amber-600'
                                    : 'text-red-600'
                            }`}>{occupancyRate}%</span>
                    </div>
                </div>
                <ProgressBar
                    value={occupancyRate}
                    danger={occupancyDanger}
                    warning={!occupancyDanger && occupancyRate < 80}
                />
            </div>

            {/* Overdue balance — only shown when non-zero */}
            {overdueAmount > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-600 font-medium">Overdue</span>
                    <span className="text-[11px] font-bold text-red-700 tabular-nums">
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
        <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <div className="h-4 w-32 rounded animate-pulse bg-zinc-100" />
            <div className="h-7 w-24 rounded animate-pulse bg-zinc-100" />
            <div className="h-px w-full bg-zinc-100" />
            <div className="space-y-1.5">
                <div className="h-3 w-full rounded animate-pulse bg-zinc-100" />
                <div className="h-1.5 w-full rounded animate-pulse bg-zinc-100" />
            </div>
            <div className="space-y-1.5">
                <div className="h-3 w-full rounded animate-pulse bg-zinc-100" />
                <div className="h-1.5 w-full rounded animate-pulse bg-zinc-100" />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * BuildingPerformanceGrid
 *
 * Reads stats.buildings which is populated by buildBuildingPerformance()
 * in dashboard.service.js, normalized by UseStats.js.
 *
 * No changes needed in Dashboard.jsx — it already passes `stats` and `loading`.
 *
 * Props:
 *   stats   — normalized stats from useStats()
 *   loading — boolean
 */
export default function BuildingPerformanceGrid({ stats, loading }) {
    const buildings = stats?.buildings ?? [];

    const atRisk = buildings.filter(
        (b) => b.collection.rate < 70 || b.occupancy.rate < 60
    ).length;

    // Show skeleton while loading and no cached data yet
    if (loading && buildings.length === 0) {
        return (
            <section className="px-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-40 rounded animate-pulse bg-zinc-100" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {[1, 2].map((i) => <BuildingCardSkeleton key={i} />)}
                </div>
            </section>
        );
    }

    // No blocks in DB — render nothing (single-block/property owners)
    if (!loading && buildings.length === 0) return null;

    return (
        <section className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-sm font-semibold text-zinc-900">
                        Building Performance
                    </p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">
                        {buildings.length} {buildings.length === 1 ? 'building' : 'buildings'}
                        {atRisk > 0 && (
                            <span className="ml-2 text-red-500 font-semibold">
                                · {atRisk} needs attention
                            </span>
                        )}
                    </p>
                </div>
                {atRisk > 0 && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
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