import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Wrench, FileText, Phone, Mail, ArrowRight,
  Siren, ChevronRight,
} from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

// ── helpers ──────────────────────────────────────────────────────────────────
function daysOpen(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function ucDate(str) {
  if (!str) return null;
  try {
    return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return null; }
}

// ── Section: overdue tenants (from arrears) ───────────────────────────────
function OverdueTenantsCard({ arrears = [], loading }) {
  const critical = arrears
    .filter((a) => (a.consecutiveUnpaidMonths ?? 0) >= 2 || a.totalDuePaisa >= 5000_00)
    .slice(0, 3);

  const totalAtRisk = critical.reduce((s, a) => s + (a.totalDuePaisa ?? 0), 0) / 100;
  const count = critical.length;

  if (loading) return <CardSkeleton/>;

  return (
    <div className="urgent-card">
      {/* header */}
      <div className="uc-head">
        <div
          className="uc-sev-icon"
          style={{
            background: "color-mix(in oklch, var(--color-danger) 12%, transparent)",
            color: "var(--color-danger)",
            border: "1px solid color-mix(in oklch, var(--color-danger) 25%, transparent)",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5"/>
        </div>
        <div className="uc-label">Tenants overdue 60+ days</div>
        <div
          className="uc-count"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}
        >
          {count}
        </div>
      </div>

      {/* headline */}
      {count > 0 ? (
        <>
          <div className="uc-headline">
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-danger)" }}>
              {formatRupeesCompact(totalAtRisk)}
            </span>
            {" "}at risk · escalation zone
          </div>
          <div className="uc-rows">
            {critical.map((a, i) => {
              const unit = a.units?.[0];
              const months = a.consecutiveUnpaidMonths ?? 0;
              return (
                <div key={a.tenant?._id ?? i} className="uc-row">
                  <div>
                    <div className="uc-who">{unit?.unitNumber ?? unit?.name ?? "Unit"} · {a.tenant?.name ?? "—"}</div>
                    <div className="uc-meta">{months} month{months !== 1 ? "s" : ""} overdue</div>
                  </div>
                  <div
                    className="uc-amt"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}
                  >
                    {formatRupeesCompact((a.totalDuePaisa ?? 0) / 100)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="uc-actions">
            <Link to="/rent-payment" className="uc-btn danger">
              <Phone className="w-3 h-3"/>Collect rent
            </Link>
            <a href="tel:" className="uc-btn danger-out">
              <Mail className="w-3 h-3"/>Send notice
            </a>
            <Link to="/tenant/allTenants" className="uc-btn ghost">
              <ChevronRight className="w-3 h-3"/>All overdue
            </Link>
          </div>
        </>
      ) : (
        <div className="uc-empty">No tenants with 60+ day arrears</div>
      )}
    </div>
  );
}

// ── Section: maintenance overdue ──────────────────────────────────────────
function MaintenanceCard({ maintenance = [], loading }) {
  const overdue = maintenance.filter((m) => daysOpen(m.createdAt) > 7).slice(0, 3);
  const worst = overdue.reduce((max, m) => {
    const d = daysOpen(m.createdAt);
    return d > (max?.d ?? 0) ? { ...m, d } : max;
  }, null);

  if (loading) return <CardSkeleton/>;

  return (
    <div className="urgent-card">
      <div className="uc-head">
        <div
          className="uc-sev-icon"
          style={{
            background: "color-mix(in oklch, var(--color-warning) 14%, transparent)",
            color: "var(--color-warning)",
            border: "1px solid color-mix(in oklch, var(--color-warning) 28%, transparent)",
          }}
        >
          <Wrench className="w-3.5 h-3.5"/>
        </div>
        <div className="uc-label">Maintenance overdue &gt; 7 days</div>
        <div
          className="uc-count"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)", borderColor: "var(--color-warning-border)" }}
        >
          {overdue.length}
        </div>
      </div>

      {overdue.length > 0 ? (
        <>
          <div className="uc-headline">
            Tenant satisfaction at risk · longest{" "}
            <span style={{ fontWeight: 700 }}>{worst?.d ?? 0}d</span>
          </div>
          <div className="uc-rows">
            {overdue.map((m, i) => {
              const d = daysOpen(m.createdAt);
              return (
                <div key={m._id ?? i} className="uc-row">
                  <div>
                    <div className="uc-who">
                      {m.unit?.name ?? m.unit?.unitNumber ?? "Unit"} · {m.title ?? "Request"}
                    </div>
                    <div className="uc-meta">
                      Reported {ucDate(m.createdAt)} · {m.status ?? "open"}
                    </div>
                  </div>
                  <div
                    className="uc-amt"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: d > 14 ? "var(--color-danger)" : "var(--color-warning)",
                    }}
                  >
                    {d}d
                  </div>
                </div>
              );
            })}
          </div>
          <div className="uc-actions">
            <Link to="/maintenance" className="uc-btn warn-out">
              <Wrench className="w-3 h-3"/>View requests
            </Link>
            <Link to="/maintenance" className="uc-btn ghost">
              <ChevronRight className="w-3 h-3"/>Assign
            </Link>
          </div>
        </>
      ) : (
        <div className="uc-empty">No maintenance overdue beyond 7 days</div>
      )}
    </div>
  );
}

// ── Section: lease renewals ───────────────────────────────────────────────
function LeaseRenewalCard({ contracts = [], loading }) {
  const soon = contracts.filter((c) => (c.daysUntilEnd ?? 999) <= 30).slice(0, 3);
  const all = contracts.slice(0, 3);
  const items = soon.length > 0 ? soon : all.slice(0, 2);

  if (loading) return <CardSkeleton/>;

  return (
    <div className="urgent-card">
      <div className="uc-head">
        <div
          className="uc-sev-icon"
          style={{
            background: "color-mix(in oklch, var(--color-info, #1e40af) 12%, transparent)",
            color: "var(--color-info, #1e40af)",
            border: "1px solid color-mix(in oklch, var(--color-info, #1e40af) 25%, transparent)",
          }}
        >
          <FileText className="w-3.5 h-3.5"/>
        </div>
        <div className="uc-label">Lease renewals · 60 days</div>
        <div
          className="uc-count"
          style={{
            background: "var(--color-info-bg, #dbeafe)",
            color: "var(--color-info, #1e40af)",
            borderColor: "var(--color-info-border, #bfdbfe)",
          }}
        >
          {contracts.length}
        </div>
      </div>

      {items.length > 0 ? (
        <>
          <div className="uc-headline">
            <span style={{ fontWeight: 700 }}>{items.length}</span> tenant{items.length !== 1 ? "s" : ""} · renewal window open
          </div>
          <div className="uc-rows">
            {items.map((c, i) => (
              <div key={c._id ?? i} className="uc-row">
                <div>
                  <div className="uc-who">{c.name ?? "Tenant"}</div>
                  <div className="uc-meta">
                    Expires {ucDate(c.leaseEndDate)} ·{" "}
                    {(c.daysUntilEnd ?? 0) <= 0 ? "expired" : `${c.daysUntilEnd}d`}
                  </div>
                </div>
                <div
                  className="uc-amt"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color:
                      (c.daysUntilEnd ?? 999) <= 15
                        ? "var(--color-danger)"
                        : "var(--color-warning)",
                  }}
                >
                  {c.daysUntilEnd <= 0 ? "EXP" : `${c.daysUntilEnd}d`}
                </div>
              </div>
            ))}
          </div>
          <div className="uc-actions">
            <Link to="/tenant/allTenants" className="uc-btn primary">
              <Phone className="w-3 h-3"/>Start renewal
            </Link>
            <Link to="/tenant/allTenants" className="uc-btn ghost">
              Review pricing
            </Link>
          </div>
        </>
      ) : (
        <div className="uc-empty">No leases expiring in the next 60 days</div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="urgent-card animate-pulse">
      <div className="uc-head">
        <div className="uc-sev-icon bg-muted"/>
        <div className="uc-label h-3 w-40 rounded bg-muted"/>
        <div className="uc-count bg-muted w-6 h-5"/>
      </div>
      <div className="h-2 w-32 rounded bg-muted mt-3"/>
      <div className="space-y-2 mt-3">
        {[1, 2].map((x) => (
          <div key={x} className="uc-row">
            <div className="h-2 w-36 rounded bg-muted"/>
            <div className="h-2 w-16 rounded bg-muted"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root panel ────────────────────────────────────────────────────────────
export default function UrgentActionsPanel({ stats, arrears = [], loading }) {
  const maintenance = stats?.maintenance ?? [];
  const contracts = stats?.contractsEndingSoon ?? [];

  const overdueCount = arrears.filter(
    (a) => (a.consecutiveUnpaidMonths ?? 0) >= 2 || a.totalDuePaisa >= 5000_00,
  ).length;
  const maintOverdueCount = maintenance.filter((m) => daysOpen(m.createdAt) > 7).length;
  const totalUrgent = overdueCount + maintOverdueCount + Math.min(contracts.length, 1);

  return (
    <div className="urgent-panel">
      {/* panel header */}
      <div className="urgent-head">
        <div className="urgent-siren">
          <Siren className="w-4 h-4"/>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold leading-none" style={{ color: "var(--color-text-strong)" }}>
            Urgent actions · Today
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Items needing a decision in the next 24 hours
          </p>
        </div>
        <div className="urgent-summary">
          {overdueCount > 0 && (
            <div className="urgent-stat">
              <div className="urgent-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                {overdueCount}
              </div>
              <div className="urgent-stat-l">Overdue</div>
            </div>
          )}
          <div className="urgent-stat">
            <div className="urgent-stat-v" style={{ fontFamily: "var(--font-mono)" }}>
              {totalUrgent}
            </div>
            <div className="urgent-stat-l">Total items</div>
          </div>
          <Link to="/maintenance" className="uc-btn ghost text-xs">
            View all <ArrowRight className="w-3 h-3 inline-block ml-0.5"/>
          </Link>
        </div>
      </div>

      {/* 3-column cards */}
      <div className="urgent-list">
        <OverdueTenantsCard arrears={arrears} loading={loading}/>
        <MaintenanceCard maintenance={maintenance} loading={loading}/>
        <LeaseRenewalCard contracts={contracts} loading={loading}/>
      </div>
    </div>
  );
}
