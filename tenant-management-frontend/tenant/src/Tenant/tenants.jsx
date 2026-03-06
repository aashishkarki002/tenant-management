import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, Send, ArrowDown,
  Users, CheckCircle2, Clock, X,
  ChevronDown, Filter, Banknote, CalendarClock,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";
import TenantCard from "../components/TenantCard";
import api from "../../plugins/axios";
import { toast } from "sonner";
import { getAllBlocks } from "./addTenant/utils/propertyHelper";
import { useHeaderSlot } from "../context/HeaderSlotContext";

// ─── Filter Registry ───────────────────────────────────────────────────────────
//
// Industry standard: declare all filters here as data.
// Adding a new filter = adding one object. Zero render code changes.
// The same pattern is used by Linear, Notion, and Jira.
//
const FILTER_GROUPS = [
  {
    key: "status",
    label: "Status",
    icon: CheckCircle2,
    options: [
      { value: "active", label: "Active", dot: "bg-green-500" },
      { value: "inactive", label: "Inactive", dot: "bg-gray-400" },
      { value: "vacated", label: "Vacated", dot: "bg-red-400" },
    ],
  },
  {
    key: "frequency",
    label: "Payment",
    icon: Banknote,
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "quarterly", label: "Quarterly" },
    ],
  },
  {
    key: "lease",
    label: "Lease",
    icon: CalendarClock,
    options: [
      { value: "expiring_soon", label: "Expiring in 60d" },
      { value: "expired", label: "Expired" },
    ],
  },
];

// ─── URL param helpers ─────────────────────────────────────────────────────────
//
// Industry standard: ALL filter state lives in URL so users can share
// and refresh without losing context. This is the Next.js / React Router pattern.
//
function parseFiltersFromParams(searchParams) {
  return {
    search: searchParams.get("search") ?? "",
    block: searchParams.get("block") ?? "",
    innerBlock: searchParams.get("innerBlock") ?? "",
    status: searchParams.getAll("status"),      // multi-value
    frequency: searchParams.getAll("frequency"),   // multi-value
    lease: searchParams.getAll("lease"),       // multi-value
  };
}

function buildSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.search) p.set("search", filters.search);
  if (filters.block) p.set("block", filters.block);
  if (filters.innerBlock) p.set("innerBlock", filters.innerBlock);
  filters.status.forEach(v => p.append("status", v));
  filters.frequency.forEach(v => p.append("frequency", v));
  filters.lease.forEach(v => p.append("lease", v));
  return p;
}

