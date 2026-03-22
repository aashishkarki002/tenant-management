import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import qs from "qs";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, ArrowDown,
  Users, CheckCircle2, X,
  ChevronDown, Filter, Banknote, CalendarClock,
  AlertTriangle, DollarSign,
  MoreVertical, Eye, CreditCard, Bell, Pencil, XCircle,
  Phone, Mail, Upload, SlidersHorizontal, LayoutGrid, List as ListIcon,
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

const ESSENTIAL_FILTERS = [
  {
    key: "status",
    label: "Status",
    icon: CheckCircle2,
    options: [
      { value: "active", label: "Active", dot: "bg-[var(--color-success)]" },
      { value: "inactive", label: "Inactive", dot: "bg-[var(--color-muted-fill)]" },
      { value: "vacated", label: "Vacated", dot: "bg-[var(--color-danger)]" },
    ],
  },
  {
    key: "paymentStatus",
    label: "Payment",
    icon: DollarSign,
    options: [
      { value: "paid", label: "Paid", dot: "bg-[var(--color-success)]" },
      { value: "due_soon", label: "Due Soon", dot: "bg-[var(--color-warning)]" },
      { value: "overdue", label: "Overdue", dot: "bg-[var(--color-danger)]" },
    ],
  },
];

const ADVANCED_FILTERS = [
  {
    key: "frequency",
    label: "Billing Frequency",
    icon: Banknote,
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "quarterly", label: "Quarterly" },
    ],
  },
  {
    key: "lease",
    label: "Lease Status",
    icon: CalendarClock,
    options: [
      { value: "expiring_soon", label: "Expiring Soon (< 30 days)" },
      { value: "expired", label: "Expired" },
    ],
  },
];

const FILTER_GROUPS = [...ESSENTIAL_FILTERS, ...ADVANCED_FILTERS];

// ─── URL param helpers ─────────────────────────────────────────────────────────
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

