import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, ArrowDown,
  Users, CheckCircle2, X,
  ChevronDown, Filter, Banknote, CalendarClock,
  LayoutGrid, List, AlertTriangle, DollarSign,
  MoreVertical, Eye, CreditCard, Bell, Pencil, XCircle,
  Phone, Mail, Upload,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import TenantCard, {
  getPaymentStatus, needsAttention, PAYMENT_BADGE,
  getAvatarColor, getTenantLocationLabel, getTenantRentDisplay,
} from "../components/TenantCard";
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
    key: "paymentStatus",
    label: "Payment",
    icon: DollarSign,
    options: [
      { value: "paid", label: "Paid", dot: "bg-green-500" },
      { value: "due_soon", label: "Due Soon", dot: "bg-amber-400" },
      { value: "overdue", label: "Overdue", dot: "bg-red-500" },
    ],
  },
  {
    key: "frequency",
    label: "Billing",
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
      { value: "expiring_soon", label: "Expiring Soon" },
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
    status: searchParams.getAll("status"),
    paymentStatus: searchParams.getAll("paymentStatus"),
    frequency: searchParams.getAll("frequency"),
    lease: searchParams.getAll("lease"),
  };
}

function buildSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.search) p.set("search", filters.search);
  if (filters.block) p.set("block", filters.block);
  if (filters.innerBlock) p.set("innerBlock", filters.innerBlock);
  filters.status.forEach(v => p.append("status", v));
  filters.paymentStatus.forEach(v => p.append("paymentStatus", v));
  filters.frequency.forEach(v => p.append("frequency", v));
  filters.lease.forEach(v => p.append("lease", v));
  return p;
}

