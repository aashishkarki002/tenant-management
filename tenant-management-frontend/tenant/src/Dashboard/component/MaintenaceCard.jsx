import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, History } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MaintenaceCard({ stats, loading, error }) {
  const openRequests = stats?.openRequests ?? stats?.maintenance?.openRequests ?? stats?.attention?.maintenanceCount ?? null;
  const activeTenants = stats?.activeTenants ?? stats?.maintenance?.activeTenants ?? stats?.occupancy?.occupied ?? stats?.occupancy?.occupiedUnits ?? null;

  return (
    <Card className="rounded-lg shadow-lg w-full bg-white border border-gray-100 mt-6 mx-4">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Maintenance Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border-2 border-orange-500 bg-orange-50 p-4">
            {loading ? (
              <>
                <div className="h-9 w-12 rounded animate-pulse bg-orange-200" />
                <div className="h-4 w-24 mt-2 rounded animate-pulse bg-orange-100" />
                <div className="h-3 w-20 mt-1 rounded animate-pulse bg-orange-100" />
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-orange-600">{openRequests ?? '—'}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Open Requests</p>
                <p className="text-xs text-orange-600 font-medium uppercase tracking-wide mt-0.5">
                  Action Required
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {loading ? (
              <>
                <div className="h-9 w-12 rounded animate-pulse bg-gray-200" />
                <div className="h-4 w-24 mt-2 rounded animate-pulse bg-gray-100" />
                <div className="h-3 w-20 mt-1 rounded animate-pulse bg-gray-100" />
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-gray-900">{activeTenants ?? '—'}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Active Tenants</p>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-0.5">
                  Current Cycle
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Shortcuts */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quick Shortcuts
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <Link
              to="/maintenance"
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 hover:border-orange-200 transition-colors"
            >
              <div className="rounded-md bg-orange-100 p-2">
                <FileText className="w-5 h-5 text-orange-800" />
              </div>
              <span className="text-sm font-medium text-gray-900">New Ticket</span>
            </Link>
            <Link
              to="/maintenance"
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 hover:border-orange-200 transition-colors"
            >
              <div className="rounded-md bg-orange-100 p-2 ">
                <History className="w-5 h-5 text-orange-800" />
              </div>
              <span className="text-sm font-medium text-gray-900">Log Book</span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
