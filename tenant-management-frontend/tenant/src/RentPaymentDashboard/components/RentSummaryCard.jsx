// src/pages/rent/components/RentSummaryCard.jsx
//
// Stripe-style KPI strip — four cells in a single row.
// Pure Tailwind + shadcn. No inline styles except the dynamic progress bar width.
import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

// ── KPI Cell ──────────────────────────────────────────────────────────────────
const KpiCell = ({ label, value, sub, valueClass, className }) => (
  <div className={cn("flex flex-col gap-1 px-5 py-5", className)}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </p>
    <p className={cn("text-2xl font-bold tracking-tight tabular-nums", valueClass)}>
      {value}
    </p>
    {sub && (
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    )}
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyKpiStrip = ({ frequencyLabel }) => (
  <div className="rounded-xl border border-border bg-card px-5 py-10 flex flex-col items-center justify-center gap-3 text-center">
    <div className="h-10 w-10 rounded-lg border border-border bg-background flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
        />
      </svg>
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground">
        No {frequencyLabel.toLowerCase()} rents generated yet
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Use "Process Rents" to generate records for this period.
      </p>
    </div>
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const RentSummaryCard = ({
  totalCollected,
  totalDue,
  frequencyView,
  currentMonthName,
  currentYear,
}) => {
  const progressPct = totalDue > 0 ? Math.min((totalCollected / totalDue) * 100, 100) : 0;
  const outstanding = Math.max(0, totalDue - totalCollected);
  const frequencyLabel = frequencyView === "quarterly" ? "Quarterly" : "Monthly";

  const fmt = (n) =>
    `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (totalDue === 0) {
    return <EmptyKpiStrip frequencyLabel={frequencyLabel} />;
  }

  // Colour ramp by collection rate
  const pct = Math.round(progressPct);
  const rateChipCls =
    pct >= 90
      ? "bg-emerald-50 text-emerald-700"
      : pct >= 60
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  const barCls =
    pct >= 90
      ? "bg-emerald-500"
      : pct >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/*
        4-column grid:
          Mobile  → 2 × 2  (first three span one cell each; progress spans full width)
          Desktop → 1 : 1 : 1 : 1.6 (progress column is wider)
      */}
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.7fr] divide-y sm:divide-y-0 sm:divide-x divide-border">

        {/* ── Total Due ─────────────────────────────────── */}
        <KpiCell
          label="Total Due"
          value={fmt(totalDue)}
          sub={`${frequencyLabel} · ${currentMonthName} ${currentYear}`}
          valueClass="text-foreground"
        />

        {/* ── Collected ─────────────────────────────────── */}
        <KpiCell
          label="Collected"
          value={fmt(totalCollected)}
          sub={`${pct}% of total`}
          valueClass="text-emerald-600"
        />

        {/* ── Outstanding ───────────────────────────────── */}
        <KpiCell
          label="Outstanding"
          value={fmt(outstanding)}
          sub={outstanding > 0 ? "Awaiting collection" : "Fully collected"}
          valueClass={outstanding > 0 ? "text-amber-600" : "text-muted-foreground"}
          className="col-span-2 sm:col-span-1 border-t sm:border-t-0 border-border"
        />

        {/* ── Progress ──────────────────────────────────── */}
        <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 border-border px-5 py-5 flex flex-col justify-center gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Collection Rate
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums",
                rateChipCls,
              )}
            >
              <TrendingUp className="h-3 w-3 shrink-0" />
              {pct}%
            </span>
          </div>

          {/* Track — Tailwind bg-border as the empty fill */}
          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
            {/* ONLY dynamic inline style: the runtime percentage width */}
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out",
                barCls,
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {fmt(totalCollected)} collected
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              of {fmt(totalDue)}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};