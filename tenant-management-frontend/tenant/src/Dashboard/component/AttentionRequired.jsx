// src/pages/component/NeedsAttention.jsx
//
// REPLACES: MaintenaceCard + AttentionRequired (two separate panels)
//
// DESIGN RATIONALE:
// The owner's first question on opening the dashboard is "do I have problems?"
// Previously this required reading two separate cards in two different layout
// positions — attention items below the chart row, maintenance beside it.
// That forced the owner to mentally merge them.
//
// This component unifies ALL risk signals into one ranked panel that sits
// beside the Revenue Trend chart. Severity order matches what actually costs
// money or time if ignored:
//
//   1. CRITICAL  — overdue rent       (money already lost)
//   2. HIGH      — leases expiring ≤7d (imminent revenue risk)
//   3. MEDIUM    — leases expiring ≤30d (near-term revenue risk)
//   4. MEDIUM    — open maintenance    (operational + liability)
//   5. LOW       — generators due      (operational)
//   6. LOW       — upcoming maintenance (scheduled, not urgent)
//
// When nothing needs attention, the panel earns its space by showing a
// genuine all-clear with the date of the last check — not just a zero.
//
// DISPLAY ONLY — receives pre-normalized stats from useStats().

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle, Clock, Wrench, Zap, CheckCircle2,
    ChevronRight, CalendarClock, CircleDot,
} from "lucide-react";

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV = {
    critical: { dot: "#B02020", bg: "#FDF2F2", border: "#F0CBCB", label: "Critical", labelColor: "#B02020" },
    high: { dot: "#C4721A", bg: "#FEF6ED", border: "#F5DDB8", label: "High", labelColor: "#C4721A" },
    medium: { dot: "#7A6858", bg: "#F8F5F2", border: "#E8E0D8", label: "Medium", labelColor: "#7A6858" },
    low: { dot: "#4A7A5A", bg: "#F2FAF5", border: "#C3E8CF", label: "Low", labelColor: "#4A7A5A" },
};

// ─── Item builders — pure functions, no JSX ───────────────────────────────────
//
// Each builder returns an array of { id, severity, icon, title, sub, to }
// objects. The renderer maps over the merged + sorted list.

