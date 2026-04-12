
import React, { useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { STATUS_FILTERS, PRIORITY_FILTERS } from '../constants/maintenance.constants';
import { formatStatus } from '../utils/maintenance.utils';

export const MaintenanceFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  hasActiveFilters,
  clearFilters,
  filteredCount,
}) => {
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const filterPopoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setFilterPopoverOpen(false);
      }
    };
    if (filterPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterPopoverOpen]);

  const handleClearFilters = () => {
    clearFilters();
    setFilterPopoverOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub pointer-events-none" />
        <Input
          placeholder="Search repairs, tenants, or units..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-surface-raised border-muted-fill h-10"
        />
      </div>

      {/* Filter Button + Popover */}
      <div className="relative" ref={filterPopoverRef}>
        <button
          type="button"
          onClick={() => setFilterPopoverOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium transition-colors',
            hasActiveFilters
              ? 'border-white text-white bg-primary/10 hover:bg-primary/20'
              : 'border-muted-fill bg-surface-raised text-text-body hover:bg-muted-fill'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-primary">
              {(statusFilter !== 'All' ? 1 : 0) + (priorityFilter !== 'All' ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Popover */}
        {filterPopoverOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-muted-fill bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-muted-fill sticky top-0 bg-surface-raised z-10">
              <span className="text-sm font-semibold text-text-strong">Filters</span>
              <button
                type="button"
                onClick={() => setFilterPopoverOpen(false)}
                className="rounded-full p-1 text-text-sub hover:bg-muted-fill transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Filters Grid: Mobile vertical, Desktop 2-column */}
            <div className="flex flex-col md:flex-row gap-4 px-4 py-3">
              {/* Status Filter */}
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-sub">
                  Status
                </p>
                <div className="flex flex-col gap-1">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-left transition-all duration-150 transform hover:scale-105',
                        statusFilter === s
                          ? 'bg-muted-fill text-text-strong font-medium'
                          : 'text-text-body hover:bg-muted-fill/60'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors duration-150',
                          statusFilter === s
                            ? 'bg-primary'
                            : 'border border-muted-fill bg-surface-raised'
                        )}
                      >
                        {statusFilter === s && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      {s === 'All' ? 'All statuses' : formatStatus(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-sub">
                  Priority
                </p>
                <div className="flex flex-col gap-1">
                  {PRIORITY_FILTERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorityFilter(p)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-left transition-all duration-150 transform hover:scale-105',
                        priorityFilter === p
                          ? 'bg-muted-fill text-text-strong font-medium'
                          : 'text-text-body hover:bg-muted-fill/60'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors duration-150',
                          priorityFilter === p
                            ? 'bg-primary'
                            : 'border border-muted-fill bg-surface-raised'
                        )}
                      >
                        {priorityFilter === p && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      {p === 'All' ? 'All priorities' : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear Filters Footer */}
            {hasActiveFilters && (
              <>
                <div className="mx-4 border-t border-muted-fill" />
                <div className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="w-full rounded-lg py-1.5 text-xs font-medium text-text-sub hover:bg-muted-fill transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Result Count */}
      {hasActiveFilters && (
        <span className="shrink-0 text-xs text-text-sub">
          {filteredCount} result{filteredCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};
