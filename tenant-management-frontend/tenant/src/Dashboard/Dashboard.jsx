import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, PlusIcon, ReceiptTextIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import KpiStrip from "./component/KpiStrip";
import BarDiagram from "./component/BarDiagram";
import RecentActivities from "./component/RecentActivities";
import BuildingPerformanceGrid from "./component/BuildingPerfomanceGrid";
import { useTime } from "./hooks/UseTime";
import { useStats } from "./hooks/UseStats";
import { Link } from "react-router-dom";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";
import BuildingHealthPanel from "./component/BuildingHealthPanel";
import { getFYLabel, getFYStartYear, getTodayNepali } from "../../utils/nepaliDate";
import AttentionBanner from "./component/AttentionBanner";

// Derive FY labels once — no approximation, uses the real BS calendar
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

  // Header slot — GlobalSearch + action CTAs
  useHeaderSlot(() => (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 max-w-xs">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Link to="/tenant/addTenants">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
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

  return (
    <div className="min-h-screen pb-12 bg-background">

      {/* ── Page Header ── */}
      <div className="px-4  pb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-1
                        text-muted-foreground">
            {greeting}, {user?.name}
          </p>
          <h1 className="text-2xl font-bold leading-none tracking-tight text-foreground">
            Property Overview
          </h1>
        </div>

        {/* FY Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setFyOpen(o => !o)}
            className="flex items-center gap-2 rounded-xl border border-border
                       px-3.5 py-2 text-sm font-semibold
                       bg-card text-primary
                       transition-all hover:shadow-sm active:scale-[0.98]"
          >
            {FY_LABELS[period]}
            <ChevronDown className="w-3.5 h-3.5 opacity-40" />
          </button>

          {fyOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-30 rounded-xl border
                         border-border overflow-hidden shadow-lg bg-card min-w-[164px]"
            >
              {["thisYear", "lastYear"].map(p => (
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

      {/* ── Error banner ── */}
      {error && !loading && (
        <div className="mx-4 mb-4 flex items-center justify-between gap-3
                        rounded-xl border border-destructive/30
                        bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <button
            onClick={refetch}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg
                       border border-destructive text-destructive
                       hover:bg-destructive/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Full-page loader (first load only) ── */}
      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      )}

      {(stats || !loading) && (
        <div className="px-4 space-y-4">

          {/* ── ROW 1: 4 KPI tiles ── above the fold ── */}
          <KpiStrip stats={stats} loading={loading} />
          <AttentionBanner stats={stats} loading={loading} />

          {/* ── ROW 2: Revenue chart + Needs Attention (above fold) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 
          ">
            <div className="lg:col-span-2 h-[320px]">
              <div className="rounded-2xl border border-border overflow-hidden bg-card h-full">
                <BarDiagram stats={stats} loading={loading} error={error} period={period} />
              </div>
            </div>
            <div className="lg:col-span-1">
              <BuildingHealthPanel stats={stats} loading={loading} />
            </div>
          </div>

          {/* ── ROW 3: Activity feed (scrollable, below fold) ── */}
          <RecentActivities stats={stats} loading={loading} error={error} />



        </div>
      )}
    </div>
  );
}