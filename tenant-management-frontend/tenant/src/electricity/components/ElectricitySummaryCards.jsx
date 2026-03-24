import React from "react";

// ─── Segment config ───────────────────────────────────────────────────────────
// Only CSS variables that exist in the petrol theme design system.
// "primary" and "secondary" are not defined — accent is the brand token.

const SEGMENTS = [
  {
    key: "unit",
    label: "Units",
    barColor: "var(--color-accent)",
    textColor: "var(--color-accent)",
    bgColor: "var(--color-accent-light)",
    borderColor: "var(--color-accent-mid)",
  },
  {
    key: "common_area",
    label: "Common Area",
    barColor: "var(--color-success)",
    textColor: "var(--color-success)",
    bgColor: "var(--color-success-bg)",
    borderColor: "var(--color-success-border)",
  },
  {
    key: "parking",
    label: "Parking",
    barColor: "var(--color-warning)",
    textColor: "var(--color-warning)",
    bgColor: "var(--color-warning-bg)",
    borderColor: "var(--color-warning-border)",
  },
  {
    key: "sub_meter",
    label: "Sub-Meter",
    barColor: "var(--color-info)",
    textColor: "var(--color-info)",
    bgColor: "var(--color-info-bg)",
    borderColor: "var(--color-info-border)",
  },
];

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtKwh = (n) =>
  Number(n).toLocaleString("en-NP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

// ─── Component ────────────────────────────────────────────────────────────────

export function ElectricitySummaryCards({ grouped = {}, summary = {} }) {
  const { grandTotalUnits = 0 } = summary;

  // Build active segments only — skip buckets with no data.
  const activeSegments = SEGMENTS.reduce((acc, seg) => {
    const bucket = grouped[seg.key];
    const units = Number(bucket?.totalUnits ?? 0);
    const amount = Number(bucket?.totalAmount ?? 0);
    const count = Number(bucket?.count ?? 0);
    if (units <= 0 && amount <= 0 && count <= 0) return acc;
    return [...acc, { ...seg, units, amount, count }];
  }, []);

  if (activeSegments.length === 0) return null;

  const divisor =
    activeSegments.reduce((s, seg) => s + seg.units, 0) || grandTotalUnits || 1;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 pt-4 pb-3 flex items-center justify-between border-b"
        style={{
          borderColor: "var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-strong)" }}
        >
          Consumption Breakdown
        </h3>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--color-text-body)" }}
        >
          {fmtKwh(grandTotalUnits)} kWh
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stacked bar */}
        <div
          className="relative h-3 w-full rounded-full overflow-hidden flex"
          style={{ backgroundColor: "var(--color-muted)" }}
        >
          {activeSegments.map((seg) => {
            const pct = (seg.units / divisor) * 100;
            return (
              <div
                key={seg.key}
                title={`${seg.label}: ${fmtKwh(seg.units)} kWh (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? "6px" : "0",
                  backgroundColor: seg.barColor,
                  flexShrink: 0,
                  transition: "width 0.5s ease",
                }}
                className="first:rounded-l-full last:rounded-r-full hover:opacity-80 cursor-default"
              />
            );
          })}
        </div>

        {/* Per-type cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {activeSegments.map((seg) => {
            const pct = ((seg.units / divisor) * 100).toFixed(0);
            return (
              <div
                key={seg.key}
                className="rounded-xl px-3.5 py-3.5"
                style={{
                  backgroundColor: seg.bgColor,
                  border: `1px solid ${seg.borderColor}`,
                }}
              >
                {/* Label + percentage */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.barColor }}
                    />
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: seg.textColor }}
                    >
                      {seg.label}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold shrink-0"
                    style={{ color: seg.textColor, opacity: 0.7 }}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Primary value */}
                <p
                  className="text-lg font-bold leading-tight tabular-nums"
                  style={{ color: seg.textColor }}
                >
                  {fmtKwh(seg.units)} kWh
                </p>

                {/* Secondary value */}
                <p
                  className="text-xs mt-1"
                  style={{ color: seg.textColor, opacity: 0.75 }}
                >
                  {fmtRs(seg.amount)}
                </p>

                {/* Reading count */}
                <p
                  className="text-[10px] mt-2.5 pt-2 font-medium"
                  style={{
                    color: seg.textColor,
                    opacity: 0.6,
                    borderTop: `1px solid ${seg.borderColor}`,
                  }}
                >
                  {seg.count} {seg.count === 1 ? "reading" : "readings"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}