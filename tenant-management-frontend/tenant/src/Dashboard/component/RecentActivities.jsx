import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Clock, User, Circle, TrendingUp, TrendingDown,
  CalendarClock, Wrench, Zap, AlertTriangle, Fuel,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Icon / colour maps (recent activity feed) ────────────────────────────────

const ICON_MAP = {
  payment: CheckCircle, rent: CheckCircle, maintenance: Clock,
  tenant: User, revenue: TrendingUp, expense: TrendingDown, default: Circle,
};
const COLOR_MAP = {
  payment: 'bg-green-500', rent: 'bg-emerald-500', maintenance: 'bg-blue-500',
  tenant: 'bg-orange-500', revenue: 'bg-violet-500', expense: 'bg-red-400', default: 'bg-gray-400',
};
const LABEL_MAP = {
  payment: 'Payment', rent: 'Rent', maintenance: 'Maintenance',
  tenant: 'Tenant', revenue: 'Revenue', expense: 'Expense', default: 'Activity',
};
const BADGE_MAP = {
  payment: 'bg-green-100 text-green-700', rent: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-blue-100 text-blue-700', tenant: 'bg-orange-100 text-orange-700',
  revenue: 'bg-violet-100 text-violet-700', expense: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-500',
};

const PRIORITY_BADGE = {
  Urgent: 'bg-red-100 text-red-700', High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700', Low: 'bg-gray-100 text-gray-500',
};
const STATUS_BADGE = {
  OPEN: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-amber-100 text-amber-700',
};
const GENERATOR_STATUS_COLOR = {
  RUNNING: 'bg-green-100 text-green-700', IDLE: 'bg-gray-100 text-gray-500',
  MAINTENANCE: 'bg-amber-100 text-amber-700', FAULT: 'bg-red-100 text-red-700',
};

// ─── Formatters ───────────────────────────────────────────────────────────────

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

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNepaliDate(nepaliDate) {
  if (!nepaliDate) return '';
  if (typeof nepaliDate === 'string') return nepaliDate;
  if (nepaliDate instanceof Date) return nepaliDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return String(nepaliDate);
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - Date.now()) / 86_400_000);
}

function daysLabel(d) {
  const n = daysUntil(d);
  if (n == null) return '';
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return 'Today';
  return `In ${n}d`;
}

// ─── Data normalisers ─────────────────────────────────────────────────────────

function normalizeActivities(stats) {
  const raw = stats?.recentActivity ?? stats?.recentActivities ?? stats?.activities;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => {
    const parts = [item.sub, item.time ? formatRelativeTime(item.time) : null].filter(Boolean);
    return {
      id: item.id ?? i,
      type: item.type ?? 'default',
      mainText: item.mainText ?? item.label ?? item.title ?? '—',
      details: parts.join(' · '),
      amount: item.amount ?? null,
    };
  });
}

function normalizeUpcomingRents(stats) {
  return (stats?.upcomingRents ?? []).map((r, i) => ({
    id: r._id ?? i,
    tenantName: r.tenant?.name ?? r.tenantName ?? '—',
    propertyName: r.property?.name ?? r.propertyName ?? '',
    dueDate: r.nepaliDueDate ? formatNepaliDate(r.nepaliDueDate) : '',
    amount: r.remainingPaisa != null ? r.remainingPaisa / 100 : (r.remaining ?? r.rentAmount ?? null),
  }));
}

function normalizeUpcomingMaintenance(stats) {
  return (stats?.upcomingMaintenance ?? []).map((m, i) => ({
    id: m._id ?? i,
    title: m.title ?? 'Maintenance',
    priority: m.priority,
    status: m.status,
    scheduledDate: m.scheduledDate,
    property: m.property,
    unit: m.unit,
    assignedTo: m.assignedTo,
  }));
}

