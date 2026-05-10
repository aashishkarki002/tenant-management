import React, { useMemo, useState } from "react";
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

// ── Quarter definitions (Nepali FY) ───────────────────────────────────────────
// Nepali FY starts Shrawan (BS month 4). getCurrentFYMonths returns all 12 FY
// months in order. Index 0–2 = Q1, 3–5 = Q2, 6–8 = Q3, 9–11 = Q4.
const QUARTERS = [
  { key: "all", label: "Full Year" },
  { key: "Q1",  label: "Q1 · Shr–Ash",  slice: [0, 3]  },
  { key: "Q2",  label: "Q2 · Kar–Pou",  slice: [3, 6]  },
  { key: "Q3",  label: "Q3 · Mag–Cha",  slice: [6, 9]  },
  { key: "Q4",  label: "Q4 · Bai–Ash",  slice: [9, 12] },
];

// ── Custom tooltip ─────────────────────────────────────────────────────────────
const BvETooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--color-surface-invert)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "var(--color-surface-invert-text, #fff)",
        minWidth: 130,
      }}
    >
      <div className="font-semibold mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-none" style={{ background: p.fill ?? p.stroke }} />
          <span style={{ color: "rgba(255,255,255,0.6)" }}>{p.name}</span>
          <span className="ml-auto font-mono">{formatRupeesCompact(p.value)}</span>
        </div>
      ))}
      {payload.length >= 2 && payload[0].value > 0 && (
        <div
          className="mt-1.5 pt-1.5 border-t text-[10px] font-semibold"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
        >
          Gap: {formatRupeesCompact(Math.max(0, payload[0].value - payload[1].value))}
        </div>
      )}
    </div>
  );
};

