import { useState } from "react";
import { CalendarDays, Filter, ChevronLeft, ChevronRight, Inbox, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import useChecklistHistory from "../hooks/useCheckListHistory";
import CategoryRow from "./CategoryRow";
import { CATEGORY_LABELS } from "../constants/checkListConstants";

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "INCOMPLETE", label: "Incomplete" },
];

const ISSUE_OPTIONS = [
  { value: "true", label: "Has Issues" },
  { value: "false", label: "No Issues" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A single day's card — date header + all its category rows */
function DayGroup({ day, onCardClick }) {
  const categoryKeys = Object.keys(day.categories);

  return (
    <div className="rounded-xl border bg-card/50 overflow-hidden">
      {/* Date header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {day.nepaliDate ?? "—"}
        </span>
        {day.englishDate && (
          <span className="text-xs text-muted-foreground">
            ·&nbsp;
            {new Date(day.englishDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 rounded-full">
          {categoryKeys.length} {categoryKeys.length === 1 ? "category" : "categories"}
        </Badge>
      </div>

      {/* Category rows */}
      <div className="px-4 py-3.5">
        {categoryKeys.map((cat) => (
          <CategoryRow
            key={cat}
            category={cat}
            results={day.categories[cat]}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}

/** Active filter pill */
function FilterPill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-destructive transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Pagination controls */
function Pagination({ pagination, goToPage }) {
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground">
        {total === 0 ? "No results" : `${from}–${to} of ${total} results`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[5ch] text-center">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CheckListHistory
 *
 * Renders paginated checklist history for a property.
 * Makes a SINGLE fetch (no per-category calls) — results are grouped
 * client-side by date then category using useChecklistHistory.
 *
 * Props:
 *   propertyId   string   required
 *   onCardClick  (result) → void   optional — open a detail sheet
 */
function CheckListHistory({ propertyId, onCardClick }) {
  const [showFilters, setShowFilters] = useState(false);

  const {
    groupedDays,
    filters,
    setFilters,
    pagination,
    goToPage,
    isLoading,
    error,
  } = useChecklistHistory(propertyId);

  // ── Filter helpers ────────────────────────────────────────────────────────

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: "" }));
  }

  function clearAllFilters() {
    setFilters({ category: "", blockId: "", status: "", hasIssues: "" });
  }

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "");
  const hasActiveFilters = activeFilters.length > 0;

  // ── Card click ────────────────────────────────────────────────────────────

  function handleCardClick(result) {
    onCardClick?.(result);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Checklist History
        </h2>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5" />
          {hasActiveFilters ? `Filters (${activeFilters.length})` : "Filter"}
        </Button>
      </div>

      {/* ── Filter panel ────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Category
              </label>
              <Select
                value={filters.category || "__ALL__"}
                onValueChange={(v) => setFilter("category", v === "__ALL__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <Select
                value={filters.status || "__ALL__"}
                onValueChange={(v) => setFilter("status", v === "__ALL__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All statuses</SelectItem>
                  {HISTORY_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issues */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Issues
              </label>
              <Select
                value={filters.hasIssues === "" ? "__ALL__" : filters.hasIssues}
                onValueChange={(v) => setFilter("hasIssues", v === "__ALL__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Any</SelectItem>
                  {ISSUE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* ── Active filter pills ──────────────────────────────────────────── */}
      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filters.category && (
            <FilterPill
              label={CATEGORY_LABELS[filters.category] ?? filters.category}
              onRemove={() => clearFilter("category")}
            />
          )}
          {filters.status && (
            <FilterPill
              label={
                HISTORY_STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ??
                filters.status
              }
              onRemove={() => clearFilter("status")}
            />
          )}
          {filters.hasIssues !== "" && (
            <FilterPill
              label={ISSUE_OPTIONS.find((o) => o.value === filters.hasIssues)?.label ?? ""}
              onRemove={() => clearFilter("hasIssues")}
            />
          )}
        </div>
      )}

      {/* ── Content area ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading history…</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      ) : groupedDays.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-30" />
          <p className="text-sm">
            {hasActiveFilters
              ? "No results match the current filters."
              : "No checklist history found."}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedDays.map((day) => (
            <DayGroup
              key={day.nepaliDate ?? day.englishDate}
              day={day}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {!isLoading && pagination.totalPages > 1 && (
        <Pagination pagination={pagination} goToPage={goToPage} />
      )}
    </div>
  );
}

export default CheckListHistory;