function hasActiveFilters(f) {
  return !!(
    f.search || f.block || f.innerBlock ||
    f.status.length || f.frequency.length || f.lease.length
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TenantCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>
      <div className="flex justify-between">
        <div className="h-8 w-20 bg-gray-200 rounded-lg" />
        <div className="h-8 w-16 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, dot, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full
                     bg-[#3D1414]/10 text-[#3D1414] text-xs font-medium border border-[#3D1414]/20">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full hover:bg-[#3D1414]/20 p-0.5 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Inline Filter Group Button ────────────────────────────────────────────────
//
// Each filter group renders as a single compact dropdown in the header.
// Active state is visually indicated via count badge + filled style.
// Pattern: same as Linear's filter bar.
//
function FilterGroupButton({ group, selectedValues, onToggle }) {
  const [open, setOpen] = useState(false);
  const Icon = group.icon;
  const activeCount = selectedValues.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium
                   transition-colors shrink-0
                   ${activeCount > 0
            ? "bg-[#3D1414] text-white border-[#3D1414]"
            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{group.label}</span>
        {activeCount > 0 && (
          <span className="bg-white/30 text-white text-xs rounded-full w-4 h-4
                           flex items-center justify-center font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-11 left-0 z-50 bg-white rounded-xl border border-gray-200
                          shadow-lg p-1 min-w-[168px]">
            {group.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => onToggle(group.key, opt.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                           text-left transition-colors
                           ${selectedValues.includes(opt.value)
                    ? "bg-[#3D1414]/10 text-[#3D1414] font-medium"
                    : "text-gray-700 hover:bg-gray-50"}`}
              >
                {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                {opt.label}
                {selectedValues.includes(opt.value) && (
                  <span className="ml-auto text-[#3D1414] text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Contextual Header Slot ────────────────────────────────────────────────────
//
// ARCHITECTURE CHANGE from original:
//   OLD: TenantHeaderSlot owned filter state and called onFilter callback
//        via useEffect — indirect, hard to trace.
//   NEW: All filter state lives in Tenants (URL-synced). Header slot receives
//        controlled props and fires direct setters. Zero side-channel data flow.
//
// Layout pattern: [Search][FilterGroups] · spacer · divider · [CTAs]
// This prevents overflow on medium viewports regardless of how many filters
// are added — the spacer absorbs the gap, CTAs stay pinned right.
//
function TenantHeaderSlot({
  filters,
  allBlocks,
  onSearchChange,
  onBlockChange,
  onFilterToggle,
  onNavigate,
}) {
  const selectedBlock = allBlocks.find(b => b._id === filters.block) ?? null;
  const selectedInner = selectedBlock?.innerBlocks?.find(
    ib => ib._id === filters.innerBlock
  ) ?? null;

  const blockLabel = selectedBlock
    ? selectedInner
      ? `${selectedBlock.name} · ${selectedInner.name}`
      : selectedBlock.name
    : "All Blocks";

  return (
    <div className="flex items-center gap-2 w-full min-w-0">

      {/* ── Left zone: search ── */}
      <div className="relative w-56 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search tenants…"
          value={filters.search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* ── Block filter (location-based, separate from attribute filters) ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 text-sm shrink-0 max-w-[148px] justify-between gap-1.5"
          >
            <span className="truncate">{blockLabel}</span>
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuItem onClick={() => onBlockChange(null, null)}>
            All Blocks
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {allBlocks.length === 0 ? (
            <DropdownMenuItem disabled>No blocks available</DropdownMenuItem>
          ) : (
            allBlocks.map(block => (
              <DropdownMenuSub key={block._id}>
                <DropdownMenuSubTrigger>{block.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onBlockChange(block, null)}>
                    All {block.name}
                  </DropdownMenuItem>
                  {Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {block.innerBlocks.map(inner => (
                        <DropdownMenuItem
                          key={inner._id}
                          onClick={() => onBlockChange(block, inner)}
                        >
                          {inner.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Attribute filter groups (status / payment / lease) ── */}
      <div className="flex items-center gap-1.5">
        {FILTER_GROUPS.map(group => (
          <FilterGroupButton
            key={group.key}
            group={group}
            selectedValues={filters[group.key] ?? []}
            onToggle={onFilterToggle}
          />
        ))}
      </div>

      {/* ── Spacer — absorbs available width so CTAs stay pinned right ── */}
      <div className="flex-1 min-w-0" />

      {/* ── Divider ── */}
      <div className="w-px h-6 bg-gray-200 shrink-0" />

      {/* ── Right zone: CTAs — always pinned right ── */}
      <Button
        className="h-9 text-sm bg-[#3D1414] hover:bg-[#3D1414]/90 text-white shrink-0"
        onClick={onNavigate.toAdd}
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Tenant
      </Button>
      <Button
        variant="outline"
        className="h-9 text-sm shrink-0 hidden sm:flex"
        onClick={onNavigate.toMessage}
      >
        <Send className="w-3.5 h-3.5 mr-1.5" />
        Message
      </Button>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [totalCount, setTotalCount] = useState(null); // total before filtering
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── All filter state lives in URL — single source of truth ──────────────────
  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams]
  );

  const isInitialMount = useRef(true);

  /* ── Setters — each writes back to URL params ─────────────────────────────── */

  const setFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleMultiFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = next.getAll(key);
      next.delete(key); // clear all values for this key
      if (current.includes(value)) {
        current.filter(v => v !== value).forEach(v => next.append(key, v));
      } else {
        [...current, value].forEach(v => next.append(key, v));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const handleSearchChange = useCallback((value) => {
    setFilter("search", value.trim() || null);
  }, [setFilter]);

  const handleBlockChange = useCallback((block, inner) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (block) {
        next.set("block", block._id);
        if (inner) next.set("innerBlock", inner._id);
        else next.delete("innerBlock");
      } else {
        next.delete("block");
        next.delete("innerBlock");
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  /* ── Data fetching ─────────────────────────────────────────────────────────── */

  const fetchProperties = async () => {
    try {
      const res = await api.get("/api/property/get-property");
      setProperties(res.data.property || []);
    } catch {
      setProperties([]);
    }
  };

  const fetchAllTenants = async () => {
    try {
      const res = await api.get("/api/tenant/get-tenants");
      const list = res.data.tenants || [];
      setTenants(list);
      setTotalCount(list.length);
    } catch {
      toast.error("Failed to load tenants");
      setTenants([]);
    }
  };

  const fetchFilteredTenants = async (currentFilters) => {
    try {
      const params = {};
      if (currentFilters.search) params.search = currentFilters.search;
      if (currentFilters.block) params.block = currentFilters.block;
      if (currentFilters.innerBlock) params.innerBlock = currentFilters.innerBlock;

      // Multi-value params — axios serializes array correctly
      if (currentFilters.status.length) params.status = currentFilters.status;
      if (currentFilters.frequency.length) params.frequency = currentFilters.frequency;
      if (currentFilters.lease.length) params.lease = currentFilters.lease;

      const res = await api.get("/api/tenant/search-tenants", { params });
      setTenants(res.data.tenants || []);
    } catch {
      toast.error("Failed to filter tenants");
      setTenants([]);
    }
  };

  /* ── Effects ───────────────────────────────────────────────────────────────── */

  // Initial load
  useEffect(() => {
    setLoading(true);
    const initialFilters = parseFiltersFromParams(searchParams);
    Promise.all([
      fetchProperties(),
      hasActiveFilters(initialFilters)
        ? fetchFilteredTenants(initialFilters)
        : fetchAllTenants(),
    ]).finally(() => setLoading(false));
  }, []);

  // React to URL param changes (filter changes after mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setLoading(true);
    (hasActiveFilters(filters)
      ? fetchFilteredTenants(filters)
      : fetchAllTenants()
    ).finally(() => setLoading(false));
  }, [searchParams]); // searchParams is the canonical filter state

  /* ── Derived data ──────────────────────────────────────────────────────────── */

  const allBlocks = useMemo(() => getAllBlocks(properties), [properties]);

  // Stats computed from full tenants list (unfiltered ideally from backend)
  const activeTenants = tenants.filter(t => t.status === "active").length;
  const expiringTenants = tenants.filter(t => {
    if (!t.leaseEndDate) return false;
    const diff = (new Date(t.leaseEndDate) - new Date()) / 86400000;
    return diff > 0 && diff <= 60;
  }).length;

  // ── Applied chips for chip bar ─────────────────────────────────────────────
  const appliedChips = useMemo(() => {
    const chips = [];

    // Block/innerBlock
    const block = allBlocks.find(b => b._id === filters.block);
    if (block) {
      const inner = block.innerBlocks?.find(i => i._id === filters.innerBlock);
      chips.push({
        key: "block",
        value: filters.block,
        label: inner ? `${block.name} · ${inner.name}` : block.name,
        onRemove: () => handleBlockChange(null, null),
      });
    }

    // Attribute filters
    FILTER_GROUPS.forEach(group => {
      (filters[group.key] ?? []).forEach(value => {
        const opt = group.options.find(o => o.value === value);
        chips.push({
          key: `${group.key}-${value}`,
          label: opt?.label ?? value,
          dot: opt?.dot,
          onRemove: () => toggleMultiFilter(group.key, value),
        });
      });
    });

    return chips;
  }, [filters, allBlocks]);

  /* ── Navigation callbacks ──────────────────────────────────────────────────── */

  // Stable object — does NOT need useRef since it's memoized once
  const navCallbacks = useMemo(() => ({
    toAdd: () => navigate("/tenant/addTenants"),
    toMessage: () => navigate("/tenant/send-message"),
  }), [navigate]);

  /* ── Inject contextual slot into header ────────────────────────────────────── */

  useHeaderSlot(
    () => (
      <TenantHeaderSlot
        filters={filters}
        allBlocks={allBlocks}
        onSearchChange={handleSearchChange}
        onBlockChange={handleBlockChange}
        onFilterToggle={toggleMultiFilter}
        onNavigate={navCallbacks}
      />
    ),
    [filters, allBlocks] // re-inject when filters or blocks change
  );

  /* ── Render ────────────────────────────────────────────────────────────────── */

  const showingFiltered = hasActiveFilters(filters);

  return (
    <div className="min-h-screen px-4 sm:px-6 font-sans">

      {/* ── Filter chip bar ─────────────────────────────────────────────────────
          Industry pattern: secondary sticky bar below header that shows
          all active filters as dismissible chips. Renders only when needed.
          Matches Linear / Notion / Jira behavior.
      ────────────────────────────────────────────────────────────────────────── */}
      {appliedChips.length > 0 && (
        <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2
                        bg-white/90 backdrop-blur-sm border-b border-gray-100
                        flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Filters:
          </span>
          {appliedChips.map(chip => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              dot={chip.dot}
              onRemove={chip.onRemove}
            />
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="py-6">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage your residents and their details
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Total Tenants"
            value={totalCount ?? tenants.length}
            iconBg="bg-gray-100"
            iconColor="text-gray-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="Active Tenants"
            value={activeTenants}
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
          <StatCard
            icon={Clock}
            label="Lease Expiring Soon"
            value={expiringTenants}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        </div>

        {/* Results count — only shown when filtering */}
        {showingFiltered && !loading && (
          <p className="text-xs text-gray-400 mb-3">
            Showing <span className="font-semibold text-gray-700">{tenants.length}</span>
            {totalCount != null && ` of ${totalCount}`} tenants
          </p>
        )}

        {/* Tenant grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => <TenantCardSkeleton key={i} />)
          ) : tenants.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {showingFiltered ? "No tenants match the current filters" : "No tenants found"}
              </p>
              {showingFiltered && (
                <button
                  onClick={clearAllFilters}
                  className="mt-2 text-xs text-[#3D1414] underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            tenants.map(tenant => (
              <TenantCard
                key={tenant._id}
                tenant={tenant}
                // Renamed: this is a refetch after any mutation, not a delete handler
                onTenantMutated={fetchAllTenants}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}