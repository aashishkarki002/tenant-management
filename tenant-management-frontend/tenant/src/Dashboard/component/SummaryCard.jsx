import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wallet, Building2, AlertCircle, Wrench, ChevronRight, IndianRupee } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function formatAmount(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n.toLocaleString()}`;
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/20 ${className}`} />;
}

export default function SummaryCard({ stats, loading, error, onRetry }) {
  const collection = stats?.collection ?? stats?.thisMonthCollection ?? {};
  const totalCollected = collection?.totalCollected ?? collection?.total ?? null;
  const target = collection?.target ?? null;
  const collectionPct = target && totalCollected != null ? Math.round((Number(totalCollected) / Number(target)) * 100) : 0;
  const rent = collection?.rent ?? {};
  const cam = collection?.cam ?? {};
  const electricity = collection?.electricity ?? {};
  const outstanding = collection?.outstandingBalance ?? collection?.outstanding ?? null;

  const occupancy = stats?.occupancy ?? {};
  const occupancyRate = occupancy?.rate ?? occupancy?.occupancyRate ?? 0;
  const occupied = occupancy?.occupied ?? occupancy?.occupiedUnits ?? 0;
  const totalUnits = occupancy?.totalUnits ?? occupancy?.total ?? 0;
  const vacant = occupancy?.vacant ?? occupancy?.vacantUnits ?? Math.max(0, totalUnits - occupied);

  const attention = stats?.attention ?? {};
  const urgentCount = attention?.urgentCount ?? attention?.urgent ?? 0;
  const overdueCount = attention?.overdueCount ?? attention?.overduePayments ?? 0;
  const overdueAmount = attention?.overdueAmount ?? attention?.overdueTotal ?? 0;
  const maintenanceCount = attention?.maintenanceCount ?? attention?.maintenanceRequests ?? 0;
  const maintenanceDetail = attention?.maintenanceDetail ?? attention?.maintenanceDetail ?? '—';

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4">
        <Card className="md:col-span-3 p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive mb-2">{error}</p>
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4">

        <Card className="rounded-lg shadow-lg w-full bg-orange-800 text-white border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide">
              This Month Collection
            </CardTitle>
            <div className="rounded-md bg-orange-700/80 p-1.5">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-2 w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <>
                <p className="text-3xl font-bold">
                  {totalCollected != null ? `₹${Number(totalCollected).toLocaleString()}` : '—'}
                </p>
                <Progress
                  value={collectionPct}
                  className="h-2 w-full bg-white *:data-[slot=progress-indicator]:bg-white *:data-[slot=progress-indicator]:rounded-r-full"
                />
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-200 shrink-0" />
                    RENT {formatAmount(rent?.collected)} / {formatAmount(rent?.target)}
                    {rent?.target != null && rent?.target !== '' ? ` (${Math.round((Number(rent?.collected ?? 0) / Number(rent?.target)) * 100)}%)` : ''}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-200 shrink-0" />
                    CAM CHARGES {formatAmount(cam?.collected)} / {formatAmount(cam?.target)}
                    {cam?.target != null && cam?.target !== '' ? ` (${Math.round((Number(cam?.collected ?? 0) / Number(cam?.target)) * 100)}%)` : ''}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-200 shrink-0" />
                    ELECTRICITY {formatAmount(electricity?.collected)} / {formatAmount(electricity?.target)}
                    {electricity?.target != null && electricity?.target !== '' ? ` (${Math.round((Number(electricity?.collected ?? 0) / Number(electricity?.target)) * 100)}%)` : ''}
                  </li>
                </ul>
                <p className="flex items-center gap-2 text-sm">
                  <IndianRupee className="w-4 h-4" />
                  {outstanding != null ? `₹${Number(outstanding).toLocaleString()} outstanding balance` : '—'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-lg w-full bg-white text-gray-900 border border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-gray-700">
              Occupancy Rate
            </CardTitle>
            <div className="rounded-md bg-orange-100 p-1.5">
              <Building2 className="w-4 h-4 text-orange-800" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-9 w-20 bg-gray-200" />
                <Skeleton className="h-3 w-24 bg-gray-200" />
                <Skeleton className="h-2 w-full bg-gray-200" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-6 w-16 bg-gray-200" />
                  <Skeleton className="h-9 w-28 bg-gray-200" />
                </div>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-gray-900">{occupancyRate}%</p>
                <p className="text-xs text-gray-600">{occupied} OF {totalUnits} UNITS</p>
                <div className="flex justify-end text-xs text-gray-600">{vacant} VACANT</div>
                <Progress
                  value={occupancyRate}
                  className="h-2 w-full bg-gray-200 *:data-[slot=progress-indicator]:bg-orange-800"
                />
                <div className="flex items-center justify-between pt-1">
                  <Badge className="text-sm text-green-600 bg-green-50 border-green-600">Stable</Badge>
                  <Link to="/units">
                    <Button className="text-sm font-medium text-orange-800 hover:underline bg-white border border-gray-200 hover:bg-orange-50 cursor-pointer">
                      View All Units
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-lg w-full bg-white text-gray-900 border border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold tracking-wide text-gray-700">
              Attention Needed
            </CardTitle>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {urgentCount} Urgent
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full bg-gray-100" />
                <Skeleton className="h-16 w-full bg-gray-100" />
                <Skeleton className="h-4 w-36 bg-gray-100" />
              </div>
            ) : (
              <>
                <Link to="/rent-payment" className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{overdueCount} Overdue Payments</p>
                      <p className="text-xs text-gray-500">{overdueAmount != null && overdueAmount !== '' ? `Totaling ₹${Number(overdueAmount).toLocaleString()}` : '—'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link to="/maintenance" className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-orange-800 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{maintenanceCount} Maintenance Request{maintenanceCount !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-500">{maintenanceDetail}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link to="/maintenance" className="inline-flex items-center text-sm font-medium text-orange-800 hover:underline pt-1">
                  Go to Action Center
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
