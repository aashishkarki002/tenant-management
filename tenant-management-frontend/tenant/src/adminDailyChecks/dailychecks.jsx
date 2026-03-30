import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import useChecklistHistory from "./hooks/useCheckListHistory";
import DayGroup from "./components/DayGroup";
import ChecklistPagination from "./components/CheckListPagination";
import ChecklistHistorySkeleton from "./components/CheckListHistorySkeleton";
import ChecklistHistoryEmpty from "./components/CheckListHistoryEmpty";
import { CATEGORY_LABELS } from "./constants/checkListConstants";

const OWNERSHIP_ENTITY_ID = "6970f5a7464f3514eb16051c";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "INCOMPLETE", label: "Incomplete" },
];

// ─── Active filter pill ───────────────────────────────────────────────────────
function FilterPill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/8 text-primary rounded-full px-2.5 py-1 ring-1 ring-inset ring-primary/20">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-destructive transition-colors ml-0.5"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-4">
      {[
        { color: "bg-emerald-400", label: "Passed" },
        { color: "bg-rose-400", label: "Failed" },
        { color: "bg-zinc-200", label: "Pending" },
      ].map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Inline filter bar ────────────────────────────────────────────────────────
function FilterBar({ filters, setFilters, blocks, isLoading }) {
  function set(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val === "__ALL__" ? "" : val }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category */}
      <Select
        value={filters.category || "__ALL__"}
        onValueChange={(v) => set("category", v)}
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__ALL__">All categories</SelectItem>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Block */}
      {blocks.length > 0 && (
        <Select
          value={filters.blockId || "__ALL__"}
          onValueChange={(v) => set("blockId", v)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All blocks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All blocks</SelectItem>
            {blocks.map((b) => (
              <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status */}
      <Select
        value={filters.status || "__ALL__"}
        onValueChange={(v) => set("status", v)}
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__ALL__">All statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Issues */}
      <Select
        value={filters.hasIssues === "" ? "__ALL__" : String(filters.hasIssues)}
        onValueChange={(v) => set("hasIssues", v === "__ALL__" ? "" : v)}
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Any result" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__ALL__">Any result</SelectItem>
          <SelectItem value="true">Has issues</SelectItem>
          <SelectItem value="false">No issues</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * ChecklistHistory — redesigned page
 *
 * Props:
 *   propertyId  string
 *   blocks      [{ _id, name }]
 */
function ChecklistHistory({ propertyId, blocks = [] }) {
  const navigate = useNavigate();
  const effectivePropertyId = propertyId ?? OWNERSHIP_ENTITY_ID;

  const {
    groupedDays,
    filters,
    setFilters,
    pagination,
    goToPage,
    isLoading,
    error,
    refetch,
  } = useChecklistHistory(effectivePropertyId);

  const activeFilterEntries = Object.entries(filters).filter(([, v]) => v !== "");
  const hasActiveFilters = activeFilterEntries.length > 0;

  const handleCardClick = useCallback(
    (result) => {
      navigate(`/admin-daily-checks/check-result-details/${result._id}`);
    },
    [navigate],
  );

  const clearAll = useCallback(
    () => setFilters({ category: "", blockId: "", status: "", hasIssues: "" }),
    [setFilters],
  );

  function clearFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: "" }));
  }

  // Labels for active filter pills
  const FILTER_LABEL_MAP = {
    category: (v) => CATEGORY_LABELS[v] ?? v,
    blockId: (v) => blocks.find((b) => b._id === v)?.name ?? v,
    status: (v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v,
    hasIssues: (v) => (v === "true" ? "Has Issues" : "No Issues"),
  };

  return (
    <div className="space-y-5 p-6">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: title + filter toggle icon */}
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Inspection History
          </h2>
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>

        {/* Right: refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Filter bar + legend row ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          blocks={blocks}
          isLoading={isLoading}
        />
        <Legend />
      </div>

      {/* ── Active filter pills (when filters are set) ───────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilterEntries.map(([key, val]) => (
            <FilterPill
              key={key}
              label={FILTER_LABEL_MAP[key]?.(String(val)) ?? String(val)}
              onRemove={() => clearFilter(key)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="h-px bg-border/50" />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ChecklistHistorySkeleton rows={3} />
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 text-center space-y-2">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button
            variant="link"
            size="sm"
            onClick={refetch}
            className="h-auto p-0 text-xs text-destructive underline"
          >
            Try again
          </Button>
        </div>
      ) : groupedDays.length === 0 ? (
        <ChecklistHistoryEmpty
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearAll}
        />
      ) : (
        <>
          <div>
            {groupedDays.map((day, idx) => (
              <DayGroup
                key={day.nepaliDate ?? idx}
                dayData={day}
                prevDayData={idx > 0 ? groupedDays[idx - 1] : null}
                onCardClick={handleCardClick}
              />
            ))}
          </div>

          <ChecklistPagination
            pagination={pagination}
            goToPage={goToPage}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}

export default ChecklistHistory;