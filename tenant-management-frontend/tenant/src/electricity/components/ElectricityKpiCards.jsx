import React from "react";
import { Zap, DollarSign, AlertTriangle, Gauge } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

// ─── KPI derivation ───────────────────────────────────────────────────────────

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

  return {
    totalConsumption,
    totalRevenue,
    pendingAmount,
    pendingCount,
    recordedMeters,
    totalMeters,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtKwh = (n) =>
  `${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

// ─── Card config ──────────────────────────────────────────────────────────────
// Note: DO NOT derive color tokens dynamically at runtime — Tailwind's scanner
// only retains class names it sees as complete strings at build time.
// All color values here use CSS variables via inline style instead.

const KPI_CONFIG = [
  {
    id: "consumption",
    label: "Total Consumption",
    Icon: Zap,
    accentColor: "var(--color-accent)",
    accentBg: "var(--color-accent-light)",
    getValue: (k) => fmtKwh(k.totalConsumption),
    getSub: () => "This billing period",
    getAlert: () => false,
  },
  {
    id: "revenue",
    label: "Electricity Revenue",
    Icon: DollarSign,
    accentColor: "var(--color-success)",
    accentBg: "var(--color-success-bg)",
    getValue: (k) => fmtRs(k.totalRevenue),
    getSub: () => "Billed this period",
    getAlert: () => false,
  },
  {
    id: "pending",
    label: "Pending Bills",
    Icon: AlertTriangle,
    accentColor: "var(--color-warning)",
    accentBg: "var(--color-warning-bg)",
    getValue: (k) => fmtRs(k.pendingAmount),
    getSub: (k) =>
      k.pendingCount > 0
        ? `${k.pendingCount} tenant${k.pendingCount !== 1 ? "s" : ""} unpaid`
        : "All bills settled",
    getAlert: (k) => k.pendingCount > 0,
    getAlertText: (k) =>
      `${k.pendingCount} bill${k.pendingCount !== 1 ? "s" : ""} outstanding`,
  },
  {
    id: "meters",
    label: "Readings Completed",
    Icon: Gauge,
    accentColor: "var(--color-accent)",
    accentBg: "var(--color-accent-light)",
    getValue: (k) => `${k.recordedMeters} / ${k.totalMeters}`,
    getSub: () => "Meters recorded",
    getAlert: (k) => k.totalMeters > 0 && k.recordedMeters < k.totalMeters,
    getAlertText: (k) => {
      const missing = k.totalMeters - k.recordedMeters;
      return `${missing} meter${missing !== 1 ? "s" : ""} missing`;
    },
  },
];

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ config, kpis }) {
  const { Icon, label, accentColor, accentBg } = config;
  const showAlert = config.getAlert(kpis);

  return (
    <div
      className="relative group rounded-xl px-4 py-4 transition-shadow duration-200 hover:shadow-lg"
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label — weakest level in hierarchy */}
          <p
            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: "var(--color-text-sub)" }}
          >
            {label}
          </p>

          {/* Primary value — strongest */}
          <p
            className="text-2xl font-bold leading-tight truncate tabular-nums"
            style={{ color: "var(--color-text-strong)" }}
          >
            {config.getValue(kpis)}
          </p>

          {/* Sub-label */}
          <p
            className="text-xs mt-1.5"
            style={{ color: "var(--color-text-sub)" }}
          >
            {config.getSub(kpis)}
          </p>
        </div>

        {/* Icon */}
        <div
          className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
          style={{ backgroundColor: accentBg }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>

      {/* Alert pill */}
      {showAlert && config.getAlertText && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2.5 py-1.5"
          style={{
            backgroundColor: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            color: "var(--color-warning)",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {config.getAlertText(kpis)}
        </div>
      )}
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function ElectricityKpiCards({ grouped = {}, summary = {}, periodLabel }) {
  const kpis = deriveKpis(grouped, summary);

  return (
    <div>
      {periodLabel && (
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-sub)" }}
        >
          Key Metrics
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map((config) => (
          <KpiCard key={config.id} config={config} kpis={kpis} />
        ))}
      </div>
    </div>
  );
}