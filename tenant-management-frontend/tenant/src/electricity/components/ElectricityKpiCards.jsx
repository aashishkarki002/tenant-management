import React from "react";
import { Zap, DollarSign, AlertTriangle, Gauge } from "lucide-react";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

function deriveKpis(grouped, summary) {
  const totalConsumption = Number(summary.grandTotalUnits) || 0;
  const totalRevenue = Number(summary.grandTotalAmount) || 0;

  let pendingAmount = 0;
  let pendingCount = 0;
  let recordedMeters = 0;
  let totalMeters = 0;

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

  return { totalConsumption, totalRevenue, pendingAmount, pendingCount, recordedMeters, totalMeters };
}

const fmtKwh = (n) => `${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;
const fmtRs = (n) => `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

const KPI_CONFIG = [
  {
    id: "consumption",
    label: "Total Consumption",
    Icon: Zap,
    accentVar: "--kpi-accent-blue",
    getValue: (k) => fmtKwh(k.totalConsumption),
    getSub: () => "This billing period",
    getAlert: () => false,
  },
  {
    id: "revenue",
    label: "Electricity Revenue",
    Icon: DollarSign,
    accentVar: "--kpi-accent-green",
    getValue: (k) => fmtRs(k.totalRevenue),
    getSub: () => "Billed this period",
    getAlert: () => false,
  },
  {
    id: "pending",
    label: "Pending Bills",
    Icon: AlertTriangle,
    accentVar: "--kpi-accent-amber",
    getValue: (k) => fmtRs(k.pendingAmount),
    getSub: (k) =>
      k.pendingCount > 0
        ? `${k.pendingCount} tenant${k.pendingCount !== 1 ? "s" : ""} unpaid`
        : "All bills settled",
    getAlert: (k) => k.pendingCount > 0,
    getAlertText: (k) => `${k.pendingCount} bill${k.pendingCount !== 1 ? "s" : ""} outstanding`,
  },
  {
    id: "meters",
    label: "Readings Completed",
    Icon: Gauge,
    accentVar: "--kpi-accent-blue",
    getValue: (k) => `${k.recordedMeters} / ${k.totalMeters}`,
    getSub: () => "Meters recorded",
    getAlert: (k) => k.totalMeters > 0 && k.recordedMeters < k.totalMeters,
    getAlertText: (k) => {
      const missing = k.totalMeters - k.recordedMeters;
      return `${missing} meter${missing !== 1 ? "s" : ""} missing`;
    },
  },
];

function KpiCard({ config, kpis }) {
  const { Icon, label } = config;
  const showAlert = config.getAlert(kpis);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "var(--color-text-sub)",
              marginBottom: "6px",
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--color-text-strong)",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {config.getValue(kpis)}
          </p>
          <p style={{ fontSize: "12px", color: "var(--color-text-sub)", marginTop: "4px" }}>
            {config.getSub(kpis)}
          </p>
        </div>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-muted-fill)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: "16px", height: "16px", color: "var(--color-text-sub)" }} />
        </div>
      </div>

      {showAlert && config.getAlertText && (
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            fontWeight: 500,
            borderRadius: "var(--radius-sm)",
            padding: "5px 9px",
            backgroundColor: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            color: "var(--color-warning)",
          }}
        >
          <AlertTriangle style={{ width: "11px", height: "11px", flexShrink: 0 }} />
          {config.getAlertText(kpis)}
        </div>
      )}
    </div>
  );
}

export function ElectricityKpiCards({ grouped = {}, summary = {} }) {
  const kpis = deriveKpis(grouped, summary);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "10px",
      }}
    >
      {KPI_CONFIG.map((config) => (
        <KpiCard key={config.id} config={config} kpis={kpis} />
      ))}
    </div>
  );
}