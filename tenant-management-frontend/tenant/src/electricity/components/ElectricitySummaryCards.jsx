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
    <div className="bg-white rounded-xl border border-[#E8E4E0] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#F0EDE9]">
        <h3 className="text-sm font-semibold text-[#1C1A18]">Consumption Breakdown</h3>
        <span className="text-xs font-medium text-[#948472]">
          {fmt.kwh(grandTotalUnits)} kWh total
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stacked bar */}
        <div className="relative h-3.5 w-full rounded-full bg-[#F0EDE9] overflow-hidden flex gap-[2px]">
          {activeSegments.map((seg) => {
            const pct = (seg.units / divisor) * 100;
            return (
              <div
                key={seg.key}
                title={`${seg.label}: ${fmt.kwh(seg.units)} kWh (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? "6px" : "0",
                  backgroundColor: seg.color,
                  flexShrink: 0,
                  transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            );
          })}
        </div>

        {/* Per-type breakdown cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {activeSegments.map((seg) => {
            const pct = ((seg.units / divisor) * 100).toFixed(0);
            return (
              <div
                key={seg.key}
                className={`rounded-lg border px-3.5 py-3 ${seg.bg} ${seg.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className={`text-xs font-bold ${seg.text} flex-1 truncate`}>
                    {seg.label}
                  </span>
                  <span className={`text-xs font-semibold ${seg.text} opacity-70`}>
                    {pct}%
                  </span>
                </div>

                <p className={`text-base font-bold ${seg.text} leading-tight`}>
                  {fmt.kwh(seg.units)} kWh
                </p>
                <p className={`text-xs ${seg.text} opacity-80 mt-0.5`}>
                  {fmt.rs(seg.amount)}
                </p>
                <p className={`text-[10px] ${seg.text} opacity-50 mt-1`}>
                  {seg.count} {seg.count === 1 ? "reading" : "readings"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
