// src/pages/dashboard/component/NeedsAttentionPanel.jsx

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    CalendarClock,
    Wrench,
    Zap,
    CheckCircle2,
    ChevronRight,
    SlidersHorizontal,
    Building2,
} from "lucide-react";

// ─── Severity tokens ──────────────────────────────────────────────────────────
const SEV = {
    critical: {
        dot: "var(--destructive)",
        iconBg: "color-mix(in oklch, var(--destructive) 12%, transparent)",
        iconBorder: "color-mix(in oklch, var(--destructive) 25%, transparent)",
        iconColor: "var(--destructive)",
        strip: "var(--destructive)",
        badge: {
            bg: "color-mix(in oklch, var(--destructive) 12%, transparent)",
            color: "var(--destructive)",
            border: "color-mix(in oklch, var(--destructive) 30%, transparent)",
        },
    },
    high: {
        dot: "var(--warning)",
        iconBg: "color-mix(in oklch, var(--warning) 14%, transparent)",
        iconBorder: "color-mix(in oklch, var(--warning) 28%, transparent)",
        iconColor: "var(--warning)",
        strip: "var(--warning)",
        badge: {
            bg: "color-mix(in oklch, var(--warning) 14%, transparent)",
            color: "var(--warning)",
            border: "color-mix(in oklch, var(--warning) 30%, transparent)",
        },
    },
    medium: {
        dot: "var(--color-muted-foreground)",
        iconBg: "var(--color-secondary)",
        iconBorder: "var(--color-border)",
        iconColor: "var(--color-muted-foreground)",
        strip: "var(--color-border)",
        badge: {
            bg: "var(--color-secondary)",
            color: "var(--color-muted-foreground)",
            border: "var(--color-border)",
        },
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmt(n) {
    if (!n || isNaN(n)) return null;
    if (n >= 100_000) return `Rs. ${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n}`;
}

function fmtDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysOldLabel(dateStr) {
    if (!dateStr) return null;
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (d === 0) return "opened today";
    if (d === 1) return "1 day open";
    return `${d}d open`;
}

// ─── Alert builder ────────────────────────────────────────────────────────────
//
// Only reads fields confirmed present in normalizeDashboardStats():
//
//   stats.attention.overdueCount / overdueAmount
//   stats.overdueRents[]     { tenant:{name}, remainingPaisa, dueDate,
//                               property:{name}, unit:{name} }
//   stats.contractsEndingSoon[] { name, daysUntilEnd, endDate }
//   stats.maintenance[]      { title, status, priority, createdAt,
//                               property:{name}, unit:{name} }
//   stats.generatorsDueService[] { name, currentFuelPercent,
//                               lowFuelThresholdPercent, criticalFuelThresholdPercent,
//                               nextServiceDate, property:{name} }

function buildAlerts(stats) {
    if (!stats) return [];
    const alerts = [];
    const attention = stats.attention ?? {};

    // ── 1. Overdue rent ───────────────────────────────────────────────────────
    const overdueCount = attention.overdueCount ?? 0;
    const overdueAmount = attention.overdueAmount ?? 0;
    const overdueRents = Array.isArray(stats.overdueRents) ? stats.overdueRents : [];

    overdueRents.slice(0, 3).forEach((r, i) => {
        const name = r.tenant?.name ?? r.tenantName ?? `Tenant ${i + 1}`;
        const amt = r.remainingPaisa ? fmtAmt(r.remainingPaisa / 100) : null;
        const due = r.dueDate ? `Due ${fmtDate(r.dueDate)}` : null;
        const location = r.unit?.name || null;

        alerts.push({
            id: `overdue-${i}`,
            type: "rent",
            severity: "critical",
            icon: AlertTriangle,
            title: name,
            sub: [amt ? `${amt} outstanding` : "Rent overdue", due].filter(Boolean).join(" · "),
            meta: location,
            badge: "Overdue",
            to: "/rent-payment",
            sortKey: 0,
        });
    });

    // Summary row if backend only gave us a sample
    if (overdueCount > overdueRents.length) {
        const remaining = overdueCount - overdueRents.length;
        alerts.push({
            id: "overdue-more",
            type: "rent",
            severity: "critical",
            icon: AlertTriangle,
            title: `+${remaining} more overdue tenant${remaining !== 1 ? "s" : ""}`,
            sub: overdueAmount > 0
                ? `${fmtAmt(overdueAmount)} total outstanding`
                : "Review all overdue rents",
            meta: null,
            badge: `${overdueCount} total`,
            to: "/rent-payment",
            sortKey: 0,
        });
    }

    // ── 2. Leases ending soon ─────────────────────────────────────────────────
    const leases = Array.isArray(stats.contractsEndingSoon)
        ? stats.contractsEndingSoon.filter((c) => (c.daysUntilEnd ?? 999) <= 45)
        : [];

    leases.slice(0, 3).forEach((c, i) => {
        const days = c.daysUntilEnd ?? 999;
        const urgent = days <= 7;
        const expiry = c.endDate ? fmtDate(c.endDate) : null;

        let timeLabel;
        if (days <= 0) timeLabel = "Expired";
        else if (days === 1) timeLabel = "Expires tomorrow";
        else timeLabel = `Expires in ${days} days`;
        if (expiry) timeLabel += ` · ${expiry}`;

        const location = c.unit?.name || null;

        alerts.push({
            id: `lease-${i}`,
            type: "lease",
            severity: urgent ? "high" : "medium",
            icon: CalendarClock,
            title: c.name ?? "Tenant",
            sub: timeLabel,
            meta: location,
            badge: days <= 0 ? "Expired" : `${days}d`,
            to: "/tenant",
            sortKey: urgent ? 1 : 2,
        });
    });

    // ── 3. Open maintenance ───────────────────────────────────────────────────
    const openMaint = Array.isArray(stats.maintenance)
        ? stats.maintenance.filter((m) =>
            ["OPEN", "IN_PROGRESS"].includes((m.status ?? "").toUpperCase())
        )
        : [];

    openMaint.slice(0, 3).forEach((m, i) => {
        const isUrgent = (m.priority ?? "").toLowerCase() === "urgent";
        const isHigh = (m.priority ?? "").toLowerCase() === "high";
        const rawStatus = (m.status ?? "OPEN").replace(/_/g, " ");
        const statusLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
        const age = daysOldLabel(m.createdAt);
        const location = m.unit?.name || null;

        alerts.push({
            id: `maint-${i}`,
            type: "maintenance",
            severity: isUrgent ? "critical" : isHigh ? "high" : "medium",
            icon: Wrench,
            title: m.title ?? "Maintenance request",
            sub: [statusLabel, age].filter(Boolean).join(" · "),
            meta: location,
            badge: m.priority ?? null,
            to: "/maintenance",
            sortKey: isUrgent ? 1.5 : 3,
        });
    });

    if (openMaint.length > 3) {
        const extra = openMaint.length - 3;
        alerts.push({
            id: "maint-more",
            type: "maintenance",
            severity: "medium",
            icon: Wrench,
            title: `+${extra} more open request${extra !== 1 ? "s" : ""}`,
            sub: `${openMaint.length} total in queue`,
            meta: null,
            badge: `${openMaint.length}`,
            to: "/maintenance",
            sortKey: 3,
        });
    }

    // ── 4. Generator alerts ───────────────────────────────────────────────────
    const gens = Array.isArray(stats.generatorsDueService) ? stats.generatorsDueService : [];

    gens.slice(0, 2).forEach((g, i) => {
        const fuelPct = g.currentFuelPercent;
        const lowThreshold = g.lowFuelThresholdPercent ?? 20;
        const critThreshold = g.criticalFuelThresholdPercent ?? 10;
        const lowFuel = fuelPct != null && fuelPct <= lowThreshold;
        const critical = fuelPct != null && fuelPct <= critThreshold;
        const nextService = g.nextServiceDate;
        const serviceOverdue = nextService
            ? Math.ceil((new Date(nextService) - Date.now()) / 86_400_000) < 0
            : false;

        const parts = [];
        if (fuelPct != null) parts.push(`Fuel: ${fuelPct}%`);
        if (nextService) {
            parts.push(serviceOverdue
                ? `Service overdue · ${fmtDate(nextService)}`
                : `Service due ${fmtDate(nextService)}`);
        }

        alerts.push({
            id: `gen-${i}`,
            type: "generator",
            severity: critical || serviceOverdue ? "critical" : lowFuel ? "high" : "medium",
            icon: Zap,
            title: g.name ?? "Generator",
            sub: parts.join(" · ") || "Needs attention",
            meta: null,
            badge: critical ? "Critical" : serviceOverdue ? "Overdue" : lowFuel ? "Low fuel" : "Check",
            to: "/dashboard/generators",
            sortKey: 4,
        });
    });

    return alerts.sort((a, b) => a.sortKey - b.sortKey);
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
    { key: "all", label: "All" },
    { key: "rent", label: "Rent" },
    { key: "lease", label: "Leases" },
    { key: "maintenance", label: "Maintenance" },
    { key: "generator", label: "Generators" },
];

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ item }) {
    const sev = SEV[item.severity] ?? SEV.medium;
    const Icon = item.icon;

    return (
        <Link
            to={item.to}
            className="group relative flex items-start gap-3.5 px-4 py-3.5
                 transition-colors hover:bg-secondary/50
                 border-b border-border/40 last:border-0 overflow-hidden"
        >
            {/* Left severity strip */}
            <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: sev.strip }}
            />

            {/* Icon bubble */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 relative"
                style={{
                    background: sev.iconBg,
                    border: `1px solid ${sev.iconBorder}`,
                }}
            >
                <Icon className="w-3.5 h-3.5" style={{ color: sev.iconColor }} />
                {item.severity === "critical" && (
                    <span
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping opacity-75"
                        style={{ background: "var(--destructive)" }}
                    />
                )}
            </div>

            {/* Text block */}
            <div className="flex-1 min-w-0">
                {/* Line 1: title — WHO or WHAT */}
                <p className="text-xs font-semibold text-foreground truncate leading-relaxed">
                    {item.title}
                </p>

                {/* Line 2: sub — status + timing */}
                {item.sub && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1 leading-relaxed">
                        {item.sub}
                    </p>
                )}

                {/* Line 3: meta — WHERE (only if data exists) */}
                {item.meta && (
                    <p
                        className="text-[10px] truncate mt-1 leading-relaxed flex items-center gap-1"
                        style={{ color: "color-mix(in oklch, var(--color-muted-foreground) 60%, transparent)" }}
                    >
                        <Building2 className="w-2.5 h-2.5 shrink-0" />
                        {item.meta}
                    </p>
                )}
            </div>

            {/* Badge + chevron */}
            <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                {item.badge && (
                    <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap"
                        style={{
                            background: sev.badge.bg,
                            color: sev.badge.color,
                            borderColor: sev.badge.border,
                        }}
                    >
                        {item.badge}
                    </span>
                )}
                <ChevronRight
                    className="w-3 h-3 opacity-0 group-hover:opacity-40
                       group-hover:translate-x-0.5 transition-all text-muted-foreground"
                />
            </div>
        </Link>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PanelSkeleton() {
    return (
        <div className="divide-y divide-border/50">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg animate-pulse bg-secondary shrink-0" />
                    <div className="flex-1 space-y-1.5 py-0.5">
                        <div className="h-2.5 rounded animate-pulse bg-secondary w-3/4" />
                        <div className="h-2 rounded animate-pulse bg-muted w-1/2" />
                        <div className="h-2 rounded animate-pulse bg-muted w-2/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NeedsAttentionPanel({ stats, loading }) {
    const [activeFilter, setActiveFilter] = useState("all");

    const allAlerts = useMemo(() => buildAlerts(stats), [stats]);

    const filtered = useMemo(
        () => activeFilter === "all" ? allAlerts : allAlerts.filter((a) => a.type === activeFilter),
        [allAlerts, activeFilter]
    );

    const counts = useMemo(() => {
        const c = { all: allAlerts.length };
        allAlerts.forEach((a) => { c[a.type] = (c[a.type] ?? 0) + 1; });
        return c;
    }, [allAlerts]);

    const hasAlerts = allAlerts.length > 0;
    const criticalCount = allAlerts.filter((a) => a.severity === "critical").length;

    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col min-h-0 flex-1">

            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">Needs attention</span>
                    {!loading && hasAlerts && (
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                            style={{
                                background: criticalCount > 0
                                    ? "color-mix(in oklch, var(--destructive) 12%, transparent)"
                                    : "color-mix(in oklch, var(--warning) 12%, transparent)",
                                color: criticalCount > 0 ? "var(--destructive)" : "var(--warning)",
                                borderColor: criticalCount > 0
                                    ? "color-mix(in oklch, var(--destructive) 28%, transparent)"
                                    : "color-mix(in oklch, var(--warning) 28%, transparent)",
                            }}
                        >
                            {allAlerts.length}
                        </span>
                    )}
                </div>
                {hasAlerts && (
                    <Link
                        to="/rent-payment"
                        className="text-[11px] text-muted-foreground hover:text-foreground
                       transition-colors flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                    >
                        <span className="hidden sm:inline">View all</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            {/* ── Filter chips ── */}
            {!loading && hasAlerts && (
                <div className="px-4 py-2 flex items-center gap-1.5 flex-wrap border-b border-border/50 shrink-0">
                    {FILTERS.filter((f) => f.key === "all" || (counts[f.key] ?? 0) > 0).map((f) => {
                        const isActive = activeFilter === f.key;
                        return (
                            <button
                                key={f.key}
                                onClick={() => setActiveFilter(f.key)}
                                className="flex items-center gap-1 text-[10px] font-semibold
                             px-2 py-0.5 rounded-md border transition-colors"
                                style={{
                                    background: isActive ? "var(--primary)" : "transparent",
                                    color: isActive ? "var(--primary-foreground)" : "var(--color-muted-foreground)",
                                    borderColor: isActive ? "var(--primary)" : "var(--color-border)",
                                }}
                            >
                                {f.label}
                                {(counts[f.key] ?? 0) > 0 && (
                                    <span
                                        className="rounded-full px-1"
                                        style={{
                                            background: isActive
                                                ? "color-mix(in oklch, var(--primary-foreground) 20%, transparent)"
                                                : "var(--color-secondary)",
                                            color: isActive
                                                ? "var(--primary-foreground)"
                                                : "var(--color-muted-foreground)",
                                        }}
                                    >
                                        {counts[f.key]}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Alert list ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <PanelSkeleton />
                ) : !hasAlerts ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center px-4">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: "color-mix(in oklch, var(--success) 14%, transparent)" }}
                        >
                            <CheckCircle2 className="w-5 h-5" style={{ color: "var(--success)" }} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">All clear</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                No overdue rents, expiring leases,
                                <br />or open maintenance today.
                            </p>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-muted-foreground opacity-40" />
                        <p className="text-xs text-muted-foreground">No alerts in this category</p>
                    </div>
                ) : (
                    <div>
                        {filtered.map((item) => (
                            <AlertRow key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}