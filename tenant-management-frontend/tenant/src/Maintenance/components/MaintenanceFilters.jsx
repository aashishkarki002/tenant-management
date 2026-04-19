import React, { useMemo } from 'react';
import { Search, SlidersHorizontal, X, Check, ChevronDown, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STATUS_FILTERS, PRIORITY_FILTERS } from '../constants/maintenance.constants';
import { formatStatus } from '../utils/maintenance.utils';
import {
  getNepaliMonthOptions,
  getNepaliYearOptions,
  getCurrentNepaliYear,
  NEPALI_MONTH_NAMES,
} from '../../utils/nepaliDate';

// ─── Static option lists ──────────────────────────────────────────────────────
const MONTH_OPTIONS = getNepaliMonthOptions();
const YEAR_OPTIONS = getNepaliYearOptions(2078, getCurrentNepaliYear());

// ─── Visual metadata per status / priority ────────────────────────────────────
const STATUS_META = {
  All: { label: 'All', dot: null, idle: 'border-muted-fill bg-surface-raised text-text-sub hover:bg-muted-fill', on: 'border-slate-500  bg-slate-600   text-white' },
  OPEN: { label: 'Open', dot: 'bg-slate-400', idle: 'border-slate-200  bg-slate-50    text-slate-600 hover:bg-slate-100', on: 'border-slate-600  bg-slate-700   text-white' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-blue-500', idle: 'border-blue-200   bg-blue-50     text-blue-600  hover:bg-blue-100', on: 'border-blue-600   bg-blue-600    text-white' },
  PENDING_SETTLEMENT: { label: 'Pending', dot: 'bg-violet-500', idle: 'border-violet-200 bg-violet-50   text-violet-600 hover:bg-violet-100', on: 'border-violet-600 bg-violet-600  text-white' },
  COMPLETED: { label: 'Completed', dot: 'bg-emerald-500', idle: 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100', on: 'border-emerald-600 bg-emerald-600 text-white' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-gray-400', idle: 'border-gray-200   bg-gray-100    text-gray-500  hover:bg-gray-200', on: 'border-gray-600   bg-gray-600    text-white' },
};

const PRIORITY_META = {
  All: { label: 'All', dot: null, idle: 'border-muted-fill bg-surface-raised text-text-sub hover:bg-muted-fill', on: 'border-slate-500 bg-slate-600 text-white' },
  Urgent: { label: 'Urgent', dot: 'bg-red-600', idle: 'border-red-200    bg-red-50    text-red-600    hover:bg-red-100', on: 'border-red-600    bg-red-600    text-white' },
  High: { label: 'High', dot: 'bg-orange-500', idle: 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100', on: 'border-orange-600 bg-orange-600 text-white' },
  Medium: { label: 'Medium', dot: 'bg-amber-500', idle: 'border-amber-200  bg-amber-50  text-amber-600  hover:bg-amber-100', on: 'border-amber-600  bg-amber-600  text-white' },
  Low: { label: 'Low', dot: 'bg-gray-400', idle: 'border-gray-200   bg-gray-100  text-gray-500   hover:bg-gray-200', on: 'border-gray-600   bg-gray-600   text-white' },
};

// ─── Small building-block components ─────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-sub select-none">
      {children}
    </p>
  );
}

function FilterPill({ active, dot, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none',
        active ? 'shadow-sm' : '',
        active ? 'scale-[1.02]' : 'hover:scale-[1.02]',
      )}
      style={{ /* kept as tailwind via cn */ }}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot, active && 'brightness-150')} />}
      {active && !dot && <Check className="h-2.5 w-2.5 shrink-0" />}
      {label}
    </button>
  );
}

// Styled native select with chevron overlay
function NativeSelect({ value, onChange, options, placeholder, active }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={cn(
          'w-full appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-sm transition-colors cursor-pointer bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/30',
          active
            ? 'border-primary text-text-strong font-medium'
            : 'border-muted-fill text-text-body',
        )}
      >
        {placeholder && <option value={0}>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-sub" />
    </div>
  );
}

