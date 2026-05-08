import React from "react";
import { Link } from "react-router-dom";
import { Wrench, ChevronRight, User } from "lucide-react";

function daysOpen(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function SevDot({ days }) {
  const color = days > 14
    ? "var(--color-danger)"
    : days > 7
      ? "var(--color-warning)"
      : "var(--color-text-weak)";
  return (
    <span
      className="sev-dot"
      style={{ background: color }}
    />
  );
}

export default function MaintenanceHealthPanel({ stats, loading }) {
  const summary = stats?.maintenanceSummary ?? { open: 0, inProgress: 0, completed: 0 };
  const maintenance = stats?.maintenance ?? [];

  // Sort by days open descending
  const sorted = [...maintenance].sort((a, b) => daysOpen(b.createdAt) - daysOpen(a.createdAt));
  const topItems = sorted.slice(0, 4);

  const openCount = summary.open ?? 0;
  const inProgressCount = summary.inProgress ?? 0;
  const overdueCount = maintenance.filter((m) => daysOpen(m.createdAt) > 7).length;
  const blockedCount = maintenance.filter((m) => m.status === "IN_PROGRESS").length;

  const avgDays = maintenance.length > 0
    ? Math.round(maintenance.reduce((s, m) => s + daysOpen(m.createdAt), 0) / maintenance.length)
    : 0;

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col gap-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted"/>
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map((x) => <div key={x} className="h-14 rounded bg-muted"/>)}
        </div>
        {[1,2,3].map((x) => <div key={x} className="h-10 rounded bg-muted"/>)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Maintenance health
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Avg open time ·{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {avgDays} day{avgDays !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <Link
          to="/maintenance"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          View all <ChevronRight className="w-3 h-3"/>
        </Link>
      </div>

      {/* stat row */}
      <div className="maint-top mt-3">
        <div className="maint-stat">
          <div className="maint-stat-l">Open</div>
          <div className="maint-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-strong)" }}>
            {openCount}
          </div>
          <div className="maint-stat-d" style={{ color: "var(--color-text-sub)" }}>requests</div>
        </div>
        <div className="maint-stat" style={overdueCount > 0 ? { background: "var(--color-danger-bg)" } : {}}>
          <div className="maint-stat-l" style={{ color: overdueCount > 0 ? "var(--color-danger)" : undefined }}>Overdue</div>
          <div
            className="maint-stat-v"
            style={{ fontFamily: "var(--font-mono)", color: overdueCount > 0 ? "var(--color-danger)" : "var(--color-text-strong)" }}
          >
            {overdueCount}
          </div>
          <div className="maint-stat-d" style={{ color: "var(--color-text-sub)" }}>&gt; 7 days</div>
        </div>
        <div className="maint-stat" style={blockedCount > 0 ? { background: "var(--color-warning-bg)" } : {}}>
          <div className="maint-stat-l" style={{ color: blockedCount > 0 ? "var(--color-warning)" : undefined }}>
            In progress
          </div>
          <div
            className="maint-stat-v"
            style={{ fontFamily: "var(--font-mono)", color: blockedCount > 0 ? "var(--color-warning)" : "var(--color-text-strong)" }}
          >
            {blockedCount}
          </div>
          <div className="maint-stat-d" style={{ color: "var(--color-text-sub)" }}>active</div>
        </div>
      </div>

      {/* list */}
      {topItems.length > 0 ? (
        <div className="maint-list mt-3 flex-1">
          {topItems.map((m, i) => {
            const d = daysOpen(m.createdAt);
            return (
              <div key={m._id ?? i} className="maint-row">
                <SevDot days={d}/>
                <div className="maint-info">
                  <div className="maint-title">
                    {m.unit?.unitNumber ?? m.unit?.name ?? m.property?.name ?? "Property"} · {m.title ?? "Request"}
                  </div>
                  <div className="maint-sub" style={{ color: "var(--color-text-sub)" }}>
                    {m.status ?? "open"} · {d}d open
                    {m.assignedTo?.name ? ` · ${m.assignedTo.name}` : " · unassigned"}
                  </div>
                </div>
                <span
                  className="maint-age"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: d > 14 ? "var(--color-danger)" : d > 7 ? "var(--color-warning)" : "var(--color-text-sub)",
                  }}
                >
                  {d}d
                </span>
                <Link to="/maintenance" className="uc-btn ghost text-xs shrink-0">
                  <User className="w-3 h-3"/>Assign
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Wrench className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--color-text-weak)" }}/>
            <div className="text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>
              No open requests
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
