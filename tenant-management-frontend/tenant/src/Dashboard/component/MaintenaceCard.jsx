import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, History, CalendarX2, Wrench, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── MaintenanceCard: Operational Alerts Panel ────────────────────────────────
//
// Redesigned as a decision-support panel, not a stats card.
// It surfaces actionable operational signals only — things that require
// an owner's response today or this week.
//
// Data sources (all safe-accessed, no backend contract changes):
//   • contracts ending soon     → stats.contractsEndingSoon
//   • open maintenance tasks    → stats.maintenance (filter OPEN, > 7 days old)
//   • generators needing work   → stats.generatorsDueService
//   • total open requests count → stats.openRequests
//
// Industry pattern: operational alerts must be scannable in < 5 seconds.
// Use consistent visual hierarchy: icon → label → value/date.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysOld(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ icon: Icon, iconBg, iconColor, label, sublabel, badge, badgeColor, to }) {
  const content = (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 hover:bg-zinc-50 transition-colors">
      <div className={`rounded-lg p-1.5 shrink-0 ${iconBg}`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 truncate">{label}</p>
        {sublabel && <p className="text-xs text-zinc-400 truncate mt-0.5">{sublabel}</p>}
      </div>
      {badge && (
        <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="block">{content}</Link>
  ) : (
    <div>{content}</div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function AlertSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{title}</p>
        {count > 0 && (
          <span className="text-[10px] font-bold text-zinc-400">{count}</span>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AlertSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-2.5 w-28 rounded animate-pulse bg-zinc-100" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-zinc-100" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-zinc-100" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-24 rounded animate-pulse bg-zinc-100" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-zinc-100" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * MaintenanceCard (Operational Alerts)
 *
 * Props:
 *   stats   — normalised stats object from useStats()
 *   loading — boolean
 *   error   — string | null
 */
export default function MaintenanceCard({ stats, loading, error }) {
  const contractsEndingSoon = stats?.contractsEndingSoon ?? [];
  const allMaintenance = Array.isArray(stats?.maintenance) ? stats.maintenance : [];
  const generators = stats?.generatorsDueService ?? [];
  const openRequests = stats?.openRequests ?? 0;

  // Maintenance open > 7 days — requires explicit follow-up
  const staleMaintenance = allMaintenance.filter(m =>
    (m.status || '').toUpperCase() === 'OPEN' && daysOld(m.createdAt) > 7
  );

  // Generator alerts: low fuel or service overdue
  const genAlerts = generators.filter(g => {
    const serviceOverdue = g.nextServiceDate && daysUntil(g.nextServiceDate) < 0;
    const lowFuel = g.currentFuelPercent != null && g.currentFuelPercent <= (g.lowFuelThresholdPercent ?? 20);
    return serviceOverdue || lowFuel;
  });

  const totalAlerts = contractsEndingSoon.length + staleMaintenance.length + genAlerts.length;
  const isAllClear = totalAlerts === 0 && openRequests === 0;

  return (
    <Card className="rounded-xl shadow-sm w-full bg-white border border-zinc-200">
      <CardHeader className="pb-3 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-zinc-900">Operational Alerts</CardTitle>
          {!loading && totalAlerts > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {error && <p className="text-xs text-red-500">{error}</p>}

        {loading ? (
          <AlertSkeleton />
        ) : isAllClear ? (
          /* All-clear state */
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700">All clear</p>
              <p className="text-xs text-zinc-400 mt-0.5">No operational alerts today</p>
            </div>
          </div>
        ) : (
          <>
            {/* Leases Ending Soon */}
            {contractsEndingSoon.length > 0 && (
              <AlertSection title="Leases Ending Soon" count={contractsEndingSoon.length}>
                {contractsEndingSoon.map((c, i) => {
                  const urgent = c.daysUntilEnd <= 7;
                  const warn = c.daysUntilEnd > 7 && c.daysUntilEnd <= 14;
                  return (
                    <AlertRow
                      key={c._id ?? i}
                      icon={CalendarX2}
                      iconBg={urgent ? 'bg-red-50' : warn ? 'bg-amber-50' : 'bg-zinc-50'}
                      iconColor={urgent ? 'text-red-500' : warn ? 'text-amber-500' : 'text-zinc-400'}
                      label={c.name}
                      sublabel={urgent ? 'Expires this week — immediate action' : warn ? 'Expires within 2 weeks' : `Expires in ${c.daysUntilEnd} days`}
                      badge={`${c.daysUntilEnd}d`}
                      badgeColor={urgent ? 'bg-red-50 text-red-600 border border-red-200' : warn ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-zinc-100 text-zinc-500'}
                      to="/maintenance"
                    />
                  );
                })}
              </AlertSection>
            )}

            {/* Stale Open Maintenance (> 7 days) */}
            {staleMaintenance.length > 0 && (
              <AlertSection title="Maintenance — Overdue Follow-up" count={staleMaintenance.length}>
                {staleMaintenance.slice(0, 4).map((m, i) => (
                  <AlertRow
                    key={m._id ?? i}
                    icon={Wrench}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-700"
                    label={m.title ?? 'Open Request'}
                    sublabel={[
                      m.property?.name,
                      m.unit?.name,
                      `${daysOld(m.createdAt)}d open`,
                    ].filter(Boolean).join(' · ')}
                    badge={m.priority ?? null}
                    badgeColor={
                      m.priority === 'Urgent' ? 'bg-red-50 text-red-600'
                        : m.priority === 'High' ? 'bg-orange-50 text-orange-700'
                          : 'bg-zinc-100 text-zinc-500'
                    }
                    to="/maintenance"
                  />
                ))}
              </AlertSection>
            )}

            {/* Generator Alerts */}
            {genAlerts.length > 0 && (
              <AlertSection title="Generator Alerts" count={genAlerts.length}>
                {genAlerts.map((g, i) => {
                  const serviceOverdue = g.nextServiceDate && daysUntil(g.nextServiceDate) < 0;
                  const critical = g.currentFuelPercent != null && g.currentFuelPercent <= (g.criticalFuelThresholdPercent ?? 10);
                  return (
                    <AlertRow
                      key={g._id ?? i}
                      icon={serviceOverdue || critical ? AlertTriangle : Zap}
                      iconBg={serviceOverdue || critical ? 'bg-red-50' : 'bg-amber-50'}
                      iconColor={serviceOverdue || critical ? 'text-red-500' : 'text-amber-500'}
                      label={g.name ?? 'Generator'}
                      sublabel={[
                        g.property?.name,
                        g.currentFuelPercent != null ? `Fuel: ${g.currentFuelPercent}%` : null,
                        serviceOverdue ? `Service overdue since ${formatDate(g.nextServiceDate)}` : null,
                      ].filter(Boolean).join(' · ')}
                      badge={critical ? 'Critical' : serviceOverdue ? 'Overdue' : 'Low Fuel'}
                      badgeColor={critical || serviceOverdue ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}
                      to="/dashboard/generators"
                    />
                  );
                })}
              </AlertSection>
            )}

            {/* Summary: all open requests (if stale doesn't capture full picture) */}
            {openRequests > staleMaintenance.length && staleMaintenance.length === 0 && (
              <AlertSection title="Open Maintenance" count={openRequests}>
                <AlertRow
                  icon={Wrench}
                  iconBg="bg-zinc-50"
                  iconColor="text-zinc-500"
                  label={`${openRequests} open request${openRequests !== 1 ? 's' : ''}`}
                  sublabel="Review and assign pending tasks"
                  to="/maintenance"
                />
              </AlertSection>
            )}
          </>
        )}

        {/* Quick Shortcuts — always visible */}
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2.5">Quick Shortcuts</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/maintenance"
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-orange-50 hover:border-orange-200 transition-colors group"
            >
              <div className="rounded-md bg-orange-100 p-1.5 group-hover:bg-orange-200 transition-colors shrink-0">
                <FileText className="w-3.5 h-3.5 text-orange-800" />
              </div>
              <span className="text-xs font-medium text-zinc-700">New Ticket</span>
            </Link>
            <Link
              to="/maintenance"
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-orange-50 hover:border-orange-200 transition-colors group"
            >
              <div className="rounded-md bg-orange-100 p-1.5 group-hover:bg-orange-200 transition-colors shrink-0">
                <History className="w-3.5 h-3.5 text-orange-800" />
              </div>
              <span className="text-xs font-medium text-zinc-700">Log Book</span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}