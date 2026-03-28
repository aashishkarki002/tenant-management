// src/pages/component/AttentionBanner.tsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Wrench, CalendarClock, Zap, ArrowRight } from "lucide-react";



function buildChips(stats) {
    if (!stats) return [];
    const chips = [];

    // 1. Overdue rent — critical
    const overdueCount = stats.attention?.overdueCount ?? 0;
    if (overdueCount > 0) {
        chips.push({
            label: `${overdueCount} overdue rent${overdueCount !== 1 ? "s" : ""}`,
            to: "/rent-payment",
            severity: "critical",
            icon: AlertTriangle,
        });
    }

    // 2. Leases ending ≤ 14 days — high
    const leases = Array.isArray(stats.contractsEndingSoon)
        ? stats.contractsEndingSoon.filter((c) => (c.daysUntilEnd ?? 999) <= 14)
        : [];
    if (leases.length > 0) {
        const urgent = leases.filter((c) => c.daysUntilEnd <= 7).length;
        chips.push({
            label: urgent > 0
                ? `${urgent} lease${urgent !== 1 ? "s" : ""} expiring this week`
                : `${leases.length} lease${leases.length !== 1 ? "s" : ""} ending soon`,
            to: "/tenant",
            severity: urgent > 0 ? "high" : "medium",
            icon: CalendarClock,
        });
    }

    // 3. Open maintenance
    const openMaint = Array.isArray(stats.maintenance)
        ? stats.maintenance.filter((m) =>
            ["OPEN", "IN_PROGRESS"].includes((m.status ?? "").toUpperCase())
        ).length
        : 0;
    if (openMaint > 0) {
        chips.push({
            label: `${openMaint} maintenance open`,
            to: "/maintenance",
            severity: "medium",
            icon: Wrench,
        });
    }

    // 4. Generator alerts
    const genAlerts = Array.isArray(stats.generatorsDueService)
        ? stats.generatorsDueService.length
        : 0;
    if (genAlerts > 0) {
        chips.push({
            label: `${genAlerts} generator alert${genAlerts !== 1 ? "s" : ""}`,
            to: "/maintenance",
            severity: "medium",
            icon: Zap,
        });
    }

    return chips;
}

const SEV_STYLES = {
    critical: {
        chip: {
            bg: "color-mix(in oklch, var(--destructive) 12%, transparent)",
            border: "color-mix(in oklch, var(--destructive) 30%, transparent)",
            color: "var(--destructive)",
        },
        dot: "var(--destructive)",
    },
    high: {
        chip: {
            bg: "color-mix(in oklch, var(--warning) 14%, transparent)",
            border: "color-mix(in oklch, var(--warning) 30%, transparent)",
            color: "var(--warning)",
        },
        dot: "var(--warning)",
    },
    medium: {
        chip: {
            bg: "var(--color-secondary)",
            border: "var(--color-border)",
            color: "var(--color-muted-foreground)",
        },
        dot: "var(--color-muted-foreground)",
    },
};

export default function AttentionBanner({ stats, loading }) {
    const chips = useMemo(() => buildChips(stats), [stats]);

    if (loading || chips.length === 0) return null;

    // Banner severity = worst chip
    const topSeverity = chips.some((c) => c.severity === "critical")
        ? "critical"
        : chips.some((c) => c.severity === "high")
            ? "high"
            : "medium";

    const bannerStyle = SEV_STYLES[topSeverity];

    return (
        <div
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 flex-wrap"
            style={{
                background: bannerStyle.chip.bg,
                border: `1px solid ${bannerStyle.chip.border}`,
            }}
        >
            {/* Pulsing dot */}
            <div className="relative shrink-0 flex items-center">
                {topSeverity === "critical" && (
                    <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping"
                        style={{ background: bannerStyle.dot }}
                    />
                )}
                <span
                    className="relative inline-flex w-2 h-2 rounded-full"
                    style={{ background: bannerStyle.dot }}
                />
            </div>

            {/* Chips — one per issue type, each links independently */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
                {chips.map((chip, i) => {
                    const s = SEV_STYLES[chip.severity];
                    const Icon = chip.icon;
                    return (
                        <Link
                            key={i}
                            to={chip.to}
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1
                         text-xs font-semibold transition-opacity hover:opacity-80"
                            style={{
                                background: s.chip.bg,
                                border: `1px solid ${s.chip.border}`,
                                color: s.chip.color,
                            }}
                        >
                            <Icon className="w-3 h-3 shrink-0" />
                            {chip.label}
                        </Link>
                    );
                })}
            </div>

            {/* Dismiss / review CTA */}
            <Link
                to="/rent-payment"
                className="flex items-center gap-1 ml-auto shrink-0
                   text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: bannerStyle.dot }}
            >
                Review all
                <ArrowRight className="w-3 h-3" />
            </Link>
        </div>
    );
}