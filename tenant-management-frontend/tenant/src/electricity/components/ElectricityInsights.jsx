import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertCircle, Zap } from "lucide-react";
import { getConsumption } from "../utils/electricityCalculations";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

const fmt = {
  kwh: (n) => Number(n).toLocaleString("en-NP", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  rs: (n) => `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`,
};

/**
 * @param {Object} grouped
 * @param {Object|null} neaBill  — current month's NeaBill document (optional)
 */
export function ElectricityInsights({ grouped = {}, neaBill = null }) {
  const insights = useMemo(() => {
    let allReadings = [];
    for (const key of METER_TYPE_KEYS) {
      allReadings = allReadings.concat(grouped[key]?.readings ?? []);
    }
    if (allReadings.length === 0) return null;

    let highest    = null;
    let lowest     = null;
    let unpaidTotal = 0;
    let unpaidCount = 0;
    let unitConsumption = 0; // tenant meter kWh only (for loss detection)

    for (const r of allReadings) {
      const consumption = r.unitsConsumed != null ? Number(r.unitsConsumed) : getConsumption(r);
      const name = r.unit?.name ?? r.unit?.unitName ?? r.subMeter?.name ?? "Unknown";

      if (consumption > 0) {
        if (!highest || consumption > highest.consumption) highest = { name, consumption };
        if (!lowest  || consumption < lowest.consumption)  lowest  = { name, consumption };
      }

      if (r.meterType === "unit") unitConsumption += consumption;

      const status = String(r.status ?? "pending").toLowerCase();
      if (status === "pending" || status === "partially_paid" || status === "overdue") {
        unpaidTotal += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        unpaidCount++;
      }
    }

    // Loss detection: only when NEA bill has totalUnits
    let lossData = null;
    if (neaBill?.totalUnits != null && neaBill.totalUnits > 0) {
      const purchased  = Number(neaBill.totalUnits);
      const loss       = purchased - unitConsumption;
      const lossPct    = ((loss / purchased) * 100).toFixed(1);
      if (loss > 0) {
        lossData = {
          purchased,
          metered: unitConsumption,
          loss,
          lossPct: parseFloat(lossPct),
        };
      }
    }

    return { highest, lowest, unpaidTotal, unpaidCount, lossData };
  }, [grouped, neaBill]);

  if (!insights) return null;
  const { highest, lowest, unpaidTotal, unpaidCount, lossData } = insights;

  const cards = [
    highest && {
      id: "highest",
      icon: TrendingUp,
      iconBg: "var(--color-danger-bg)",
      iconColor: "var(--color-danger)",
      label: "Highest Consumption",
      value: `${fmt.kwh(highest.consumption)} kWh`,
      detail: highest.name,
    },
    lowest && {
      id: "lowest",
      icon: TrendingDown,
      iconBg: "var(--color-success-bg)",
      iconColor: "var(--color-success)",
      label: "Lowest Consumption",
      value: `${fmt.kwh(lowest.consumption)} kWh`,
      detail: lowest.name,
    },
    unpaidCount > 0 && {
      id: "unpaid",
      icon: AlertCircle,
      iconBg: "var(--color-warning-bg)",
      iconColor: "var(--color-warning)",
      label: "Unpaid Total",
      value: fmt.rs(unpaidTotal),
      detail: `${unpaidCount} tenant${unpaidCount !== 1 ? "s" : ""}`,
    },
    lossData && {
      id: "loss",
      icon: Zap,
      iconBg: "var(--color-warning-bg)",
      iconColor: "var(--color-warning)",
      label: "Unit Loss Detected",
      value: `${fmt.kwh(lossData.loss)} kWh`,
      detail: `${lossData.lossPct}% of ${fmt.kwh(lossData.purchased)} purchased`,
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(3, minmax(0, 1fr))`, gap: "10px" }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "var(--radius-md)",
                backgroundColor: card.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon style={{ width: "15px", height: "15px", color: card.iconColor }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--color-text-sub)",
                  marginBottom: "2px",
                }}
              >
                {card.label}
              </p>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--color-text-strong)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {card.value}
              </p>
              <p style={{ fontSize: "12px", color: "var(--color-text-sub)", marginTop: "2px" }}>
                {card.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}