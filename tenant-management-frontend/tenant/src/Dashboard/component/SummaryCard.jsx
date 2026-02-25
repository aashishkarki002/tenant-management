import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wallet, Building2, AlertCircle, Wrench, ChevronRight, IndianRupee, AlertTriangle, TrendingUp } from 'lucide-react';
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

// ─── Skeletons ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/20 ${className}`} />;
}

function SkeletonLight({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

function SkeletonDanger({ className = '' }) {
  return <div className={`animate-pulse rounded bg-red-200 ${className}`} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SummaryCard({ stats, loading, error, onRetry }) {
  const [collectionView, setCollectionView] = useState('month'); // 'month' | 'year'

  // ── Collection ──────────────────────────────────────────────────────────────
  const rentSummary = stats?.rentSummary ?? {};
  const totalCollected = rentSummary.totalCollected ?? null;
  const target = rentSummary.totalRent ?? null;
  const outstanding = rentSummary.totalOutstanding ?? null;
  const collectionPct = pct(totalCollected, target);

  const revenueBreakdown = stats?.revenueBreakdown ?? [];
  const revenueBreakdownThisMonth = stats?.revenueBreakdownThisMonth ?? revenueBreakdown; // fallback to all-time if not available
  const totalRevenue = stats?.totalRevenue ?? revenueBreakdown.reduce((s, r) => s + r.amount, 0);
  // Derive totalCollected from this-month breakdown sum when available
  const thisMonthTotal = revenueBreakdownThisMonth.reduce((s, r) => s + r.amount, 0);
  const displayCollected = thisMonthTotal > 0 ? thisMonthTotal : totalCollected;

  // ── YTD scorecard derived from revenueThisYear ────────────────────────────
  const revenueThisYear = Array.isArray(stats?.revenueThisYear) ? stats.revenueThisYear : [];
  const currentNpMonth = stats?.npMonth ?? null;

  // Only count months up to and including the current month (past + current)
  const elapsedMonths = revenueThisYear.filter(m => currentNpMonth == null || m.month <= currentNpMonth);
  const ytdCollected = elapsedMonths.reduce((s, m) => s + (m.total ?? 0), 0);

  // Months that had any revenue recorded = "hit" months
  const hitMonths = elapsedMonths.filter(m => (m.total ?? 0) > 0).length;
  const missedMonths = elapsedMonths.length - hitMonths;
  const avgMonthly = elapsedMonths.length > 0 ? ytdCollected / elapsedMonths.length : 0;

  // YTD target = per-month target × elapsed months
  const monthlyTarget = target != null && elapsedMonths.length > 0 ? target : null;
  const ytdTarget = monthlyTarget != null ? monthlyTarget * elapsedMonths.length : null;
  const ytdPct = pct(ytdCollected, ytdTarget);

  // ── Occupancy ───────────────────────────────────────────────────────────────
  const occupancyRate = stats?.occupancyRate ?? 0;
  const occupied = stats?.occupiedUnits ?? 0;
  const totalUnits = stats?.totalUnits ?? 0;
  const vacant = Math.max(0, totalUnits - occupied);

  // ── Attention ───────────────────────────────────────────────────────────────
  const overdueRents = stats?.overdueRents ?? [];
  const overdueCount = overdueRents.length;
  const overdueAmount = overdueRents.reduce(
    (sum, r) => sum + (r.remainingPaisa ?? (r.remaining ?? 0) * 100), 0
  ) / 100;
  const maintenanceCount = stats?.maintenanceOpen ?? 0;
  const maintenanceDetail = stats?.maintenance?.[0]?.title ?? (maintenanceCount > 0 ? `${maintenanceCount} open request${maintenanceCount !== 1 ? 's' : ''}` : 'No open requests');

  // ── Contracts ending soon ───────────────────────────────────────────────────
  const contractsEndingSoon = stats?.contractsEndingSoon ?? [];

  const urgentCount = overdueCount + maintenanceCount;
  const isCritical = urgentCount > 0;

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 px-4 pb-2">

      {/* ── Collection Card with Month/Year Toggle ────────────────────── */}
      <Card className="rounded-xl shadow-md w-full bg-orange-800 text-white border-none sm:col-span-2 md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold tracking-widest uppercase opacity-80">
            Revenue
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Toggle pill */}
            <div className="flex rounded-md overflow-hidden border border-orange-600 text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setCollectionView('month')}
                className={`px-2.5 py-1 transition-colors ${collectionView === 'month'
                  ? 'bg-white text-orange-800'
                  : 'bg-transparent text-orange-200 hover:bg-orange-700'
                  }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setCollectionView('year')}
                className={`px-2.5 py-1 transition-colors ${collectionView === 'year'
                  ? 'bg-white text-orange-800'
                  : 'bg-transparent text-orange-200 hover:bg-orange-700'
                  }`}
              >
                Year
              </button>
            </div>
            <div className="rounded-md bg-orange-700/80 p-1.5">
              {collectionView === 'year' ? (
                <TrendingUp className="w-4 h-4 text-white" />
              ) : (
                <Wallet className="w-4 h-4 text-white" />
              )}
            </div>
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
              </div>
              <Skeleton className="h-4 w-40" />
            </>
          ) : collectionView === 'month' ? (
            <>
              <p className="text-xs text-orange-300 -mb-1">This month's collection</p>

              {/* Revenue line items — scoped to current month */}
              <ul className="space-y-2.5">
                {revenueBreakdownThisMonth.length > 0 ? revenueBreakdownThisMonth.map((item) => (
                  <li key={item.code} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />
                      <span className="text-sm text-orange-100 truncate">{item.name}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-white shrink-0">
                      {formatAmount(item.amount)}
                    </span>
                  </li>
                )) : (
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />
                      <span className="text-sm text-orange-100">Rent</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-white">
                      {displayCollected != null ? `₹${Number(displayCollected).toLocaleString()}` : '—'}
                    </span>
                  </li>
                )}
              </ul>

              {/* Divider + Total */}
              <div className="border-t border-orange-600 pt-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-orange-300">Total Collected</span>
                  <span className="text-lg font-bold tabular-nums text-white">
                    {displayCollected != null ? `₹${Number(displayCollected).toLocaleString()}` : '—'}
                  </span>
                </div>
                {target != null && target > 0 && (
                  <>
                    <Progress
                      value={pct(displayCollected, target)}
                      className="h-1.5 w-full bg-orange-700 *:data-[slot=progress-indicator]:bg-white *:data-[slot=progress-indicator]:rounded-r-full"
                    />
                    <p className="text-xs text-orange-300">
                      {pct(displayCollected, target)}% of ₹{Number(target).toLocaleString()} target
                    </p>
                  </>
                )}
              </div>

              {/* Outstanding due */}
              <div className="flex items-center justify-between rounded-lg bg-orange-900/60 px-3 py-2.5 mt-1">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
                  <IndianRupee className="w-3.5 h-3.5" />
                  Overall Due
                </span>
                <span className={`text-sm font-bold tabular-nums ${outstanding != null && Number(outstanding) > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  {outstanding != null ? `₹${Number(outstanding).toLocaleString()}` : '—'}
                </span>
              </div>
            </>
          ) : (
            /* ── YTD Scorecard ─────────────────────────────────────────── */
            <>
              <p className="text-xs text-orange-300 -mb-2">
                Collected year-to-date · {elapsedMonths.length} month{elapsedMonths.length !== 1 ? 's' : ''}
              </p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums">
                {`₹${Number(ytdCollected).toLocaleString()}`}
              </p>

              {/* YTD progress vs prorated target */}
              {ytdTarget != null && (
                <div className="space-y-1">
                  <Progress
                    value={ytdPct}
                    className="h-2 w-full bg-orange-700 *:data-[slot=progress-indicator]:bg-white *:data-[slot=progress-indicator]:rounded-r-full"
                  />
                  <p className="text-xs text-orange-200">
                    {ytdPct}% of {formatAmount(ytdTarget)} prorated target
                  </p>
                </div>
              )}

              {/* Key metrics grid */}
              <div className="grid grid-cols-3 gap-2 border-t border-orange-700 pt-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-lg font-bold tabular-nums">{formatAmount(avgMonthly)}</p>
                  <p className="text-[10px] text-orange-300 uppercase tracking-wide leading-tight">Avg / month</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-lg font-bold tabular-nums text-green-300">{hitMonths}</p>
                  <p className="text-[10px] text-orange-300 uppercase tracking-wide leading-tight">Months hit</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className={`text-lg font-bold tabular-nums ${missedMonths > 0 ? 'text-red-300' : 'text-white'}`}>
                    {missedMonths}
                  </p>
                  <p className="text-[10px] text-orange-300 uppercase tracking-wide leading-tight">Months missed</p>
                </div>
              </div>

              {/* Per-month collected rows — only elapsed months */}
              <ul className="space-y-1.5 border-t border-orange-700 pt-3 max-h-[120px] overflow-y-auto">
                {elapsedMonths.map((m) => {
                  const hasData = (m.total ?? 0) > 0;
                  const isCurrentMonth = m.month === currentNpMonth;
                  return (
                    <li key={m.month} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrentMonth ? 'bg-white' : hasData ? 'bg-green-400' : 'bg-orange-600'
                          }`} />
                        <span className={`text-xs truncate ${isCurrentMonth ? 'text-white font-semibold' : 'text-orange-200'}`}>
                          {m.name}{isCurrentMonth ? ' (now)' : ''}
                        </span>
                      </span>
                      <span className={`text-xs font-medium tabular-nums shrink-0 ${hasData ? 'text-white' : 'text-orange-600'}`}>
                        {hasData ? `₹${Number(m.total).toLocaleString()}` : 'no data'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Occupancy Rate ────────────────────────────────────────────── */}
      <Card className="rounded-xl shadow-md w-full bg-white text-gray-900 border border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold tracking-widest uppercase text-gray-500">
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
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{occupancyRate}%</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{occupied} of {totalUnits} units</p>
              <div className="flex justify-end text-xs text-gray-400">{vacant} vacant</div>
              <Progress
                value={occupancyRate}
                className="h-2 w-full bg-gray-100 *:data-[slot=progress-indicator]:bg-orange-800"
              />
              <div className="flex items-center justify-between pt-1">
                <Badge className={`text-xs border ${occupancyRate >= 80
                  ? 'text-green-700 bg-green-50 border-green-300'
                  : occupancyRate >= 50
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-300'
                    : 'text-red-700 bg-red-50 border-red-300'
                  }`}>
                  {occupancyRate >= 80 ? 'Stable' : occupancyRate >= 50 ? 'Moderate' : 'Low'}
                </Badge>
                <Link to="/units">
                  <Button className="text-xs font-medium text-orange-800 hover:underline bg-white border border-gray-200 hover:bg-orange-50 cursor-pointer h-8 px-3">
                    View All Units
                  </Button>
                </Link>
              </div>

              {/* Contracts ending soon — contextual nudge in occupancy card */}
              {contractsEndingSoon.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Leases ending soon
                  </p>
                  <ul className="space-y-1.5">
                    {contractsEndingSoon.slice(0, 2).map((c, i) => (
                      <li key={c._id ?? i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 truncate">{c.name}</span>
                        <span className={`text-xs font-semibold shrink-0 ml-2 px-1.5 py-0.5 rounded-full ${c.daysUntilEnd <= 7
                            ? 'bg-red-50 text-red-600'
                            : c.daysUntilEnd <= 14
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-gray-50 text-gray-500'
                          }`}>
                          {c.daysUntilEnd}d
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Attention Needed ──────────────────────────────────────────── */}
      <Card className={`rounded-xl shadow-md w-full border transition-all duration-300 ${isCritical
        ? 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50 ring-2 ring-red-200 ring-offset-1'
        : 'bg-white border-gray-100'
        }`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {isCritical && (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" style={{
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }} />
            )}
            <CardTitle className={`text-xs font-semibold tracking-widest uppercase ${isCritical ? 'text-red-700' : 'text-gray-500'
              }`}>
              Attention Needed
            </CardTitle>
          </div>
          {urgentCount > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm shadow-red-200 animate-pulse">
              {urgentCount} Urgent
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-2.5">
          {loading ? (
            <div className="space-y-2">
              <SkeletonDanger className="h-16 w-full" />
              <SkeletonDanger className="h-16 w-full" />
              <SkeletonLight className="h-4 w-36" />
            </div>
          ) : (
            <>
              {/* Overdue Payments Row */}
              <Link
                to="/rent-payment"
                className={`flex items-center justify-between rounded-lg p-3 transition-all group ${overdueCount > 0
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-200'
                  : 'border border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-1.5 shrink-0 ${overdueCount > 0 ? 'bg-red-400/50' : 'bg-gray-100'
                    }`}>
                    <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${overdueCount > 0 ? 'text-white' : 'text-gray-700'}`}>
                      {overdueCount} Overdue Payment{overdueCount !== 1 ? 's' : ''}
                    </p>
                    <p className={`text-xs ${overdueCount > 0 ? 'text-red-100' : 'text-gray-400'}`}>
                      {overdueCount > 0
                        ? `${overdueCount === 3 ? 'At least ' : ''}${formatAmount(overdueAmount)} total`
                        : 'All payments up to date'}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${overdueCount > 0 ? 'text-red-200' : 'text-gray-400'} group-hover:translate-x-0.5 transition-transform`} />
              </Link>

              {/* Maintenance Requests Row */}
              <Link
                to="/maintenance"
                className={`flex items-center justify-between rounded-lg p-3 transition-all group ${maintenanceCount > 0
                  ? 'bg-orange-800 text-white hover:bg-orange-900 shadow-sm shadow-orange-200'
                  : 'border border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-1.5 shrink-0 ${maintenanceCount > 0 ? 'bg-orange-700/50' : 'bg-gray-100'
                    }`}>
                    <Wrench className={`w-4 h-4 ${maintenanceCount > 0 ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${maintenanceCount > 0 ? 'text-white' : 'text-gray-700'}`}>
                      {maintenanceCount} Maintenance Request{maintenanceCount !== 1 ? 's' : ''}
                    </p>
                    <p className={`text-xs ${maintenanceCount > 0 ? 'text-orange-200' : 'text-gray-400'}`}>
                      {maintenanceDetail}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${maintenanceCount > 0 ? 'text-orange-300' : 'text-gray-400'} group-hover:translate-x-0.5 transition-transform`} />
              </Link>

              <Link
                to="/maintenance"
                className={`inline-flex items-center text-xs font-semibold hover:underline pt-1 ${isCritical ? 'text-red-700' : 'text-orange-800'
                  }`}
              >
                Go to Action Center
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}