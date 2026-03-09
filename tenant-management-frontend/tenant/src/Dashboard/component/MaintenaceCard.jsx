// src/pages/component/MaintenanceCard.jsx
// Operational Alerts Panel — CSS variable tokens only.

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, History, CalendarX2, Wrench, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

// ─── Status tokens ────────────────────────────────────────────────────────────
const T = {
  danger: "oklch(0.45 0.14 19)",
  dangerBg: "oklch(0.91 0.04 19 / 50%)",
  dangerBorder: "oklch(0.45 0.14 19 / 25%)",
  warning: "oklch(0.60 0.13 55)",
  warningBg: "oklch(0.94 0.04 75 / 70%)",
  warningBorder: "oklch(0.60 0.13 55 / 25%)",
  success: "oklch(0.48 0.10 152)",
  successBg: "oklch(0.91 0.04 152 / 50%)",
  successBorder: "oklch(0.48 0.10 152 / 25%)",
  neutral: "var(--color-muted-foreground)",
  neutralBg: "var(--color-secondary)",
  neutralBorder: "var(--color-border)",
};

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
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ icon: Icon, iconBg, iconColor, label, sublabel, badge, badgeColor, badgeBg, to }) {
  const content = (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5
                 hover:bg-secondary transition-colors"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div
        className="rounded-lg p-1.5 shrink-0"
        style={{ background: iconBg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{sublabel}</p>
        )}
      </div>
      {badge && (
        <span
          className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full border"
          style={{ background: badgeBg, color: badgeColor, borderColor: badgeColor + "40" }}
        >
          {badge}
        </span>
      )}
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : <div>{content}</div>;
}

// ─── Section ──────────────────────────────────────────────────────────────────

function AlertSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </p>
        {count > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground">{count}</span>
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
        <div className="h-2.5 w-28 rounded animate-pulse bg-secondary" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-secondary" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-secondary" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-24 rounded animate-pulse bg-secondary" />
        <div className="h-10 w-full rounded-lg animate-pulse bg-secondary" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MaintenanceCard({ stats, loading, error }) {
  const contractsEndingSoon = stats?.contractsEndingSoon ?? [];
  const allMaintenance = Array.isArray(stats?.maintenance) ? stats.maintenance : [];
  const generators = stats?.generatorsDueService ?? [];
  const openRequests = stats?.openRequests ?? 0;

  const staleMaintenance = allMaintenance.filter(m =>
    (m.status || "").toUpperCase() === "OPEN" && daysOld(m.createdAt) > 7
  );

  const genAlerts = generators.filter(g => {
    const serviceOverdue = g.nextServiceDate && daysUntil(g.nextServiceDate) < 0;
    const lowFuel = g.currentFuelPercent != null && g.currentFuelPercent <= (g.lowFuelThresholdPercent ?? 20);
    return serviceOverdue || lowFuel;
  });

  const totalAlerts = contractsEndingSoon.length + staleMaintenance.length + genAlerts.length;
  const isAllClear = totalAlerts === 0 && openRequests === 0;

  return (
    <Card className="rounded-xl shadow-sm w-full bg-card border-border">
      <CardHeader className="pb-3 border-b border-secondary">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            Operational Alerts
          </CardTitle>
          {!loading && totalAlerts > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ background: T.warningBg, color: T.warning, borderColor: T.warning + "40" }}
            >
              {totalAlerts} alert{totalAlerts !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <AlertSkeleton />
        ) : isAllClear ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: T.successBg }}
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: T.success }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground mt-0.5">No operational alerts today</p>
            </div>
          </div>
        ) : (
          <>
            {contractsEndingSoon.length > 0 && (
              <AlertSection title="Leases Ending Soon" count={contractsEndingSoon.length}>
                {contractsEndingSoon.map((c, i) => {
                  const urgent = c.daysUntilEnd <= 7;
                  const warn = c.daysUntilEnd > 7 && c.daysUntilEnd <= 14;
                  return (
                    <AlertRow
                      key={c._id ?? i}
                      icon={CalendarX2}
                      iconBg={urgent ? T.dangerBg : warn ? T.warningBg : T.neutralBg}
                      iconColor={urgent ? T.danger : warn ? T.warning : T.neutral}
                      label={c.name}
                      sublabel={urgent ? "Expires this week — immediate action"
                        : warn ? "Expires within 2 weeks"
                          : `Expires in ${c.daysUntilEnd} days`}
                      badge={`${c.daysUntilEnd}d`}
                      badgeBg={urgent ? T.dangerBg : warn ? T.warningBg : T.neutralBg}
                      badgeColor={urgent ? T.danger : warn ? T.warning : T.neutral}
                      to="/maintenance"
                    />
                  );
                })}
              </AlertSection>
            )}

            {staleMaintenance.length > 0 && (
              <AlertSection title="Maintenance — Overdue Follow-up" count={staleMaintenance.length}>
                {staleMaintenance.slice(0, 4).map((m, i) => (
                  <AlertRow
                    key={m._id ?? i}
                    icon={Wrench}
                    iconBg={T.warningBg}
                    iconColor={T.warning}
                    label={m.title ?? "Open Request"}
                    sublabel={[
                      m.property?.name,
                      m.unit?.name,
                      `${daysOld(m.createdAt)}d open`,
                    ].filter(Boolean).join(" · ")}
                    badge={m.priority ?? null}
                    badgeBg={m.priority === "Urgent" ? T.dangerBg
                      : m.priority === "High" ? T.warningBg
                        : T.neutralBg}
                    badgeColor={m.priority === "Urgent" ? T.danger
                      : m.priority === "High" ? T.warning
                        : T.neutral}
                    to="/maintenance"
                  />
                ))}
              </AlertSection>
            )}

            {genAlerts.length > 0 && (
              <AlertSection title="Generator Alerts" count={genAlerts.length}>
                {genAlerts.map((g, i) => {
                  const serviceOverdue = g.nextServiceDate && daysUntil(g.nextServiceDate) < 0;
                  const critical = g.currentFuelPercent != null
                    && g.currentFuelPercent <= (g.criticalFuelThresholdPercent ?? 10);
                  return (
                    <AlertRow
                      key={g._id ?? i}
                      icon={serviceOverdue || critical ? AlertTriangle : Zap}
                      iconBg={serviceOverdue || critical ? T.dangerBg : T.warningBg}
                      iconColor={serviceOverdue || critical ? T.danger : T.warning}
                      label={g.name ?? "Generator"}
                      sublabel={[
                        g.property?.name,
                        g.currentFuelPercent != null ? `Fuel: ${g.currentFuelPercent}%` : null,
                        serviceOverdue ? `Service overdue since ${formatDate(g.nextServiceDate)}` : null,
                      ].filter(Boolean).join(" · ")}
                      badge={critical ? "Critical" : serviceOverdue ? "Overdue" : "Low Fuel"}
                      badgeBg={critical || serviceOverdue ? T.dangerBg : T.warningBg}
                      badgeColor={critical || serviceOverdue ? T.danger : T.warning}
                      to="/dashboard/generators"
                    />
                  );
                })}
              </AlertSection>
            )}

            {openRequests > staleMaintenance.length && staleMaintenance.length === 0 && (
              <AlertSection title="Open Maintenance" count={openRequests}>
                <AlertRow
                  icon={Wrench}
                  iconBg={T.neutralBg}
                  iconColor={T.neutral}
                  label={`${openRequests} open request${openRequests !== 1 ? "s" : ""}`}
                  sublabel="Review and assign pending tasks"
                  to="/maintenance"
                />
              </AlertSection>
            )}
          </>
        )}

        {/* Quick Shortcuts */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
            Quick Shortcuts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/maintenance"
              className="flex items-center gap-2 rounded-lg border border-border
                         px-3 py-2.5 hover:bg-secondary hover:border-primary/20
                         transition-colors group"
            >
              <div className="rounded-md p-1.5 bg-secondary group-hover:bg-primary/10 transition-colors shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">New Ticket</span>
            </Link>
            <Link
              to="/maintenance"
              className="flex items-center gap-2 rounded-lg border border-border
                         px-3 py-2.5 hover:bg-secondary hover:border-primary/20
                         transition-colors group"
            >
              <div className="rounded-md p-1.5 bg-secondary group-hover:bg-primary/10 transition-colors shrink-0">
                <History className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Log Book</span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}