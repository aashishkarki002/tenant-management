import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatRupeesCompact } from "@/lib/formatters";

const DATASET_COLORS = {
  monthly: "var(--color-accent)",
  quarterly: "#378ADD",
  booked: "var(--color-muted-fill)",
};

const TOGGLES = [
  { id: "all", label: "All" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--color-surface-invert)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#fff",
        minWidth: 130,
      }}
    >
      <div className="font-semibold mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.fill }}
          />
          <span style={{ color: "rgba(255,255,255,0.6)" }}>{p.name}</span>
          <span className="ml-auto font-mono">
            {formatRupeesCompact(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TogglePill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none"
      style={
        active
          ? { background: "var(--color-accent)", color: "#fff" }
          : {
              background: "var(--color-surface)",
              color: "var(--color-text-sub)",
              border: "1px solid var(--color-border)",
            }
      }
    >
      {children}
    </button>
  );
}

function LegendItem({ color, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ background: color }}
      />
      <span style={{ color: "var(--color-text-sub)" }}>{label}</span>
      {value != null && (
        <span
          className="font-semibold tabular-nums"
          style={{ color: "var(--color-text-strong)" }}
        >
          {formatRupeesCompact(value)}
        </span>
      )}
    </div>
  );
}

export default function RevenueChart({ data, loading, quarter }) {
  const [toggle, setToggle] = useState("all");
  const chartData = Array.isArray(data) ? data : [];

  const totalMonthly = chartData.reduce((s, d) => s + (d.monthly ?? 0), 0);
  const totalQuarterly = chartData.reduce((s, d) => s + (d.quarterly ?? 0), 0);
  const totalBooked = chartData.reduce((s, d) => s + (d.booked ?? 0), 0);

  const showMonthly = toggle === "all" || toggle === "monthly";
  const showQuarterly = toggle === "all" || toggle === "quarterly";

  return (
    <div
      className="h-full flex flex-col gap-2 rounded-[14px] p-4"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
      role="img"
      aria-label={`Revenue chart for ${quarter}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
        >
          Revenue by Month
        </span>
        <div className="flex items-center gap-1">
          {TOGGLES.map((t) => (
            <TogglePill
              key={t.id}
              active={toggle === t.id}
              onClick={() => setToggle(t.id)}
            >
              {t.label}
            </TogglePill>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div
            className="h-full w-full rounded-lg animate-pulse"
            style={{ background: "var(--color-muted-fill)" }}
          />
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
              No data for {quarter}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
              barSize={28}
            >
              <XAxis
                dataKey="month"
                tick={{
                  fontSize: 11,
                  fill: "var(--color-text-sub)",
                  fontVariantNumeric: "tabular-nums",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-text-sub)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  v === 0 ? "0" : formatRupeesCompact(v)
                }
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              {showMonthly && (
                <Bar
                  dataKey="monthly"
                  name="Monthly collected"
                  stackId="a"
                  fill={DATASET_COLORS.monthly}
                  radius={[4, 4, 0, 0]}
                />
              )}
              {showQuarterly && (
                <Bar
                  dataKey="quarterly"
                  name="Quarterly collected"
                  stackId="a"
                  fill={DATASET_COLORS.quarterly}
                  radius={showMonthly ? [4, 4, 0, 0] : [4, 4, 0, 0]}
                />
              )}
              <Bar
                dataKey="booked"
                name="Booked (uncollected)"
                stackId="a"
                fill={DATASET_COLORS.booked}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 shrink-0 pt-1 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        {showMonthly && (
          <LegendItem
            color={DATASET_COLORS.monthly}
            label="Monthly"
            value={totalMonthly}
          />
        )}
        {showQuarterly && (
          <LegendItem
            color={DATASET_COLORS.quarterly}
            label="Quarterly"
            value={totalQuarterly}
          />
        )}
        <LegendItem
          color={DATASET_COLORS.booked}
          label="Booked"
          value={totalBooked}
        />
      </div>
    </div>
  );
}
