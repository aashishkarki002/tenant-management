import React from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ReceiptTextIcon, PlusIcon, Loader2 } from "lucide-react";
import SummaryCard from "./component/SummaryCard";
import BarDiagram from "./component/BarDiagram";
import RecentActivities from "./component/RecentActivities";
import MaintenaceCard from "./component/MaintenaceCard";
import { useTime } from "./hooks/UseTime";
import { useStats } from "./hooks/UseStats";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const { greeting } = useTime();
  const { stats, loading, error, refetch } = useStats();

  return (
    <div className="min-h-screen ">
      {/* ── Header ── */}
      <div className="p-4 sm:p-6">
        <p className="text-2xl sm:text-3xl font-bold text-orange-900 leading-tight">
          {greeting},{" "}
          <span className="text-orange-800">{user.name}</span>
        </p>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-1">
          <p className="text-sm text-gray-500">
            Here&apos;s what&apos;s happening in your building today
          </p>
          {/* Action buttons — stack on mobile, row on sm+ */}
          <div className="flex gap-2 flex-wrap">
            <Link to="/rent-payment" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto bg-white text-black border border-gray-300 hover:bg-orange-50 cursor-pointer text-sm">
                <ReceiptTextIcon className="w-4 h-4 shrink-0" />
                <span>Record Payment</span>
              </Button>
            </Link>
            <Link to="/tenant/addTenants" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto bg-orange-900 text-white hover:bg-orange-800 cursor-pointer text-sm">
                <PlusIcon className="w-4 h-4 shrink-0" />
                <span>Add Tenant</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg border border-destructive/50 bg-destructive/5 flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      )}

      {/* ── Main Content ── */}
      {(stats || !loading) && (
        <div className="space-y-0">
          {/* Summary Cards — 3-col grid, collapses to 1 on mobile */}
          <SummaryCard
            stats={stats}
            loading={loading}
            error={error}
            onRetry={refetch}
          />

          {/* Bar chart — full width */}
          <div className="px-4 pb-4">
            <BarDiagram stats={stats} loading={loading} error={error} />
          </div>

          {/* Bottom row — stacks on mobile, 2-col on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-6">
            <RecentActivities stats={stats} loading={loading} error={error} />
            <MaintenaceCard stats={stats} loading={loading} error={error} />
          </div>
        </div>
      )}
    </div>
  );
}