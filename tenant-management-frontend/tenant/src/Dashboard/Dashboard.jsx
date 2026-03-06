// src/pages/Dashboard.jsx
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
import AttentionRequired from "./component/AttentionRequired";

function getApproxNepaliYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() + 56 : now.getFullYear() + 57;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { greeting } = useTime();
  const { stats, loading, error, refetch } = useStats();
  const [period, setPeriod] = useState("thisYear");
  const [fyOpen, setFyOpen] = useState(false);

  const nepaliYear = getApproxNepaliYear();
  const fyLabels = {
    thisYear: `FY ${nepaliYear}–${String(nepaliYear + 1).slice(-2)}`,
    lastYear: `FY ${nepaliYear - 1}–${String(nepaliYear).slice(-2)}`,
  };

  // Header: GlobalSearch + action CTAs.
  // Factory pattern — no deps since content is static (no page state feeds into it).
  useHeaderSlot(() => (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 max-w-xs"><GlobalSearch /></div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Link to="/tenant/addTenants">
          <Button size="sm" className="hover:opacity-90"
            style={{ background: "#3D1414", color: "#F0DADA" }}>
            <PlusIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Add Tenant</span>
          </Button>
        </Link>
        <Link to="/rent-payment">
          <Button variant="outline" size="sm"
            className="border-[#DDD6D0] text-[#3D1414] hover:bg-[#F8F5F2]">
            <ReceiptTextIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Record Payment</span>
          </Button>
        </Link>
      </div>
    </div>
  ), []);

  return (
    <div className="min-h-screen pb-12" style={{ background: "#F8F5F2" }}>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-1.5"
            style={{ color: "#AFA097" }}>
            {greeting}, {user?.name}
          </p>
          <h1 className="text-2xl font-bold leading-none tracking-tight"
            style={{ color: "#1C1A18" }}>
            Property Overview
          </h1>
        </div>

        {/* ── FY Dropdown ── scopes this page's data ── */}
        <div className="relative shrink-0">
          <button
            onClick={() => setFyOpen(o => !o)}
            className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold
              transition-all hover:shadow-sm active:scale-[0.98]"
            style={{ background: "#FDFCFA", borderColor: "#DDD6D0", color: "#3D1414" }}>
            {fyLabels[period]}
            <ChevronDown className="w-3.5 h-3.5 opacity-40" />
          </button>

          {fyOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 rounded-xl border overflow-hidden shadow-lg"
              style={{ background: "#FDFCFA", borderColor: "#DDD6D0", minWidth: "164px" }}>
              {["thisYear", "lastYear"].map(p => (
                <button key={p}
                  onClick={() => { setPeriod(p); setFyOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    background: period === p ? "#F0DADA" : "transparent",
                    color: period === p ? "#3D1414" : "#625848",
                  }}>
                  <span>{fyLabels[p]}</span>
                  {period === p && (
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Active</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Click-outside backdrop */}
          {fyOpen && (
            <div className="fixed inset-0 z-20" onClick={() => setFyOpen(false)} />
          )}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{ background: "#F5D5D5", borderColor: "rgba(176,32,32,0.3)" }}>
          <p className="text-sm font-medium" style={{ color: "#B02020" }}>{error}</p>
          <button onClick={refetch}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "#B02020", color: "#B02020" }}>Retry</button>
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-24" style={{ color: "#948472" }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      )}

      {(stats || !loading) && (
        <div className="px-4 space-y-4">

          {/* ── ROW 1: KPI strip ─────────────────────────────────────── */}
          <KpiStrip stats={stats} loading={loading} />

          {/* ── ROW 2: Chart (2/3) + Needs Attention (1/3) ──────────── */}
          {/* NeedsAttention replaces both MaintenaceCard and AttentionRequired.
              All risk signals — overdue rent, expiring leases, maintenance,
              generators — are ranked by severity in one panel beside the chart.
              The owner gets their full risk picture without scrolling. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border overflow-hidden h-full"
                style={{ background: "#FDFCFA", borderColor: "#DDD6D0" }}>
                <BarDiagram stats={stats} loading={loading} error={error} period={period} />
              </div>
            </div>
            <div className="lg:col-span-1">
              <AttentionRequired stats={stats} loading={loading} />
            </div>
          </div>

          {/* ── ROW 3: Activity feed ──────────────────────────────────── */}
          <RecentActivities stats={stats} loading={loading} error={error} />


          {/* ── ROW 5: Building performance grid ─────────────────────── */}
          <BuildingPerformanceGrid stats={stats} loading={loading} />

        </div>
      )}
    </div>
  );
}