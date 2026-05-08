import React, { useMemo } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";
import {
  NEPALI_MONTH_NAMES,
  getCurrentFYMonths,
  getFYStartYear,
  getTodayNepali,
} from "@/utils/nepaliDate";

// ── Custom tooltip ────────────────────────────────────────────────────────
const BvETooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--color-surface-invert)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "var(--color-surface-invert-text, #fff)",
        minWidth: 120,
      }}
    >
      <div className="font-semibold mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-none"
            style={{ background: p.fill ?? p.stroke }}
          />
          <span style={{ color: "rgba(255,255,255,0.6)" }}>{p.name}</span>
          <span className="ml-auto font-mono">{formatRupeesCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Trend chip ────────────────────────────────────────────────────────────
function TrendChip({ direction, label }) {
  const cfg = {
    up: { icon: TrendingUp, style: { color: "var(--color-success)", background: "var(--color-success-bg)" } },
    down: { icon: TrendingDown, style: { color: "var(--color-danger)", background: "var(--color-danger-bg)" } },
    flat: { icon: Minus, style: { color: "var(--color-text-sub)", background: "var(--color-surface)" } },
  }[direction ?? "flat"];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={cfg.style}
    >
      <Icon className="w-3 h-3"/>
      {label}
    </span>
  );
}

// ── Bar shape with rounded top ────────────────────────────────────────────
const RoundedBar = (props) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const r = Math.min(4, height / 2);
  return (
    <g>
      <path
        d={`M${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} H${x} V${y + r} Q${x},${y} ${x + r},${y}`}
        fill={fill}
      />
    </g>
  );
};

export default function BookedVsEarnedPanel({ stats, loading }) {
  const kpi = stats?.kpi ?? {};
  const revenueByMonth = stats?.revenueByMonth ?? [];

  // Build chart data from revenueByMonth — last 6 months of FY
  const chartData = useMemo(() => {
    const todayBs = getTodayNepali();
    const fyStart = getFYStartYear(todayBs);
    const { months: fyMonthsAll } = getCurrentFYMonths(todayBs);

    // Only take months that have data (not future months)
    const recorded = fyMonthsAll.filter((fm) => {
      if (fm.isFuture) return false;
      const found = revenueByMonth.find((r) => {
        const rYear = r.year ?? fyStart;
        return rYear === fm.bsYear && r.month === fm.month;
      });
      return found != null;
    });

    // Last 5 months max
    const slice = recorded.slice(-5);

    return slice.map((fm, idx) => {
      const found = revenueByMonth.find(
        (r) => (r.year ?? fyStart) === fm.bsYear && r.month === fm.month,
      );
      const earned = found?.total ?? found?.revenue ?? 0;
      // Estimate booked = earned / assumed collection rate (85% baseline)
      // For last/current month use real kpi.totalBilled
      const isCurrentMonth = idx === slice.length - 1;
      const booked = isCurrentMonth
        ? Math.max(kpi.totalBilled ?? 0, earned)
        : earned > 0 ? Math.round(earned / 0.85) : 0;

      return {
        month: NEPALI_MONTH_NAMES[fm.month - 1] ?? `M${fm.month}`,
        booked,
        earned,
        lossPct: booked > 0 ? Math.max(0, Math.round(((booked - earned) / booked) * 100)) : 0,
      };
    });
  }, [revenueByMonth, kpi.totalBilled]);

  // efficiency stat
  const collectionRate = kpi.collectionRate ?? 0;
  const totalBilled = kpi.totalBilled ?? 0;
  const totalReceived = kpi.totalReceived ?? 0;
  const gap = Math.max(0, totalBilled - totalReceived);

  // trend direction
  const effDirection = collectionRate >= 85 ? "up" : collectionRate >= 70 ? "flat" : "down";
  const lastMonth = chartData[chartData.length - 2];
  const thisMonth = chartData[chartData.length - 1];
  const trendLabel =
    thisMonth && lastMonth
      ? thisMonth.earned > lastMonth.earned
        ? "Improving"
        : thisMonth.earned < lastMonth.earned
          ? "Declining"
          : "Stable"
      : "";

  if (loading && !stats) {
    return (
      <div className="panel-loading">
        <div className="h-48 w-full rounded bg-muted animate-pulse"/>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Revenue efficiency · Booked vs Collected
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Expected rent vs. cash received each month
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="be-legend-item">
            <span className="be-legend-sw" style={{ background: "var(--color-accent-mid)" }}/>
            Booked
          </span>
          <span className="be-legend-item">
            <span className="be-legend-sw" style={{ background: "var(--color-accent)" }}/>
            Collected
          </span>
          {trendLabel && (
            <TrendChip
              direction={trendLabel === "Improving" ? "up" : trendLabel === "Declining" ? "down" : "flat"}
              label={trendLabel}
            />
          )}
        </div>
      </div>

      {/* chart */}
      <div className="flex-1 flex gap-4 min-h-0 mt-3">
        <div className="flex-1 min-w-0" style={{ height: 220 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} barCategoryGap="28%" barGap={3}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--color-text-sub)", fontFamily: "var(--font-sans)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatRupeesCompact(v).replace("रू ", "")}
                  tick={{ fontSize: 10, fill: "var(--color-text-sub)", fontFamily: "var(--font-sans)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<BvETooltip/>}/>
                <Bar
                  dataKey="booked"
                  name="Booked"
                  fill="var(--color-accent-mid)"
                  shape={<RoundedBar/>}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="earned"
                  name="Collected"
                  fill="var(--color-accent)"
                  shape={<RoundedBar/>}
                  maxBarSize={28}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--color-text-sub)" }}>
              No data yet for this FY
            </div>
          )}
        </div>

        {/* side stats */}
        <div className="be-side shrink-0">
          <div className="be-stat">
            <div className="be-stat-l">Collection rate</div>
            <div
              className="be-stat-v"
              style={{
                fontFamily: "var(--font-mono)",
                color: collectionRate >= 85 ? "var(--color-success)" : collectionRate >= 70 ? "var(--color-warning)" : "var(--color-danger)",
              }}
            >
              {collectionRate}%
            </div>
          </div>
          <div className="be-stat">
            <div className="be-stat-l">Collected MTD</div>
            <div className="be-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-strong)" }}>
              {formatRupeesCompact(totalReceived)}
            </div>
            <div className="be-stat-d" style={{ color: "var(--color-text-sub)" }}>
              of {formatRupeesCompact(totalBilled)} billed
            </div>
          </div>
          {gap > 0 && (
            <div className="be-stat">
              <div className="be-stat-l">Gap MTD</div>
              <div className="be-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                {formatRupeesCompact(gap)}
              </div>
              <div className="be-stat-d" style={{ color: "var(--color-text-sub)" }}>uncollected</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
