import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { getConsumption } from "../utils/electricityCalculations";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

const fmt = {
  kwh: (n) =>
    Number(n).toLocaleString("en-NP", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  rs: (n) =>
    `Rs ${Number(n).toLocaleString("en-NP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`,
};

export function ElectricityInsights({ grouped = {} }) {
  const insights = useMemo(() => {
    let allReadings = [];
    for (const key of METER_TYPE_KEYS) {
      const readings = grouped[key]?.readings ?? [];
      allReadings = allReadings.concat(readings);
    }

    if (allReadings.length === 0) return null;

    let highest = null;
    let lowest = null;
    let unpaidTotal = 0;
    let unpaidCount = 0;

    for (const r of allReadings) {
      const consumption = r.unitsConsumed != null ? Number(r.unitsConsumed) : getConsumption(r);
      const name =
        r.unit?.name ?? r.unit?.unitName ?? r.subMeter?.name ?? "Unknown";

      if (consumption > 0) {
        if (!highest || consumption > highest.consumption) {
          highest = { name, consumption };
        }
        if (!lowest || consumption < lowest.consumption) {
          lowest = { name, consumption };
        }
      }

      const status = String(r.status ?? "pending").toLowerCase();
      if (status === "pending" || status === "partially_paid" || status === "overdue") {
        unpaidTotal += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        unpaidCount++;
      }
    }

    return { highest, lowest, unpaidTotal, unpaidCount };
  }, [grouped]);

  if (!insights) return null;
  const { highest, lowest, unpaidTotal, unpaidCount } = insights;

  const cards = [
    highest && {
      id: "highest",
      icon: TrendingUp,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      borderColor: "border-red-200",
      label: "Highest Consumption",
      value: `${fmt.kwh(highest.consumption)} kWh`,
      detail: highest.name,
    },
    lowest && {
      id: "lowest",
      icon: TrendingDown,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      borderColor: "border-green-200",
      label: "Lowest Consumption",
      value: `${fmt.kwh(lowest.consumption)} kWh`,
      detail: lowest.name,
    },
    unpaidCount > 0 && {
      id: "unpaid",
      icon: AlertCircle,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      borderColor: "border-orange-200",
      label: "Unpaid Electricity Total",
      value: fmt.rs(unpaidTotal),
      detail: `Across ${unpaidCount} tenant${unpaidCount !== 1 ? "s" : ""}`,
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`group flex items-center gap-3 bg-white rounded-xl border ${card.borderColor ?? "border-[#E8E4E0]"} 
              px-4 py-3.5 transition-all duration-200 hover:shadow-md hover:scale-[1.02]
              animate-in fade-in slide-in-from-left-2`}
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.iconBg} shrink-0
              transition-transform duration-200 group-hover:scale-110 shadow-sm`}>
              <Icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wider uppercase text-[#948472] mb-0.5">
                {card.label}
              </p>
              <p className="text-base font-bold text-[#1C1A18] truncate leading-tight">{card.value}</p>
              <p className="text-xs text-[#948472] truncate mt-1">{card.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
