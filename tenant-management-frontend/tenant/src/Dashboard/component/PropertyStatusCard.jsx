import React from "react";

function SectionHeader({ children }) {
  return (
    <span
      className="block text-[10px] font-bold uppercase mb-1.5"
      style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
    >
      {children}
    </span>
  );
}

function MetricRow({ label, value, colorVar }) {
  return (
    <div
      className="flex items-center justify-between rounded-[6px] px-3 py-2.5"
      style={{ background: "var(--color-surface)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>
        {label}
      </span>
      <span
        className="text-base font-semibold tabular-nums"
        style={{ color: colorVar ?? "var(--color-text-strong)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PropertyStatusCard({ data, loading }) {
  const occ = data?.occupancy ?? { active: 0, vacant: 0, total: 0 };
  const maint = data?.maintenance ?? { open: 0, inProgress: 0, resolved: 0 };

  return (
    <div
      className="w-full rounded-[14px] p-4"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
      role="region"
      aria-label="Property status"
    >
      {/* Label */}
      <span
        className="block text-[11px] font-semibold uppercase mb-3"
        style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
      >
        Property Status
      </span>

      <div className="grid grid-cols-2 gap-4">
        {/* Occupancy */}
        <div>
          <SectionHeader>Occupancy</SectionHeader>
          {loading ? (
            <div
              className="h-16 rounded-lg animate-pulse"
              style={{ background: "var(--color-muted-fill)" }}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <MetricRow
                label="Active"
                value={occ.active}
                colorVar="var(--color-success)"
              />
              <MetricRow
                label="Vacant"
                value={occ.vacant}
                colorVar={
                  occ.vacant > 0
                    ? "var(--color-warning)"
                    : "var(--color-text-sub)"
                }
              />
            </div>
          )}
        </div>

        {/* Maintenance */}
        <div>
          <SectionHeader>Maintenance</SectionHeader>
          {loading ? (
            <div
              className="h-16 rounded-lg animate-pulse"
              style={{ background: "var(--color-muted-fill)" }}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <MetricRow
                label="Open"
                value={maint.open + maint.inProgress}
                colorVar={
                  maint.open > 0
                    ? "var(--color-danger)"
                    : "var(--color-text-sub)"
                }
              />
              <MetricRow
                label="Resolved"
                value={maint.resolved}
                colorVar="var(--color-success)"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
