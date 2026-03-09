// src/pages/component/RecentActivities.jsx
//
// Ledger activity feed + Upcoming tab.
// All colors use CSS variables from index.css — no orange-800 hardcodes.

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Clock, User, Circle, TrendingUp, TrendingDown,
  CalendarClock, Wrench, Zap, AlertTriangle, Fuel, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";

// ─── Color maps ───────────────────────────────────────────────────────────────
// Semantic-only: green (paid), red (overdue/expense), yellow (pending),
// neutral stones for everything else.

const DOT_MAP = {
  payment: "bg-[color-mix(in_oklch,var(--success)_80%,transparent)]",
  rent: "bg-[color-mix(in_oklch,var(--success)_80%,transparent)]",
  maintenance: "bg-[color-mix(in_oklch,var(--warning)_70%,transparent)]",
  tenant: "bg-[color-mix(in_oklch,var(--warning)_70%,transparent)]",
  revenue: "bg-[color-mix(in_oklch,var(--success)_70%,transparent)]",
  expense: "bg-[color-mix(in_oklch,var(--destructive)_80%,transparent)]",
  default: "bg-border",
};
const BADGE_MAP = {
  payment: { bg: "color-mix(in oklch, var(--success) 16%, transparent)", color: "var(--success)" },
  rent: { bg: "color-mix(in oklch, var(--success) 16%, transparent)", color: "var(--success)" },
  maintenance: { bg: "color-mix(in oklch, var(--warning) 16%, transparent)", color: "var(--warning)" },
  tenant: { bg: "color-mix(in oklch, var(--warning) 16%, transparent)", color: "var(--warning)" },
  revenue: { bg: "color-mix(in oklch, var(--success) 12%, transparent)", color: "var(--success)" },
  expense: { bg: "color-mix(in oklch, var(--destructive) 16%, transparent)", color: "var(--destructive)" },
  default: { bg: "var(--color-secondary)", color: "var(--color-muted-foreground)" },
};
const LABEL_MAP = {
  payment: "Payment", rent: "Rent", maintenance: "Maintenance",
  tenant: "Tenant", revenue: "Revenue", expense: "Expense", default: "Activity",
};
const INFLOW_TYPES = new Set(["payment", "rent", "revenue"]);

const PRIORITY_BADGE = {
  Urgent: { bg: "color-mix(in oklch, var(--destructive) 16%, transparent)", color: "var(--destructive)" },
  High: { bg: "color-mix(in oklch, var(--warning) 16%, transparent)", color: "var(--warning)" },
  Medium: { bg: "var(--color-secondary)", color: "var(--color-muted-foreground)" },
  Low: { bg: "var(--color-muted)", color: "var(--color-muted-foreground)" },
};
const STATUS_BADGE = {
  OPEN: { bg: "color-mix(in oklch, var(--warning) 16%, transparent)", color: "var(--warning)" },
  IN_PROGRESS: { bg: "color-mix(in oklch, var(--warning) 12%, transparent)", color: "var(--warning)" },
};
const GENERATOR_STATUS = {
  RUNNING: { bg: "color-mix(in oklch, var(--success) 16%, transparent)", color: "var(--success)" },
  IDLE: { bg: "var(--color-secondary)", color: "var(--color-muted-foreground)" },
  MAINTENANCE: { bg: "color-mix(in oklch, var(--warning) 16%, transparent)", color: "var(--warning)" },
  FAULT: { bg: "color-mix(in oklch, var(--destructive) 16%, transparent)", color: "var(--destructive)" },
};

// ─── Active tab style token ───────────────────────────────────────────────────
// Maps to var(--primary) — Burgundy 800 — consistent with sidebar active state.
const ACTIVE_TAB_BG = "var(--color-primary)";
const ACTIVE_TAB_COLOR = "var(--color-primary-foreground)";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRelativeTime(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNepaliDate(nepaliDate) {
  if (!nepaliDate) return "";
  if (typeof nepaliDate === "string") return nepaliDate;
  if (nepaliDate instanceof Date) return nepaliDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return String(nepaliDate);
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - Date.now()) / 86_400_000);
}

function daysLabel(d) {
  const n = daysUntil(d);
  if (n == null) return "";
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "Today";
  return `In ${n}d`;
}

function fmtAmount(n) {
  if (n == null) return null;
  return `Rs. ${Number(n).toLocaleString("en-NP")}`;
}

// ─── Data normalisers ─────────────────────────────────────────────────────────

function normalizeActivities(stats) {
  const raw = stats?.recentActivity ?? stats?.recentActivities ?? stats?.activities;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...raw]
    .sort((a, b) => new Date(b.time ?? 0) - new Date(a.time ?? 0))
    .slice(0, 8)
    .map((item, i) => ({
      id: item.id ?? i,
      type: item.type ?? "default",
      mainText: item.mainText ?? item.label ?? item.title ?? "—",
      details: [item.sub, item.time ? formatRelativeTime(item.time) : null].filter(Boolean).join(" · "),
      amount: item.amount ?? null,
      isInflow: INFLOW_TYPES.has(item.type ?? ""),
    }));
}

