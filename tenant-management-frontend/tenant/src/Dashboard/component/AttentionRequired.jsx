// src/pages/component/AttentionRequired.jsx
//
// Unified risk panel — replaces MaintenaceCard + old AttentionRequired.
// Severity ranked: critical → high → medium → low.
//
// COLOR TOKENS — no hardcoded hex:
//   All surface/text/border colors reference CSS variables from index.css.
//   Status colors use the brand palette OKLCH values as named constants.

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle, Clock, Wrench, Zap, CheckCircle2,
    ChevronRight, CalendarClock, CircleDot,
} from "lucide-react";

// ─── Status tokens (semantic, accounting-style) ──────────────────────────────
// Critical / High / Medium / Low all based on semantic red / yellow / green.
// Backgrounds use soft "red-100 / amber-100 / green-100" style fills.
const STATUS = {
    critical: {
        dot: "var(--destructive)",        // red-700-ish
        bg: "color-mix(in oklch, var(--destructive) 14%, transparent)",   // red-100
        border: "color-mix(in oklch, var(--destructive) 35%, transparent)",
        label: "Critical",
        labelColor: "var(--destructive)",
    },
    high: {
        dot: "var(--warning)",            // amber-500
        bg: "color-mix(in oklch, var(--warning) 16%, transparent)",       // amber-100
        border: "color-mix(in oklch, var(--warning) 35%, transparent)",
        label: "High",
        labelColor: "var(--warning)",
    },
    medium: {
        dot: "var(--color-muted-foreground)",
        bg: "var(--color-secondary)",
        border: "var(--color-border)",
        label: "Medium",
        labelColor: "var(--color-muted-foreground)",
    },
    low: {
        dot: "var(--success)",            // green-600
        bg: "color-mix(in oklch, var(--success) 16%, transparent)",       // green-100
        border: "color-mix(in oklch, var(--success) 35%, transparent)",
        label: "Low",
        labelColor: "var(--success)",
    },
};

// ─── Item builders ────────────────────────────────────────────────────────────

function buildOverdueItems(overdueRents, overdueCount, overdueAmount) {
    if (!overdueCount || overdueCount === 0) return [];
    const fmtAmt = (n) => {
        if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
        if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
        return `₹${n}`;
    };
    const items = (overdueRents ?? []).slice(0, 3).map((r, i) => ({
        id: `overdue-${i}`,
        severity: "critical",
        icon: AlertTriangle,
        title: r.tenant?.name ?? "Tenant",
        sub: `Overdue${r.remainingPaisa ? ` · ${fmtAmt(r.remainingPaisa / 100)}` : ""}`,
        to: "/rent-payment",
        sortKey: 0,
    }));
    if (overdueCount > items.length) {
        items.push({
            id: "overdue-more",
            severity: "critical",
            icon: AlertTriangle,
            title: `${overdueCount} tenants overdue`,
            sub: overdueAmount > 0 ? `Total ${fmtAmt(overdueAmount)} outstanding` : "Review now",
            to: "/rent-payment",
            sortKey: 0,
            isSummary: true,
        });
    }
    return items;
}

function buildLeaseItems(contractsEndingSoon) {
    if (!Array.isArray(contractsEndingSoon) || contractsEndingSoon.length === 0) return [];
    return contractsEndingSoon.slice(0, 4).map((c, i) => {
        const days = c.daysUntilEnd ?? 999;
        const severity = days <= 7 ? "high" : "medium";
        const sub = days <= 0
            ? "Expired"
            : days === 1 ? "Expires tomorrow"
                : `Expires in ${days} days`;
        return {
            id: `lease-${i}`,
            severity,
            icon: CalendarClock,
            title: c.name ?? "Tenant",
            sub,
            to: "/tenant",
            sortKey: severity === "high" ? 1 : 2,
        };
    });
}

function buildMaintenanceItems(maintenanceList) {
    if (!Array.isArray(maintenanceList) || maintenanceList.length === 0) return [];
    const open = maintenanceList.filter(
        (m) => ["OPEN", "IN_PROGRESS"].includes((m.status ?? "").toUpperCase())
    );
    if (open.length === 0) return [];
    const shown = open.slice(0, 2).map((m, i) => ({
        id: `maint-${i}`,
        severity: "medium",
        icon: Wrench,
        title: m.title ?? "Maintenance request",
        sub: [m.property?.name, m.unit?.name].filter(Boolean).join(" · ") || "Open request",
        to: "/maintenance",
        sortKey: 3,
    }));
    if (open.length > 2) {
        shown.push({
            id: "maint-more",
            severity: "medium",
            icon: Wrench,
            title: `${open.length} open requests`,
            sub: "Maintenance queue",
            to: "/maintenance",
            sortKey: 3,
            isSummary: true,
        });
    }
    return shown;
}

