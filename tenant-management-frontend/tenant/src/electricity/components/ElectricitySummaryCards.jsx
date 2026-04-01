import React from "react";

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

const fmtKwh = (n) =>
  Number(n).toLocaleString("en-NP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

export function ElectricitySummaryCards({ grouped = {}, summary = {} }) {
  const { grandTotalUnits = 0 } = summary;

  const activeSegments = SEGMENTS.reduce((acc, seg) => {
    const bucket = grouped[seg.key];
    const units = Number(bucket?.totalUnits ?? 0);
    const amount = Number(bucket?.totalAmount ?? 0);
    const count = Number(bucket?.count ?? 0);
    if (units <= 0 && amount <= 0 && count <= 0) return acc;
    return [...acc, { ...seg, units, amount, count }];
  }, []);

  if (activeSegments.length === 0) return null;

  const divisor = activeSegments.reduce((s, seg) => s + seg.units, 0) || grandTotalUnits || 1;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>
          Consumption Breakdown
        </h3>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-body)" }}>
          {fmtKwh(grandTotalUnits)} kWh
        </span>
      </div>

      <div style={{ padding: "14px 18px" }}>
        {/* Stacked bar */}
        <div
          style={{
            position: "relative",
            height: "5px",
            width: "100%",
            borderRadius: "99px",
            overflow: "hidden",
            display: "flex",
            backgroundColor: "var(--color-muted)",
            marginBottom: "14px",
          }}
        >
          {activeSegments.map((seg) => {
            const pct = (seg.units / divisor) * 100;
            return (
              <div
                key={seg.key}
                title={`${seg.label}: ${fmtKwh(seg.units)} kWh (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? "4px" : "0",
                  backgroundColor: seg.barColor,
                  flexShrink: 0,
                  transition: "width 0.4s ease",
                }}
              />
            );
          })}
        </div>

        {/* Segment rows — compact list instead of cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {activeSegments.map((seg, i) => {
            const pct = ((seg.units / divisor) * 100).toFixed(0);
            const isLast = i === activeSegments.length - 1;
            return (
              <div
                key={seg.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 0",
                  borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: seg.barColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "13px", color: "var(--color-text-body)", flex: 1 }}>
                  {seg.label}
                </span>
                <span style={{ fontSize: "12px", color: "var(--color-text-sub)" }}>
                  {seg.count} {seg.count === 1 ? "reading" : "readings"}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-text-strong)",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: "80px",
                    textAlign: "right",
                  }}
                >
                  {fmtKwh(seg.units)} kWh
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-sub)",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: "70px",
                    textAlign: "right",
                  }}
                >
                  {fmtRs(seg.amount)}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--color-text-sub)",
                    minWidth: "30px",
                    textAlign: "right",
                  }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}