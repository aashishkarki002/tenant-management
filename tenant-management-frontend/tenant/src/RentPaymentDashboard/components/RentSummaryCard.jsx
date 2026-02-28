import React from "react";
import { Progress } from "@/components/ui/progress";

/**
 * RentSummaryCard
 *
 * Redesign decisions (as design lead):
 *
 * 1. THREE STAT TILES — collected / outstanding / total — give instant
 *    financial orientation. The previous design only showed a single
 *    "X / Y" line, forcing users to mentally subtract. Outstanding is
 *    now explicit and coloured amber when non-zero.
 *
 * 2. PROGRESS BAR coloured green (emerald) to feel positive — "how much
 *    we've collected" not "how much is missing". The shadcn default maps
 *    to primary (blue) which feels neutral/informational, not financial.
 *
 * 3. HEADING CONSOLIDATION — removed the redundant double-label ("Track
 *    monthly rent collection" + "Monthly Collection"). One heading,
 *    one progress bar.
 *
 * 4. PERIOD LABEL comes from the parent (frequencyView) and the active
 *    period context is shown in RentFilter's badge, not repeated here.
 *    This card focuses purely on the collection numbers.
 *
 * 5. EMPTY STATE has a more informative message ("No rents generated yet
 *    for this period") rather than the generic "No rents".
 */
export const RentSummaryCard = ({
  totalCollected,
  totalDue,
  frequencyView, // "monthly" | "quarterly"
  currentMonthName, // e.g. "Falgun" — passed from parent for display
  currentYear,      // e.g. 2081
}) => {
  const progressPct =
    totalDue > 0 ? Math.min((totalCollected / totalDue) * 100, 100) : 0;
  const outstanding = Math.max(0, totalDue - totalCollected);
  const frequencyLabel = frequencyView === "quarterly" ? "Quarterly" : "Monthly";

  const fmt = (n) =>
    n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="mx-4 sm:mx-6 my-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {frequencyLabel} Collection
          </p>
          {currentMonthName && currentYear && (
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              {currentMonthName} {currentYear}
            </p>
          )}
        </div>
        {totalDue > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${progressPct >= 100
                ? "bg-emerald-100 text-emerald-700"
                : progressPct >= 60
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}
          >
            {Math.round(progressPct)}% collected
          </span>
        )}
      </div>

      {totalDue > 0 ? (
        <>
          {/* ── Stat tiles ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">
                Collected
              </p>
              <p className="text-sm sm:text-base font-bold text-emerald-700 tabular-nums">
                ₹{fmt(totalCollected)}
              </p>
            </div>
            <div
              className={`rounded-lg border p-3 ${outstanding > 0
                  ? "bg-amber-50 border-amber-100"
                  : "bg-slate-50 border-slate-100"
                }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${outstanding > 0 ? "text-amber-600" : "text-slate-400"
                  }`}
              >
                Outstanding
              </p>
              <p
                className={`text-sm sm:text-base font-bold tabular-nums ${outstanding > 0 ? "text-amber-700" : "text-slate-400"
                  }`}
              >
                ₹{fmt(outstanding)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Total Due
              </p>
              <p className="text-sm sm:text-base font-bold text-slate-700 tabular-nums">
                ₹{fmt(totalDue)}
              </p>
            </div>
          </div>

          {/* ── Progress bar ─────────────────────────────────────────────── */}
          {/* Emerald track = positive / collected framing */}
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-right tabular-nums">
              {Math.round(progressPct)}% of ₹{fmt(totalDue)} collected
            </p>
          </div>
        </>
      ) : (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-slate-400"
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
          <p className="text-sm font-medium text-slate-600">
            No {frequencyLabel.toLowerCase()} rents generated yet
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Run "Process Monthly Rents" to generate records for this period.
          </p>
        </div>
      )}
    </div>
  );
};