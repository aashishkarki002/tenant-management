import React from "react";

const METER_SEGMENTS = [
  { key: "unit", label: "Units", color: "var(--color-primary)", bg: "bg-primary-bg", text: "text-primary", border: "border-primary-border", dotClass: "bg-primary" },
  { key: "common_area", label: "Common Area", color: "var(--color-success)", bg: "bg-success-bg", text: "text-success", border: "border-success-border", dotClass: "bg-success" },
  { key: "parking", label: "Parking", color: "var(--color-warning)", bg: "bg-warning-bg", text: "text-warning", border: "border-warning-border", dotClass: "bg-warning" },
  { key: "sub_meter", label: "Sub-Meter", color: "var(--color-danger)", bg: "bg-danger-bg", text: "text-danger", border: "border-danger-border", dotClass: "bg-danger" },
];

const fmt = {
  kwh: (n) =>
    Number(n).toLocaleString("en-NP", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  rs: (n) =>
    `Rs ${Number(n).toLocaleString("en-NP", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
};

export function ElectricitySummaryCards({ grouped = {}, summary = {} }) {
  const { grandTotalUnits = 0 } = summary;

  const activeSegments = METER_SEGMENTS.reduce((acc, seg) => {
    const bucket = grouped[seg.key];
    const units = Number(bucket?.totalUnits ?? 0);
    const amount = Number(bucket?.totalAmount ?? 0);
    const count = Number(bucket?.count ?? 0);
    if (units <= 0 && amount <= 0 && count <= 0) return acc;
    acc.push({ ...seg, units, amount, count });
    return acc;
  }, []);

  const divisor = activeSegments.reduce((s, seg) => s + seg.units, 0) || grandTotalUnits || 1;

  if (activeSegments.length === 0) return null;

  return (
    <div className="bg-surface-raised rounded-xl border border-muted-fill overflow-hidden shadow-sm
      hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-muted-fill bg-gradient-to-r from-muted-fill to-surface-raised">
        <h3 className="text-sm font-bold text-text-strong tracking-tight">Consumption Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-sub">Total:</span>
          <span className="text-sm font-bold text-text-strong">
            {fmt.kwh(grandTotalUnits)} kWh
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stacked bar — animated on load */}
        <div className="relative h-4 w-full rounded-full bg-secondary overflow-hidden flex shadow-inner">
          {activeSegments.map((seg) => {
            const pct = (seg.units / divisor) * 100;
            return (
              <div
                key={seg.key}
                title={`${seg.label}: ${fmt.kwh(seg.units)} kWh (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? "8px" : "0",
                  backgroundColor: seg.color,
                  flexShrink: 0,
                  transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)",
                }}
                className="hover:opacity-80 cursor-pointer first:rounded-l-full last:rounded-r-full"
              />
            );
          })}
        </div>

        {/* Per-type breakdown cards — responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {activeSegments.map((seg, index) => {
            const pct = ((seg.units / divisor) * 100).toFixed(0);
            return (
              <div
                key={seg.key}
                className={`group rounded-xl border border-border px-3.5 py-3.5 ${seg.bg} ${seg.border} 
                  transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-default
                  animate-in fade-in slide-in-from-bottom-2`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0 shadow-sm
                      transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className={`text-xs font-bold ${seg.text} flex-1 truncate`}>
                    {seg.label}
                  </span>
                  <span className={`text-xs font-bold ${seg.text} opacity-70 
                    px-1.5 py-0.5 rounded-md bg-secondary hover:bg-secondary/80`}>
                    {pct}%
                  </span>
                </div>

                <p className={`text-lg font-bold ${seg.text} leading-tight`}>
                  {fmt.kwh(seg.units)} kWh
                </p>
                <p className={`text-xs ${seg.text} opacity-80 mt-1`}>
                  {fmt.rs(seg.amount)}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <p className={`text-[10px] ${seg.text} opacity-60 font-medium`}>
                    {seg.count} {seg.count === 1 ? "reading" : "readings"}
                  </p>
                  <div className={`w-1.5 h-1.5 rounded-full ${seg.dotClass}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
