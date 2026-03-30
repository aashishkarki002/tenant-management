/**
 * MaintenanceStats Component
 *
 * Now includes Pending Settlement KPI card.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export const MaintenanceStats = ({ stats }) => {
  const statItems = [
    {
      label: 'Open',
      value: stats.open,
      bg: 'bg-muted-fill',
      border: 'border-muted-fill',
      numColor: 'text-text-strong',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      bg: 'bg-muted-fill',
      border: 'border-muted-fill',
      numColor: 'text-text-strong',
    },
    {
      label: 'Pending Settlement',
      value: stats.pendingSettlement,
      bg: stats.pendingSettlement > 0 ? 'bg-violet-50' : 'bg-muted-fill',
      border: stats.pendingSettlement > 0 ? 'border-violet-200' : 'border-muted-fill',
      numColor: stats.pendingSettlement > 0 ? 'text-violet-700' : 'text-text-sub',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-muted-fill',
      border: stats.overdue > 0 ? 'border-red-200' : 'border-muted-fill',
      numColor: stats.overdue > 0 ? 'text-red-700' : 'text-text-sub',
    },
    {
      label: 'Completed This Week',
      value: stats.completedThisWeek,
      bg: 'bg-muted-fill',
      border: 'border-muted-fill',
      numColor: 'text-text-strong',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {statItems.map(({ label, value, bg, border, numColor }) => (
        <div key={label} className={cn('rounded-xl border p-5 shadow-sm', bg, border)}>
          <p className={cn('text-3xl font-bold tabular-nums', numColor)}>{value}</p>
          <p className="mt-1 text-xs font-medium text-text-sub">{label}</p>
        </div>
      ))}
    </div>
  );
};