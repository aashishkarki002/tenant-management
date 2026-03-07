import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Clock, User, Circle, TrendingUp, TrendingDown,
  CalendarClock, Wrench, Zap, AlertTriangle, Fuel, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Icon / colour maps ───────────────────────────────────────────────────────

const ICON_MAP = {
  payment: CheckCircle, rent: CheckCircle, maintenance: Clock,
  tenant: User, revenue: TrendingUp, expense: TrendingDown, default: Circle,
};
const DOT_MAP = {
  payment: 'bg-emerald-500', rent: 'bg-emerald-500', maintenance: 'bg-blue-500',
  tenant: 'bg-orange-500', revenue: 'bg-violet-500', expense: 'bg-red-400', default: 'bg-zinc-300',
};
const BADGE_MAP = {
  payment: 'bg-emerald-50 text-emerald-700', rent: 'bg-emerald-50 text-emerald-700',
  maintenance: 'bg-blue-50 text-blue-700', tenant: 'bg-orange-50 text-orange-700',
  revenue: 'bg-violet-50 text-violet-700', expense: 'bg-red-50 text-red-600',
  default: 'bg-zinc-100 text-zinc-500',
};
const LABEL_MAP = {
  payment: 'Payment', rent: 'Rent', maintenance: 'Maintenance',
  tenant: 'Tenant', revenue: 'Revenue', expense: 'Expense', default: 'Activity',
};

// Amount is an inflow (green) for these types, outflow (red) for expense
const INFLOW_TYPES = new Set(['payment', 'rent', 'revenue']);

