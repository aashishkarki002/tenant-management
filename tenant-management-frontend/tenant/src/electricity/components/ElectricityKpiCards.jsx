import React from "react";
import { AlertTriangle } from "lucide-react";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

function deriveKpis(grouped, summary) {
  const totalConsumption = Number(summary.grandTotalUnits) || 0;
  const totalRevenue     = Number(summary.grandTotalAmount) || 0;
  const totalMargin      = Number(summary.grandTotalMargin) || 0;
  const totalNeaCost     = Number(summary.grandTotalNeaCost) || 0;

  let pendingAmount  = 0;
  let pendingCount   = 0;
  let recordedMeters = 0;
  let totalMeters    = 0;

  for (const key of METER_TYPE_KEYS) {
    const readings = grouped[key]?.readings ?? [];
    totalMeters += readings.length;
    for (const r of readings) {
      if (Number(r.currentReading) > 0) recordedMeters++;
      const status = String(r.status ?? "pending").toLowerCase();
      if (status === "pending" || status === "partially_paid" || status === "overdue") {
        pendingAmount += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        pendingCount++;
      }
    }
  }

  const marginPercent =
    totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : null;

  return {
    totalConsumption, totalRevenue, totalMargin, totalNeaCost, marginPercent,
    pendingAmount, pendingCount, recordedMeters, totalMeters,
  };
}

const fmtKwh = (n) =>
  `${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;
const fmtRs = (n) =>
  `Rs\u00A0${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

export function ElectricityKpiCards({ grouped = {}, summary = {} }) {
  const kpis = deriveKpis(grouped, summary);
  const {
    totalConsumption, totalRevenue, totalMargin, marginPercent,
    pendingAmount, pendingCount, recordedMeters, totalMeters,
  } = kpis;

  const marginNegative = totalMargin < 0;
  const meterPct       = totalMeters > 0 ? (recordedMeters / totalMeters) * 100 : 0;
  const meterMissing   = totalMeters - recordedMeters;

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
      {/* ── Primary metrics: Revenue · Consumption · Margin ─────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>

        {/* Revenue */}
        <div style={{ padding: "16px 20px", borderRight: "1px solid var(--color-border)" }}>
          <p style={LABEL_STYLE}>Electricity Revenue</p>
          <p style={{ ...PRIMARY_NUMBER_STYLE, color: "var(--color-text-strong)" }}>
            {fmtRs(totalRevenue)}
          </p>
          <p style={SUB_STYLE}>Billed to tenants</p>
        </div>

        {/* Consumption */}
        <div style={{ padding: "16px 20px", borderRight: "1px solid var(--color-border)" }}>
          <p style={LABEL_STYLE}>Total Consumption</p>
          <p style={{ ...PRIMARY_NUMBER_STYLE, color: "var(--color-text-strong)" }}>
            {fmtKwh(totalConsumption)}
          </p>
          <p style={SUB_STYLE}>This billing period</p>
        </div>

        {/* Margin */}
        <div style={{ padding: "16px 20px" }}>
          <p style={LABEL_STYLE}>Profit Margin</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
            <p
              style={{
                ...PRIMARY_NUMBER_STYLE,
                color: marginNegative
                  ? "var(--color-danger)"
                  : "var(--color-text-strong)",
              }}
            >
              {fmtRs(totalMargin)}
            </p>
            {marginPercent != null && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "99px",
                  flexShrink: 0,
                  backgroundColor: marginNegative
                    ? "var(--color-danger-bg)"
                    : "var(--color-success-bg)",
                  color: marginNegative
                    ? "var(--color-danger)"
                    : "var(--color-success)",
                  border: `1px solid ${
                    marginNegative
                      ? "var(--color-danger-border, var(--color-danger))"
                      : "var(--color-success-border)"
                  }`,
                }}
              >
                {marginPercent}%
              </span>
            )}
          </div>
          <p
            style={{
              ...SUB_STYLE,
              color: marginNegative
                ? "var(--color-danger)"
                : "var(--color-text-sub)",
            }}
          >
            {marginNegative ? "Selling below NEA cost" : "Revenue minus NEA cost"}
          </p>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: "1px", backgroundColor: "var(--color-border)" }} />

      {/* ── Secondary strip: Pending · Meter Coverage ─────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          backgroundColor: "var(--color-surface)",
        }}
      >
        {/* Pending Payments */}
        <div
          style={{
            padding: "11px 20px",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={LABEL_STYLE}>Pending Payments</p>
            <p
              style={{
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
                color: pendingCount > 0
                  ? "var(--color-warning)"
                  : "var(--color-text-strong)",
              }}
            >
              {fmtRs(pendingAmount)}
            </p>
          </div>
          {pendingCount > 0 ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-warning-bg)",
                color: "var(--color-warning)",
                border: "1px solid var(--color-warning-border)",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <AlertTriangle style={{ width: "10px", height: "10px" }} />
              {pendingCount} unpaid
            </span>
          ) : (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-success-bg)",
                color: "var(--color-success)",
                border: "1px solid var(--color-success-border)",
                flexShrink: 0,
              }}
            >
              All settled
            </span>
          )}
        </div>

        {/* Meter Coverage */}
        <div style={{ padding: "11px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <p style={LABEL_STYLE}>Meter Coverage</p>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-text-strong)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {recordedMeters}&thinsp;/&thinsp;{totalMeters}
            </span>
          </div>
          <div
            style={{
              height: "6px",
              borderRadius: "99px",
              backgroundColor: "var(--color-muted)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${meterPct}%`,
                borderRadius: "99px",
                backgroundColor:
                  meterMissing > 0 ? "var(--color-warning)" : "var(--color-success)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <p style={{ ...SUB_STYLE, marginTop: "4px" }}>
            {meterMissing > 0
              ? `${meterMissing} meter${meterMissing !== 1 ? "s" : ""} not yet recorded`
              : totalMeters > 0
              ? "All meters recorded"
              : "No meters this period"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared micro-styles ──────────────────────────────────────────────────────

const LABEL_STYLE = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-text-sub)",
  marginBottom: "5px",
};

const PRIMARY_NUMBER_STYLE = {
  fontSize: "24px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
};

const SUB_STYLE = {
  fontSize: "11px",
  color: "var(--color-text-sub)",
  marginTop: "4px",
};
