// src/pages/rent/components/RentSummaryCard.jsx
import React from "react";

/**
 * RentSummaryCard — v3 KPI strip
 *
 * Design: single horizontal card with three stat cells (Collected /
 * Outstanding / Total Due) and a progress bar occupying the remaining
 * column — all in one row, no stacking. Matches the V2 design exactly.
 *
 * Props unchanged from v2 — fully backwards compatible.
 */
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

  const fmt = (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const pctColor =
    progressPct >= 100
      ? { bg: "bg-emerald-50", text: "text-emerald-700" }
      : progressPct >= 60
        ? { bg: "bg-amber-50", text: "text-amber-700" }
        : { bg: "bg-red-50", text: "text-red-700" };

  // Empty state — no rents generated yet for this period
  if (totalDue === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 flex flex-col items-center justify-center text-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">
          No {frequencyLabel.toLowerCase()} rents generated yet
        </p>
        <p className="text-xs text-slate-400">
          Run "Process Rents" to generate records for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/*
        Grid: 3 equal stat columns + 1 wider progress column.
        On mobile we collapse to a 2×2 grid and the progress bar sits full-width below.
      */}
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.8fr] divide-y sm:divide-y-0 divide-slate-100 sm:divide-x sm:divide-slate-100">

        {/* Collected */}
        <div className="px-4 sm:px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
            Collected
          </p>
          <p className="text-xl font-semibold text-emerald-700 tabular-nums">
            ₹{fmt(totalCollected)}
          </p>
        </div>

        {/* Outstanding */}
        <div className="px-4 sm:px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
            Outstanding
          </p>
          <p className={`text-xl font-semibold tabular-nums ${outstanding > 0 ? "text-amber-700" : "text-slate-400"}`}>
            ₹{fmt(outstanding)}
          </p>
        </div>

        {/* Total Due */}
        <div className="px-4 sm:px-5 py-4 col-span-2 sm:col-span-1 border-t sm:border-t-0 border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
            Total Due
          </p>
          <p className="text-xl font-semibold text-slate-700 tabular-nums">
            ₹{fmt(totalDue)}
          </p>
        </div>

        {/* Progress — rightmost column, vertically centered */}
        <div className="px-4 sm:px-5 py-4 col-span-2 sm:col-span-1 border-t sm:border-t-0 border-slate-100 flex flex-col justify-center gap-2">
          {/* Label row */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-slate-400">
              {frequencyLabel} · {currentMonthName} {currentYear}
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${pctColor.bg} ${pctColor.text}`}>
              {Math.round(progressPct)}%
            </span>
          </div>

          {/* Track */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Sub-label */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400 tabular-nums">
              ₹{fmt(totalCollected)} collected
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              of ₹{fmt(totalDue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};