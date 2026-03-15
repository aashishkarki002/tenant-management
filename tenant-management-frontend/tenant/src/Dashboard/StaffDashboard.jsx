import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Wrench, Zap, AlertTriangle, Fuel, CheckCircle2,
    ChevronRight, RefreshCw, AlertCircle, XCircle,
    ClipboardList, Clock, TrendingUp, Activity,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTime } from "./hooks/UseTime";
import { useStaffStats } from "./hooks/useStaffStats";

// ─── Priority & status token maps — petrol palette ───────────────────────────

const PRIORITY_CONFIG = {
    Urgent: { pill: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]", dot: "bg-[var(--color-danger)]" },
    High: { pill: "bg-orange-50 text-orange-700 border border-orange-200", dot: "bg-orange-500" },
    Medium: { pill: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]", dot: "bg-yellow-400" },
    Low: { pill: "bg-[var(--color-surface)] text-[var(--color-text-sub)] border border-[var(--color-border)]", dot: "bg-[var(--color-muted-fill)]" },
};

const STATUS_CONFIG = {
    OPEN: { pill: "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info-border)]", label: "Open" },
    IN_PROGRESS: { pill: "bg-orange-50 text-orange-700 border border-orange-200", label: "In Progress" },
    COMPLETED: { pill: "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]", label: "Done" },
    CANCELLED: { pill: "bg-[var(--color-surface)] text-[var(--color-text-weak)] border border-[var(--color-border)]", label: "Cancelled" },
};

