import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  NEPALI_MONTH_NAMES,
  getCurrentFYMonths,
  getFYStartYear,
  getTodayNepali,
} from "@/utils/nepaliDate";

import { formatRupeesCompact } from "@/lib/formatters";

// ─────────────────────────────────────────────────────────────
// Quarter definitions
// Nepali FY starts from Shrawan (month 4)
// ─────────────────────────────────────────────────────────────

const QUARTERS = [
  { key: "all", label: "Full Year" },
  { key: "Q1", label: "Q1 · Shr–Ash", slice: [0, 3] },
  { key: "Q2", label: "Q2 · Kar–Pou", slice: [3, 6] },
  { key: "Q3", label: "Q3 · Mag–Cha", slice: [6, 9] },
  { key: "Q4", label: "Q4 · Bai–Ash", slice: [9, 12] },
];

// ─────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────

const COLORS = {
  booked: {
    rent: "#2563eb",
    cam: "#059669",
    elec: "#d97706",
  },
  collected: {
    rent: "#93c5fd",
    cam: "#6ee7b7",
    elec: "#fcd34d",
  },
};

// ─────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────

function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const values = {};

  payload.forEach((p) => {
    values[p.dataKey] = p.value ?? 0;
  });

  const bookedTotal =
    (values.rentBooked ?? 0) +
    (values.camBooked ?? 0) +
    (values.elecBooked ?? 0);

  const collectedTotal =
    (values.rentCollected ?? 0) +
    (values.camCollected ?? 0) +
    (values.elecCollected ?? 0);

  const collectionRate =
    bookedTotal > 0
      ? Math.round((collectedTotal / bookedTotal) * 100)
      : 0;

  const rateColor =
    collectionRate >= 85
      ? "text-green-500"
      : collectionRate >= 70
      ? "text-yellow-500"
      : "text-red-500";

  const Row = ({ color, label, value }) => (
    <div className="flex items-center gap-2 text-xs">
      <div
        className="h-2 w-2 rounded-sm shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono">
        {formatRupeesCompact(value)}
      </span>
    </div>
  );

  return (
    <div className="min-w-[190px] rounded-lg border bg-background p-3 shadow-xl">
      <div className="mb-3 text-sm font-semibold">{label}</div>

      {/* Booked */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Booked
        </div>

        {values.rentBooked > 0 && (
          <Row
            color={COLORS.booked.rent}
            label="Rent"
            value={values.rentBooked}
          />
        )}

        {values.camBooked > 0 && (
          <Row
            color={COLORS.booked.cam}
            label="CAM"
            value={values.camBooked}
          />
        )}

        {values.elecBooked > 0 && (
          <Row
            color={COLORS.booked.elec}
            label="Electricity"
            value={values.elecBooked}
          />
        )}

        <div className="flex justify-between border-t pt-2 text-xs font-semibold">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono">
            {formatRupeesCompact(bookedTotal)}
          </span>
        </div>
      </div>

      {/* Collected */}
      <div className="mt-4 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Collected
        </div>

        {values.rentCollected > 0 && (
          <Row
            color={COLORS.collected.rent}
            label="Rent"
            value={values.rentCollected}
          />
        )}

        {values.camCollected > 0 && (
          <Row
            color={COLORS.collected.cam}
            label="CAM"
            value={values.camCollected}
          />
        )}

        {values.elecCollected > 0 && (
          <Row
            color={COLORS.collected.elec}
            label="Electricity"
            value={values.elecCollected}
          />
        )}

        <div className="flex justify-between border-t pt-2 text-xs font-semibold">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono">
            {formatRupeesCompact(collectedTotal)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">
          Collection
        </span>

        <span className={cn("text-sm font-bold", rateColor)}>
          {collectionRate}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <div
        className="h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────

function StatCell({ label, value, sub, valueClassName }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>

      <div
        className={cn(
          "font-mono text-xl font-bold tracking-tight",
          valueClassName
        )}
      >
        {value}
      </div>

      {sub && (
        <div className="text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function BookedVsEarnedPanel({
  stats,
  loading,
}) {
  const [quarter, setQuarter] = useState("all");

  const { fyMonthsAll, fyStart, todayMonth } = useMemo(() => {
    const todayBs = getTodayNepali();

    return {
      fyStart: getFYStartYear(todayBs),
      fyMonthsAll: getCurrentFYMonths(todayBs).months,
      todayMonth: todayBs.month,
    };
  }, []);

  const revenueByMonth = stats?.revenueByMonth ?? [];

  // Build FY month slots
  const allFYSlots = useMemo(() => {
    return fyMonthsAll.map((fm) => {
      const found = revenueByMonth.find(
        (r) =>
          (r.year ?? fyStart) === fm.bsYear &&
          r.month === fm.month
      );

      const hasStreams =
        found?.booked != null || found?.collected != null;

      const legacyTotal =
        found?.total ?? found?.revenue ?? 0;

      const legacyCollected =
        found?.revenue ?? found?.total ?? 0;

      return {
        month:
          NEPALI_MONTH_NAMES[fm.month - 1] ??
          `M${fm.month}`,

        bsMonth: fm.month,

        rentBooked: hasStreams
          ? found.booked?.rent ?? 0
          : legacyTotal,

        camBooked: hasStreams
          ? found.booked?.cam ?? 0
          : 0,

        elecBooked: hasStreams
          ? found.booked?.electricity ?? 0
          : 0,

        rentCollected: hasStreams
          ? found.collected?.rent ?? 0
          : legacyCollected,

        camCollected: hasStreams
          ? found.collected?.cam ?? 0
          : 0,

        elecCollected: hasStreams
          ? found.collected?.electricity ?? 0
          : 0,

        isFuture: fm.isFuture,
      };
    });
  }, [fyMonthsAll, revenueByMonth, fyStart]);

  // Quarter filter
  const chartData = useMemo(() => {
    const qDef = QUARTERS.find(
      (q) => q.key === quarter
    );

    const slots = qDef?.slice
      ? allFYSlots.slice(qDef.slice[0], qDef.slice[1])
      : allFYSlots;

    return slots.filter((s) => !s.isFuture);
  }, [quarter, allFYSlots]);

  // Aggregates
  const qStats = useMemo(() => {
    const booked = chartData.reduce(
      (sum, d) =>
        sum +
        d.rentBooked +
        d.camBooked +
        d.elecBooked,
      0
    );

    const collected = chartData.reduce(
      (sum, d) =>
        sum +
        d.rentCollected +
        d.camCollected +
        d.elecCollected,
      0
    );

    const rate =
      booked > 0
        ? Math.round((collected / booked) * 100)
        : 0;

    return { booked, collected, rate };
  }, [chartData]);

  // MTD
  const mtdSlot = allFYSlots.find(
    (s) => s.bsMonth === todayMonth
  );

  const collectedMTD = mtdSlot
    ? mtdSlot.rentCollected +
      mtdSlot.camCollected +
      mtdSlot.elecCollected
    : stats?.kpi?.totalReceived ?? 0;

  const rateColor =
    qStats.rate >= 85
      ? "text-green-500"
      : qStats.rate >= 70
      ? "text-yellow-500"
      : "text-red-500";

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="h-64 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">

          <div>
            <h3 className="text-sm font-semibold">
              Booked vs Collected
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Revenue streams ·{" "}
              {quarter === "all"
                ? "Full FY"
                : quarter}
            </p>
          </div>

          {/* Legends */}
          <div className="flex flex-wrap items-center gap-4">

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Booked
              </span>

              <LegendItem
                color={COLORS.booked.rent}
                label="Rent"
              />

              <LegendItem
                color={COLORS.booked.cam}
                label="CAM"
              />

              <LegendItem
                color={COLORS.booked.elec}
                label="Elec"
              />
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Collected
              </span>

              <LegendItem
                color={COLORS.collected.rent}
                label="Rent"
              />

              <LegendItem
                color={COLORS.collected.cam}
                label="CAM"
              />

              <LegendItem
                color={COLORS.collected.elec}
                label="Elec"
              />
            </div>
          </div>
        </div>

        {/* Quarter Toggle */}
        <div className="mb-4 flex flex-wrap gap-2">
          {QUARTERS.map((q) => (
            <Button
              key={q.key}
              variant={
                quarter === q.key
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => setQuarter(q.key)}
              className="h-8 text-xs"
            >
              {q.label}
            </Button>
          ))}
        </div>

        {/* Chart */}
        <div className="min-h-[220px] flex-1">

          {chartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartData}
                barCategoryGap="28%"
                barGap={2}
              >
                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  width={48}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                  }}
                  tickFormatter={(v) =>
                    formatRupeesCompact(v).replace(
                      "रू ",
                      ""
                    )
                  }
                />

                <Tooltip
                  cursor={{
                    fill: "rgba(0,0,0,0.04)",
                  }}
                  content={<StackedTooltip />}
                />

                {/* Booked */}
                <Bar
                  dataKey="rentBooked"
                  stackId="booked"
                  fill={COLORS.booked.rent}
                  maxBarSize={24}
                />

                <Bar
                  dataKey="camBooked"
                  stackId="booked"
                  fill={COLORS.booked.cam}
                  maxBarSize={24}
                />

                <Bar
                  dataKey="elecBooked"
                  stackId="booked"
                  fill={COLORS.booked.elec}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />

                {/* Collected */}
                <Bar
                  dataKey="rentCollected"
                  stackId="collected"
                  fill={COLORS.collected.rent}
                  maxBarSize={24}
                />

                <Bar
                  dataKey="camCollected"
                  stackId="collected"
                  fill={COLORS.collected.cam}
                  maxBarSize={24}
                />

                <Bar
                  dataKey="elecCollected"
                  stackId="collected"
                  fill={COLORS.collected.elec}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-5 flex flex-wrap items-center gap-6 border-t pt-4">

          <StatCell
            label="Collection Rate"
            value={`${qStats.rate}%`}
            sub={
              quarter === "all"
                ? "Full FY"
                : quarter
            }
            valueClassName={rateColor}
          />

          <div className="h-10 w-px bg-border" />

          <StatCell
            label="Collected MTD"
            value={formatRupeesCompact(collectedMTD)}
            sub="Current month"
          />
        </div>
      </CardContent>
    </Card>
  );
}