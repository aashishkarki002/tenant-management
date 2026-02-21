import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wallet, Building2, AlertCircle, Wrench, ChevronRight, IndianRupee } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatAmount(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n.toLocaleString()}`;
}

function pct(collected, target) {
  if (!target || !collected) return 0;
  return Math.min(100, Math.round((Number(collected) / Number(target)) * 100));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/20 ${className}`} />;
}

function SkeletonLight({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SummaryCard({ stats, loading, error, onRetry }) {

  // ── Collection ──────────────────────────────────────────────────────────────
  const rentSummary = stats?.rentSummary ?? {};
  const totalCollected = rentSummary.totalCollected ?? null;
  const target = rentSummary.totalRent ?? null;
  const outstanding = rentSummary.totalOutstanding ?? null;
  const collectionPct = pct(totalCollected, target);

  // Revenue breakdown — [{ code, name, category, amount }], sorted highest first
  const revenueBreakdown = stats?.revenueBreakdown ?? [];
  const totalRevenue = stats?.totalRevenue ?? revenueBreakdown.reduce((s, r) => s + r.amount, 0);

  // ── Occupancy ───────────────────────────────────────────────────────────────
  // Flat fields — NOT nested under stats.occupancy
  const occupancyRate = stats?.occupancyRate ?? 0;
  const occupied = stats?.occupiedUnits ?? 0;
  const totalUnits = stats?.totalUnits ?? 0;
  const vacant = Math.max(0, totalUnits - occupied);

  // ── Attention ───────────────────────────────────────────────────────────────
  // overdueRents is an array (top 3) — maintenanceOpen is the full count
  const overdueRents = stats?.overdueRents ?? [];
  const overdueCount = overdueRents.length;
  // Sum remainingPaisa across the top-3 sample (paisa → rupees)
  const overdueAmount = overdueRents.reduce(
    (sum, r) => sum + (r.remainingPaisa ?? (r.remaining ?? 0) * 100), 0
  ) / 100;
  const maintenanceCount = stats?.maintenanceOpen ?? 0;
  const maintenanceDetail = stats?.maintenance?.[0]?.title ?? (maintenanceCount > 0 ? `${maintenanceCount} open request${maintenanceCount !== 1 ? 's' : ''}` : 'No open requests');

  // urgentCount = overdue payments + open maintenance
  const urgentCount = overdueCount + maintenanceCount;

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4">
        <Card className="md:col-span-3 p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive mb-2">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4">

      {/* ── This Month Collection ─────────────────────────────────────── */}
      <Card className="rounded-lg shadow-lg w-full bg-orange-800 text-white border-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold tracking-wide">
            This Month Collection
          </CardTitle>
          <div className="rounded-md bg-orange-700/80 p-1.5">
            <Wallet className="w-4 h-4 text-white" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-2 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-4 w-40" />
            </>
          ) : (
            <>
              {/* Total collected */}
              <p className="text-3xl font-bold">
                {totalCollected != null ? `₹${Number(totalCollected).toLocaleString()}` : '—'}
              </p>

              {/* Progress toward target */}
              <div className="space-y-1">
                <Progress
                  value={collectionPct}
                  className="h-2 w-full bg-orange-700 *:data-[slot=progress-indicator]:bg-white *:data-[slot=progress-indicator]:rounded-r-full"
                />
                <p className="text-xs text-orange-200">
                  {collectionPct}% of {target != null ? `₹${Number(target).toLocaleString()}` : '—'} target
                </p>
              </div>

              {/* Revenue breakdown by source */}
              {revenueBreakdown.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {revenueBreakdown.map((item) => (
                    <li key={item.code} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-200 shrink-0" />
                        <span className="truncate uppercase tracking-wide text-orange-100 text-xs">
                          {item.name}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatAmount(item.amount)}
                        {totalRevenue > 0 && (
                          <span className="ml-1 text-orange-300 font-normal">
                            ({Math.round((item.amount / totalRevenue) * 100)}%)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Outstanding */}
              <p className="flex items-center gap-2 text-sm pt-1 border-t border-orange-700">
                <IndianRupee className="w-4 h-4 shrink-0" />
                {outstanding != null
                  ? `₹${Number(outstanding).toLocaleString()} outstanding balance`
                  : '—'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Occupancy Rate ────────────────────────────────────────────── */}
      <Card className="rounded-lg shadow-lg w-full bg-white text-gray-900 border border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold tracking-wide text-gray-700">
            Occupancy Rate
          </CardTitle>
          <div className="rounded-md bg-orange-100 p-1.5">
            <Building2 className="w-4 h-4 text-orange-800" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <>
              <SkeletonLight className="h-9 w-20" />
              <SkeletonLight className="h-3 w-24" />
              <SkeletonLight className="h-2 w-full" />
              <div className="flex justify-between pt-1">
                <SkeletonLight className="h-6 w-16" />
                <SkeletonLight className="h-9 w-28" />
              </div>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{occupancyRate}%</p>
              <p className="text-xs text-gray-600">{occupied} OF {totalUnits} UNITS</p>
              <div className="flex justify-end text-xs text-gray-600">{vacant} VACANT</div>
              <Progress
                value={occupancyRate}
                className="h-2 w-full bg-gray-200 *:data-[slot=progress-indicator]:bg-orange-800"
              />
              <div className="flex items-center justify-between pt-1">
                <Badge className={`text-sm border ${occupancyRate >= 80
                  ? 'text-green-600 bg-green-50 border-green-600'
                  : occupancyRate >= 50
                    ? 'text-yellow-600 bg-yellow-50 border-yellow-500'
                    : 'text-red-600 bg-red-50 border-red-500'
                  }`}>
                  {occupancyRate >= 80 ? 'Stable' : occupancyRate >= 50 ? 'Moderate' : 'Low'}
                </Badge>
                <Link to="/units">
                  <Button className="text-sm font-medium text-orange-800 hover:underline bg-white border border-gray-200 hover:bg-orange-50 cursor-pointer">
                    View All Units
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Attention Needed ──────────────────────────────────────────── */}
      <Card className="rounded-lg shadow-lg w-full bg-white text-gray-900 border border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold tracking-wide text-gray-700">
            Attention Needed
          </CardTitle>
          {urgentCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {urgentCount} Urgent
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <SkeletonLight className="h-16 w-full" />
              <SkeletonLight className="h-16 w-full" />
              <SkeletonLight className="h-4 w-36" />
            </div>
          ) : (
            <>
              <Link
                to="/rent-payment"
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className={`w-5 h-5 shrink-0 ${overdueCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {overdueCount} Overdue Payment{overdueCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {/* overdueRents is a top-3 sample — show "at least" when count = 3 */}
                      {overdueCount > 0
                        ? `${overdueCount === 3 ? 'At least ' : ''}Totaling ${formatAmount(overdueAmount)}`
                        : 'All payments up to date'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>

              <Link
                to="/maintenance"
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Wrench className={`w-5 h-5 shrink-0 ${maintenanceCount > 0 ? 'text-orange-800' : 'text-gray-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {maintenanceCount} Maintenance Request{maintenanceCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">{maintenanceDetail}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>

              <Link
                to="/maintenance"
                className="inline-flex items-center text-sm font-medium text-orange-800 hover:underline pt-1"
              >
                Go to Action Center
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}