const GENERATOR_STATUS_CONFIG = {
    RUNNING: { pill: "bg-[var(--color-success-bg)] text-[var(--color-success)]", dot: "bg-[var(--color-success)] animate-pulse" },
    IDLE: { pill: "bg-[var(--color-surface)] text-[var(--color-text-sub)]", dot: "bg-[var(--color-muted-fill)]" },
    MAINTENANCE: { pill: "bg-orange-50 text-orange-700", dot: "bg-orange-400" },
    FAULT: { pill: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]", dot: "bg-[var(--color-danger)] animate-pulse" },
    DECOMMISSIONED: { pill: "bg-[var(--color-surface)] text-[var(--color-text-weak)]", dot: "bg-[var(--color-muted-fill)]" },
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton({ rows = 3 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="w-9 h-9 rounded-xl animate-pulse bg-[var(--color-muted-fill)] shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 rounded-md animate-pulse bg-[var(--color-muted-fill)]" />
                        <div className="h-3 w-1/3 rounded-md animate-pulse bg-[var(--color-border)]" />
                    </div>
                    <div className="w-14 h-3 rounded-md animate-pulse bg-[var(--color-border)]" />
                </div>
            ))}
        </div>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon: Icon, variant = "default", loading }) {
    const variants = {
        default: "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-strong)]",
        accent: "bg-[var(--color-accent)] border-[var(--color-accent)] text-white",
        danger: "bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger)]",
        warning: "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning)]",
        success: "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success)]",
    };

    const iconVariants = {
        default: "text-[var(--color-text-weak)]",
        accent: "text-white/70",
        danger: "text-[var(--color-danger)]",
        warning: "text-[var(--color-warning)]",
        success: "text-[var(--color-success)]",
    };

    const labelVariants = {
        default: "text-[var(--color-text-sub)]",
        accent: "text-white/70",
        danger: "text-[var(--color-danger)]",
        warning: "text-[var(--color-warning)]",
        success: "text-[var(--color-success)]",
    };

    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${variants[variant]}`}
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-widest ${labelVariants[variant]}`}>{label}</p>
                <Icon className={`w-4 h-4 ${iconVariants[variant]}`} />
            </div>
            {loading ? (
                <div className="h-9 w-16 rounded-lg animate-pulse bg-current opacity-10" />
            ) : (
                <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
            )}
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
            {/* Priority dot */}
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-bg)]
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
                    <Fuel className="w-3 h-3" />
                    Fuel level
                </span>
                <span className={`text-xs font-bold tabular-nums ${textColor}`}>{percent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--color-muted-fill)] overflow-hidden">
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
                    : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 
                                    ${hasProblem ? "bg-orange-100" : "bg-[var(--color-accent-light)]"}`}>
                        {hasProblem
                            ? <AlertTriangle className="w-4 h-4 text-orange-600" />
                            : <Zap className="w-4 h-4 text-[var(--color-accent)]" />
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{gen.name}</p>
                        {gen.property?.name && (
                            <p className="text-xs text-[var(--color-text-sub)] truncate">{gen.property.name}</p>
                        )}
                    </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase px-2 py-1 rounded-full shrink-0 ${statusCfg.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {gen.status}
                </span>
            </div>

            {gen.currentFuelPercent != null && (
                <FuelBar
                    percent={gen.currentFuelPercent}
                    lowThreshold={gen.lowFuelThresholdPercent}
                    criticalThreshold={gen.criticalFuelThresholdPercent}
                />
            )}

            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                {gen.nextServiceDate ? (
                    <>
                        <span className="text-xs text-[var(--color-text-sub)]">Next service</span>
                        <span className={`text-xs font-semibold tabular-nums ${serviceOverdue ? "text-[var(--color-danger)]" : "text-[var(--color-text-body)]"}`}>
                            {serviceOverdue
                                ? `${Math.abs(daysUntil(gen.nextServiceDate))}d overdue`
                                : daysLabel(gen.nextServiceDate)
                            }
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, subtitle, actions, children }) {
    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] overflow-hidden"
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
        generators, generatorsWithIssues, loading, error, refetch,
    } = useStaffStats(user);

    const { tabs, active, setActive, displayedTasks } = useTaskTabs({
        openTasks, completedTasks, cancelledTasks, maintenance,
    });

    const firstName = user?.name?.split(" ")[0] ?? "there";

    // completion % for progress ring
    const totalAssigned = maintenance.length;
    const completedCount = completedTasks.length;
    const completionPct = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
    const ringCircumference = 2 * Math.PI * 20; // r=20
    const ringOffset = ringCircumference - (completionPct / 100) * ringCircumference;

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">

                {/* ── Header ──────────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-weak)] mb-1">
                            Staff Portal
                        </p>
                        <h1 className="text-2xl font-bold text-[var(--color-text-strong)] leading-tight">
                            {greeting}, {firstName}
                        </h1>
                        <p className="text-sm text-[var(--color-text-sub)] mt-1">
                            {openTasks.length > 0
                                ? `You have ${openTasks.length} open task${openTasks.length !== 1 ? "s" : ""}${urgentTasks.length > 0 ? `, ${urgentTasks.length} urgent` : ""}.`
                                : "You're all caught up today."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-text-sub)]
                                   border border-[var(--color-border)] rounded-xl px-3 py-2
                                   hover:bg-[var(--color-surface)] hover:text-[var(--color-text-body)]
                                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {/* ── Error ──────────────────────────────────────────────────── */}
                {error && (
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-danger-border)]
                                    bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button type="button" onClick={refetch}
                            className="text-xs font-semibold underline hover:no-underline shrink-0">
                            Retry
                        </button>
                    </div>
                )}

                {/* ── KPI strip ───────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        label="Open Tasks"
                        value={openTasks.length}
                        icon={ClipboardList}
                        variant={openTasks.length > 0 ? "accent" : "default"}
                        loading={loading}
                    />
                    <StatCard
                        label="Urgent"
                        value={urgentTasks.length}
                        icon={AlertTriangle}
                        variant={urgentTasks.length > 0 ? "danger" : "default"}
                        loading={loading}
                    />
                    <StatCard
                        label="Completed"
                        value={completedTasks.length}
                        icon={CheckCircle2}
                        variant={completedTasks.length > 0 ? "success" : "default"}
                        loading={loading}
                    />
                    <StatCard
                        label="Gen. Issues"
                        value={generatorsWithIssues.length}
                        icon={Activity}
                        variant={generatorsWithIssues.length > 0 ? "warning" : "default"}
                        loading={loading}
                    />
                </div>

                {/* ── Progress bar (only when there are tasks) ────────────────── */}
                {!loading && totalAssigned > 0 && (
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]
                                    px-5 py-4 flex items-center gap-5"
                        style={{ boxShadow: "var(--shadow-card)" }}>
                        {/* SVG ring */}
                        <div className="shrink-0">
                            <svg width="52" height="52" viewBox="0 0 52 52">
                                <circle cx="26" cy="26" r="20" fill="none"
                                    stroke="var(--color-muted-fill)" strokeWidth="4" />
                                <circle cx="26" cy="26" r="20" fill="none"
                                    stroke="var(--color-accent)" strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={ringCircumference}
                                    strokeDashoffset={ringOffset}
                                    transform="rotate(-90 26 26)"
                                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                                />
                                <text x="26" y="30" textAnchor="middle"
                                    fontSize="11" fontWeight="700"
                                    fill="var(--color-text-strong)">
                                    {completionPct}%
                                </text>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                                Today's progress
                            </p>
                            <p className="text-xs text-[var(--color-text-sub)] mt-0.5">
                                {completedCount} of {totalAssigned} tasks completed
                                {openTasks.length > 0 && ` · ${openTasks.length} remaining`}
                            </p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
                    </div>
                )}

                {/* ── My tasks ────────────────────────────────────────────────── */}
                <Section
                    title="My Maintenance Tasks"
                    subtitle={loading ? null : `${maintenance.length} task${maintenance.length !== 1 ? "s" : ""} assigned to you`}
                    actions={
                        <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {tabs.map((tab) => (
                                    <TabPill key={tab.key} active={active === tab.key}
                                        onClick={() => setActive(tab.key)} count={tab.count}>
                                        {tab.label}
                                    </TabPill>
                                ))}
                            </div>
                            <Link to="/maintenance"
                                className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline ml-1">
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

                {/* ── Generator status ────────────────────────────────────────── */}
                <Section
                    title="Generator Status"
                    subtitle={!loading && generatorsWithIssues.length > 0
                        ? `${generatorsWithIssues.length} generator${generatorsWithIssues.length !== 1 ? "s" : ""} need attention`
                        : !loading && generators.length > 0 ? "All generators nominal" : null}
                    actions={
                        <Link to="/maintenance/generator"
                            className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                            View all <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    }
                >
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                                    <div className="h-4 w-32 rounded-lg animate-pulse bg-[var(--color-muted-fill)]" />
                                    <div className="h-2 w-full rounded-full animate-pulse bg-[var(--color-border)]" />
                                    <div className="h-3 w-24 rounded-lg animate-pulse bg-[var(--color-border)]" />
                                </div>
                            ))}
                        </div>
                    ) : generators.length === 0 ? (
                        <Empty icon={Zap} message="No generators registered" subMessage="Generators will appear here once added" />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {generators.map((gen) => <GeneratorCard key={gen._id} gen={gen} />)}
                        </div>
                    )}
                </Section>

                {/* ── Quick access ────────────────────────────────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-[var(--color-text-weak)] uppercase tracking-widest mb-3 px-1">
                        Quick access
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Daily Check", to: "/checklists", icon: ClipboardList, color: "text-[var(--color-accent)]", bg: "bg-[var(--color-accent-light)] hover:bg-[var(--color-accent-mid)]/20" },
                            { label: "Maintenance", to: "/maintenance", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50 hover:bg-orange-100" },
                            { label: "Generator", to: "/maintenance/generator", icon: Zap, color: "text-violet-600", bg: "bg-violet-50 hover:bg-violet-100" },
                            { label: "Electricity", to: "/electricity", icon: Clock, color: "text-sky-600", bg: "bg-sky-50 hover:bg-sky-100" },
                        ].map(({ label, to, icon: Icon, color, bg }) => (
                            <Link key={label} to={to}
                                className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--color-border)]
                                            p-4 text-center transition-all duration-150 hover:shadow-sm ${bg}`}>
                                <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center">
                                    <Icon className={`w-4.5 h-4.5 ${color}`} />
                                </div>
                                <span className="text-xs font-semibold text-[var(--color-text-body)]">{label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}