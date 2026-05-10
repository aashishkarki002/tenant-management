import React, { useEffect, useRef, useState } from "react";
import { Home, Layers, Zap, TrendingUp } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

function useAnimatedWidth(target) {
  const [w, setW] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    setW(0);
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => setW(target));
    });
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return w;
}

// ── Animated stacked bar ──────────────────────────────────────────────────────
function CompositionBar({ rentPct, camPct, elecPct }) {
  const rW = useAnimatedWidth(rentPct);
  const cW = useAnimatedWidth(camPct);
  const eW = useAnimatedWidth(elecPct);

  return (
    <div
      className="h-2 rounded-full overflow-hidden flex"
      style={{ background: "var(--color-muted-fill)" }}
    >
      <span
        className="block h-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${rW}%`, background: "var(--color-accent)" }}
      />
      <span
        className="block h-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-75"
        style={{ width: `${cW}%`, background: "var(--color-info, #38bdf8)" }}
      />
      <span
        className="block h-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-150"
        style={{ width: `${eW}%`, background: "var(--color-warning)" }}
      />
    </div>
  );
}

// ── Single revenue stream column ──────────────────────────────────────────────
function StreamColumn({ label, icon: Icon, color, collected, billed, loading }) {
  const outstanding = Math.max(0, billed - collected);
  const pct = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;
  const w = useAnimatedWidth(pct);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-1.5">
        <span
          className="flex items-center justify-center w-5 h-5 rounded-md"
          style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}
        >
          <Icon className="w-3 h-3" style={{ color }} />
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--color-text-sub)" }}
        >
          {label}
        </span>
      </div>

      {loading ? (
        <div className="h-7 w-28 rounded-md bg-[color:var(--color-muted-fill)] animate-pulse" />
      ) : (
        <div
          className="text-[26px] font-bold leading-none font-mono tabular-nums tracking-[-0.02em]"
          style={{ color: "var(--color-text-strong)" }}
        >
          {formatRupeesCompact(collected)}
        </div>
      )}

      {!loading && (
        <>
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "var(--color-muted-fill)" }}>
            <span
              className="block h-full rounded-full transition-[width] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${w}%`, background: color }}
            />
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-sub)" }}>
              {pct}% of {formatRupeesCompact(billed)}
            </span>
            {outstanding > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in oklch, var(--color-warning) 12%, transparent)",
                  color: "var(--color-warning)",
                }}
              >
                {formatRupeesCompact(outstanding)} due
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RevenueSummaryBanner({ stats, loading }) {
  const kpi = stats?.kpi ?? {};

  const rentBilled     = kpi.rentBilled ?? 0;
  const rentCollected  = kpi.rentCollected ?? 0;
  const camBilled      = kpi.camBilled ?? 0;
  const camCollected   = kpi.camCollected ?? 0;

  // Electricity: pull from electricitySummary or collection.electricity
  const elec           = stats?.electricitySummary ?? stats?.collection?.electricity ?? {};
  const elecBilled     = (elec.totalBilledPaisa ?? elec.billed ?? 0) / (elec.totalBilledPaisa != null ? 100 : 1);
  const elecCollected  = (elec.totalCollectedPaisa ?? elec.collected ?? 0) / (elec.totalCollectedPaisa != null ? 100 : 1);

  const totalBilled    = rentBilled + camBilled + elecBilled;
  const totalCollected = rentCollected + camCollected + elecCollected;
  const totalOutstanding = Math.max(0, totalBilled - totalCollected);
  const overallRate    = totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 0;

  // Composition bar percentages (of totalBilled)
  const rentBarPct = totalBilled > 0 ? Math.round((rentCollected / totalBilled) * 100) : 0;
  const camBarPct  = totalBilled > 0 ? Math.round((camCollected  / totalBilled) * 100) : 0;
  const elecBarPct = totalBilled > 0 ? Math.round((elecCollected / totalBilled) * 100) : 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)" }}
    >
      {/* top strip */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-sub)" }}
          >
            Revenue · This Month
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--color-text-sub)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-accent)" }} />
            Rent
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--color-text-sub)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-info, #38bdf8)" }} />
            CAM
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--color-text-sub)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-warning)" }} />
            Electricity
          </span>
        </div>
      </div>

      {/* main content */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-5 sm:gap-6 items-start">
        <StreamColumn
          label="Rent"
          icon={Home}
          color="var(--color-accent)"
          collected={rentCollected}
          billed={rentBilled}
          loading={loading}
        />
        <StreamColumn
          label="CAM"
          icon={Layers}
          color="var(--color-info, #38bdf8)"
          collected={camCollected}
          billed={camBilled}
          loading={loading}
        />
        <StreamColumn
          label="Electricity"
          icon={Zap}
          color="var(--color-warning)"
          collected={elecCollected}
          billed={elecBilled}
          loading={loading}
        />

        {/* divider — visible only on sm+ */}
        <div className="hidden sm:block w-px self-stretch" style={{ background: "var(--color-border)" }} />

        {/* total */}
        <div className="flex flex-col gap-2 min-w-0 sm:pl-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-text-sub)" }}
          >
            = Total Revenue
          </span>
          {loading ? (
            <div className="h-8 w-32 rounded-md bg-[color:var(--color-muted-fill)] animate-pulse" />
          ) : (
            <div
              className="text-[30px] font-bold leading-none font-mono tabular-nums tracking-[-0.02em]"
              style={{
                color: overallRate >= 80 ? "var(--color-success)" : overallRate >= 60 ? "var(--color-warning)" : "var(--color-danger)",
              }}
            >
              {formatRupeesCompact(totalCollected)}
            </div>
          )}
          {!loading && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium" style={{ color: "var(--color-text-sub)" }}>
                {overallRate}% of {formatRupeesCompact(totalBilled)} billed
              </span>
              {totalOutstanding > 0 && (
                <span
                  className="text-[11px] font-semibold w-fit px-2 py-0.5 rounded-full"
                  style={{
                    background: "color-mix(in oklch, var(--color-danger) 10%, transparent)",
                    color: "var(--color-danger)",
                  }}
                >
                  {formatRupeesCompact(totalOutstanding)} outstanding
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* composition bar */}
      <div className="px-5 pb-3.5">
        <CompositionBar
          rentPct={rentBarPct}
          camPct={camBarPct}
          elecPct={elecBarPct}
        />
      </div>
    </div>
  );
}
