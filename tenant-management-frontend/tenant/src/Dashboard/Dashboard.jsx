// src/pages/dashboard/Dashboard.jsx
//
// ─── Bento Grid Responsive Layout Strategy ────────────────────────────────────
//
// DESKTOP (2xl+, 1536px+):
//   6-column asymmetric bento grid with dynamic row heights
//   • KPIs: 4 cards spanning full width (4 × 1-column)
//   • Chart: 4 columns (tall) | Attention: 2 columns (tall, scrollable)
//   • Building Health: 2 columns | Recent Activities: 4 columns
//   • Building Performance: full width grid
//
// LAPTOP (xl+, 1280-1535px):
//   4-column bento grid, more compact
//   • KPIs: 4 cards across (4 × 1-column)
//   • Chart: 3 columns | Attention: 1 column
//   • Building Health: 1 column | Recent Activities: 3 columns
//   • Building Performance: full width
//
// TABLET (md-lg, 768-1279px):
//   2-column responsive grid with natural flow
//   • KPIs: 2 × 2 grid
//   • Attention + Health: side by side (60/40 split)
//   • Chart: full width
//   • Recent Activities: full width
//   • Building Performance: full width
//
// MOBILE (< 768px):
//   Single column stack, priority-based order
//   • KPIs: stacked pairs
//   • Attention Panel (capped height)
//   • Building Health
//   • Chart (optimized aspect ratio)
//   • Recent Activities
//   • Building Performance
//
// Key principles:
//   • Pure CSS Grid with minmax() for fluid responsiveness
//   • No fixed heights except on scrollable containers
//   • Content-aware row sizing with auto-fit
//   • Bento aesthetic: varied card sizes, visual hierarchy
//   • Mobile-first approach with progressive enhancement

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, PlusIcon, ReceiptTextIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import KpiStrip from "./component/KpiStrip";
import BarDiagram from "./component/BarDiagram";
import RecentActivities from "./component/RecentActivities";
import BuildingPerformanceGrid from "./component/BuildingPerfomanceGrid";
import NeedsAttentionPanel from "./component/NeedsAttentionPanel";
import BuildingHealthPanel from "./component/BuildingHealthPanel";
import { useTime } from "./hooks/UseTime";
import { useStats } from "./hooks/UseStats";
import { Link } from "react-router-dom";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";
import { getFYLabel, getFYStartYear, getTodayNepali } from "../../utils/nepaliDate";

const todayBs = getTodayNepali();
const currentFY = getFYStartYear(todayBs);
const FY_LABELS = {
  thisYear: getFYLabel(currentFY),
  lastYear: getFYLabel(currentFY - 1),
};

