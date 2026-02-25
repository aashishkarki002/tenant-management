import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, History, AlertCircle, CalendarX2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MaintenanceCard({ stats, loading, error }) {
  const openRequests = stats?.openRequests ?? stats?.maintenance?.openRequests ?? stats?.attention?.maintenanceCount ?? null;
  const activeTenants = stats?.activeTenants ?? stats?.maintenance?.activeTenants ?? stats?.occupancy?.occupied ?? stats?.occupancy?.occupiedUnits ?? null;

  const hasOpenRequests = openRequests != null && Number(openRequests) > 0;

  const contractsEndingSoon = stats?.contractsEndingSoon ?? [];

  return (
    <Card className="rounded-xl shadow-md w-full bg-white border border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">
          Maintenance & Leases
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Open Requests — visually loud when non-zero */}
          <div className={`rounded-lg p-4 transition-all ${hasOpenRequests
            ? 'bg-orange-800 text-white shadow-sm shadow-orange-200'
            : 'border-2 border-gray-200 bg-gray-50'
            }`}>
            {loading ? (
              <>
                <div className={`h-9 w-12 rounded animate-pulse ${hasOpenRequests ? 'bg-orange-700' : 'bg-gray-200'}`} />
                <div className={`h-3.5 w-24 mt-2 rounded animate-pulse ${hasOpenRequests ? 'bg-orange-700' : 'bg-gray-200'}`} />
                <div className={`h-3 w-20 mt-1 rounded animate-pulse ${hasOpenRequests ? 'bg-orange-700' : 'bg-gray-100'}`} />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <p className={`text-3xl font-bold ${hasOpenRequests ? 'text-white' : 'text-gray-900'}`}>
                    {openRequests ?? '—'}
                  </p>
                  {hasOpenRequests && (
                    <AlertCircle className="w-4 h-4 text-orange-300 mt-1" />
                  )}
                </div>
                <p className={`text-sm font-medium mt-1 ${hasOpenRequests ? 'text-orange-100' : 'text-gray-700'}`}>
                  Open Requests
                </p>
                <p className={`text-xs font-semibold uppercase tracking-wide mt-0.5 ${hasOpenRequests ? 'text-orange-300' : 'text-gray-400'
                  }`}>
                  {hasOpenRequests ? 'Action Required' : 'All clear'}
                </p>
              </>
            )}
          </div>

          {/* Active Tenants */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {loading ? (
              <>
                <div className="h-9 w-12 rounded animate-pulse bg-gray-200" />
                <div className="h-3.5 w-24 mt-2 rounded animate-pulse bg-gray-100" />
                <div className="h-3 w-20 mt-1 rounded animate-pulse bg-gray-100" />
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-gray-900">{activeTenants ?? '—'}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">Active Tenants</p>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-0.5">
                  Current Cycle
                </p>
              </>
            )}
          </div>
        </div>

        {/* Contracts Ending Soon */}
        {!loading && contractsEndingSoon.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Leases Ending Soon
            </p>
            <ul className="space-y-2">
              {contractsEndingSoon.map((c, i) => (
                <li key={c._id ?? i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 bg-gray-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarX2 className={`w-3.5 h-3.5 shrink-0 ${c.daysUntilEnd <= 7 ? 'text-red-500' : c.daysUntilEnd <= 14 ? 'text-amber-500' : 'text-gray-400'
                      }`} />
                    <span className="text-sm text-gray-700 truncate font-medium">{c.name}</span>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ml-2 px-2 py-0.5 rounded-full ${c.daysUntilEnd <= 7
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : c.daysUntilEnd <= 14
                        ? 'bg-amber-50 text-amber-600 border border-amber-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                    {c.daysUntilEnd}d left
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Loading skeleton for contracts */}
        {loading && (
          <div className="space-y-2">
            <div className="h-3 w-32 rounded animate-pulse bg-gray-200" />
            <div className="h-10 w-full rounded animate-pulse bg-gray-100" />
            <div className="h-10 w-full rounded animate-pulse bg-gray-100" />
          </div>
        )}

        {/* Quick Shortcuts */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Quick Shortcuts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/maintenance"
              className="flex flex-col sm:flex-row items-center sm:items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-orange-50 hover:border-orange-200 transition-colors group"
            >
              <div className="rounded-md bg-orange-100 p-2 group-hover:bg-orange-200 transition-colors">
                <FileText className="w-4 h-4 text-orange-800" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-800 text-center sm:text-left">New Ticket</span>
            </Link>
            <Link
              to="/maintenance"
              className="flex flex-col sm:flex-row items-center sm:items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-orange-50 hover:border-orange-200 transition-colors group"
            >
              <div className="rounded-md bg-orange-100 p-2 group-hover:bg-orange-200 transition-colors">
                <History className="w-4 h-4 text-orange-800" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-800 text-center sm:text-left">Log Book</span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}