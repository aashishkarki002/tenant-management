import React from "react";
import { Zap, DollarSign, AlertTriangle, Gauge } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────





// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = {
  kwh: (n) =>
    Number(n).toLocaleString("en-NP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }),
  rs: (n) =>
    `Rs ${Number(n).toLocaleString("en-NP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`,
};

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
    const bucket = grouped[key];
    if (!bucket) continue;
    const readings = bucket.readings ?? [];
    totalMeters += readings.length;

    for (const r of readings) {
      if (r.currentReading != null && Number(r.currentReading) > 0) {
        recordedMeters++;
      }
      const status = String(r.status ?? "pending").toLowerCase();
      if (status === "pending" || status === "partially_paid" || status === "overdue") {
        pendingAmount += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        pendingCount++;
      }
    }
  }

  return { totalConsumption, totalRevenue, pendingAmount, pendingCount, recordedMeters, totalMeters };
}

// ─── KPI config ───────────────────────────────────────────────────────────────
//
// Industry note: DO NOT derive Tailwind bg/text classes dynamically via string
// manipulation (e.g. borderAccent.replace("border-l-", "bg-")). Tailwind's
// tree-shaker is a regex scanner — it only retains classes it finds as complete
// strings at build time. Dynamically generated substrings are invisible to it
// and will be purged in production. Always list full class names explicitly.



const KPI_CONFIG = [
  {
    id: "consumption",
    label: "Total Consumption",
    icon: Zap,
    iconBg: "bg-accent-bg",
    iconColor: "text-accent",
    borderAccent: "border-l-accent",
    barColor: "bg-accent",           // ← explicit, never derived
    getValue: (kpis) => `${fmt.kwh(kpis.totalConsumption)} kWh`,
    getSub: () => "This billing period",
  },
  {
    id: "revenue",
    label: "Electricity Revenue",
    icon: DollarSign,
    iconBg: "bg-success-bg",
    iconColor: "text-success",
    borderAccent: "border-l-success",
    barColor: "bg-success",
    getValue: (kpis) => fmt.rs(kpis.totalRevenue),
    getSub: () => "Billed this period",
  },
  {
    id: "pending",
    label: "Pending Bills",
    icon: AlertTriangle,
    iconBg: "bg-warning-bg",
    iconColor: "text-warning",
    borderAccent: "border-l-warning",
    barColor: "bg-warning",
    getValue: (kpis) => fmt.rs(kpis.pendingAmount),
    getSub: (kpis) =>
      kpis.pendingCount > 0
        ? `${kpis.pendingCount} tenant${kpis.pendingCount !== 1 ? "s" : ""} unpaid`
        : "All bills paid",
    getAlert: (kpis) => kpis.pendingCount > 0,
  },
  {
    id: "meters",
    label: "Readings Completed",
    icon: Gauge,
    iconBg: "bg-accent-bg",
    iconColor: "text-accent",
    borderAccent: "border-l-accent",
    barColor: "bg-accent",
    getValue: (kpis) => `${kpis.recordedMeters} / ${kpis.totalMeters}`,
    getSub: () => "Meters recorded",
    getAlert: (kpis) => kpis.totalMeters > 0 && kpis.recordedMeters < kpis.totalMeters,
    getAlertText: (kpis) => {
      const missing = kpis.totalMeters - kpis.recordedMeters;
      return `${missing} meter${missing !== 1 ? "s" : ""} missing readings`;
    },
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ElectricityKpiCards({
  grouped = {},
  summary = {},
  periodLabel,
}) {
  const kpis = deriveKpis(grouped, summary);

  return (
    <div>
      {/* Section header — makes it unambiguous which period the KPIs represent */}
      {periodLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-sub uppercase tracking-wider">
            Key Metrics
          </span>
          <span className="text-xs font-bold text-text-sub bg-muted-fill border border-muted-fill
            px-2.5 py-1 rounded-full">
            {periodLabel}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map((config) => {
          const Icon = config.icon;
          const showAlert = config.getAlert?.(kpis);

          return (
            <div
              key={config.id}
              className={`group relative bg-surface-raised rounded-xl border border-muted-fill
                px-4 py-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
                ${showAlert ? "ring-2 ring-warning-border/50" : ""}`}
            >
              {/* Left accent bar — explicit barColor, never derived from borderAccent */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${config.barColor}
                  transition-all duration-200 group-hover:w-1.5`}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide uppercase text-text-sub mb-1.5">
                    {config.label}
                  </p>
                  <p className="text-2xl font-bold text-text-strong leading-tight truncate">
                    {config.getValue(kpis)}
                  </p>
                  <p className="text-xs text-text-sub mt-1.5">{config.getSub(kpis)}</p>
                </div>
                <div
                  className={`flex items-center justify-center w-11 h-11 rounded-xl ${config.iconBg}
                    shrink-0 transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
              </div>

              {showAlert && config.getAlertText && (
                <div
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-warning
                    bg-warning-bg border border-warning-border rounded-lg px-2.5 h-7   py-1.5
                    animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {config.getAlertText(kpis)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}