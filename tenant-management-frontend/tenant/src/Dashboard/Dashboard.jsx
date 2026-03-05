// src/pages/Dashboard.jsx
import React, { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ReceiptTextIcon, PlusIcon, Loader2 } from "lucide-react";
import SummaryCard from "./component/SummaryCard";
import BarDiagram from "./component/BarDiagram";
import RecentActivities from "./component/RecentActivities";
import MaintenaceCard from "./component/MaintenaceCard";
import BuildingPerformanceGrid from "./component/BuildingPerfomanceGrid";
import { useTime } from "./hooks/UseTime";
import { useStats } from "./hooks/UseStats";
import { Link } from "react-router-dom";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";

// ─── Dashboard ────────────────────────────────────────────────────────────────
//
// Decision Control Center — layout order reflects decision priority:
//
//   1. KPI Cards (SummaryCard)           ← How is the business doing right now?
//   2. Building Performance Grid         ← Which properties need attention?
//   3. Revenue Trend (BarDiagram)        ← Is the trend improving?
//   4. Activity + Operational Alerts     ← What needs action today?
//
// STATE OWNERSHIP:
//   period (thisYear | lastYear) — owned here, passed to BarDiagram.
//   Multiple chart components will eventually react to the same period.
//   Rule: "lift state to the nearest common ancestor."
//
// INDUSTRY PATTERN: Dashboard components are pure display. They receive
// normalised data via props. All fetching is isolated in useStats().

// Approximate Nepali year (display-only; use bikram-sambat in production)
function getApproxNepaliYear() {
  const now = new Date();
  const adMon = now.getMonth();
  return adMon >= 3 ? now.getFullYear() + 56 : now.getFullYear() + 57;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { greeting } = useTime();
  const { stats, loading, error, refetch } = useStats();

  // ── Period state — shared filter for all chart components ─────────────────
  const [period, setPeriod] = useState('thisYear');

  const nepaliYear = getApproxNepaliYear();
  const fyLabels = {
    thisYear: `FY ${nepaliYear}–${String(nepaliYear + 1).slice(-2)}`,
    lastYear: `FY ${nepaliYear - 1}–${String(nepaliYear).slice(-2)}`,
  };

  // ── Header slot — memoized because it closes over period state ────────────
  const DashboardHeaderSlot = useMemo(() => (
    <div className="flex items-center gap-3 w-full">
      {/* Global search */}
      <div className="flex-1 max-w-xs">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        {/*
          FY Period Toggle — global filter for chart components.
          Lives in the header to signal it affects the entire dashboard view,
          not a single card. Design rule: scope should be clear from placement.
        */}
        <div className="flex rounded-md overflow-hidden border border-zinc-200 shrink-0">
          {(['thisYear', 'lastYear']).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`
                px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors
                ${period === p
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-500 hover:bg-zinc-50'
                }
              `}
            >
              {fyLabels[p]}
            </button>
          ))}
        </div>

        <Link to="/tenant/addTenants">
          <Button size="sm" className="bg-orange-900 text-white hover:bg-orange-800">
            <PlusIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Add Tenant</span>
          </Button>
        </Link>

        <Link to="/rent-payment">
          <Button variant="outline" size="sm" className="bg-white text-zinc-800 border-zinc-300 hover:bg-orange-50">
            <ReceiptTextIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Record Payment</span>
          </Button>
        </Link>
      </div>
    </div>
  ), [period, nepaliYear]);

  useHeaderSlot(DashboardHeaderSlot);

  return (
    <div className="min-h-screen bg-zinc-50/40">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-2 sm:px-6">
        <p className="text-2xl sm:text-3xl font-bold text-[#4B352A] leading-tight">
          {greeting},{' '}
          <span className="text-[#6E5034]">{user.name}</span>
        </p>
        <p className="text-sm text-zinc-500 font-medium mt-1">
          {fyLabels[period]} · Property financial overview
        </p>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="mx-4 sm:mx-6 mt-2 mb-1 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="shrink-0 text-red-700 border-red-300">
            Retry
          </Button>
        </div>
      )}

      {/* ── Full-page loader (first load only) ───────────────────────────── */}
      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-20 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading dashboard…</span>
        </div>
      )}

      {/* ── Dashboard Content ─────────────────────────────────────────────
          Renders as soon as any stats exist, even during a background refetch.
          This prevents a flash of empty state on period toggle or manual refetch.
      */}
      {(stats || !loading) && (
        <div className="space-y-0 pb-8">

          {/*
            SECTION 1: Executive KPI Cards
            Four equal-width cards answer the primary owner questions:
            How much came in? Are buildings full? Any leases at risk? Any overdue?
          */}
          <SummaryCard
            stats={stats}
            loading={loading}
            error={null}         // error banner handled above, avoid double rendering
            onRetry={refetch}
          />

          {/*
            SECTION 2: Building Performance Grid
            Multi-property view. Only renders when stats.buildings is non-empty.
            Pattern: progressive disclosure — single-property owners see nothing here.
          */}


          {/*
            SECTION 3: Revenue Trend Chart
            Receives period as a controlled prop from this parent.
            Chart is a pure display component — no period toggle inside it.
          */}
          <div className="px-4 sm:px-6 pb-4">
            <BarDiagram
              stats={stats}
              loading={loading}
              error={error}
              period={period}
            />
          </div>

          {/*
            SECTION 4: Activity + Operational Alerts (2-col)
            Left: Ledger feed (what happened)
            Right: Operational alerts (what needs action)
            Both answer "what do I do next?" from different angles.
          */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-6 pb-2">
            <RecentActivities stats={stats} loading={loading} error={error} />
            <MaintenaceCard stats={stats} loading={loading} error={error} />
          </div>

        </div>
      )}
    </div>
  );
}