import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";
import { getTodayNepali, getFYStartYear } from "@/utils/nepaliDate";
import PeriodFilter from "./component/PeriodFilter";
import RevenueCard from "./component/RevenueCard";
import ArrearsCard from "./component/ArrearsCard";
import NeedsAttentionCard from "./component/NeedsAttentionCard";
import RevenueChart from "./component/RevenueChart";
import PropertyStatusCard from "./component/PropertyStatusCard";
import { useFinancialDashboard } from "./hooks/useFinancialDashboard";

// Inject desktop grid layout once
const GRID_CSS = `
.fin-dash-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: auto;
}
@media (min-width: 768px) {
  .fin-dash-grid {
    grid-template-columns: 1fr 1fr;
  }
  .fin-dash-revenue { grid-column: 1 / 3; }
}
@media (min-width: 1024px) {
  .fin-dash-grid {
    grid-template-columns: 2fr 1fr 1fr;
    grid-template-rows: 1fr 1fr auto;
    height: 100%;
  }
  .fin-dash-revenue   { grid-column: 1; grid-row: 1 / 3; }
  .fin-dash-arrears   { grid-column: 2; grid-row: 1; }
  .fin-dash-attention { grid-column: 3; grid-row: 1; }
  .fin-dash-chart     { grid-column: 2 / 4; grid-row: 2; }
  .fin-dash-property  { grid-column: 1 / 4; grid-row: 3; }
}
`;

function useGridStyle() {
  useEffect(() => {
    if (document.getElementById("fin-dash-style")) return;
    const el = document.createElement("style");
    el.id = "fin-dash-style";
    el.textContent = GRID_CSS;
    document.head.appendChild(el);
  }, []);
}

function getCurrentCalendarQuarter(month) {
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

export default function FinancialDashboard() {
  useGridStyle();

  const todayNp = useMemo(() => getTodayNepali(), []);
  const fyStartYear = useMemo(() => getFYStartYear(todayNp), [todayNp]);

  const [quarter, setQuarter] = useState(() =>
    getCurrentCalendarQuarter(todayNp.month),
  );
  const [fy, setFy] = useState(
    () => `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
  );

  const { data, chartData, loading, error, refetch } = useFinancialDashboard(
    quarter,
    fy,
  );

  useHeaderSlot(
    () => (
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
              className="border-border text-foreground hover:bg-secondary"
            >
              <ReceiptTextIcon className="w-3 h-3" />
              <span className="hidden sm:inline ml-1.5">Record Payment</span>
            </Button>
          </Link>
        </div>
      </div>
    ),
    [],
  );

  // ── Full-page loader ────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <PeriodFilter
          quarter={quarter}
          fy={fy}
          onQuarterChange={setQuarter}
          onFyChange={setFy}
          fyStartYear={fyStartYear}
        />
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* Period filter */}
      <PeriodFilter
        quarter={quarter}
        fy={fy}
        onQuarterChange={setQuarter}
        onFyChange={setFy}
        fyStartYear={fyStartYear}
      />

      {/* Error banner */}
      {error && (
        <div
          className="mx-3 mt-2 flex items-center justify-between gap-3 shrink-0
                      rounded-xl px-4 py-2"
          style={{
            border: "1px solid var(--color-danger-border)",
            background: "var(--color-danger-bg)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
          <button
            onClick={refetch}
            className="text-xs font-semibold px-3 py-1 rounded-lg"
            style={{
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main grid — fills remaining viewport height on desktop */}
      <div
        className="fin-dash-grid flex-1 min-h-0 gap-3 p-3 overflow-y-auto lg:overflow-hidden"
      >
        <div className="fin-dash-revenue">
          <RevenueCard data={data?.revenue} loading={loading} />
        </div>
        <div className="fin-dash-arrears">
          <ArrearsCard data={data?.arrears} loading={loading} />
        </div>
        <div className="fin-dash-attention">
          <NeedsAttentionCard alerts={data?.alerts} loading={loading} />
        </div>
        <div className="fin-dash-chart">
          <RevenueChart data={chartData} loading={loading} quarter={quarter} />
        </div>
        <div className="fin-dash-property">
          <PropertyStatusCard data={data?.property} loading={loading} />
        </div>
      </div>
    </div>
  );
}
