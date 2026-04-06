import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Circle } from "lucide-react";

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
                    {completionRate}%
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5">Complete</span>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BuildingHealthPanel({ stats, loading }) {
    const isLoading = loading && !stats?.safety;
    const safety = stats?.safety ?? {
        completionRate: 0,
        completed: 0,
        total: 0,
        pending: 0,
        issues: 0,
    };
    const completionRate = Number.isFinite(safety.completionRate) ? safety.completionRate : 0;
    const completed = Number.isFinite(safety.completed) ? safety.completed : 0;
    const total = Number.isFinite(safety.total) ? safety.total : 0;
    const pending = Number.isFinite(safety.pending) ? safety.pending : 0;
    const issues = Number.isFinite(safety.issues) ? safety.issues : 0;
    const trend = stats?.safety?.trend ?? [];

    return (
        <div className="bg-card dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-border">
                <h3 className="text-sm font-medium text-foreground">Safety Compliance</h3>
                <Link
                    to="/admin-daily-checks"
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                    View All
                    <ChevronRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Health Visualization */}
            <div className={`flex flex-col items-center px-5 py-6 gap-4 ${isLoading ? "opacity-60" : ""}`}>
                <HealthRing completionRate={completionRate} size={100} />

                <div className="w-full space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Checks Completed</span>
                        <span className="font-semibold text-foreground">
                            {completed} / {total}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Pending Categories</span>
                        <span className="font-semibold text-foreground">{pending}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Issues Found</span>
                        <span className="font-semibold text-foreground">{issues}</span>
                    </div>
                </div>
                <div className="w-full mt-2 space-y-1">
                    <div className="flex items-end justify-between gap-1 px-1">
                        {trend.map((day, i) => {
                            const noData = !day || day.rate === null;
                            const isToday = i === 6;
                            const color = noData
                                ? 'var(--color-border)'
                                : day.hasIssues
                                    ? 'var(--warning)'
                                    : day.rate === 100
                                        ? 'var(--success)'
                                        : day.rate > 0
                                            ? 'var(--warning)'
                                            : 'var(--destructive)';
                            // Bar height proportional to completion rate, min 4px for visibility
                            const height = noData ? 4 : Math.max(4, Math.round((day.rate / 100) * 28));
                            return (
                                <div
                                    key={day?.date ?? i}
                                    title={noData ? `${day?.date ?? `D-${6 - i}`}: No data` : `${day.date}: ${day.rate}%`}
                                    className="flex-1 rounded-sm transition-all duration-300 cursor-default"
                                    style={{
                                        height: `${height}px`,
                                        backgroundColor: color,
                                        opacity: noData ? 0.25 : 1,
                                        outline: isToday ? `2px solid ${color}` : 'none',
                                        outlineOffset: '1px',
                                    }}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between px-1">
                        <span className="text-[8px] text-muted-foreground">6d ago</span>
                        <span className="text-[8px] text-muted-foreground font-medium">Today</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
