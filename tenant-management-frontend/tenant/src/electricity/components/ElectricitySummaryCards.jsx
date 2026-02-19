import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, DollarSign, BarChart3, CheckCircle } from "lucide-react";

/**
 * Segment config — single source of truth for meter types.
 * Adding a new meter type only requires a new entry here.
 */
const METER_SEGMENTS = [
  { key: "unit", label: "Unit", color: "#3b82f6", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { key: "common_area", label: "Common Area", color: "#a855f7", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  { key: "parking", label: "Parking", color: "#06b6d4", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  { key: "sub_meter", label: "Sub-Meter", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
];

const fmt = {
  kwh: (n) =>
    Number(n).toLocaleString("en-NP", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  rs: (n) =>
    `Rs. ${Number(n).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
};

/**
 * ElectricitySummaryCards
 *
 * Props:
 *   grouped : {
 *     unit:        { totalUnits, totalAmount, count, readings }
 *     common_area: { ... }
 *     parking:     { ... }
 *     sub_meter:   { ... }
 *   }
 *   summary : {
 *     grandTotalUnits   : number  (kWh)
 *     grandTotalAmount  : number  (rupees)
 *     totalReadings     : number
 *   }
 */
export function ElectricitySummaryCards({ grouped = {}, summary = {} }) {
  const {
    grandTotalUnits = 0,
    grandTotalAmount = 0,
    totalReadings = 0,
  } = summary;

  // Build active segments — only those with data
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

  // Count paid vs unpaid from all readings
  const { paidCount, pendingAmount } = React.useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const seg of METER_SEGMENTS) {
      const readings = grouped[seg.key]?.readings ?? [];
      for (const r of readings) {
        if (r.status === "paid") paid += 1;
        if (r.status === "pending" || r.status === "partially_paid" || r.status === "overdue") {
          pending += Number(r.remainingAmount ?? r.totalAmount ?? 0);
        }
      }
    }
    return { paidCount: paid, pendingAmount: pending };
  }, [grouped]);

  return (
    <div className="space-y-3 mt-4">



      {/* ── Consumption breakdown bar ────────────────────────────────────────── */}
      {activeSegments.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="px-5 py-4 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
                Consumption Breakdown by Type
              </span>
              <span className="text-xs text-gray-500">
                {fmt.kwh(grandTotalUnits)} kWh total
              </span>
            </div>

            {/* Stacked bar
                Pattern: outer div clips + rounds; inner segments butt flush
                with a 2px white gap between them. No per-segment border-radius
                needed — the container handles the pill shape, gaps create
                clear visual separation without bleed. */}
            <div className="relative h-3 w-full rounded-full bg-gray-100 overflow-hidden flex gap-px">
              {activeSegments.map((seg) => {
                const pct = (seg.units / divisor) * 100;
                return (
                  <div
                    key={seg.key}
                    title={`${seg.label}: ${fmt.kwh(seg.units)} kWh (${pct.toFixed(1)}%)`}
                    style={{
                      width: `${pct}%`,
                      minWidth: pct > 0 ? "4px" : "0",   // always visible if non-zero
                      backgroundColor: seg.color,
                      flexShrink: 0,
                      transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                );
              })}
            </div>

            {/* Per-type legend with kWh + amount */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {activeSegments.map((seg) => {
                const pct = ((seg.units / divisor) * 100).toFixed(0);
                return (
                  <div
                    key={seg.key}
                    className={`rounded-lg border px-3 py-2 ${seg.bg} ${seg.border}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className={`text-xs font-semibold ${seg.text}`}>
                        {seg.label}
                      </span>
                      <span className={`ml-auto text-xs ${seg.text} opacity-70`}>
                        {pct}%
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${seg.text}`}>
                      {fmt.kwh(seg.units)} kWh
                    </p>
                    <p className={`text-xs ${seg.text} opacity-80`}>
                      {fmt.rs(seg.amount)}
                    </p>
                    <p className={`text-xs ${seg.text} opacity-60 mt-0.5`}>
                      {seg.count} {seg.count === 1 ? "reading" : "readings"}
                    </p>
                  </div>
                );
              })}
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}