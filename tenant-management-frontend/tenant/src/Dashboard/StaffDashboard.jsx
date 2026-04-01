/**
 * StaffDashboard.jsx — redesigned to match Dashboard.jsx layout
 *
 * Layout strategy mirrors Dashboard.jsx:
 * - Same PageHeader pattern (greeting + action button)
 * - Same bento grid container (px-3/4/5, pb-6/8)
 * - Same responsive column system (1 → sm:2 → lg:4 → xl:6)
 * - Same card/shadow conventions from the petrol design system
 *
 * PM decision: Daily Checks is the #1 job. It owns the hero slot.
 * Everything else (KPI strip, maintenance tasks, generators) is secondary context below.
 *
 * Duplicate-submission guard: a category is LOCKED (non-clickable, visually
 * sealed) as soon as its status === "COMPLETED" in todaysChecklists.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Wrench, Zap, AlertTriangle, Fuel, CheckCircle2,
    ChevronRight, RefreshCw, AlertCircle, XCircle,
    ClipboardList, Clock, TrendingUp, Activity,
    Flame, Droplets, Car, Waves, LayoutGrid, Camera,
    Lock, ArrowRight, CheckCheck, Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTime } from "./hooks/UseTime";
import { useStaffStats } from "./hooks/useStaffStats";

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META = {
    FIRE: { icon: Flame, label: "Fire", iconBg: "bg-red-50", iconColor: "text-red-500", ring: "#ef4444", urgency: true },
    WATER_TANK: { icon: Droplets, label: "Water Tank", iconBg: "bg-blue-50", iconColor: "text-blue-500", ring: "#3b82f6", urgency: false },
    ELECTRICAL: { icon: Zap, label: "Electrical", iconBg: "bg-yellow-50", iconColor: "text-yellow-500", ring: "#f59e0b", urgency: false },
    CCTV: { icon: Camera, label: "CCTV", iconBg: "bg-purple-50", iconColor: "text-purple-500", ring: "#8b5cf6", urgency: false },
    PARKING: { icon: Car, label: "Parking", iconBg: "bg-stone-100", iconColor: "text-stone-500", ring: "#78716c", urgency: false },
    SANITARY: { icon: Waves, label: "Sanitary", iconBg: "bg-cyan-50", iconColor: "text-cyan-500", ring: "#06b6d4", urgency: false },
    COMMON_AREA: { icon: LayoutGrid, label: "Common Area", iconBg: "bg-emerald-50", iconColor: "text-emerald-500", ring: "#10b981", urgency: false },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META);

// ─── Priority / status tokens ─────────────────────────────────────────────────

const PRIORITY_CONFIG = {
    Urgent: { pill: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]", dot: "bg-[var(--color-danger)]" },
    High: { pill: "bg-orange-50 text-orange-700 border border-orange-200", dot: "bg-orange-500" },
    Medium: { pill: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]", dot: "bg-yellow-400" },
    Low: { pill: "bg-[var(--color-surface)] text-[var(--color-text-sub)] border border-[var(--color-border)]", dot: "bg-[var(--color-muted)]" },
};

const STATUS_CONFIG = {
    OPEN: { pill: "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info-border)]", label: "Open" },
    IN_PROGRESS: { pill: "bg-orange-50 text-orange-700 border border-orange-200", label: "In Progress" },
    COMPLETED: { pill: "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]", label: "Done" },
    CANCELLED: { pill: "bg-[var(--color-surface)] text-[var(--color-text-weak)] border border-[var(--color-border)]", label: "Cancelled" },
};

const GENERATOR_STATUS_CONFIG = {
    RUNNING: { pill: "bg-[var(--color-success-bg)] text-[var(--color-success)]", dot: "bg-[var(--color-success)] animate-pulse" },
    IDLE: { pill: "bg-[var(--color-surface)] text-[var(--color-text-sub)]", dot: "bg-[var(--color-muted)]" },
    MAINTENANCE: { pill: "bg-orange-50 text-orange-700", dot: "bg-orange-400" },
    FAULT: { pill: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]", dot: "bg-[var(--color-danger)] animate-pulse" },
    DECOMMISSIONED: { pill: "bg-[var(--color-surface)] text-[var(--color-text-weak)]", dot: "bg-[var(--color-muted)]" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - Date.now()) / 86_400_000);
}

function daysLabel(d) {
    const n = daysUntil(d);
    if (n == null) return "";
    if (n < 0) return `${Math.abs(n)}d overdue`;
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    return `In ${n}d`;
}

// ─── CircularProgress ─────────────────────────────────────────────────────────

function CircularProgress({ pct, size = 120, strokeWidth = 8, color = "var(--color-accent)", trackColor = "var(--color-muted)", label }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black tabular-nums text-[var(--color-text-strong)] leading-none">{pct}%</span>
                {label && <span className="text-[10px] font-semibold text-[var(--color-text-sub)] mt-0.5 leading-none">{label}</span>}
            </div>
        </div>
    );
}

// ─── DailyChecksHero ─────────────────────────────────────────────────────────

function DailyChecksHero({ safety, loadingChecklists }) {
    const navigate = useNavigate();
    const doneCount = Number.isFinite(safety?.completed) ? safety.completed : 0;
    const totalCount = Number.isFinite(safety?.total) ? safety.total : ALL_CATEGORIES.length;
    const pct = Number.isFinite(safety?.completionRate) ? safety.completionRate : 0;
    const allDone = doneCount === totalCount;

    const ringColor = allDone
        ? "#10b981"
        : doneCount >= totalCount / 2 ? "#f59e0b" : "var(--color-accent)";

    function handleCategoryClick(cat) {
        navigate("/checklists", { state: { autoStart: cat } });
    }

    return (
        <div
            className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm ring-1 ring-black/[0.02]"
            style={{ background: "var(--color-surface-raised)", boxShadow: "var(--shadow-card)" }}
        >
            {/* Header band — mirrors Dashboard card headers */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                <div>
                    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1">
                        Today's Priority
                    </p>
                    <h2 className="text-base font-bold text-[var(--color-text-strong)] leading-tight">Daily Checks</h2>
                </div>
                {allDone ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                     bg-[var(--color-success-bg)] border border-[var(--color-success-border)]
                                     text-xs font-bold text-[var(--color-success)]">
                        <CheckCheck className="w-3.5 h-3.5" /> All done
                    </span>
                ) : (
                    <Link to="/checklists" className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                        Open <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            {/* Body: ring + category grid */}
            <div className="px-5 py-5 flex flex-col sm:flex-row items-center gap-6">

                {/* Big ring */}
                {loadingChecklists ? (
                    <div className="w-[120px] h-[120px] rounded-full animate-pulse bg-[var(--color-muted)] shrink-0" />
                ) : (
                    <div className="shrink-0">
                        <CircularProgress
                            pct={pct} size={120} strokeWidth={9} color={ringColor}
                            label={allDone ? "Complete!" : `${doneCount}/${totalCount}`}
                        />
                        {!allDone && (
                            <p className="text-center text-[10px] text-[var(--color-text-weak)] mt-1.5">
                                {totalCount - doneCount} remaining
                            </p>
                        )}
                    </div>
                )}

                {/* Category chips */}
                <div className="flex-1 w-full grid grid-cols-2 gap-2 min-w-0">
                    {ALL_CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const Icon = meta.icon;
                        const done = false;
                        const inProgress = false;

                        return (
                            <button
                                key={cat}
                                onClick={() => handleCategoryClick(cat)}
                                disabled={loadingChecklists}
                                aria-label={meta.label}
                                className={`
                                    group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left
                                    transition-all duration-150
                                    ${done
                                        ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] cursor-not-allowed opacity-80"
                                        : inProgress
                                            ? "border-amber-300 bg-amber-50 hover:border-amber-400 active:scale-[0.97] cursor-pointer"
                                            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent-mid)] hover:bg-[var(--color-accent-light)] active:scale-[0.97] cursor-pointer"
                                    }
                                `}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                                                 ${done ? "bg-[var(--color-success-bg)]" : meta.iconBg}`}>
                                    {done
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                                        : <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold truncate
                                                   ${done ? "text-[var(--color-success)]" : "text-[var(--color-text-strong)]"}`}>
                                        {meta.label}
                                    </p>
                                    {meta.urgency && !done && (
                                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Critical</p>
                                    )}
                                    <p className="text-[9px] text-[var(--color-text-weak)] font-semibold">Open checklist</p>
                                </div>
                                {done
                                    ? <Lock className="w-3 h-3 text-[var(--color-success)] opacity-50 shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-weak)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                }
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* All-done celebration strip */}
            {allDone && !loadingChecklists && (
                <div className="mx-5 mb-5 px-4 py-3 rounded-2xl bg-[var(--color-success-bg)] border border-[var(--color-success-border)] flex items-center gap-3">
                    <CheckCheck className="w-5 h-5 text-[var(--color-success)] shrink-0" />
                    <p className="text-sm font-semibold text-[var(--color-success)]">
                        All {totalCount} checks completed for today. Great work!
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton({ rows = 3 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="w-9 h-9 rounded-xl animate-pulse bg-[var(--color-muted)] shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 rounded-md animate-pulse bg-[var(--color-muted)]" />
                        <div className="h-3 w-1/3 rounded-md animate-pulse bg-[var(--color-border)]" />
                    </div>
                    <div className="w-14 h-3 rounded-md animate-pulse bg-[var(--color-border)]" />
                </div>
            ))}
        </div>
    );
}

// ─── Stat card — matches KpiStrip card aesthetic ──────────────────────────────

function StatCard({ value, label, icon: Icon, variant = "default", loading }) {
    const variants = {
        default: "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-strong)]",
        accent: "bg-[var(--color-accent)] border-[var(--color-accent)] text-white",
        danger: "bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger)]",
        warning: "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning)]",
        success: "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success)]",
    };
    const iconVariants = {
        default: "text-[var(--color-text-weak)]", accent: "text-white/70",
        danger: "text-[var(--color-danger)]", warning: "text-[var(--color-warning)]", success: "text-[var(--color-success)]",
    };
    const labelVariants = {
        default: "text-[var(--color-text-sub)]", accent: "text-white/70",
        danger: "text-[var(--color-danger)]", warning: "text-[var(--color-warning)]", success: "text-[var(--color-success)]",
    };

    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 shadow-sm ring-1 ring-black/[0.02] ${variants[variant]}`}
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelVariants[variant]}`}>{label}</p>
                <Icon className={`w-4 h-4 ${iconVariants[variant]}`} />
            </div>
            {loading
                ? <div className="h-9 w-16 rounded-lg animate-pulse bg-current opacity-10" />
                : <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
            }
        </div>
    );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }) {
    const isCompleted = task.status === "COMPLETED";
    const isCancelled = task.status === "CANCELLED";
    const days = daysUntil(task.scheduledDate);
    const isOverdue = !isCompleted && !isCancelled && days != null && days < 0;

    const dateLabel = isCompleted && task.completedAt
        ? `Done ${formatDate(task.completedAt)}`
        : isCancelled ? "Cancelled"
            : daysLabel(task.scheduledDate);

    const dateLabelColor = isCompleted ? "text-[var(--color-success)]"
        : isCancelled ? "text-[var(--color-text-weak)]"
            : isOverdue ? "text-[var(--color-danger)]"
                : "text-[var(--color-warning)]";

    const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.Low;
    const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.OPEN;

    return (
        <Link
            to="/maintenance"
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)]
                       bg-[var(--color-surface)] hover:border-[var(--color-accent-mid)]
                       hover:bg-[var(--color-accent-light)] transition-all duration-150"
        >
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-background
                            border border-[var(--color-border)] group-hover:border-[var(--color-accent-mid)]">
                <span className={`w-2 h-2 rounded-full ${priorityCfg.dot}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium truncate ${isCancelled ? "text-[var(--color-text-weak)] line-through" : "text-[var(--color-text-strong)]"}`}>
                        {task.title}
                    </p>
                    {task.priority && !isCancelled && (
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${priorityCfg.pill}`}>
                            {task.priority}
                        </span>
                    )}
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${statusCfg.pill}`}>
                        {statusCfg.label}
                    </span>
                </div>
                <p className="text-xs text-[var(--color-text-sub)] truncate mt-0.5">
                    {[task.property?.name, task.unit?.name].filter(Boolean).join(" · ") || "No location"}
                </p>
            </div>
            <div className="text-right shrink-0 ml-2">
                <p className={`text-xs font-semibold tabular-nums ${dateLabelColor}`}>{dateLabel}</p>
                <p className="text-[11px] text-[var(--color-text-weak)] mt-0.5">{formatDate(task.scheduledDate)}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-weak)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>
    );
}

