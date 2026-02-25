import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, User, Circle, TrendingUp, TrendingDown, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP = {
  payment: CheckCircle,
  rent: CheckCircle,
  maintenance: Clock,
  tenant: User,
  revenue: TrendingUp,
  expense: TrendingDown,
  default: Circle,
};

const COLOR_MAP = {
  payment: 'bg-green-500',
  rent: 'bg-emerald-500',
  maintenance: 'bg-blue-500',
  tenant: 'bg-orange-500',
  revenue: 'bg-violet-500',
  expense: 'bg-red-400',
  default: 'bg-gray-400',
};

const LABEL_MAP = {
  payment: 'Payment',
  rent: 'Rent',
  maintenance: 'Maintenance',
  tenant: 'Tenant',
  revenue: 'Revenue',
  expense: 'Expense',
  default: 'Activity',
};

const BADGE_MAP = {
  payment: 'bg-green-100 text-green-700',
  rent: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-blue-100 text-blue-700',
  tenant: 'bg-orange-100 text-orange-700',
  revenue: 'bg-violet-100 text-violet-700',
  expense: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-500',
};

function formatRelativeTime(date) {
  if (!date) return '';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNepaliDate(nepaliDate) {
  if (!nepaliDate) return '';
  // nepaliDate may be a plain date object or string like "2081-05-15"
  if (typeof nepaliDate === 'string') return nepaliDate;
  if (nepaliDate instanceof Date) {
    return nepaliDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return String(nepaliDate);
}

function normalizeActivities(stats) {
  const raw = stats?.recentActivity ?? stats?.recentActivities ?? stats?.activities;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((item, i) => {
    if (item.mainText !== undefined) {
      const parts = [item.sub, item.time ? formatRelativeTime(item.time) : null].filter(Boolean);
      return {
        id: item.id ?? i,
        type: item.type ?? 'default',
        mainText: item.mainText,
        details: parts.join(' · '),
        amount: item.amount ?? null,
      };
    }

    const parts = [item.sub, item.time ? formatRelativeTime(item.time) : null].filter(Boolean);
    return {
      id: item.id ?? i,
      type: item.type ?? 'default',
      mainText: item.label ?? item.title ?? '—',
      details: parts.join(' · '),
      amount: item.amount ?? null,
    };
  });
}

function normalizeUpcoming(stats) {
  const raw = stats?.upcomingRents ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((r, i) => {
    const tenantName = r.tenant?.name ?? r.tenantName ?? '—';
    const propertyName = r.property?.name ?? r.propertyName ?? '';
    const dueDateStr = r.nepaliDueDate ? formatNepaliDate(r.nepaliDueDate) : '';
    const remaining = r.remainingPaisa != null ? r.remainingPaisa / 100 : (r.remaining ?? r.rentAmount ?? null);
    return {
      id: r._id ?? i,
      tenantName,
      propertyName,
      dueDate: dueDateStr,
      amount: remaining,
    };
  });
}

function ActivitySkeleton() {
  return (
    <div className="space-y-5 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full animate-pulse bg-muted shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-3/4 rounded animate-pulse bg-muted" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecentActivities({ stats, loading, error }) {
  const [tab, setTab] = useState('activity'); // 'activity' | 'upcoming'
  const activities = normalizeActivities(stats);
  const upcomingRents = normalizeUpcoming(stats);

  return (
    <Card className="rounded-xl shadow-md w-full bg-white border border-gray-100">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">
          Activity
        </CardTitle>
        <div className="flex items-center gap-3">
          {/* Tab toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setTab('activity')}
              className={`px-2.5 py-1.5 transition-colors ${tab === 'activity'
                ? 'bg-orange-800 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`px-2.5 py-1.5 transition-colors flex items-center gap-1 ${tab === 'upcoming'
                ? 'bg-orange-800 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
            >
              Upcoming
              {upcomingRents.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${tab === 'upcoming' ? 'bg-white text-orange-800' : 'bg-orange-100 text-orange-700'
                  }`}>
                  {upcomingRents.length}
                </span>
              )}
            </button>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-semibold text-orange-700 hover:text-orange-800 hover:underline uppercase tracking-wide"
          >
            View All
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}

        {/* ── Recent Activity Tab ──────────────────────────────────── */}
        {tab === 'activity' && (
          loading ? (
            <ActivitySkeleton />
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <Circle className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No recent transactions</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-100" aria-hidden />
              <div className="space-y-5">
                {activities.map((activity) => {
                  const IconComponent = ICON_MAP[activity.type] ?? ICON_MAP.default;
                  const iconColor = COLOR_MAP[activity.type] ?? COLOR_MAP.default;
                  const badgeColor = BADGE_MAP[activity.type] ?? BADGE_MAP.default;
                  const label = LABEL_MAP[activity.type] ?? LABEL_MAP.default;
                  return (
                    <div key={activity.id} className="relative flex items-start gap-3 group">
                      <div className={`relative z-10 ${iconColor} rounded-full p-1.5 shrink-0 shadow-sm ring-2 ring-white mt-0.5`}>
                        <IconComponent className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate leading-snug">
                            {activity.mainText}
                          </p>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                            {label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {activity.details}
                        </p>
                      </div>
                      {activity.amount != null && (
                        <span className="shrink-0 text-xs font-semibold text-gray-700 tabular-nums mt-0.5">
                          Rs.&nbsp;{Number(activity.amount).toLocaleString('en-NP')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Upcoming Rents Tab ────────────────────────────────────── */}
        {tab === 'upcoming' && (
          loading ? (
            <ActivitySkeleton />
          ) : upcomingRents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No upcoming rents in next 7 days</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingRents.map((r) => (
                <Link
                  to="/rent-payment"
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50 hover:border-orange-200 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full bg-amber-100 p-1.5 shrink-0">
                      <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.tenantName}</p>
                      {r.propertyName && (
                        <p className="text-xs text-gray-400 truncate">{r.propertyName}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {r.amount != null && (
                      <p className="text-xs font-semibold text-gray-700 tabular-nums">
                        Rs.&nbsp;{Number(r.amount).toLocaleString('en-NP')}
                      </p>
                    )}
                    {r.dueDate && (
                      <p className="text-xs text-amber-600 font-medium">Due {r.dueDate}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}