export default function Dashboard() {
  const { user } = useAuth();
  const { greeting } = useTime();
  const { stats, loading, error, refetch } = useStats();
  const [period, setPeriod] = useState("thisYear");
  const [fyOpen, setFyOpen] = useState(false);

  useHeaderSlot(() => (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 max-w-xs">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Link to="/tenant/addTenants">
          <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
            <PlusIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Add Tenant</span>
          </Button>
        </Link>
        <Link to="/rent-payment">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground hover:bg-secondary hover:text-primary"
          >
            <ReceiptTextIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Record Payment</span>
          </Button>
        </Link>
      </div>
    </div>
  ), []);

  // ── Page header (shared across all breakpoints) ──────────────────────────────
  const PageHeader = (
    <div className="px-4 sm:px-5 pt-4 pb-3 shrink-0 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase
                      text-muted-foreground mb-1">
          {greeting}, {user?.name}
        </p>
        <h1 className="text-2xl font-bold leading-none tracking-tight text-foreground">
          Property Overview
        </h1>
      </div>

      {/* FY Picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => setFyOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-border
                     px-3.5 py-2 text-sm font-semibold bg-card text-primary
                     transition-all hover:shadow-sm active:scale-[0.98]"
        >
          {FY_LABELS[period]}
          <ChevronDown className="w-3.5 h-3.5 opacity-40" />
        </button>

        {fyOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-30 rounded-xl border
                          border-border overflow-hidden shadow-lg bg-card min-w-[164px]">
            {["thisYear", "lastYear"].map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setFyOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5
                            text-sm font-medium transition-colors
                            ${period === p
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary"
                  }`}
              >
                <span>{FY_LABELS[p]}</span>
                {period === p && (
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {fyOpen && (
          <div className="fixed inset-0 z-20" onClick={() => setFyOpen(false)} />
        )}
      </div>
    </div>
  );

  // ── Error banner ─────────────────────────────────────────────────────────────
  const ErrorBanner = error && !loading && (
    <div className="mx-4 sm:mx-5 mb-2 flex items-center justify-between gap-3 shrink-0
                    rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
      <p className="text-sm font-medium text-destructive">{error}</p>
      <button
        onClick={refetch}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border
                   border-destructive text-destructive hover:bg-destructive/10 transition-colors"
      >
        Retry
      </button>
    </div>
  );

  // ── Full-page loader (first load only) ───────────────────────────────────────
  if (loading && !stats) {
    return (
      <div className="flex flex-col bg-background min-h-screen">
        {PageHeader}
        {ErrorBanner}
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen">
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      {PageHeader}
      {ErrorBanner}

      {/* ─── Main Bento Grid Container ───────────────────────────────────────── */}
      {(stats || !loading) && (
        <div className="px-3 sm:px-4 lg:px-5 pb-6 lg:pb-8">

          {/* ═══════════════════════════════════════════════════════════════════
              HYBRID BENTO GRID - Space-Efficient, Context-Aware Layout
              
              Strategy:
              1. Reduced chart height (380px) - see revenue trend at a glance
              2. Right sidebar: Attention + Health stacked vertically (related context)
              3. Smart spacing: No wasted vertical space
              4. Current month clearly visible in chart header
              
              VISUAL BALANCE OPTIMIZATIONS:
              - Chart: Subtle gradient background for visual weight (4 cols = 66%)
              - Sidebar: Increased spacing/padding for better breathing room (2 cols = 33%)
              - KPIs: Micro-interactions (hover lift) for engagement
              - Proportions follow 2:1 ratio (industry standard for dashboard layouts)
              ═══════════════════════════════════════════════════════════════ */}
          <div
            className="
              grid gap-3 sm:gap-4 lg:gap-5
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-4
              xl:grid-cols-6
              2xl:grid-cols-6
            "
            style={{
              gridAutoFlow: 'dense',
              gridTemplateRows: 'auto auto auto auto',
            }}
          >

            {/* ─── Row 1: KPI Cards ────────────────────────────────────────── */}
            <div className="
              col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6 2xl:col-span-6
            ">
              <KpiStrip stats={stats} loading={loading} />
            </div>

            {/* ─── Row 2: Compact Chart + Attention/Health Sidebar ─────────── */}

            {/* Revenue Chart - COMPACT HEIGHT for at-a-glance viewing */}
            <div className="
              col-span-1 sm:col-span-2 
              lg:col-span-3
              xl:col-span-4
              2xl:col-span-4
              rounded-2xl border border-border bg-card
              flex flex-col
              h-[380px] sm:h-[400px] lg:h-[420px]
              shadow-sm
              ring-1 ring-black/[0.02]
            ">
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                <BarDiagram stats={stats} loading={loading} error={error} period={period} />
              </div>
            </div>

            {/* Right Sidebar: Attention + Health STACKED (space-efficient) */}
            <div className="
              col-span-1 sm:col-span-2
              lg:col-span-1
              xl:col-span-2
              2xl:col-span-2
              flex flex-col gap-3 sm:gap-4 lg:gap-5
            ">

              {/* Needs Attention - Compact, auto-sizing */}
              <div className="flex-shrink-0 transition-all duration-200 hover:scale-[1.01]">
                <NeedsAttentionPanel stats={stats} loading={loading} />
              </div>

              {/* Building Health - Right below attention for context */}
              <div className="flex-shrink-0 transition-all duration-200 hover:scale-[1.01]">
                <BuildingHealthPanel stats={stats} loading={loading} />
              </div>

            </div>

            {/* ─── Row 3: Recent Activities (Full Width) ───────────────────── */}
            <div className="
              col-span-1 sm:col-span-2
              lg:col-span-4
              xl:col-span-6
              2xl:col-span-6
              overflow-auto scrollbar-thin
              h-auto
            ">
              <RecentActivities stats={stats} loading={loading} error={error} />
            </div>

            {/* ─── Row 4: Building Performance Grid ────────────────────────── */}
            <div className="
              col-span-1 sm:col-span-2
              lg:col-span-4 
              xl:col-span-6
              2xl:col-span-6
            ">
              <BuildingPerformanceGrid stats={stats} loading={loading} />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}