// ─── Active chip shown below the search bar ───────────────────────────────────
function ActiveChip({ label, dot, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-muted-fill bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-text-body">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />}
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-text-sub hover:bg-muted-fill hover:text-text-strong transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const MaintenanceFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  nepaliMonthFilter,
  setNepaliMonthFilter,
  nepaliYearFilter,
  setNepaliYearFilter,
  hasActiveFilters,
  clearFilters,
  filteredCount,
}) => {
  const [open, setOpen] = React.useState(false);

  // Active filter count for badge
  const activeCount = useMemo(() => (
    (statusFilter !== 'All' ? 1 : 0) +
    (priorityFilter !== 'All' ? 1 : 0) +
    (nepaliYearFilter !== 0 ? 1 : 0) +
    (nepaliMonthFilter !== 0 ? 1 : 0)
  ), [statusFilter, priorityFilter, nepaliYearFilter, nepaliMonthFilter]);

  // Active chips data
  const activeChips = useMemo(() => {
    const chips = [];
    if (statusFilter !== 'All') {
      const meta = STATUS_META[statusFilter] ?? { label: formatStatus(statusFilter), dot: 'bg-slate-400' };
      chips.push({ id: 'status', label: meta.label, dot: meta.dot, onRemove: () => setStatusFilter('All') });
    }
    if (priorityFilter !== 'All') {
      const meta = PRIORITY_META[priorityFilter] ?? { label: priorityFilter, dot: 'bg-gray-400' };
      chips.push({ id: 'priority', label: meta.label, dot: meta.dot, onRemove: () => setPriorityFilter('All') });
    }
    if (nepaliYearFilter !== 0) {
      chips.push({ id: 'year', label: `BS ${nepaliYearFilter}`, dot: null, onRemove: () => setNepaliYearFilter(0) });
    }
    if (nepaliMonthFilter !== 0) {
      const name = NEPALI_MONTH_NAMES[nepaliMonthFilter - 1] ?? nepaliMonthFilter;
      chips.push({ id: 'month', label: name, dot: null, onRemove: () => setNepaliMonthFilter(0) });
    }
    return chips;
  }, [statusFilter, priorityFilter, nepaliYearFilter, nepaliMonthFilter, setStatusFilter, setPriorityFilter, setNepaliYearFilter, setNepaliMonthFilter]);

  return (
    <div className="space-y-2">
      {/* ── Row 1: search + filter button ─────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub pointer-events-none" />
          <Input
            placeholder="Search repairs, tenants, or units…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-surface-raised border-muted-fill text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-sub hover:bg-muted-fill hover:text-text-strong transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter popover trigger */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border text-sm font-medium transition-all duration-150 shrink-0',
                activeCount > 0
                  ? 'border-primary bg-primary text-white hover:bg-primary/90'
                  : 'border-muted-fill bg-surface-raised text-text-body hover:bg-muted-fill',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold tabular-nums">
                  {activeCount}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[380px] max-w-[calc(100vw-1.5rem)] p-0 rounded-xl border border-muted-fill bg-background shadow-xl overflow-hidden"
          >
            {/* ── Popover header ────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-muted-fill bg-surface-raised">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-text-sub" />
                <span className="text-sm font-semibold text-text-strong">Filters</span>
                {activeCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                    {activeCount} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded px-2 py-1 text-xs font-medium text-text-sub hover:bg-muted-fill hover:text-text-strong transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-sub hover:bg-muted-fill hover:text-text-strong transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-muted-fill">
              {/* ── Status ──────────────────────────────────────────────── */}
              <div className="px-4 py-3.5">
                <SectionLabel>Status</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FILTERS.map((s) => {
                    const meta = STATUS_META[s] ?? { label: formatStatus(s), dot: 'bg-slate-400', idle: 'border-muted-fill bg-surface-raised text-text-sub', on: 'border-slate-600 bg-slate-600 text-white' };
                    const isActive = statusFilter === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none',
                          isActive ? meta.on : meta.idle,
                          isActive ? 'scale-[1.02] shadow-sm' : 'hover:scale-[1.02]',
                        )}
                      >
                        {meta.dot && (
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} />
                        )}
                        {!meta.dot && isActive && <Check className="h-2.5 w-2.5 shrink-0" />}
                        {s === 'All' ? 'All' : meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Priority ─────────────────────────────────────────────── */}
              <div className="px-4 py-3.5">
                <SectionLabel>Priority</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_FILTERS.map((p) => {
                    const meta = PRIORITY_META[p] ?? { label: p, dot: 'bg-gray-400', idle: 'border-muted-fill bg-surface-raised text-text-sub', on: 'border-gray-600 bg-gray-600 text-white' };
                    const isActive = priorityFilter === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriorityFilter(p)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none',
                          isActive ? meta.on : meta.idle,
                          isActive ? 'scale-[1.02] shadow-sm' : 'hover:scale-[1.02]',
                        )}
                      >
                        {meta.dot && (
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} />
                        )}
                        {!meta.dot && isActive && <Check className="h-2.5 w-2.5 shrink-0" />}
                        {p === 'All' ? 'All' : meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── BS Period ────────────────────────────────────────────── */}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-1.5 mb-3">
                  <CalendarDays className="h-3.5 w-3.5 text-text-sub" />
                  <SectionLabel>BS Period</SectionLabel>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Year */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold text-text-sub uppercase tracking-wider">Year</p>
                    <div className="relative">
                      <select
                        value={nepaliYearFilter}
                        onChange={(e) => setNepaliYearFilter(Number(e.target.value))}
                        className={cn(
                          'w-full appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-sm transition-colors bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/30',
                          nepaliYearFilter !== 0
                            ? 'border-primary text-text-strong font-semibold'
                            : 'border-muted-fill text-text-body',
                        )}
                      >
                        <option value={0}>All years</option>
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y.value} value={y.value}>{y.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-sub" />
                    </div>
                    {nepaliYearFilter !== 0 && (
                      <button
                        type="button"
                        onClick={() => setNepaliYearFilter(0)}
                        className="mt-1 text-[10px] text-text-sub hover:text-text-strong transition-colors"
                      >
                        Clear year
                      </button>
                    )}
                  </div>

                  {/* Month */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold text-text-sub uppercase tracking-wider">Month</p>
                    <div className="relative">
                      <select
                        value={nepaliMonthFilter}
                        onChange={(e) => setNepaliMonthFilter(Number(e.target.value))}
                        className={cn(
                          'w-full appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-sm transition-colors bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/30',
                          nepaliMonthFilter !== 0
                            ? 'border-primary text-text-strong font-semibold'
                            : 'border-muted-fill text-text-body',
                        )}
                      >
                        <option value={0}>All months</option>
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-sub" />
                    </div>
                    {nepaliMonthFilter !== 0 && (
                      <button
                        type="button"
                        onClick={() => setNepaliMonthFilter(0)}
                        className="mt-1 text-[10px] text-text-sub hover:text-text-strong transition-colors"
                      >
                        Clear month
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer: result count ──────────────────────────────────── */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-muted-fill bg-surface-raised">
                <span className="text-xs text-text-sub tabular-nums">
                  <span className="font-semibold text-text-strong">{filteredCount}</span>
                  {' '}result{filteredCount !== 1 ? 's' : ''} match
                </span>
                <button
                  type="button"
                  onClick={() => { clearFilters(); setOpen(false); }}
                  className="text-xs font-medium text-text-sub hover:text-text-strong transition-colors"
                >
                  Reset &amp; close
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Row 2: active filter chips (only when filters are on) ─────── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-sub select-none">Active:</span>
          {activeChips.map((chip) => (
            <ActiveChip
              key={chip.id}
              label={chip.label}
              dot={chip.dot}
              onRemove={chip.onRemove}
            />
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] font-medium text-text-sub hover:text-text-strong transition-colors underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
