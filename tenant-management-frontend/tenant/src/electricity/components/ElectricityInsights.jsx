import React, { useMemo } from "react";
import { getConsumption } from "../utils/electricityCalculations";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

const fmt = {
  kwh: (n) =>
    Number(n).toLocaleString("en-NP", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  rs: (n) =>
    `Rs\u00A0${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`,
};

/**
 * @param {Object}      grouped
 * @param {Object|null} neaBill  — current month's NeaBill document (optional)
 */
export function ElectricityInsights({ grouped = {}, neaBill = null }) {
  const insights = useMemo(() => {
    let allReadings = [];
    for (const key of METER_TYPE_KEYS) {
      allReadings = allReadings.concat(grouped[key]?.readings ?? []);
    }
    if (allReadings.length === 0) return null;

    let highest         = null;
    let lowest          = null;
    let unpaidTotal     = 0;
    let unpaidCount     = 0;
    let unitConsumption = 0;

    for (const r of allReadings) {
      const consumption =
        r.unitsConsumed != null ? Number(r.unitsConsumed) : getConsumption(r);
      const name =
        r.unit?.name ?? r.unit?.unitName ?? r.subMeter?.name ?? "Unknown";

      if (consumption > 0) {
        if (!highest || consumption > highest.consumption)
          highest = { name, consumption };
        if (!lowest || consumption < lowest.consumption)
          lowest = { name, consumption };
      }

      if (r.meterType === "unit") unitConsumption += consumption;

      const status = String(r.status ?? "pending").toLowerCase();
      if (
        status === "pending" ||
        status === "partially_paid" ||
        status === "overdue"
      ) {
        unpaidTotal += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        unpaidCount++;
      }
    }

    let lossData = null;
    if (neaBill?.totalUnits != null && neaBill.totalUnits > 0) {
      const purchased = Number(neaBill.totalUnits);
      const loss      = purchased - unitConsumption;
      const lossPct   = ((loss / purchased) * 100).toFixed(1);
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

  const chips = [
    highest && {
      id: "highest",
      accentColor: "var(--color-danger)",
      accentBg: "var(--color-danger-bg)",
      label: "Highest",
      value: `${fmt.kwh(highest.consumption)} kWh`,
      detail: highest.name,
    },
    lowest && {
      id: "lowest",
      accentColor: "var(--color-success)",
      accentBg: "var(--color-success-bg)",
      label: "Lowest",
      value: `${fmt.kwh(lowest.consumption)} kWh`,
      detail: lowest.name,
    },
    unpaidCount > 0 && {
      id: "unpaid",
      accentColor: "var(--color-warning)",
      accentBg: "var(--color-warning-bg)",
      label: "Unpaid",
      value: fmt.rs(unpaidTotal),
      detail: `${unpaidCount} tenant${unpaidCount !== 1 ? "s" : ""}`,
    },
    lossData && {
      id: "loss",
      accentColor: "var(--color-warning)",
      accentBg: "var(--color-warning-bg)",
      label: "Unit Loss",
      value: `${fmt.kwh(lossData.loss)} kWh`,
      detail: `${lossData.lossPct}% of purchased`,
    },
  ].filter(Boolean);

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(chips.length, 4)}, minmax(0, 1fr))`,
        gap: "8px",
      }}
    >
      {chips.map((chip) => (
        <div
          key={chip.id}
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderLeft: `3px solid ${chip.accentColor}`,
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: chip.accentColor,
              marginBottom: "3px",
            }}
          >
            {chip.label}
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--color-text-strong)",
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.2,
            }}
          >
            {chip.value}
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "var(--color-text-sub)",
              marginTop: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {chip.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