function normalizeUpcomingRents(stats) {
  return (stats?.upcomingRentsEnglish ?? []).map((r, i) => ({
    id: r._id ?? i,
    tenantName: r.tenant?.name ?? r.tenantName ?? "—",
    propertyName: r.property?.name ?? r.propertyName ?? "",
    dueDate: r.nepaliDueDate ? formatNepaliDate(r.nepaliDueDate) : "",
    amount: r.remainingPaisa != null ? r.remainingPaisa / 100 : (r.remaining ?? r.rentAmount ?? null),
  }));
}

function normalizeUpcomingMaintenance(stats) {
  const primary = stats?.upcomingMaintenance;
  const fallback = stats?.maintenance ?? [];
  const source = Array.isArray(primary) && primary.length > 0 ? primary : fallback;
  return source.map((m, i) => ({
    id: m._id ?? i,
    title: m.title ?? "Maintenance",
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
    name: g.name ?? "Generator",
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
          <div className="w-2 h-2 rounded-full animate-pulse bg-secondary shrink-0 mt-1.5" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-3.5 w-3/4 rounded animate-pulse bg-secondary" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-muted" />
          </div>
          <div className="h-3.5 w-16 rounded animate-pulse bg-secondary shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
          <div className="w-7 h-7 rounded-lg animate-pulse bg-secondary shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 rounded animate-pulse bg-secondary" />
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
      className="flex items-center justify-between rounded-lg border border-border
                 px-3 py-2.5 hover:bg-secondary hover:border-primary/20 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg p-1.5 shrink-0 bg-secondary">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{r.tenantName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[r.propertyName, r.dueDate ? `Due ${r.dueDate}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {r.amount != null && (
        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 ml-2">
          {fmtAmount(r.amount)}
        </span>
      )}
    </Link>
  );
}

function MaintenanceRow({ task }) {
  const pb = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.Low;
  const sb = STATUS_BADGE[task.status?.toUpperCase()] ?? null;

  return (
    <Link
      to="/maintenance"
      className="flex items-center justify-between rounded-lg border border-border
                 px-3 py-2.5 hover:bg-secondary transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg p-1.5 shrink-0 bg-secondary">
          <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[task.property?.name, task.unit?.name, task.scheduledDate ? daysLabel(task.scheduledDate) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {task.priority && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: pb.bg, color: pb.color }}>
            {task.priority}
          </span>
        )}
        {sb && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: sb.bg, color: sb.color }}>
            {task.status?.replace("_", " ")}
          </span>
        )}
      </div>
    </Link>
  );
}