// ─── KPI Strip ────────────────────────────────────────────────────────────────
//
// A single horizontal bar replaces four tall cards.
// Each cell earns a semantic background only when it actually demands attention.
//
function KpiStrip({ items }) {
  return (
    <div
      className="flex items-stretch rounded-xl border overflow-hidden mb-6 shadow-[var(--shadow-card)]"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const bgStyle =
          item.urgency === "danger"
            ? { background: "var(--color-danger-bg)", borderLeft: "2px solid var(--color-danger)" }
            : item.urgency === "warning"
              ? { background: "var(--color-warning-bg)", borderLeft: "2px solid var(--color-warning)" }
              : {};
        const valueColor =
          item.urgency === "danger"
            ? "var(--color-danger)"
            : item.urgency === "warning"
              ? "var(--color-warning)"
              : "var(--color-text-strong)";

        return (
          <div
            key={item.label}
            className="flex-1 px-4 py-3 min-w-0"
            style={{
              borderRight: isLast ? "none" : "1px solid var(--color-border)",
              ...bgStyle,
            }}
          >
            <p
              className="text-[9px] font-semibold uppercase tracking-widest mb-1 truncate"
              style={{ color: "var(--color-text-weak)" }}
            >
              {item.label}
            </p>
            <p
              className="text-base font-bold font-mono tabular-nums leading-none"
              style={{ color: valueColor }}
            >
              {item.value}
            </p>
            {item.sub && (
              <p className="text-[10px] mt-1 truncate" style={{ color: "var(--color-text-sub)" }}>
                {item.sub}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TenantCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-border shadow-[var(--shadow-card)] p-3 space-y-2.5 animate-pulse"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full" style={{ background: "var(--color-muted-fill)" }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 rounded w-2/3" style={{ background: "var(--color-muted-fill)" }} />
          <div className="h-2.5 rounded w-1/3" style={{ background: "var(--color-muted-fill)" }} />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="h-4 rounded w-24" style={{ background: "var(--color-muted-fill)" }} />
        <div className="h-5 w-14 rounded-full" style={{ background: "var(--color-muted-fill)" }} />
      </div>
      <div className="h-2.5 rounded w-3/4" style={{ background: "var(--color-muted-fill)" }} />
      <div className="border-t border-border pt-2 flex gap-1.5">
        <div className="h-7 rounded-lg flex-1" style={{ background: "var(--color-muted-fill)" }} />
        <div className="h-7 rounded-lg flex-1" style={{ background: "var(--color-muted-fill)" }} />
      </div>
    </div>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, dot, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 pl-2.5 pr-1.5 rounded-full text-[11px] font-medium border"
      style={{
        background: "var(--color-accent-light)",
        borderColor: "var(--color-accent-mid)",
        color: "var(--color-accent)",
      }}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 transition-opacity hover:opacity-60"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Filter Group Button ───────────────────────────────────────────────────────
function FilterGroupButton({ group, selectedValues, onToggle }) {
  const Icon = group.icon;
  const activeCount = selectedValues.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-colors shrink-0 outline-none"
          style={activeCount > 0 ? {
            background: "var(--color-accent)",
            color: "#ffffff",
            borderColor: "var(--color-accent)",
          } : {
            background: "var(--color-surface)",
            color: "var(--color-text-body)",
            borderColor: "var(--color-border)",
          }}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">{group.label}</span>
          {activeCount > 0 && (
            <span className="bg-white/30 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0">
              {activeCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px] p-1">
        {group.options.map(opt => {
          const isSelected = selectedValues.includes(opt.value);
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={(e) => { e.preventDefault(); onToggle(group.key, opt.value); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
              style={isSelected ? {
                background: "var(--color-accent-light)",
                color: "var(--color-accent)",
                fontWeight: 500,
              } : { color: "var(--color-text-body)" }}
            >
              {opt.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dot}`} />}
              <span className="flex-1">{opt.label}</span>
              {isSelected && <span className="ml-auto text-xs" style={{ color: "var(--color-accent)" }}>✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Advanced Filters Popover ──────────────────────────────────────────────────
function AdvancedFiltersPopover({ filters, onFilterToggle }) {
  const advancedActiveCount = ADVANCED_FILTERS.reduce(
    (count, group) => count + (filters[group.key]?.length ?? 0),
    0
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-colors shrink-0 outline-none"
          style={advancedActiveCount > 0 ? {
            background: "var(--color-accent)",
            color: "#ffffff",
            borderColor: "var(--color-accent)",
          } : {
            background: "var(--color-surface)",
            color: "var(--color-text-body)",
            borderColor: "var(--color-border)",
          }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">More Filters</span>
          {advancedActiveCount > 0 && (
            <span className="bg-white/30 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0">
              {advancedActiveCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h3 className="text-xs font-semibold" style={{ color: "var(--color-text-strong)" }}>Advanced Filters</h3>
        </div>

        <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
          {ADVANCED_FILTERS.map(group => {
            const Icon = group.icon;
            const selectedValues = filters[group.key] ?? [];
            return (
              <div key={group.key}>
                <label
                  className="flex items-center gap-1.5 text-[10px] font-semibold mb-2 px-1 uppercase tracking-widest"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  <Icon className="w-3 h-3" />
                  {group.label}
                </label>
                <div className="space-y-1">
                  {group.options.map(opt => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <DropdownMenuItem
                        key={opt.value}
                        onSelect={(e) => { e.preventDefault(); onFilterToggle(group.key, opt.value); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
                        style={isSelected ? {
                          background: "var(--color-accent-light)",
                          color: "var(--color-accent)",
                          fontWeight: 500,
                        } : {
                          color: "var(--color-text-body)",
                        }}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {isSelected && <span style={{ color: "var(--color-accent)" }}>✓</span>}
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {advancedActiveCount > 0 && (
          <div className="px-3 py-2.5 border-t" style={{ borderColor: "var(--color-border)" }}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                ADVANCED_FILTERS.forEach(group => {
                  (filters[group.key] ?? []).forEach(value => onFilterToggle(group.key, value));
                });
              }}
              className="w-full justify-center text-[11px] font-medium py-1.5 rounded-lg cursor-pointer"
              style={{ color: "var(--color-text-sub)" }}
            >
              Clear advanced filters
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Mobile Filter Drawer ──────────────────────────────────────────────────────
function MobileFilterDrawer({ isOpen, onClose, filters, allBlocks, onBlockChange, onFilterToggle, onClearAll }) {
  if (!isOpen) return null;

  const activeFilterCount =
    (filters.block ? 1 : 0) +
    (filters.status?.length ?? 0) +
    (filters.paymentStatus?.length ?? 0) +
    (filters.frequency?.length ?? 0) +
    (filters.lease?.length ?? 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 sm:hidden" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl shadow-[var(--shadow-modal)]
                   max-h-[85vh] overflow-hidden flex flex-col sm:hidden
                   animate-in slide-in-from-bottom duration-300"
        style={{ background: "var(--color-surface-raised)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <h3 className="text-base font-bold font-sans" style={{ color: "var(--color-text-strong)" }}>Filters</h3>
            {activeFilterCount > 0 && (
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-sub)" }}>
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-surface)", color: "var(--color-text-sub)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          <div>
            <label className="block text-[10px] font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--color-text-sub)" }}>
              Location
            </label>
            <div className="space-y-1.5">
              <button
                onClick={() => onBlockChange(null, null)}
                className="w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium"
                style={!filters.block ? {
                  background: "var(--color-accent)", color: "#ffffff", borderColor: "var(--color-accent)",
                } : {
                  background: "var(--color-surface-raised)", color: "var(--color-text-body)", borderColor: "var(--color-border)",
                }}
              >
                All Blocks
              </button>
              {allBlocks.map(block => (
                <div key={block._id}>
                  <button
                    onClick={() => onBlockChange(block, null)}
                    className="w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium"
                    style={filters.block === block._id && !filters.innerBlock ? {
                      background: "var(--color-accent)", color: "#ffffff", borderColor: "var(--color-accent)",
                    } : {
                      background: "var(--color-surface-raised)", color: "var(--color-text-body)", borderColor: "var(--color-border)",
                    }}
                  >
                    {block.name}
                  </button>
                  {Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0 && (
                    <div className="ml-4 mt-1.5 space-y-1.5">
                      {block.innerBlocks.map(inner => (
                        <button
                          key={inner._id}
                          onClick={() => onBlockChange(block, inner)}
                          className="w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm"
                          style={filters.innerBlock === inner._id ? {
                            background: "var(--color-accent-light)", color: "var(--color-accent)", borderColor: "var(--color-accent-mid)", fontWeight: 500,
                          } : {
                            background: "var(--color-surface-raised)", color: "var(--color-text-sub)", borderColor: "var(--color-border)",
                          }}
                        >
                          {inner.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {FILTER_GROUPS.map(group => {
            const Icon = group.icon;
            const selectedValues = filters[group.key] ?? [];
            return (
              <div key={group.key}>
                <label
                  className="flex items-center gap-2 text-[10px] font-semibold mb-2 uppercase tracking-widest"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  <Icon className="w-3.5 h-3.5" /> {group.label}
                </label>
                <div className="space-y-1.5">
                  {group.options.map(opt => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => onFilterToggle(group.key, opt.value)}
                        className="w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-2.5 text-sm"
                        style={isSelected ? {
                          background: "var(--color-accent-light)", color: "var(--color-accent)", borderColor: "var(--color-accent-mid)", fontWeight: 500,
                        } : {
                          background: "var(--color-surface-raised)", color: "var(--color-text-body)", borderColor: "var(--color-border)",
                        }}
                      >
                        {opt.dot && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />}
                        <span className="flex-1">{opt.label}</span>
                        {isSelected && <span style={{ color: "var(--color-accent)" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t px-5 py-4 flex gap-3" style={{ borderColor: "var(--color-border)" }}>
          <Button
            variant="outline"
            onClick={onClearAll}
            disabled={activeFilterCount === 0}
            className="flex-1 h-11 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-body)" }}
          >
            Clear All
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 h-11 text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Contextual Header Slot ────────────────────────────────────────────────────
//
// Layout: [Search] [Block▾] | [Status] [Payment] [Filters▾] ··· [Grid|Table] [+ Add Tenant]
//
// Design decisions:
// - "Send Message" removed from header — it's a per-tenant action, lives in TenantCard ••• menu
// - View toggle (Grid/Table) moved here so the page body stays clean
// - Divider separates location filter from status/payment filters (different filter categories)
// - Only one filled button (Add Tenant) — everything else is flat/outline
//
function TenantHeaderSlot({
  filters, allBlocks, onSearchChange, onBlockChange, onFilterToggle, onNavigate, onClearAll,
  viewMode, onViewModeChange,
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const selectedBlock = allBlocks.find(b => b._id === filters.block) ?? null;
  const selectedInner = selectedBlock?.innerBlocks?.find(ib => ib._id === filters.innerBlock) ?? null;

  const blockLabel = selectedBlock
    ? selectedInner ? `${selectedBlock.name} · ${selectedInner.name}` : selectedBlock.name
    : "All Blocks";

  const mobileActiveFilterCount =
    (filters.block ? 1 : 0) +
    (filters.status?.length ?? 0) +
    (filters.paymentStatus?.length ?? 0) +
    (filters.frequency?.length ?? 0) +
    (filters.lease?.length ?? 0);

  return (
    <>
      <MobileFilterDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        filters={filters}
        allBlocks={allBlocks}
        onBlockChange={onBlockChange}
        onFilterToggle={onFilterToggle}
        onClearAll={onClearAll}
      />

      <div className="flex items-center gap-2 w-full min-w-0">

        {/* ── Mobile ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 w-full sm:hidden">
          <div className="relative flex-1 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--color-text-weak)" }}
            />
            <input
              type="text"
              placeholder="Search tenants…"
              value={filters.search}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full h-11 pl-10 pr-3 text-sm rounded-xl border outline-none transition-colors font-sans"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-strong)",
              }}
            />
          </div>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="relative h-11 px-4 rounded-xl border font-medium text-sm transition-all shrink-0 flex items-center gap-2"
            style={mobileActiveFilterCount > 0 ? {
              background: "var(--color-accent)", color: "#ffffff", borderColor: "var(--color-accent)",
            } : {
              background: "var(--color-surface)", color: "var(--color-text-body)", borderColor: "var(--color-border)",
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {mobileActiveFilterCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2"
                style={{ background: "var(--color-danger)", borderColor: "var(--color-surface-raised)" }}
              >
                {mobileActiveFilterCount}
              </span>
            )}
          </button>
          <Button
            onClick={onNavigate.toAdd}
            className="h-11 w-11 p-0 text-white shrink-0 flex items-center justify-center rounded-xl"
            style={{ background: "var(--color-accent)" }}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* ── Desktop ─────────────────────────────────────────────────────────── */}
        {/*
          Left cluster: Search + Block (location context)
          Middle cluster: Status + Payment + More Filters (tenant state)
          Right cluster: view toggle + Add Tenant (only primary CTA)
        */}
        <div className="hidden sm:flex items-center gap-1.5 w-full min-w-0">

          {/* Search */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px] shrink">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--color-text-weak)" }}
            />
            <input
              type="text"
              placeholder="Search tenants…"
              value={filters.search}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border outline-none transition-colors font-sans"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-strong)",
              }}
            />
          </div>

          {/* Block filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs shrink-0 max-w-[140px] justify-between gap-1 font-medium"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              >
                <span className="truncate">{blockLabel}</span>
                <ArrowDown className="w-3 h-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="start">
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

          {/* Divider — separates location from state filters */}
          <div className="w-px h-5 shrink-0" style={{ background: "var(--color-border)" }} />

          {/* Essential filters: Status + Payment */}
          {ESSENTIAL_FILTERS.map(group => (
            <FilterGroupButton
              key={group.key}
              group={group}
              selectedValues={filters[group.key] ?? []}
              onToggle={onFilterToggle}
            />
          ))}

          {/* Advanced filters collapsed into one button */}
          <AdvancedFiltersPopover filters={filters} onFilterToggle={onFilterToggle} />

          {/* Spacer — pushes right cluster to the end */}
          <div className="flex-1" />

          {/* View toggle — Grid / Table */}
          <div
            className="flex items-center rounded-lg p-0.5 border shrink-0"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <button
              onClick={() => onViewModeChange("grid")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all"
              style={viewMode === "grid" ? {
                background: "var(--color-surface-raised)",
                color: "var(--color-text-strong)",
                boxShadow: "var(--shadow-card)",
              } : { color: "var(--color-text-sub)" }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Grid</span>
            </button>
            <button
              onClick={() => onViewModeChange("table")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all"
              style={viewMode === "table" ? {
                background: "var(--color-surface-raised)",
                color: "var(--color-text-strong)",
                boxShadow: "var(--shadow-card)",
              } : { color: "var(--color-text-sub)" }}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-5 shrink-0" style={{ background: "var(--color-border)" }} />

          {/* Add Tenant — sole primary CTA */}
          <Button
            onClick={onNavigate.toAdd}
            className="h-9 px-3 text-xs font-semibold text-white shrink-0 flex items-center gap-1.5"
            style={{ background: "var(--color-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Tenant
          </Button>

        </div>

      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);
  const isInitialMount = useRef(true);

  /* ── Filter setters ─────────────────────────────────────────────────────── */

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
      next.delete(key);
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

  /* ── Data fetching ──────────────────────────────────────────────────────── */

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

      const res = await api.get("/api/tenant/search-tenants", {
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "repeat" }),
      });
      setTenants(res.data.tenants || []);
    } catch {
      toast.error("Failed to filter tenants");
      setTenants([]);
    }
  };

  /* ── Effects ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    setLoading(true);
    const initialFilters = parseFiltersFromParams(searchParams);
    Promise.all([
      fetchProperties(),
      hasActiveFilters(initialFilters) ? fetchFilteredTenants(initialFilters) : fetchAllTenants(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setLoading(true);
    (hasActiveFilters(filters) ? fetchFilteredTenants(filters) : fetchAllTenants())
      .finally(() => setLoading(false));
  }, [searchParams]);

  /* ── Derived ────────────────────────────────────────────────────────────── */

  const allBlocks = useMemo(() => getAllBlocks(properties), [properties]);

  const activeTenants = tenants.filter(t => t.status === "active").length;

  const outstandingRent = useMemo(
    () => tenants.reduce((sum, t) => sum + (t.outstandingAmount ?? 0), 0),
    [tenants]
  );

  const attentionCount = useMemo(
    () => tenants.filter(t => needsAttention(t)).length,
    [tenants]
  );

  const appliedChips = useMemo(() => {
    const chips = [];
    const block = allBlocks.find(b => b._id === filters.block);
    if (block) {
      const inner = block.innerBlocks?.find(i => i._id === filters.innerBlock);
      chips.push({
        key: "block", value: filters.block,
        label: inner ? `${block.name} · ${inner.name}` : block.name,
        onRemove: () => handleBlockChange(null, null),
      });
    }
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

  const navCallbacks = useMemo(() => ({
    toAdd: () => navigate("/tenant/addTenants"),
    toMessage: () => navigate("/tenant/send-message"),
  }), [navigate]);

  /* ── Header slot injection ──────────────────────────────────────────────── */

  useHeaderSlot(
    () => (
      <TenantHeaderSlot
        filters={filters}
        allBlocks={allBlocks}
        onSearchChange={handleSearchChange}
        onBlockChange={handleBlockChange}
        onFilterToggle={toggleMultiFilter}
        onNavigate={navCallbacks}
        onClearAll={clearAllFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    ),
    [filters, allBlocks, viewMode]
  );

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const showingFiltered = hasActiveFilters(filters);

  return (
    <div className="min-h-screen px-4 sm:px-6 font-sans" style={{ color: "var(--color-text-body)" }}>

      {/* ── Active filter chip bar ─────────────────────────────────────────── */}
      {appliedChips.length > 0 && (
        <div
          className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2
                     backdrop-blur-sm border-b flex items-center gap-2 flex-wrap"
          style={{
            background: "color-mix(in srgb, var(--color-surface-raised) 92%, transparent)",
            borderColor: "var(--color-border)",
          }}
        >
          <span className="text-[11px] flex items-center gap-1 shrink-0" style={{ color: "var(--color-text-weak)" }}>
            <Filter className="w-3 h-3" /> Filters:
          </span>
          {appliedChips.map(chip => (
            <FilterChip key={chip.key} label={chip.label} dot={chip.dot} onRemove={chip.onRemove} />
          ))}
          <button
            onClick={clearAllFilters}
            className="text-[11px] underline underline-offset-2 ml-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-sub)" }}
          >
            Clear all
          </button>
        </div>
      )}

      <div className="py-5">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="mb-5">
          <h1 className="text-xl font-bold font-sans" style={{ color: "var(--color-text-strong)" }}>Tenants</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Manage residents, leases, and rent collection
          </p>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────────────────── */}
        <KpiStrip
          items={[
            {
              label: "Total Tenants",
              value: totalCount ?? tenants.length,
              sub: `${activeTenants} active`,
            },
            {
              label: "Outstanding",
              value: outstandingRent > 0 ? `Rs ${outstandingRent.toLocaleString()}` : "Rs 0",
              sub: "Unpaid balances",
              urgency: outstandingRent > 0 ? "warning" : undefined,
            },
            {
              label: "Due this week",
              value: tenants.filter(t => getPaymentStatus(t) === "due_soon").length,
              sub: "Tenants",
            },
            {
              label: "Needs Attention",
              value: attentionCount > 0 ? attentionCount : "None",
              sub: attentionCount > 0 ? "Overdue or lease expiring" : "All clear",
              urgency: attentionCount > 0 ? "danger" : undefined,
            },
          ]}
        />

        {/* ── filter result count ───────────────────────────────────────────── */}
        <div className="min-h-[18px] mb-4">
          {showingFiltered && !loading && (
            <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
              Showing{" "}
              <span className="font-semibold" style={{ color: "var(--color-text-body)" }}>{tenants.length}</span>
              {totalCount != null && ` of ${totalCount}`} tenants
            </p>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <TenantCardSkeleton key={i} />)}
            </div>
          ) : (
            <div
              className="rounded-xl border shadow-[var(--shadow-card)] p-8"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="space-y-3 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-full" style={{ background: "var(--color-muted-fill)" }} />
                    <div className="h-3 rounded flex-1" style={{ background: "var(--color-muted-fill)" }} />
                    <div className="h-3 rounded w-20" style={{ background: "var(--color-muted-fill)" }} />
                    <div className="h-3 rounded w-16" style={{ background: "var(--color-muted-fill)" }} />
                    <div className="h-3 rounded w-24" style={{ background: "var(--color-muted-fill)" }} />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : tenants.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-muted-fill)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-weak)" }}>
              {showingFiltered ? "No tenants match the current filters" : "No tenants found"}
            </p>
            {showingFiltered && (
              <button
                onClick={clearAllFilters}
                className="mt-2 text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: "var(--color-accent)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {tenants.map(tenant => (
              <TenantCard key={tenant._id} tenant={tenant} onTenantMutated={fetchAllTenants} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl border overflow-hidden shadow-[var(--shadow-card)]"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "var(--color-surface-raised)" }}>
                  {["Tenant", "Unit", "Rent", "Status", "Payment", "Lease End", ""].map((h, i) => (
                    <TableHead
                      key={i}
                      className={`text-[10px] font-semibold uppercase tracking-widest ${i === 0 ? "pl-4" : ""} ${i === 6 ? "text-right pr-4" : ""}`}
                      style={{ color: "var(--color-text-sub)" }}
                    >
                      {h}
                    </TableHead>
                  ))}
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
                      className="cursor-pointer transition-colors"
                      style={{ borderColor: "var(--color-border)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-raised)"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                      onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          {attention && (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-danger)" }} />
                          )}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${getAvatarColor(tenant?.name)}`}>
                            {initials}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: "var(--color-text-strong)" }}>
                            {tenant?.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>{getTenantLocationLabel(tenant)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold font-mono tabular-nums" style={{ color: "var(--color-text-strong)" }}>
                          {getTenantRentDisplay(tenant)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={isActive ? {
                            background: "var(--color-success-bg)",
                            color: "var(--color-success)",
                          } : {
                            background: "var(--color-surface-raised)",
                            color: "var(--color-text-weak)",
                          }}
                        >
                          {isActive ? "Active" : tenant?.status ?? "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono" style={{ color: "var(--color-text-sub)" }}>
                          {tenant?.leaseEndDateNepali || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                            style={{ color: "var(--color-text-weak)" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--color-success-bg)"; e.currentTarget.style.color = "var(--color-success)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--color-text-weak)"; }}
                            onClick={e => { e.stopPropagation(); if (tenant?.phone) window.location.href = `tel:${tenant.phone}`; }}
                            title="Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                            style={{ color: "var(--color-text-weak)" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--color-accent-light)"; e.currentTarget.style.color = "var(--color-accent)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--color-text-weak)"; }}
                            onClick={e => { e.stopPropagation(); if (tenant?.email) window.location.href = `mailto:${tenant.email}`; }}
                            title="Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                                style={{ color: "var(--color-text-weak)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-raised)"}
                                onMouseLeave={e => e.currentTarget.style.background = ""}
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
                                style={{ color: "var(--color-danger)" }}
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