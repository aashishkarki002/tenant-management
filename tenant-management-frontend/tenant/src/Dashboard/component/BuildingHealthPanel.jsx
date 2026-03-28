import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle, Clock, Wrench, Zap, CheckCircle2,
    ChevronRight, CalendarClock, CircleDot, Camera,
    Building2, Shield, TrendingUp, TrendingDown,
} from 'lucide-react';
import api from '../../../plugins/axios';

// ─── Status tokens ────────────────────────────────────────────────────────────
const STATUS = {
    critical: {
        dot: "var(--destructive)",
        bg: "color-mix(in oklch, var(--destructive) 14%, transparent)",
        border: "color-mix(in oklch, var(--destructive) 35%, transparent)",
        label: "Critical",
        labelColor: "var(--destructive)",
    },
    high: {
        dot: "var(--warning)",
        bg: "color-mix(in oklch, var(--warning) 16%, transparent)",
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
        dot: "var(--success)",
        bg: "color-mix(in oklch, var(--success) 16%, transparent)",
        border: "color-mix(in oklch, var(--success) 35%, transparent)",
        label: "Low",
        labelColor: "var(--success)",
    },
};

// ─── Daily Checks Categories ──────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'CCTV', label: 'CCTV', Icon: Camera },
    { key: 'ELECTRICAL', label: 'Electrical', Icon: Zap },
    { key: 'SANITARY', label: 'Sanitary', Icon: AlertTriangle },
    { key: 'COMMON_AREA', label: 'Common Area', Icon: Building2 },
    { key: 'PARKING', label: 'Parking', Icon: Building2 },
    { key: 'FIRE', label: 'Fire & Safety', Icon: Shield },
    { key: 'WATER_TANK', label: 'Water Tank', Icon: Building2 },
];

// ─── Helper: Calculate pass rate ─────────────────────────────────────────────
const pRate = c => (!c?.totalItems ? 0 : Math.round((c.passedItems / c.totalItems) * 100));

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

// ─── Building Health Progress Ring ───────────────────────────────────────────
function HealthRing({ completionRate = 0, size = 120 }) {
    const strokeWidth = 8;
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const fillAmount = Math.max(0, Math.min(1, completionRate / 100)) * circumference;

    const color = completionRate === 100
        ? 'var(--success)'
        : completionRate >= 70
            ? 'var(--warning)'
            : 'var(--destructive)';

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--color-muted)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${fillAmount} ${circumference - fillAmount}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color }}>
                    {Math.round(completionRate)}%
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5">Complete</span>
            </div>
        </div>
    );
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
            <div className="mt-0.5 shrink-0 relative">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
                >
                    <Icon className="w-3.5 h-3.5" style={{ color: sev.dot }} />
                </div>
                {item.severity === "critical" && (
                    <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                        style={{ background: sev.dot }}
                    />
                )}
            </div>

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
export default function BuildingHealthPanel({ stats, loading }) {
    const [dailyCheckData, setDailyCheckData] = useState([]);
    const [checksLoading, setChecksLoading] = useState(true);

    // Fetch daily checks completion status
    useEffect(() => {
        const fetchDailyChecks = async () => {
            setChecksLoading(true);
            try {
                const results = await Promise.allSettled(
                    CATEGORIES.map(cat =>
                        api.get('/api/checklists/results', {
                            params: { category: cat.key, limit: 1, page: 1 },
                        })
                    )
                );

                const data = CATEGORIES.map((cat, i) => {
                    const r = results[i];
                    return {
                        catKey: cat.key,
                        checklist: r.status === 'fulfilled' ? (r.value?.data?.data?.[0] || null) : null,
                    };
                });
                setDailyCheckData(data);
            } catch (error) {
                console.error('Failed to fetch daily checks:', error);
            } finally {
                setChecksLoading(false);
            }
        };

        fetchDailyChecks();
    }, []);

    // Calculate overall building health
    const buildingHealth = useMemo(() => {
        if (checksLoading || dailyCheckData.length === 0) return { rate: 0, completed: 0, total: CATEGORIES.length };

        const completedChecks = dailyCheckData.filter(d => d.checklist && d.checklist.status === 'COMPLETED');
        const avgPassRate = completedChecks.length > 0
            ? completedChecks.reduce((sum, d) => sum + pRate(d.checklist), 0) / completedChecks.length
            : 0;

        const completionRate = (completedChecks.length / CATEGORIES.length) * 100;

        // Combine completion rate and pass rate for overall health
        const overallHealth = (completionRate * 0.6) + (avgPassRate * 0.4);

        return {
            rate: Math.round(overallHealth),
            completed: completedChecks.length,
            total: CATEGORIES.length,
            avgPassRate: Math.round(avgPassRate),
        };
    }, [dailyCheckData, checksLoading]);

    // Build attention items
    const attentionItems = useMemo(() => {
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
        attentionItems.forEach((item) => {
            if (!map[item.severity]) map[item.severity] = [];
            map[item.severity].push(item);
        });
        return order
            .filter((s) => map[s]?.length)
            .map((s) => ({ severity: s, items: map[s], ...STATUS[s] }));
    }, [attentionItems]);

    const totalCount = attentionItems.length;

    return (
        <div className="rounded-2xl border border-border overflow-hidden h-full flex flex-col bg-card">

            {/* Building Health Status Section */}
            <div className="px-4 py-4 border-b border-secondary">
                <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-bold text-foreground">Building Health</span>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <HealthRing completionRate={buildingHealth.rate} size={100} />

                    <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Daily Checks</span>
                            <span className="font-semibold text-foreground">
                                {buildingHealth.completed} / {buildingHealth.total}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Avg Pass Rate</span>
                            <span className="font-semibold" style={{
                                color: buildingHealth.avgPassRate === 100
                                    ? 'var(--success)'
                                    : buildingHealth.avgPassRate >= 70
                                        ? 'var(--warning)'
                                        : 'var(--destructive)'
                            }}>
                                {buildingHealth.avgPassRate}%
                            </span>
                        </div>
                    </div>

                    <Link
                        to="/admin-daily-checks"
                        className="w-full mt-2 py-2 px-3 rounded-lg text-xs font-semibold 
                                 bg-primary/10 text-primary hover:bg-primary/20 
                                 transition-colors flex items-center justify-center gap-2"
                    >
                        View All Checks
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>






        </div>
    );
}
