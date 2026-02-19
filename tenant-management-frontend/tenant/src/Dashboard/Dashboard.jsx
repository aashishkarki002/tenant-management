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
    <>
      <div className="p-4 sm:p-6">
        <p className="text-3xl font-bold text-orange-900">
          {greeting}, <span className="text-orange-800">{user.name}</span>
        </p>
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Here&apos;s what happening in your building today
          </p>
          <div className="flex gap-2">
            <Link to="/rent-payment">
              <Button className="bg-white text-black border border-gray-300 hover:bg-orange-50 cursor-pointer">
                <ReceiptTextIcon className="w-4 h-4" />
                Record Payment
              </Button>
            </Link>
            <Link to="/tenant/addTenants">
              <Button className="bg-orange-900 text-white hover:bg-orange-800 cursor-pointer">
                <PlusIcon className="w-4 h-4 cursor-pointer hover:text-white" />
                Add Tenant
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg border border-destructive/50 bg-destructive/5 flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      )}

      {(stats || !loading) && (
        <>
          <SummaryCard
            stats={stats}
            loading={loading}
            error={error}
            onRetry={refetch}
          />
          <BarDiagram stats={stats} loading={loading} error={error} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecentActivities stats={stats} loading={loading} error={error} />
            <MaintenaceCard stats={stats} loading={loading} error={error} />
          </div>
        </>
      )}
    </>
  );
}