// ── Trend chip ─────────────────────────────────────────────────────────────────
function TrendChip({ direction, label }) {
  const cfg = {
    up:   { icon: TrendingUp,   style: { color: "var(--color-success)", background: "var(--color-success-bg)" } },
    down: { icon: TrendingDown, style: { color: "var(--color-danger)",  background: "var(--color-danger-bg)"  } },
    flat: { icon: Minus,        style: { color: "var(--color-text-sub)", background: "var(--color-surface)"   } },
  }[direction ?? "flat"];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={cfg.style}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Rounded-top bar shape ──────────────────────────────────────────────────────
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

// ── Quarter toggle pill ────────────────────────────────────────────────────────
function QuarterToggle({ active, quarters, onChange }) {
  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: "var(--color-muted-fill)" }}
    >
      {quarters.map((q) => (
        <button
          key={q.key}
          onClick={() => onChange(q.key)}
          className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 whitespace-nowrap"
          style={
            active === q.key
              ? { background: "var(--color-surface-raised)", color: "var(--color-text-strong)", boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08))" }
              : { color: "var(--color-text-sub)" }
          }
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BookedVsEarnedPanel({ stats, loading }) {
  const kpi            = stats?.kpi ?? {};
  const revenueByMonth = stats?.revenueByMonth ?? [];
  const [quarter, setQuarter] = useState("all");

  // Build full-year chart data
  const { fyMonthsAll, fyStart } = useMemo(() => {
    const todayBs = getTodayNepali();
    const fyStart = getFYStartYear(todayBs);
    const { months: fyMonthsAll } = getCurrentFYMonths(todayBs);
    return { fyMonthsAll, fyStart };
  }, []);

  // All FY months (past + current, not future)
  const recordedMonths = useMemo(
    () => fyMonthsAll.filter((fm) => {
      if (fm.isFuture) return false;
      return revenueByMonth.some(
        (r) => (r.year ?? fyStart) === fm.bsYear && r.month === fm.month,
      );
    }),
    [fyMonthsAll, revenueByMonth, fyStart],
  );

  // All 12 FY month slots (for quarter slicing), filled with zero for missing
  const allFYSlots = useMemo(
    () => fyMonthsAll.map((fm, idx) => {
      const found = revenueByMonth.find(
        (r) => (r.year ?? fyStart) === fm.bsYear && r.month === fm.month,
      );
      const isCurrentMonth = !fm.isFuture && idx === recordedMonths.length - 1;
      const earned = found?.total ?? found?.revenue ?? 0;
      const booked = isCurrentMonth
        ? Math.max(kpi.totalBilled ?? 0, earned)
        : earned > 0 ? Math.round(earned / 0.85) : 0;

      return {
        month: NEPALI_MONTH_NAMES[fm.month - 1] ?? `M${fm.month}`,
        booked,
        earned,
        isFuture: fm.isFuture,
        fyIndex: idx,
      };
    }),
    [fyMonthsAll, revenueByMonth, fyStart, kpi.totalBilled, recordedMonths.length],
  );

  // Filter to selected quarter
  const chartData = useMemo(() => {
    const qDef = QUARTERS.find((q) => q.key === quarter);
    const slots = qDef?.slice
      ? allFYSlots.slice(qDef.slice[0], qDef.slice[1])
      : allFYSlots.filter((s) => !s.isFuture);
    return slots.filter((s) => !s.isFuture);
  }, [quarter, allFYSlots]);

  // Quarter-level aggregate for side stats
  const qTotals = useMemo(() => {
    const earned = chartData.reduce((s, d) => s + d.earned, 0);
    const booked = chartData.reduce((s, d) => s + d.booked, 0);
    return { earned, booked, gap: Math.max(0, booked - earned) };
  }, [chartData]);

  // Current-month stats for side panel
  const collectionRate = kpi.collectionRate ?? 0;
  const totalBilled    = kpi.totalBilled    ?? 0;
  const totalReceived  = kpi.totalReceived  ?? 0;
  const gap            = Math.max(0, totalBilled - totalReceived);

  const effDirection = collectionRate >= 85 ? "up" : collectionRate >= 70 ? "flat" : "down";

  const lastMonth  = chartData[chartData.length - 2];
  const thisMonth  = chartData[chartData.length - 1];
  const trendLabel =
    thisMonth && lastMonth
      ? thisMonth.earned > lastMonth.earned ? "Improving"
      : thisMonth.earned < lastMonth.earned ? "Declining"
      : "Stable"
      : "";

  if (loading && !stats) {
    return (
      <div className="panel-loading">
        <div className="h-48 w-full rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Booked vs Collected
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Expected rent vs cash received · {quarter === "all" ? "Full FY" : quarter}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="be-legend-item">
            <span className="be-legend-sw" style={{ background: "var(--color-accent-mid)" }} />
            Booked
          </span>
          <span className="be-legend-item">
            <span className="be-legend-sw" style={{ background: "var(--color-accent)" }} />
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

      {/* quarter toggle */}
      <div className="mt-2 mb-3">
        <QuarterToggle active={quarter} quarters={QUARTERS} onChange={setQuarter} />
      </div>

      {/* chart + side stats */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0" style={{ height: 200 }}>
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
                <Tooltip content={<BvETooltip />} />
                <Bar dataKey="booked" name="Booked" fill="var(--color-accent-mid)" shape={<RoundedBar />} maxBarSize={28} />
                <Bar dataKey="earned" name="Collected" fill="var(--color-accent)" shape={<RoundedBar />} maxBarSize={28} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--color-text-sub)" }}>
              No data yet for this period
            </div>
          )}
        </div>

        {/* side stats */}
        <div className="be-side shrink-0">
          {quarter === "all" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="be-stat">
                <div className="be-stat-l">{quarter} collected</div>
                <div className="be-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-strong)" }}>
                  {formatRupeesCompact(qTotals.earned)}
                </div>
              </div>
              <div className="be-stat">
                <div className="be-stat-l">{quarter} booked</div>
                <div className="be-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-sub)" }}>
                  {formatRupeesCompact(qTotals.booked)}
                </div>
              </div>
              {qTotals.gap > 0 && (
                <div className="be-stat">
                  <div className="be-stat-l">{quarter} gap</div>
                  <div className="be-stat-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                    {formatRupeesCompact(qTotals.gap)}
                  </div>
                </div>
              )}
              <div className="be-stat">
                <div className="be-stat-l">Efficiency</div>
                <div
                  className="be-stat-v"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: qTotals.booked > 0
                      ? (qTotals.earned / qTotals.booked) >= 0.85 ? "var(--color-success)"
                        : (qTotals.earned / qTotals.booked) >= 0.70 ? "var(--color-warning)"
                        : "var(--color-danger)"
                      : "var(--color-text-sub)",
                  }}
                >
                  {qTotals.booked > 0 ? `${Math.round((qTotals.earned / qTotals.booked) * 100)}%` : "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