function normalizeGenerators(stats) {
  return (stats?.generatorsDueService ?? []).map((g, i) => ({
    id: g._id ?? i,
    name: g.name ?? 'Generator',
    status: g.status,
    currentFuelPercent: g.currentFuelPercent,
    criticalFuelThresholdPercent: g.criticalFuelThresholdPercent ?? 10,
    lowFuelThresholdPercent: g.lowFuelThresholdPercent ?? 20,
    nextServiceDate: g.nextServiceDate,
    property: g.property,
  }));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

function CardSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
          <div className="w-8 h-8 rounded-full animate-pulse bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 rounded animate-pulse bg-muted" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────

function RentRow({ r }) {
  return (
    <Link
      to="/rent-payment"
      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-full bg-amber-100 p-1.5 shrink-0">
          <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{r.tenantName}</p>
          {r.propertyName && <p className="text-xs text-gray-400 truncate">{r.propertyName}</p>}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        {r.amount != null && (
          <p className="text-xs font-semibold text-gray-700 tabular-nums">
            Rs.&nbsp;{Number(r.amount).toLocaleString('en-NP')}
          </p>
        )}
        {r.dueDate && <p className="text-xs text-amber-600 font-medium">Due {r.dueDate}</p>}
      </div>
    </Link>
  );
}

function MaintenanceRow({ task }) {
  const days = daysUntil(task.scheduledDate);
  const isOverdue = days != null && days < 0;
  return (
    <Link
      to="/dashboard/maintenance"
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className={`rounded-full p-2 shrink-0 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
        <Wrench className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
          {task.priority && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority] ?? 'bg-gray-100 text-gray-500'}`}>
              {task.priority}
            </span>
          )}
          {task.status && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {[task.property?.name, task.unit?.name, task.assignedTo?.name ? `Assigned: ${task.assignedTo.name}` : null]
            .filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={`text-xs font-semibold tabular-nums ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
          {daysLabel(task.scheduledDate)}
        </p>
        <p className="text-[11px] text-gray-400">{formatDate(task.scheduledDate)}</p>
      </div>
    </Link>
  );
}

function GeneratorRow({ gen }) {
  const serviceOverdue = gen.nextServiceDate && daysUntil(gen.nextServiceDate) < 0;
  const lowFuel = gen.currentFuelPercent != null && gen.currentFuelPercent <= gen.lowFuelThresholdPercent;
  const critical = gen.currentFuelPercent != null && gen.currentFuelPercent <= gen.criticalFuelThresholdPercent;

  const iconBg = critical || serviceOverdue ? 'bg-red-50' : lowFuel ? 'bg-amber-50' : 'bg-violet-50';
  const IconEl = critical || serviceOverdue
    ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
    : lowFuel
      ? <Fuel className="w-3.5 h-3.5 text-amber-500" />
      : <Zap className="w-3.5 h-3.5 text-violet-500" />;

  return (
    <Link
      to="/dashboard/generators"
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className={`rounded-full p-2 shrink-0 ${iconBg}`}>{IconEl}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{gen.name}</p>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${GENERATOR_STATUS_COLOR[gen.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {gen.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {gen.currentFuelPercent != null && (
            <span className={`text-xs tabular-nums ${lowFuel ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
              Fuel: {gen.currentFuelPercent}%
            </span>
          )}
          {gen.property?.name && <span className="text-xs text-gray-400 truncate">{gen.property.name}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        {gen.nextServiceDate ? (
          <>
            <p className={`text-xs font-semibold ${serviceOverdue ? 'text-red-500' : 'text-violet-600'}`}>
              {daysLabel(gen.nextServiceDate)}
            </p>
            <p className="text-[11px] text-gray-400">{formatDate(gen.nextServiceDate)}</p>
          </>
        ) : lowFuel ? (
          <p className="text-xs font-semibold text-amber-600">Low fuel</p>
        ) : null}
      </div>
    </Link>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

// ─── Sub-tab pill ─────────────────────────────────────────────────────────────

function SubTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${active
          ? 'bg-orange-800 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecentActivities({ stats, loading, error }) {
  // top-level tabs
  const [tab, setTab] = useState('activity'); // 'activity' | 'upcoming'
  // sub-tabs inside 'upcoming'
  const [upcomingTab, setUpcomingTab] = useState('rents'); // 'rents' | 'maintenance' | 'generators'

  const activities = normalizeActivities(stats);
  const upcomingRents = normalizeUpcomingRents(stats);
  const upcomingMaintenance = normalizeUpcomingMaintenance(stats);
  const generators = normalizeGenerators(stats);

  const upcomingTotal = upcomingRents.length + upcomingMaintenance.length + generators.length;

  return (
    <Card className="rounded-xl shadow-md w-full bg-white border border-gray-100">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">Activity</CardTitle>

        <div className="flex items-center gap-3">
          {/* Top-level tab toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setTab('activity')}
              className={`px-2.5 py-1.5 transition-colors ${tab === 'activity' ? 'bg-orange-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${tab === 'upcoming' ? 'bg-orange-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
            >
              Upcoming
              {upcomingTotal > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${tab === 'upcoming' ? 'bg-white text-orange-800' : 'bg-orange-100 text-orange-700'
                  }`}>
                  {upcomingTotal}
                </span>
              )}
            </button>
          </div>

          <Link
            to="/dashboard/transactions"
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
            <Empty icon={Circle} message="No recent transactions" />
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
                        <p className="text-xs text-gray-400 truncate">{activity.details}</p>
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

        {/* ── Upcoming Tab ─────────────────────────────────────────── */}
        {tab === 'upcoming' && (
          <>
            {/* Sub-tab pills */}
            <div className="flex items-center gap-2 mb-4">
              <SubTab active={upcomingTab === 'rents'} onClick={() => setUpcomingTab('rents')}>
                Rents{upcomingRents.length > 0 ? ` (${upcomingRents.length})` : ''}
              </SubTab>
              <SubTab active={upcomingTab === 'maintenance'} onClick={() => setUpcomingTab('maintenance')}>
                Maintenance{upcomingMaintenance.length > 0 ? ` (${upcomingMaintenance.length})` : ''}
              </SubTab>
              <SubTab active={upcomingTab === 'generators'} onClick={() => setUpcomingTab('generators')}>
                Generators{generators.length > 0 ? ` (${generators.length})` : ''}
              </SubTab>
            </div>

            {/* Rents */}
            {upcomingTab === 'rents' && (
              loading ? <CardSkeleton /> :
                upcomingRents.length === 0 ? (
                  <Empty icon={CalendarClock} message="No upcoming rents in next 7 days" />
                ) : (
                  <div className="space-y-2">
                    {upcomingRents.map((r) => <RentRow key={r.id} r={r} />)}
                  </div>
                )
            )}

            {/* Maintenance */}
            {upcomingTab === 'maintenance' && (
              loading ? <CardSkeleton /> :
                upcomingMaintenance.length === 0 ? (
                  <Empty icon={Wrench} message="No upcoming maintenance tasks" />
                ) : (
                  <div className="space-y-2">
                    {upcomingMaintenance.map((task) => <MaintenanceRow key={task.id} task={task} />)}
                  </div>
                )
            )}

            {/* Generators */}
            {upcomingTab === 'generators' && (
              loading ? <CardSkeleton /> :
                generators.length === 0 ? (
                  <Empty icon={Zap} message="All generators are healthy" />
                ) : (
                  <div className="space-y-2">
                    {generators.map((gen) => <GeneratorRow key={gen.id} gen={gen} />)}
                  </div>
                )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}