function hasActiveFilters(f) {
  return !!(
    f.search || f.block || f.innerBlock ||
    f.status.length || f.paymentStatus.length || f.frequency.length || f.lease.length
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, description, iconBg, iconColor, highlight }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3
                     ${highlight ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {description && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TenantCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-2.5 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-5 w-14 bg-gray-200 rounded-full" />
      </div>
      <div className="h-2.5 bg-gray-200 rounded w-3/4" />
      <div className="border-t border-gray-100 pt-2 flex gap-1.5">
        <div className="h-7 bg-gray-200 rounded-lg flex-1" />
        <div className="h-7 bg-gray-200 rounded-lg flex-1" />
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
    /**
     * Responsive layout
     * ─────────────────
     * Mobile (<sm) — 2 rows:
     *   Row 1: [Filters…] ············· [Add CTA icon] [Msg icon]
     *   Row 2: [Search ─────────────────────────────────────────]
     *
     * Desktop (sm+) — 1 row:
     *   [Search] [Block ▾] [Status][Payment][Lease] · | · [Add Tenant] [Message]
     */
    <div className="flex flex-col sm:flex-row sm:items-center gap-y-1.5 gap-x-2 w-full overflow-hidden">

      {/* ── Row 1 ── */}
      <div className="flex items-center gap-1.5 w-full min-w-0 overflow-hidden">

        {/* Search — desktop only inline */}
        <div className="relative hidden sm:block w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#AFA097" }} />
          <input
            type="text"
            placeholder="Search tenant, phone, or unit…"
            value={filters.search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ background: "#F8F5F2", borderColor: "#DDD6D0", color: "#1C1A18" }}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border outline-none transition-colors
                       placeholder:text-[#C8BDB6] focus:border-[#AFA097] focus:ring-2 focus:ring-[#3D1414]/10"
          />
        </div>

        {/* Block filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 text-xs shrink-0 max-w-[120px] sm:max-w-[148px] justify-between gap-1
                         border-[#DDD6D0] bg-[#F8F5F2] text-[#1C1A18] hover:bg-[#EEE9E5]"
            >
              <span className="truncate">{blockLabel}</span>
              <ArrowDown className="w-3 h-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem onClick={() => onBlockChange(null, null)}>All Blocks</DropdownMenuItem>
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
                          <DropdownMenuItem key={inner._id} onClick={() => onBlockChange(block, inner)}>
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

        {/* Attribute filter groups — icon-only on mobile */}
        <div className="flex items-center gap-1">
          {FILTER_GROUPS.map(group => (
            <FilterGroupButton
              key={group.key}
              group={group}
              selectedValues={filters[group.key] ?? []}
              onToggle={onFilterToggle}
            />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Divider — desktop only */}
        <div className="hidden sm:block w-px h-5 bg-[#DDD6D0] shrink-0" />

        {/* CTAs */}
        <Button
          variant="outline"
          title="Import Tenants"
          className="hidden sm:flex h-8 px-3 text-xs font-semibold
                     border-[#DDD6D0] bg-[#F8F5F2] text-[#1C1A18] hover:bg-[#EEE9E5]
                     shrink-0 items-center justify-center"
          onClick={onNavigate.toMessage}
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span className="ml-1.5 whitespace-nowrap">Import</span>
        </Button>

        <Button
          title="Add Tenant"
          className="h-8 w-8 sm:w-auto px-0 sm:px-3 text-xs font-semibold
                     bg-[#3D1414] hover:bg-[#3D1414]/90 text-white shrink-0
                     flex items-center justify-center"
          onClick={onNavigate.toAdd}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Add Tenant</span>
        </Button>

      </div>

      {/* ── Row 2 — mobile search, full width ── */}
      <div className="sm:hidden w-full">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#AFA097" }} />
          <input
            type="text"
            placeholder="Search tenant, phone, or unit…"
            value={filters.search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ background: "#F8F5F2", borderColor: "#DDD6D0", color: "#1C1A18" }}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border outline-none transition-colors
                       placeholder:text-[#C8BDB6] focus:border-[#AFA097] focus:ring-2 focus:ring-[#3D1414]/10"
          />
        </div>
      </div>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

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

      if (currentFilters.status.length) params.status = currentFilters.status;
      if (currentFilters.paymentStatus.length) params.paymentStatus = currentFilters.paymentStatus;
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

  const activeTenants = tenants.filter(t => t.status === "active").length;

  const outstandingRent = useMemo(() => {
    return tenants.reduce((sum, t) => sum + (t.outstandingAmount ?? 0), 0);
  }, [tenants]);

  const attentionCount = useMemo(() => {
    return tenants.filter(t => needsAttention(t)).length;
  }, [tenants]);

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
    <div className="min-h-screen px-4 sm:px-5 font-sans">

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

      <div className="py-4">
        {/* Page title */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your residents, leases, and rent collection
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={Users}
            label="Total Tenants"
            value={totalCount ?? tenants.length}
            description="All registered tenants"
            iconBg="bg-gray-100"
            iconColor="text-gray-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="Active"
            value={activeTenants}
            description="Currently occupying"
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
          <StatCard
            icon={DollarSign}
            label="Outstanding Rent"
            value={outstandingRent > 0 ? `Rs ${outstandingRent.toLocaleString()}` : "Rs 0"}
            description="Unpaid balances"
            iconBg="bg-red-50"
            iconColor="text-red-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Attention Needed"
            value={attentionCount}
            description="Overdue or lease expiring"
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            highlight={attentionCount > 0}
          />
        </div>

        {/* View toggle + results count */}
        <div className="flex items-center justify-between mb-3">
          <div>
            {showingFiltered && !loading && (
              <p className="text-xs text-gray-400">
                Showing <span className="font-semibold text-gray-700">{tenants.length}</span>
                {totalCount != null && ` of ${totalCount}`} tenants
              </p>
            )}
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                         ${viewMode === "grid"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                         ${viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"}`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        </div>

        {/* Empty / loading states */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <TenantCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
              <div className="space-y-3 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="h-3 bg-gray-200 rounded flex-1" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : tenants.length === 0 ? (
          <div className="text-center py-16">
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
        ) : viewMode === "grid" ? (
          /* ── Grid View ─────────────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {tenants.map(tenant => (
              <TenantCard
                key={tenant._id}
                tenant={tenant}
                onTenantMutated={fetchAllTenants}
              />
            ))}
          </div>
        ) : (
          /* ── Table View ────────────────────────────────────────────── */
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pl-4">Tenant</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unit</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Rent</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Payment</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Lease End</TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(tenant => {
                  const isActive = tenant?.status === "active" || !tenant?.status;
                  const paymentStatus = getPaymentStatus(tenant);
                  const badge = PAYMENT_BADGE[paymentStatus] ?? PAYMENT_BADGE.paid;
                  const attention = needsAttention(tenant);
                  const initials = tenant?.name
                    ? tenant.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                    : "?";

                  return (
                    <TableRow
                      key={tenant._id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          {attention && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${getAvatarColor(tenant?.name)}`}>
                            {initials}
                          </div>
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                            {tenant?.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{getTenantLocationLabel(tenant)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-gray-900">{getTenantRentDisplay(tenant)}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                          ${isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {isActive ? "Active" : tenant?.status ?? "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{tenant?.leaseEndDateNepali || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400
                                       hover:bg-green-50 hover:text-green-600 transition-colors"
                            onClick={e => { e.stopPropagation(); if (tenant?.phone) window.location.href = `tel:${tenant.phone}`; }}
                            title="Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400
                                       hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={e => { e.stopPropagation(); if (tenant?.email) window.location.href = `mailto:${tenant.email}`; }}
                            title="Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400
                                           hover:bg-gray-100 transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/rent-payment`)}>
                                <CreditCard className="w-3.5 h-3.5 mr-2" /> Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/tenant/send-message`)}>
                                <Bell className="w-3.5 h-3.5 mr-2" /> Send Reminder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/tenant/editTenant/${tenant._id}`)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Tenant
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={async () => {
                                  try {
                                    const res = await api.patch(`/api/tenant/delete-tenant/${tenant._id}`);
                                    if (res.data.success) { toast.success(res.data.message); fetchAllTenants(); }
                                    else toast.error(res.data.message || "Failed");
                                  } catch (err) { toast.error(err.response?.data?.message || "An error occurred"); }
                                }}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-2" /> Terminate Lease
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}