function buildGeneratorItems(generatorsDueService) {
    if (!Array.isArray(generatorsDueService) || generatorsDueService.length === 0) return [];
    return generatorsDueService.slice(0, 2).map((g, i) => ({
        id: `gen-${i}`,
        severity: "low",
        icon: Zap,
        title: g.name ?? "Generator",
        sub: g.currentFuelPercent != null && g.currentFuelPercent <= 20
            ? `Fuel at ${g.currentFuelPercent}%`
            : "Service due",
        to: "/maintenance",
        sortKey: 4,
    }));
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, isLast }) {
    const sev = STATUS[item.severity] ?? STATUS.medium;
    const Icon = item.icon;

    return (
        <Link
            to={item.to}
            className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/60"
            style={{ borderBottom: isLast ? "none" : "1px solid var(--color-secondary)" }}
        >
            {/* Severity icon */}
            <div className="mt-0.5 shrink-0 relative">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
                >
                    <Icon className="w-3.5 h-3.5" style={{ color: sev.dot }} />
                </div>
                {/* Pulse dot — critical only */}
                {item.severity === "critical" && (
                    <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                        style={{ background: sev.dot }}
                    />
                )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <p
                    className="text-xs font-semibold leading-tight truncate"
                    style={{ color: item.isSummary ? sev.dot : "var(--color-foreground)" }}
                >
                    {item.title}
                </p>
                <p className="text-[10px] mt-0.5 leading-tight truncate text-muted-foreground">
                    {item.sub}
                </p>
            </div>

            {/* Chevron */}
            <ChevronRight
                className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover:opacity-100
                   group-hover:translate-x-0.5 transition-all text-muted-foreground"
            />
        </Link>
    );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, color, count }) {
    return (
        <div
            className="flex items-center justify-between px-4 py-1.5 border-b"
            style={{
                background: "var(--color-muted)",
                borderColor: "var(--color-secondary)",
            }}
        >
            <span
                className="text-[9px] font-bold tracking-[0.2em] uppercase"
                style={{ color }}
            >
                {label}
            </span>
            {count > 1 && (
                <span
                    className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                    style={{ background: color + "20", color }}
                >
                    {count}
                </span>
            )}
        </div>
    );
}

// ─── All-clear state ──────────────────────────────────────────────────────────

function AllClear() {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                    background: "oklch(0.91 0.04 152 / 50%)",
                    border: "1px solid oklch(0.48 0.10 152 / 30%)",
                }}
            >
                <CheckCircle2 className="w-6 h-6" style={{ color: "oklch(0.48 0.10 152)" }} />
            </div>
            <div>
                <p className="text-sm font-bold text-foreground">All clear</p>
                <p className="text-[11px] mt-1 text-muted-foreground">
                    No overdue rents, maintenance issues,
                    <br />
                    or expiring leases right now.
                </p>
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/60">
                Checked at {timeStr}
            </p>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
    return (
        <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg animate-pulse bg-secondary" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 rounded animate-pulse w-2/3 bg-secondary" />
                        <div className="h-2 rounded animate-pulse w-1/2 bg-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AttentionRequired({ stats, loading }) {
    const items = useMemo(() => {
        if (!stats) return [];
        const attention = stats.attention ?? {};
        return [
            ...buildOverdueItems(
                stats.overdueRents,
                attention.overdueCount ?? 0,
                attention.overdueAmount ?? 0,
            ),
            ...buildLeaseItems(stats.contractsEndingSoon),
            ...buildMaintenanceItems(stats.maintenance),
            ...buildGeneratorItems(stats.generatorsDueService),
        ].sort((a, b) => a.sortKey - b.sortKey);
    }, [stats]);

    const groups = useMemo(() => {
        const order = ["critical", "high", "medium", "low"];
        const map = {};
        items.forEach((item) => {
            if (!map[item.severity]) map[item.severity] = [];
            map[item.severity].push(item);
        });
        return order
            .filter((s) => map[s]?.length)
            .map((s) => ({ severity: s, items: map[s], ...STATUS[s] }));
    }, [items]);

    const totalCount = items.length;

    return (
        <div className="rounded-2xl border border-border overflow-hidden h-full flex flex-col bg-card">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-secondary">
                <div className="flex items-center gap-2">
                    <CircleDot
                        className="w-3.5 h-3.5"
                        style={{
                            color: totalCount > 0 ? "var(--destructive)" : "var(--success)",
                        }}
                    />
                    <span className="text-sm font-bold text-foreground">Needs Attention</span>
                </div>

                {!loading && totalCount > 0 && (
                    <span
                        className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                        style={{
                            background: "color-mix(in oklch, var(--destructive) 16%, transparent)",
                            color: "var(--destructive)",
                        }}
                    >
                        {totalCount} item{totalCount !== 1 ? "s" : ""}
                    </span>
                )}
                {!loading && totalCount === 0 && (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                            background: "color-mix(in oklch, var(--success) 16%, transparent)",
                            color: "var(--success)",
                        }}
                    >
                        All clear
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: "420px" }}>
                {loading ? (
                    <Skeleton />
                ) : totalCount === 0 ? (
                    <AllClear />
                ) : (
                    groups.map((group) =>
                        group.items.map((item, i) => {
                            const isFirstInGroup = i === 0;
                            const isLastInGroup = i === group.items.length - 1;
                            const isLastGroup = group === groups[groups.length - 1];
                            return (
                                <React.Fragment key={item.id}>
                                    {isFirstInGroup && (
                                        <SectionLabel label={group.label} color={group.dot} count={group.items.length} />
                                    )}
                                    <ItemRow item={item} isLast={isLastInGroup && isLastGroup} />
                                </React.Fragment>
                            );
                        })
                    )
                )}
            </div>

            {/* Footer quick-links */}
            {!loading && totalCount > 0 && (
                <div className="flex items-center gap-0 border-t border-secondary">
                    {[
                        { label: "Payments", to: "/rent-payment" },
                        { label: "Maintenance", to: "/maintenance" },
                        { label: "Tenants", to: "/tenant" },
                    ].map(({ label, to }, i, arr) => (
                        <Link
                            key={to}
                            to={to}
                            className="flex-1 flex items-center justify-center py-2.5
                         text-[10px] font-semibold tracking-wide uppercase
                         transition-colors hover:bg-secondary text-muted-foreground
                         hover:text-primary"
                            style={{
                                borderRight: i < arr.length - 1 ? "1px solid var(--color-secondary)" : "none",
                            }}
                        >
                            {label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}