function buildOverdueItems(overdueRents, overdueCount, overdueAmount) {
    if (!overdueCount || overdueCount === 0) return [];

    const fmtAmt = (n) => {
        if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
        if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
        return `₹${n}`;
    };

    // Show individual overdue tenants (up to 3 from the sample), then a "+N more"
    const items = (overdueRents ?? []).slice(0, 3).map((r, i) => ({
        id: `overdue-${i}`,
        severity: "critical",
        icon: AlertTriangle,
        title: r.tenant?.name ?? "Tenant",
        sub: `Overdue${r.remainingPaisa ? ` · ${fmtAmt(r.remainingPaisa / 100)}` : ""}`,
        to: "/rent-payment",
        sortKey: 0,
    }));

    // If there are more overdue tenants than the 3-item sample, add a summary row
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
            : days === 1
                ? "Expires tomorrow"
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

    // Show up to 2 individual items, then a summary if more exist
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
    const sev = SEV[item.severity] ?? SEV.medium;
    const Icon = item.icon;

    return (
        <Link
            to={item.to}
            className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
            style={{ borderBottom: isLast ? "none" : "1px solid #F0EBE8" }}
        >
            {/* Severity dot + icon */}
            <div className="mt-0.5 shrink-0 relative">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
                >
                    <Icon className="w-3.5 h-3.5" style={{ color: sev.dot }} />
                </div>
                {/* Pulse only for critical */}
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
                    style={{ color: item.isSummary ? sev.dot : "#1C1A18" }}
                >
                    {item.title}
                </p>
                <p className="text-[10px] mt-0.5 leading-tight truncate" style={{ color: "#948472" }}>
                    {item.sub}
                </p>
            </div>

            {/* Chevron */}
            <ChevronRight
                className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                style={{ color: "#C8BDB6" }}
            />
        </Link>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ label, color, count }) {
    return (
        <div
            className="flex items-center justify-between px-4 py-1.5"
            style={{ background: "#F8F5F2", borderBottom: "1px solid #F0EBE8" }}
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

// ─── All clear state ──────────────────────────────────────────────────────────

function AllClear() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "#F0FAF3", border: "1px solid #C3E8CF" }}
            >
                <CheckCircle2 className="w-6 h-6" style={{ color: "#2E7A4A" }} />
            </div>
            <div>
                <p className="text-sm font-bold" style={{ color: "#1C1A18" }}>
                    All clear
                </p>
                <p className="text-[11px] mt-1" style={{ color: "#948472" }}>
                    No overdue rents, maintenance issues,
                    <br />
                    or expiring leases right now.
                </p>
            </div>
            <p className="text-[10px] font-semibold" style={{ color: "#C8BDB6" }}>
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
                    <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: "#EEE9E5" }} />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 rounded animate-pulse w-2/3" style={{ background: "#EEE9E5" }} />
                        <div className="h-2 rounded animate-pulse w-1/2" style={{ background: "#F0EBE8" }} />
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

    // Group by severity label for section headers
    const groups = useMemo(() => {
        const order = ["critical", "high", "medium", "low"];
        const map = {};
        items.forEach((item) => {
            if (!map[item.severity]) map[item.severity] = [];
            map[item.severity].push(item);
        });
        return order.filter((s) => map[s]?.length).map((s) => ({
            severity: s,
            items: map[s],
            ...SEV[s],
        }));
    }, [items]);

    const totalCount = items.length;

    return (
        <div
            className="rounded-2xl border overflow-hidden h-full flex flex-col"
            style={{ background: "#FDFCFA", borderColor: "#DDD6D0" }}
        >
            {/* ── Panel header ── */}
            <div
                className="flex items-center justify-between px-4 py-3.5 border-b"
                style={{ borderColor: "#EEE9E5" }}
            >
                <div className="flex items-center gap-2">
                    <CircleDot
                        className="w-3.5 h-3.5"
                        style={{ color: totalCount > 0 ? "#B02020" : "#2E7A4A" }}
                    />
                    <span className="text-sm font-bold" style={{ color: "#1C1A18" }}>
                        Needs Attention
                    </span>
                </div>

                {/* Live count badge */}
                {!loading && totalCount > 0 && (
                    <span
                        className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                        style={{ background: "#F5D5D5", color: "#B02020" }}
                    >
                        {totalCount} item{totalCount !== 1 ? "s" : ""}
                    </span>
                )}
                {!loading && totalCount === 0 && (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#D4EDE0", color: "#2E7A4A" }}
                    >
                        All clear
                    </span>
                )}
            </div>

            {/* ── Body ── */}
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
                                    {/* Section label at start of each severity group */}
                                    {isFirstInGroup && (
                                        <SectionLabel
                                            label={group.label}
                                            color={group.dot}
                                            count={group.items.length}
                                        />
                                    )}
                                    <ItemRow
                                        item={item}
                                        isLast={isLastInGroup && isLastGroup}
                                    />
                                </React.Fragment>
                            );
                        })
                    )
                )}
            </div>

            {/* ── Footer — links to full views ── */}
            {!loading && totalCount > 0 && (
                <div
                    className="flex items-center gap-0 border-t"
                    style={{ borderColor: "#EEE9E5" }}
                >
                    {[
                        { label: "Payments", to: "/rent-payment" },
                        { label: "Maintenance", to: "/maintenance" },
                        { label: "Tenants", to: "/tenant" },
                    ].map(({ label, to }, i, arr) => (
                        <Link
                            key={to}
                            to={to}
                            className="flex-1 flex items-center justify-center py-2.5 text-[10px]
                font-semibold tracking-wide uppercase transition-colors hover:bg-[#F8F5F2]"
                            style={{
                                color: "#948472",
                                borderRight: i < arr.length - 1 ? "1px solid #EEE9E5" : "none",
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