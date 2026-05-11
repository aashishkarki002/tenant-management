import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NEPALI_MONTH_NAMES } from "../../utils/nepaliDate";

const METER_KEYS = ["unit", "common_area", "parking", "sub_meter"];
const MONTH_ABBR = NEPALI_MONTH_NAMES.map((m) => m.slice(0, 3).toUpperCase());
export function ConsumptionTrendChart({
  neaBills = [],
  currentPeriod = null,
  grouped = {},
}) {
  // ── Chart data ─────────────────────────────
  const chartData = useMemo(() => {
    const sorted = [...neaBills]
      .filter((b) => b.totalUnits != null)
      .sort((a, b) => {
        if (a.nepaliYear !== b.nepaliYear) return a.nepaliYear - b.nepaliYear;
        return a.nepaliMonth - b.nepaliMonth;
      })
      .slice(-6);

    return sorted.map((bill) => ({
      month: MONTH_ABBR[(bill.nepaliMonth ?? 1) - 1] ?? `M${bill.nepaliMonth}`,
      kWh: bill.totalUnits ?? 0,
      isCurrent:
        currentPeriod &&
        bill.nepaliYear === currentPeriod.year &&
        bill.nepaliMonth === currentPeriod.month,
    }));
  }, [neaBills, currentPeriod]);

  // ── Meter coverage ─────────────────────────
  let totalMeters = 0;
  let recordedMeters = 0;

  for (const key of METER_KEYS) {
    const readings = grouped[key]?.readings ?? [];
    totalMeters += readings.length;

    for (const r of readings) {
      if (Number(r.currentReading) > 0) recordedMeters++;
    }
  }

  const meterPct = totalMeters ? (recordedMeters / totalMeters) * 100 : 0;
  const meterMissing = totalMeters - recordedMeters;
  const noMeters = totalMeters === 0;

  return (
    <Card className="w-full shadow-sm border">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm font-semibold">
          Consumption Trend
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          6 months · kWh
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="h-[90px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                />
                <YAxis hide />
                <Tooltip
                  formatter={(val) => [`${val} kWh`, "Consumption"]}
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="kWh" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isCurrent ? "#0d9488" : "#99f6e4"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No historical NEA bills yet
            </div>
          )}
        </div>

        {/* Meter coverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Meter Coverage
            </span>

            {noMeters ? (
              <span className="text-xs text-muted-foreground">
                No meters configured
              </span>
            ) : (
              <span className="text-xs font-medium tabular-nums">
                {recordedMeters} / {totalMeters}
              </span>
            )}
          </div>

          {!noMeters && (
            <>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    meterMissing > 0 ? "bg-amber-500" : "bg-teal-600"
                  }`}
                  style={{ width: `${meterPct}%` }}
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                {meterMissing > 0
                  ? `${meterMissing} meter${
                      meterMissing !== 1 ? "s" : ""
                    } not yet recorded`
                  : "All meters recorded"}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}