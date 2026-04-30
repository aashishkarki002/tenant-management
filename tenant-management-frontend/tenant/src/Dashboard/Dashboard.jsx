import React, { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, PlusIcon, ReceiptTextIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import KpiStrip from "./component/KpiStrip";
import BarDiagram from "./component/BarDiagram";
import RecentActivities from "./component/RecentActivities";
import NeedsAttentionPanel from "./component/NeedsAttentionPanel";
import BuildingHealthPanel from "./component/BuildingHealthPanel";
import { useTime } from "./hooks/UseTime";
import { useStats } from "./hooks/UseStats";
import { useArrearsData } from "./hooks/useArrearsData";
import { Link } from "react-router-dom";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";
import { getFYLabel, getFYStartYear, getTodayNepali } from "@/utils/nepaliDate";

export default function Dashboard() {
  const { user } = useAuth();
  const { greeting } = useTime();
  const { stats, loading, error, refetch } = useStats();
  const { arrears, loading: arrearsLoading } = useArrearsData();
  const [period, setPeriod] = useState("thisYear");
  const [fyOpen, setFyOpen] = useState(false);

  const FY_LABELS = useMemo(() => {
    const todayBs = getTodayNepali();
    const currentFY = getFYStartYear(todayBs);
    return {
      thisYear: getFYLabel(currentFY),
      lastYear: getFYLabel(currentFY - 1),
    };
  }, []);

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
        <p
          className="text-sm font-medium text-muted-foreground mb-1.5"

        >
          {greeting}, {user?.name}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold leading-none tracking-tight text-foreground">
          Property Overview
        </h1>
      </div>

      {/* FY Picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => setFyOpen((o) => !o)}
          aria-expanded={fyOpen}
          aria-haspopup="listbox"
          className="flex items-center gap-2 rounded-xl border border-border
                     px-3.5 py-2 text-sm font-semibold bg-card text-primary
                     transition-[box-shadow,transform] hover:shadow-sm active:scale-[0.98]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {FY_LABELS[period]}
          <ChevronDown
            className="w-3.5 h-3.5 opacity-40 transition-transform duration-200"
            style={{ transform: fyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
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
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
                            ${period === p
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary"
                  }`}
              >
                <span>{FY_LABELS[p]}</span>
                {period === p && (
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {fyOpen && (
          <div className="fixed inset-0 z-20" aria-hidden="true" onClick={() => setFyOpen(false)} />
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

      {/* ─── Main Grid ───────────────────────────────────────────────────────── */}
      {(stats || !loading) && (
        <div className="px-3 sm:px-4 lg:px-5 pb-6 lg:pb-8">
          <div className="grid gap-3 sm:gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">

            {/* KPI strip */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6">
              <KpiStrip stats={stats} loading={loading} />
            </div>

            {/* Revenue chart — 50% on lg, 67% on xl+ */}
            <div className="
              col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-4
              rounded-2xl border border-border bg-card shadow-sm
              flex flex-col h-[380px] sm:h-[400px] lg:h-[420px]
            ">
              <BarDiagram stats={stats} loading={loading} error={error} period={period} />
            </div>

            {/* Alerts + health sidebar — 50% on lg, 33% on xl+ */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2 flex flex-col gap-3 sm:gap-4 lg:gap-5">

              <div className="flex-shrink-0">
                <BuildingHealthPanel stats={stats} loading={loading} />
              </div>
            </div>

            {/* Recent activity — full width */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6">
              <RecentActivities stats={stats} loading={loading} error={error} />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}