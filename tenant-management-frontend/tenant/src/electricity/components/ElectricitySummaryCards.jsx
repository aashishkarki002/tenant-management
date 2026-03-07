import React from "react";

const METER_SEGMENTS = [
  { key: "unit", label: "Units", color: "#3b82f6", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", lightBg: "#EFF6FF" },
  { key: "common_area", label: "Common Area", color: "#a855f7", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", lightBg: "#FAF5FF" },
  { key: "parking", label: "Parking", color: "#06b6d4", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", lightBg: "#ECFEFF" },
  { key: "sub_meter", label: "Sub-Meter", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", lightBg: "#FFFBEB" },
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
    <div className="bg-white rounded-xl border border-[#E8E4E0] overflow-hidden shadow-sm
      hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#F0EDE9] bg-gradient-to-r from-[#F8F5F2] to-white">
        <h3 className="text-sm font-bold text-[#1C1A18] tracking-tight">Consumption Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#948472]">Total:</span>
          <span className="text-sm font-bold text-[#3D1414]">
            {fmt.kwh(grandTotalUnits)} kWh
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stacked bar — animated on load */}
        <div className="relative h-4 w-full rounded-full bg-[#F0EDE9] overflow-hidden flex shadow-inner">
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
                className={`group rounded-xl border px-3.5 py-3.5 ${seg.bg} ${seg.border} 
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
                    px-1.5 py-0.5 rounded-md bg-white/50`}>
                    {pct}%
                  </span>
                </div>

                <p className={`text-lg font-bold ${seg.text} leading-tight`}>
                  {fmt.kwh(seg.units)} kWh
                </p>
                <p className={`text-xs ${seg.text} opacity-80 mt-1`}>
                  {fmt.rs(seg.amount)}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10">
                  <p className={`text-[10px] ${seg.text} opacity-60 font-medium`}>
                    {seg.count} {seg.count === 1 ? "reading" : "readings"}
                  </p>
                  <div className={`w-1.5 h-1.5 rounded-full ${seg.color.includes("blue") ? "bg-blue-500" : 
                    seg.color.includes("purple") ? "bg-purple-500" :
                    seg.color.includes("cyan") ? "bg-cyan-500" : "bg-amber-500"}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