function GeneratorRow({ gen }) {
  const gs = GENERATOR_STATUS[gen.status?.toUpperCase()] ?? GENERATOR_STATUS.IDLE;
  const isCritical = gen.currentFuelPercent != null && gen.currentFuelPercent <= gen.criticalFuelThresholdPercent;
  const isLow = gen.currentFuelPercent != null && gen.currentFuelPercent <= gen.lowFuelThresholdPercent;

  return (
    <Link
      to="/dashboard/generators"
      className="flex items-center justify-between rounded-lg border border-border
                 px-3 py-2.5 hover:bg-secondary transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg p-1.5 shrink-0 bg-secondary">
          <Zap className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{gen.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[
              gen.property?.name,
              gen.currentFuelPercent != null ? `Fuel: ${gen.currentFuelPercent}%` : null,
              gen.nextServiceDate ? `Service ${daysLabel(gen.nextServiceDate)}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {isCritical && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: "color-mix(in oklch, var(--destructive) 16%, transparent)", color: "var(--destructive)" }}>
            Critical
          </span>
        )}
        {gen.status && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: gs.bg, color: gs.color }}>
            {gen.status}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <Icon className="w-6 h-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Sub-tab pill ─────────────────────────────────────────────────────────────

function SubTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
      style={{
        background: active ? ACTIVE_TAB_BG : "var(--color-secondary)",
        color: active ? ACTIVE_TAB_COLOR : "var(--color-muted-foreground)",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecentActivities({ stats, loading, error }) {
  const [tab, setTab] = useState("activity");
  const [upcomingTab, setUpcomingTab] = useState("rents");

  const activities = normalizeActivities(stats);
  const upcomingRents = normalizeUpcomingRents(stats);
  const upcomingMaintenance = normalizeUpcomingMaintenance(stats);
  const generators = normalizeGenerators(stats);
  const upcomingTotal = upcomingRents.length + upcomingMaintenance.length + generators.length;

  return (
    <Card className="rounded-xl shadow-sm w-full bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-secondary">
        <CardTitle className="text-sm font-semibold text-foreground">Activity</CardTitle>

        <div className="flex items-center gap-3">
          {/* Tab switcher — uses primary token instead of orange-800 */}
          <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setTab("activity")}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: tab === "activity" ? ACTIVE_TAB_BG : "var(--color-card)",
                color: tab === "activity" ? ACTIVE_TAB_COLOR : "var(--color-muted-foreground)",
              }}
            >
              Ledger
            </button>
            <button
              type="button"
              onClick={() => setTab("upcoming")}
              className="px-3 py-1.5 flex items-center gap-1 transition-colors"
              style={{
                background: tab === "upcoming" ? ACTIVE_TAB_BG : "var(--color-card)",
                color: tab === "upcoming" ? ACTIVE_TAB_COLOR : "var(--color-muted-foreground)",
              }}
            >
              Upcoming
              {upcomingTotal > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold"
                  style={{
                    background: tab === "upcoming"
                      ? "var(--color-primary-foreground)"
                      : "var(--color-secondary)",
                    color: tab === "upcoming"
                      ? "var(--color-primary)"
                      : "var(--color-muted-foreground)",
                  }}
                >
                  {upcomingTotal}
                </span>
              )}
            </button>
          </div>

          <Link
            to="/dashboard/transactions"
            className="text-[11px] font-semibold uppercase tracking-wide
                       text-primary hover:opacity-70 hover:underline transition-opacity"
          >
            View All
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        {/* Ledger Feed */}
        {tab === "activity" && (
          loading ? <ActivitySkeleton /> :
            activities.length === 0 ? (
              <Empty icon={Circle} message="No recent transactions" />
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => {
                  const dotColor = DOT_MAP[activity.type] ?? DOT_MAP.default;
                  const badge = BADGE_MAP[activity.type] ?? BADGE_MAP.default;
                  const label = LABEL_MAP[activity.type] ?? LABEL_MAP.default;
                  const AmountIcon = activity.isInflow ? ArrowDownLeft : ArrowUpRight;
                  const amountColor = activity.isInflow
                    ? "oklch(0.48 0.10 152)"   // success-500
                    : "oklch(0.45 0.14 19)";    // error-500

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate leading-snug">
                            {activity.mainText}
                          </p>
                          <span
                            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {activity.details}
                        </p>
                      </div>

                      {activity.amount != null && (
                        <div className="shrink-0 flex items-center gap-1">
                          <AmountIcon className="w-3 h-3" style={{ color: amountColor }} />
                          <span
                            className="text-xs font-semibold tabular-nums"
                            style={{ color: amountColor }}
                          >
                            {fmtAmount(activity.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {(stats?.recentActivity ?? stats?.recentActivities ?? []).length > 8 && (
                  <div className="pt-2 text-center">
                    <Link
                      to="/dashboard/transactions"
                      className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                    >
                      Showing 8 of {(stats?.recentActivity ?? stats?.recentActivities ?? []).length} — View All →
                    </Link>
                  </div>
                )}
              </div>
            )
        )}

        {/* Upcoming Tab */}
        {tab === "upcoming" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <SubTab active={upcomingTab === "rents"} onClick={() => setUpcomingTab("rents")}>
                Rents{upcomingRents.length > 0 ? ` (${upcomingRents.length})` : ""}
              </SubTab>
              <SubTab active={upcomingTab === "maintenance"} onClick={() => setUpcomingTab("maintenance")}>
                Tasks{upcomingMaintenance.length > 0 ? ` (${upcomingMaintenance.length})` : ""}
              </SubTab>
              <SubTab active={upcomingTab === "generators"} onClick={() => setUpcomingTab("generators")}>
                Generators{generators.length > 0 ? ` (${generators.length})` : ""}
              </SubTab>
            </div>

            {upcomingTab === "rents" && (
              loading ? <CardSkeleton /> :
                upcomingRents.length === 0
                  ? <Empty icon={CalendarClock} message="No upcoming rents in 7 days" />
                  : <div className="space-y-1.5">{upcomingRents.map(r => <RentRow key={r.id} r={r} />)}</div>
            )}
            {upcomingTab === "maintenance" && (
              loading ? <CardSkeleton /> :
                upcomingMaintenance.length === 0
                  ? <Empty icon={Wrench} message="No open maintenance tasks" />
                  : <div className="space-y-1.5">{upcomingMaintenance.map(t => <MaintenanceRow key={t.id} task={t} />)}</div>
            )}
            {upcomingTab === "generators" && (
              loading ? <CardSkeleton /> :
                generators.length === 0
                  ? <Empty icon={Zap} message="All generators healthy" />
                  : <div className="space-y-1.5">{generators.map(g => <GeneratorRow key={g.id} gen={g} />)}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}