const PRIORITY_BADGE = {
  Urgent: 'bg-red-50 text-red-700', High: 'bg-orange-50 text-orange-700',
  Medium: 'bg-yellow-50 text-yellow-700', Low: 'bg-zinc-100 text-zinc-500',
};
const STATUS_BADGE = {
  OPEN: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-amber-50 text-amber-700',
};
const GENERATOR_STATUS_COLOR = {
  RUNNING: 'bg-emerald-50 text-emerald-700', IDLE: 'bg-zinc-100 text-zinc-500',
  MAINTENANCE: 'bg-amber-50 text-amber-700', FAULT: 'bg-red-50 text-red-700',
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

function fmtAmount(n) {
  if (n == null) return null;
  return `Rs. ${Number(n).toLocaleString('en-NP')}`;
}

// ─── Data normalisers ─────────────────────────────────────────────────────────

/**
 * normalizeActivities
 * Reads backend-produced recentActivity array (shaped by TX_TYPE_MAP).
 * Limits to 8 items per UX spec: "decision feed, not a log dump."
 */
function normalizeActivities(stats) {
  const raw = stats?.recentActivity ?? stats?.recentActivities ?? stats?.activities;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.slice(0, 8).map((item, i) => ({
    id: item.id ?? i,
    type: item.type ?? 'default',
    mainText: item.mainText ?? item.label ?? item.title ?? '—',
    details: [item.sub, item.time ? formatRelativeTime(item.time) : null].filter(Boolean).join(' · '),
    amount: item.amount ?? null,
    isInflow: INFLOW_TYPES.has(item.type ?? ''),
  }));
}

function normalizeUpcomingRents(stats) {
  return (stats?.upcomingRentsEnglish ?? []).map((r, i) => ({
    id: r._id ?? i,
    tenantName: r.tenant?.name ?? r.tenantName ?? '—',
    propertyName: r.property?.name ?? r.propertyName ?? '',
    dueDate: r.nepaliDueDate ? formatNepaliDate(r.nepaliDueDate) : '',
    amount: r.remainingPaisa != null ? r.remainingPaisa / 100 : (r.remaining ?? r.rentAmount ?? null),
  }));
}

function normalizeUpcomingMaintenance(stats) {
  const primary = stats?.upcomingMaintenance;
  const fallback = stats?.maintenance ?? [];
  const source = Array.isArray(primary) && primary.length > 0 ? primary : fallback;
  return source.map((m, i) => ({
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

// ─── Skeletons ────────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-4 pt-1">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse bg-zinc-100 shrink-0 mt-1.5" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-3.5 w-3/4 rounded animate-pulse bg-zinc-100" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-zinc-100" />
          </div>
          <div className="h-3.5 w-16 rounded animate-pulse bg-zinc-100 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100">
          <div className="w-7 h-7 rounded-lg animate-pulse bg-zinc-100 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 rounded animate-pulse bg-zinc-100" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-zinc-100" />
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
      className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2.5 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg bg-amber-50 p-1.5 shrink-0">
          <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-800 truncate">{r.tenantName}</p>
          {r.propertyName && <p className="text-xs text-zinc-400 truncate">{r.propertyName}</p>}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        {r.amount != null && (
          <p className="text-xs font-semibold text-zinc-700 tabular-nums">
            Rs. {Number(r.amount).toLocaleString('en-NP')}
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
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className={`rounded-lg p-1.5 shrink-0 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
        <Wrench className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-zinc-800 truncate">{task.title}</p>
          {task.priority && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority] ?? 'bg-zinc-100 text-zinc-500'}`}>
              {task.priority}
            </span>
          )}
          {task.status && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[task.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 truncate mt-0.5">
          {[task.property?.name, task.unit?.name, task.assignedTo?.name ? `→ ${task.assignedTo.name}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={`text-xs font-semibold tabular-nums ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
          {daysLabel(task.scheduledDate)}
        </p>
        <p className="text-[11px] text-zinc-400">{formatDate(task.scheduledDate)}</p>
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
    : lowFuel ? <Fuel className="w-3.5 h-3.5 text-amber-500" />
      : <Zap className="w-3.5 h-3.5 text-violet-500" />;
  return (
    <Link
      to="/dashboard/generators"
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className={`rounded-lg p-1.5 shrink-0 ${iconBg}`}>{IconEl}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-zinc-800 truncate">{gen.name}</p>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${GENERATOR_STATUS_COLOR[gen.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
            {gen.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {gen.currentFuelPercent != null && (
            <span className={`text-xs tabular-nums ${lowFuel ? 'text-amber-600 font-semibold' : 'text-zinc-400'}`}>
              Fuel: {gen.currentFuelPercent}%
            </span>
          )}
          {gen.property?.name && <span className="text-xs text-zinc-400 truncate">{gen.property.name}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        {gen.nextServiceDate ? (
          <>
            <p className={`text-xs font-semibold ${serviceOverdue ? 'text-red-500' : 'text-violet-600'}`}>
              {daysLabel(gen.nextServiceDate)}
            </p>
            <p className="text-[11px] text-zinc-400">{formatDate(gen.nextServiceDate)}</p>
          </>
        ) : lowFuel ? (
          <p className="text-xs font-semibold text-amber-600">Low fuel</p>
        ) : null}
      </div>
    </Link>
  );
}

function Empty({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <div className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-zinc-300" />
      </div>
      <p className="text-sm font-medium text-zinc-400">{message}</p>
    </div>
  );
}

// ─── Sub-tab pill ─────────────────────────────────────────────────────────────

function SubTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${active ? 'bg-orange-800 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
        }`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * RecentActivities
 *
 * Ledger-based activity feed. Recent tab: 8 items max.
 * Color-coded amounts: emerald for inflows (rent, payment, revenue),
 * red for outflows (expense).
 *
 * Industry pattern: financial feeds should never need a legend —
 * color alone communicates direction at a glance.
 */
export default function RecentActivities({ stats, loading, error }) {
  const [tab, setTab] = useState('activity');
  const [upcomingTab, setUpcomingTab] = useState('rents');

  const activities = normalizeActivities(stats);
  const upcomingRents = normalizeUpcomingRents(stats);
  const upcomingMaintenance = normalizeUpcomingMaintenance(stats);
  const generators = normalizeGenerators(stats);
  const upcomingTotal = upcomingRents.length + upcomingMaintenance.length + generators.length;

  return (
    <Card className="rounded-xl shadow-sm w-full bg-white border border-zinc-200">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-100">
        <CardTitle className="text-sm font-semibold text-zinc-900">Activity</CardTitle>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setTab('activity')}
              className={`px-3 py-1.5 transition-colors ${tab === 'activity' ? 'bg-orange-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
            >
              Ledger
            </button>
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${tab === 'upcoming' ? 'bg-orange-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
            >
              Upcoming
              {upcomingTotal > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${tab === 'upcoming' ? 'bg-white text-orange-800' : 'bg-orange-100 text-orange-700'
                  }`}>{upcomingTotal}</span>
              )}
            </button>
          </div>

          <Link
            to="/dashboard/transactions"
            className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 hover:underline uppercase tracking-wide"
          >
            View All
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {/* ── Ledger Feed ─────────────────────────────────────────── */}
        {tab === 'activity' && (
          loading ? <ActivitySkeleton /> :
            activities.length === 0 ? (
              <Empty icon={Circle} message="No recent transactions" />
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => {
                  const dotColor = DOT_MAP[activity.type] ?? DOT_MAP.default;
                  const badgeColor = BADGE_MAP[activity.type] ?? BADGE_MAP.default;
                  const label = LABEL_MAP[activity.type] ?? LABEL_MAP.default;
                  const AmountIcon = activity.isInflow ? ArrowDownLeft : ArrowUpRight;
                  const amountColor = activity.isInflow ? 'text-emerald-600' : 'text-red-500';

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      {/* Dot indicator */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-zinc-800 truncate leading-snug">
                            {activity.mainText}
                          </p>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                            {label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{activity.details}</p>
                      </div>

                      {/* Amount — color-coded direction */}
                      {activity.amount != null && (
                        <div className="shrink-0 flex items-center gap-1">
                          <AmountIcon className={`w-3 h-3 ${amountColor}`} />
                          <span className={`text-xs font-semibold tabular-nums ${amountColor}`}>
                            {fmtAmount(activity.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* "8 of N" counter */}
                {(stats?.recentActivity ?? stats?.recentActivities ?? []).length > 8 && (
                  <div className="pt-2 text-center">
                    <Link
                      to="/dashboard/transactions"
                      className="text-xs font-semibold text-zinc-400 hover:text-orange-700 transition-colors"
                    >
                      Showing 8 of {(stats?.recentActivity ?? stats?.recentActivities ?? []).length} — View All →
                    </Link>
                  </div>
                )}
              </div>
            )
        )}

        {/* ── Upcoming Tab ─────────────────────────────────────────── */}
        {tab === 'upcoming' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <SubTab active={upcomingTab === 'rents'} onClick={() => setUpcomingTab('rents')}>
                Rents{upcomingRents.length > 0 ? ` (${upcomingRents.length})` : ''}
              </SubTab>
              <SubTab active={upcomingTab === 'maintenance'} onClick={() => setUpcomingTab('maintenance')}>
                Tasks{upcomingMaintenance.length > 0 ? ` (${upcomingMaintenance.length})` : ''}
              </SubTab>
              <SubTab active={upcomingTab === 'generators'} onClick={() => setUpcomingTab('generators')}>
                Generators{generators.length > 0 ? ` (${generators.length})` : ''}
              </SubTab>
            </div>

            {upcomingTab === 'rents' && (
              loading ? <CardSkeleton /> :
                upcomingRents.length === 0 ? (
                  <Empty icon={CalendarClock} message="No upcoming rents in 7 days" />
                ) : (
                  <div className="space-y-1.5">
                    {upcomingRents.map(r => <RentRow key={r.id} r={r} />)}
                  </div>
                )
            )}

            {upcomingTab === 'maintenance' && (
              loading ? <CardSkeleton /> :
                upcomingMaintenance.length === 0 ? (
                  <Empty icon={Wrench} message="No open maintenance tasks" />
                ) : (
                  <div className="space-y-1.5">
                    {upcomingMaintenance.map(task => <MaintenanceRow key={task.id} task={task} />)}
                  </div>
                )
            )}

            {upcomingTab === 'generators' && (
              loading ? <CardSkeleton /> :
                generators.length === 0 ? (
                  <Empty icon={Zap} message="All generators healthy" />
                ) : (
                  <div className="space-y-1.5">
                    {generators.map(gen => <GeneratorRow key={gen.id} gen={gen} />)}
                  </div>
                )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}