import React from "react";

const SEGMENTS = [
  {
    key:         "unit",
    label:       "Unit Meters",
    barColor:    "var(--color-accent)",
    textColor:   "var(--color-accent)",
    bgColor:     "var(--color-accent-light)",
    borderColor: "var(--color-accent-mid)",
  },
  {
    key:         "common_area",
    label:       "Common Area",
    barColor:    "var(--color-success)",
    textColor:   "var(--color-success)",
    bgColor:     "var(--color-success-bg)",
    borderColor: "var(--color-success-border)",
  },
  {
    key:         "parking",
    label:       "Parking",
    barColor:    "var(--color-warning)",
    textColor:   "var(--color-warning)",
    bgColor:     "var(--color-warning-bg)",
    borderColor: "var(--color-warning-border)",
  },
  {
    key:         "sub_meter",
    label:       "Sub-Meter",
    barColor:    "var(--color-info)",
    textColor:   "var(--color-info)",
    bgColor:     "var(--color-info-bg)",
    borderColor: "var(--color-info-border)",
  },
];

const fmtKwh = (n) =>
  Number(n).toLocaleString("en-NP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const fmtRs = (n) =>
  `Rs\u00A0${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

export function ElectricitySummaryCards({ grouped = {}, summary = {} }) {
  const { grandTotalUnits = 0 } = summary;

  const activeSegments = SEGMENTS.reduce((acc, seg) => {
    const bucket = grouped[seg.key];
    const units  = Number(bucket?.totalUnits ?? 0);
    const amount = Number(bucket?.totalAmount ?? 0);
    const count  = Number(bucket?.count ?? 0);
    if (units <= 0 && amount <= 0 && count <= 0) return acc;
    return [...acc, { ...seg, units, amount, count }];
  }, []);

  if (activeSegments.length === 0) return null;

  const divisor =
    activeSegments.reduce((s, seg) => s + seg.units, 0) || grandTotalUnits || 1;

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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <h3
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--color-text-sub)",
            margin: 0,
          }}
        >
          Consumption Breakdown
        </h3>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--color-text-strong)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtKwh(grandTotalUnits)} kWh
        </span>
      </div>

      {/* ── Stacked bar ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          height: "6px",
          width: "100%",
          backgroundColor: "var(--color-muted)",
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
                minWidth: pct > 0 ? "3px" : "0",
                backgroundColor: seg.barColor,
                flexShrink: 0,
                transition: "width 0.4s ease",
              }}
            />
          );
        })}
      </div>

      {/* ── Segment rows ────────────────────────────────────────────────── */}
      <div style={{ padding: "4px 0" }}>
        {activeSegments.map((seg, i) => {
          const pct    = (seg.units / divisor) * 100;
          const isLast = i === activeSegments.length - 1;

          return (
            <div
              key={seg.key}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 1fr 52px 90px 80px 40px",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderBottom: isLast ? "none" : "1px solid var(--color-border)",
              }}
            >
              {/* Color dot */}
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: seg.barColor,
                  flexShrink: 0,
                  justifySelf: "center",
                }}
              />

              {/* Label + mini-bar */}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--color-text-body)",
                    marginBottom: "3px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {seg.label}
                </p>
                <div
                  style={{
                    height: "3px",
                    borderRadius: "99px",
                    backgroundColor: "var(--color-muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: seg.barColor,
                      borderRadius: "99px",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              {/* Count */}
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-sub)",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {seg.count} {seg.count === 1 ? "unit" : "units"}
              </span>

              {/* kWh */}
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-strong)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtKwh(seg.units)} kWh
              </span>

              {/* Amount */}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-sub)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtRs(seg.amount)}
              </span>

              {/* % */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-text-sub)",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
