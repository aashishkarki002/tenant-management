/**
 * MaintenanceHeader Component
 * 
 * Displays the page title, description, and view mode toggle.
 */

import React from 'react';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MaintenanceHeader = ({ viewMode, setViewMode, rightContent }) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-strong sm:text-3xl">Maintenance</h1>
        <p className="mt-1 text-sm text-text-sub">
          Manage repair requests and track maintenance tasks
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-muted-fill bg-muted-fill/50 p-0.5">
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'cards'
                ? 'bg-surface-raised text-text-strong shadow-sm'
                : 'text-text-sub hover:text-text-body'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'table'
                ? 'bg-surface-raised text-text-strong shadow-sm'
                : 'text-text-sub hover:text-text-body'
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
        {rightContent}
      </div>
    </div>
  );
};