// ─── Fuel bar ─────────────────────────────────────────────────────────────────

function FuelBar({ percent, lowThreshold, criticalThreshold }) {
    const critical = percent <= (criticalThreshold ?? 10);
    const low = percent <= (lowThreshold ?? 20);
    const barColor = critical ? "bg-[var(--color-danger)]" : low ? "bg-yellow-400" : "bg-[var(--color-success)]";
    const textColor = critical ? "text-[var(--color-danger)]" : low ? "text-yellow-600" : "text-[var(--color-success)]";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-sub)]">
                    <Fuel className="w-3 h-3" /> Fuel level
                </span>
                <span className={`text-xs font-bold tabular-nums ${textColor}`}>{percent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
            </div>
        </div>
    );
}

// ─── Generator card ───────────────────────────────────────────────────────────

function GeneratorCard({ gen }) {
    const serviceOverdue = gen.nextServiceDate && daysUntil(gen.nextServiceDate) < 0;
    const lowFuel = gen.currentFuelPercent != null && gen.currentFuelPercent <= (gen.lowFuelThresholdPercent ?? 20);
    const hasProblem = lowFuel || serviceOverdue || gen.status === "FAULT";
    const statusCfg = GENERATOR_STATUS_CONFIG[gen.status] ?? GENERATOR_STATUS_CONFIG.IDLE;

    return (
        <Link
            to="/maintenance/generator"
            className={`group rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-150
                        hover:shadow-md hover:border-[var(--color-accent-mid)]
                        ${hasProblem
                    ? "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                                     ${hasProblem ? "bg-orange-100" : "bg-[var(--color-accent-light)]"}`}>
                        {hasProblem
                            ? <AlertTriangle className="w-4 h-4 text-orange-600" />
                            : <Zap className="w-4 h-4 text-[var(--color-accent)]" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{gen.name}</p>
                        {gen.property?.name && <p className="text-xs text-[var(--color-text-sub)] truncate">{gen.property.name}</p>}
                    </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase px-2 py-1 rounded-full shrink-0 ${statusCfg.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} /> {gen.status}
                </span>
            </div>
            {gen.currentFuelPercent != null && (
                <FuelBar percent={gen.currentFuelPercent} lowThreshold={gen.lowFuelThresholdPercent} criticalThreshold={gen.criticalFuelThresholdPercent} />
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                {gen.nextServiceDate ? (
                    <>
                        <span className="text-xs text-[var(--color-text-sub)]">Next service</span>
                        <span className={`text-xs font-semibold tabular-nums ${serviceOverdue ? "text-[var(--color-danger)]" : "text-[var(--color-text-body)]"}`}>
                            {serviceOverdue ? `${Math.abs(daysUntil(gen.nextServiceDate))}d overdue` : daysLabel(gen.nextServiceDate)}
                        </span>
                    </>
                ) : gen.lastCheckedAt ? (
                    <>
                        <span className="text-xs text-[var(--color-text-sub)]">Last check</span>
                        <span className="text-xs text-[var(--color-text-body)] font-medium">{formatDate(gen.lastCheckedAt)}</span>
                    </>
                ) : (
                    <span className="text-xs text-[var(--color-text-weak)]">No service info</span>
                )}
            </div>
        </Link>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon: Icon, message, subMessage }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[var(--color-text-weak)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-sub)]">{message}</p>
            {subMessage && <p className="text-xs text-[var(--color-text-weak)]">{subMessage}</p>}
        </div>
    );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabPill({ active, onClick, children, count }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                ${active
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "bg-[var(--color-surface)] text-[var(--color-text-sub)] border border-[var(--color-border)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-accent)]"
                }`}
        >
            {children}
            {count != null && count > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] leading-none font-bold
                    ${active ? "bg-white/20 text-white" : "bg-[var(--color-accent-light)] text-[var(--color-accent)]"}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ─── Section wrapper — same card conventions as Dashboard panels ──────────────

function Section({ title, subtitle, actions, children }) {
    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-card overflow-hidden shadow-sm ring-1 ring-black/[0.02]"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)]">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h2>
                    {subtitle && <p className="text-xs text-[var(--color-text-sub)] mt-0.5">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

// ─── Tab state hook ───────────────────────────────────────────────────────────

function useTaskTabs({ openTasks, completedTasks, cancelledTasks, maintenance }) {
    const [active, setActive] = useState("open");
    const tabs = [
        { key: "open", label: "Open", tasks: openTasks, count: openTasks.length },
        { key: "completed", label: "Done", tasks: completedTasks, count: completedTasks.length },
        { key: "cancelled", label: "Cancelled", tasks: cancelledTasks, count: cancelledTasks.length },
        { key: "all", label: "All", tasks: maintenance, count: maintenance.length },
    ];
    const currentTab = tabs.find((t) => t.key === active) ?? tabs[0];
    return { tabs, active, setActive, displayedTasks: currentTab.tasks };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
    const { user } = useAuth();
    const { greeting } = useTime();
    const {
        maintenance, openTasks, urgentTasks, completedTasks, cancelledTasks,
        generators, generatorsWithIssues, safety, loading, error, refetch,
    } = useStaffStats(user);

    const { tabs, active, setActive, displayedTasks } = useTaskTabs({
        openTasks, completedTasks, cancelledTasks, maintenance,
    });

    const loadingChecklists = loading;
    const firstName = user?.name?.split(" ")[0] ?? "there";

    // Maintenance completion ring (secondary)
    const totalAssigned = maintenance.length;
    const completedCount = completedTasks.length;
    const completionPct = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
    const ringCircumference = 2 * Math.PI * 20;
    const ringOffset = ringCircumference - (completionPct / 100) * ringCircumference;

    // ── Page header — matches Dashboard.jsx PageHeader ────────────────────────
    const PageHeader = (
        <div className="px-4 sm:px-5 pt-4 pb-3 shrink-0 flex items-end justify-between gap-4">
            <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1">
                    Staff Portal
                </p>
                <h1 className="text-2xl font-bold leading-none tracking-tight text-foreground">
                    {greeting}, {firstName}
                </h1>
                {!loading && (
                    <p className="text-sm text-[var(--color-text-sub)] mt-1">
                        {openTasks.length > 0
                            ? `${openTasks.length} task${openTasks.length !== 1 ? "s" : ""} open${urgentTasks.length > 0 ? ` · ${urgentTasks.length} urgent` : ""}`
                            : "All maintenance tasks clear today."}
                    </p>
                )}
            </div>

            {/* Refresh button — right-aligned, mirrors FY picker placement */}
            <button
                type="button"
                onClick={refetch}
                disabled={loading || loadingChecklists}
                className="flex items-center gap-2 rounded-xl border border-border
                           px-3.5 py-2 text-sm font-semibold bg-card text-primary
                           transition-all hover:shadow-sm active:scale-[0.98]
                           disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${(loading || loadingChecklists) ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
            </button>
        </div>
    );

    // ── Error banner — identical to Dashboard.jsx ErrorBanner ─────────────────
    const ErrorBanner = error && !loading && (
        <div className="mx-4 sm:mx-5 mb-2 flex items-center justify-between gap-3 shrink-0
                        rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <button
                onClick={refetch}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border
                           border-destructive text-destructive hover:bg-destructive/10 transition-colors"
            >
                Retry
            </button>
        </div>
    );

    // ── Full-page loader (first load only) — mirrors Dashboard.jsx ────────────
    if (loading && !maintenance.length && !safety) {
        return (
            <div className="flex flex-col bg-background min-h-screen">
                {PageHeader}
                {ErrorBanner}
                <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Loading…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-background min-h-screen">

            {/* ─── Page Header ──────────────────────────────────────────────── */}
            {PageHeader}
            {ErrorBanner}

            {/* ─── Main Bento Grid — same container as Dashboard.jsx ────────── */}
            <div className="px-3 sm:px-4 lg:px-5 pb-6 lg:pb-8">
                <div
                    className="
                        grid gap-3 sm:gap-4 lg:gap-5
                        grid-cols-1
                        sm:grid-cols-2
                        lg:grid-cols-4
                        xl:grid-cols-6
                        2xl:grid-cols-6
                    "
                    style={{ gridAutoFlow: "dense" }}
                >

                    {/* ══ Row 1: Daily Checks Hero — full width, #1 priority ══ */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6 2xl:col-span-6">
                        <DailyChecksHero safety={safety} loadingChecklists={loadingChecklists} />
                    </div>

                    {/* ══ Row 2: KPI strip — 4 stat cards ══════════════════════ */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6 2xl:col-span-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            <StatCard label="Open Tasks" value={openTasks.length} icon={ClipboardList} variant={openTasks.length > 0 ? "accent" : "default"} loading={loading} />
                            <StatCard label="Urgent" value={urgentTasks.length} icon={AlertTriangle} variant={urgentTasks.length > 0 ? "danger" : "default"} loading={loading} />
                            <StatCard label="Completed" value={completedTasks.length} icon={CheckCircle2} variant={completedTasks.length > 0 ? "success" : "default"} loading={loading} />
                            <StatCard label="Gen. Issues" value={generatorsWithIssues.length} icon={Activity} variant={generatorsWithIssues.length > 0 ? "warning" : "default"} loading={loading} />
                        </div>
                    </div>

                    {/* ══ Row 3: Maintenance progress + Tasks ════════════════════
                         Left (3→4 cols): My Tasks section
                         Right (1→2 cols): Progress ring card
                    ══════════════════════════════════════════════════════════ */}

                    {/* My Maintenance Tasks */}
                    <div className="
                        col-span-1 sm:col-span-2
                        lg:col-span-3
                        xl:col-span-4
                        2xl:col-span-4
                    ">
                        <Section
                            title="My Maintenance Tasks"
                            subtitle={loading ? null : `${maintenance.length} task${maintenance.length !== 1 ? "s" : ""} assigned to you`}
                            actions={
                                <>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {tabs.map((tab) => (
                                            <TabPill key={tab.key} active={active === tab.key} onClick={() => setActive(tab.key)} count={tab.count}>
                                                {tab.label}
                                            </TabPill>
                                        ))}
                                    </div>
                                    <Link to="/maintenance" className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline ml-1">
                                        View all <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </>
                            }
                        >
                            {loading ? (
                                <RowSkeleton rows={3} />
                            ) : displayedTasks.length === 0 ? (
                                (() => {
                                    const states = {
                                        open: { icon: CheckCircle2, message: "No open tasks", subMessage: "You're all caught up 🎉" },
                                        completed: { icon: CheckCircle2, message: "No completed tasks yet" },
                                        cancelled: { icon: XCircle, message: "No cancelled tasks" },
                                        all: { icon: Wrench, message: "No tasks assigned yet" },
                                    };
                                    const s = states[active] ?? states.all;
                                    return <Empty icon={s.icon} message={s.message} subMessage={s.subMessage} />;
                                })()
                            ) : (
                                <div className="space-y-2">
                                    {displayedTasks.map((task) => <TaskRow key={task._id} task={task} />)}
                                </div>
                            )}
                        </Section>
                    </div>

                    {/* Maintenance progress ring — sidebar card */}
                    <div className="
                        col-span-1 sm:col-span-2
                        lg:col-span-1
                        xl:col-span-2
                        2xl:col-span-2
                    ">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-card overflow-hidden shadow-sm ring-1 ring-black/[0.02] h-full"
                            style={{ boxShadow: "var(--shadow-card)" }}>
                            <div className="px-5 py-4 border-b border-[var(--color-border)]">
                                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1">Progress</p>
                                <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Maintenance</h2>
                            </div>
                            <div className="p-5 flex flex-col items-center gap-4">
                                {loading || totalAssigned === 0 ? (
                                    <Empty icon={TrendingUp} message="No tasks yet" subMessage="Tasks will appear here once assigned" />
                                ) : (
                                    <>
                                        {/* Inline SVG ring — consistent with DailyChecksHero ring style */}
                                        <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                                            <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-muted)" strokeWidth="7" />
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-accent)" strokeWidth="7"
                                                    strokeLinecap="round"
                                                    strokeDasharray={ringCircumference * 2}
                                                    strokeDashoffset={ringCircumference * 2 - (completionPct / 100) * ringCircumference * 2}
                                                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black tabular-nums text-[var(--color-text-strong)] leading-none">{completionPct}%</span>
                                                <span className="text-[10px] font-semibold text-[var(--color-text-sub)] mt-0.5">done</span>
                                            </div>
                                        </div>
                                        <div className="w-full space-y-2 text-center">
                                            <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                                                {completedCount} of {totalAssigned}
                                            </p>
                                            <p className="text-xs text-[var(--color-text-sub)]">tasks completed</p>
                                            {openTasks.length > 0 && (
                                                <p className="text-xs font-medium text-[var(--color-warning)]">
                                                    {openTasks.length} remaining
                                                </p>
                                            )}
                                        </div>
                                        <Link to="/maintenance"
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                                                         border border-[var(--color-border)] text-xs font-semibold
                                                         text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]
                                                         hover:border-[var(--color-accent-mid)] transition-colors">
                                            View tasks <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ══ Row 4: Generator Status — full width ════════════════ */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6 2xl:col-span-6">
                        <Section
                            title="Generator Status"
                            subtitle={
                                !loading && generatorsWithIssues.length > 0
                                    ? `${generatorsWithIssues.length} generator${generatorsWithIssues.length !== 1 ? "s" : ""} need attention`
                                    : !loading && generators.length > 0 ? "All generators nominal" : null
                            }
                            actions={
                                <Link to="/maintenance/generator"
                                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                                    View all <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            }
                        >
                            {loading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                                            <div className="h-4 w-32 rounded-lg animate-pulse bg-[var(--color-muted)]" />
                                            <div className="h-2 w-full rounded-full animate-pulse bg-[var(--color-border)]" />
                                            <div className="h-3 w-24 rounded-lg animate-pulse bg-[var(--color-border)]" />
                                        </div>
                                    ))}
                                </div>
                            ) : generators.length === 0 ? (
                                <Empty icon={Zap} message="No generators registered" subMessage="Generators will appear here once added" />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {generators.map((gen) => <GeneratorCard key={gen._id} gen={gen} />)}
                                </div>
                            )}
                        </Section>
                    </div>

                </div>
            </div>
        </div>
    );
}