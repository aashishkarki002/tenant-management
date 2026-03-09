import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Wrench, Zap, AlertTriangle, Fuel, CheckCircle2,
    ChevronRight, RefreshCw, AlertCircle, XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "../context/AuthContext";
import { useTime } from "./hooks/UseTime";
import { useStaffStats } from "./hooks/useStaffStats";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_BADGE = {
    Urgent: "bg-red-100 text-red-700",
    High: "bg-orange-100 text-orange-700",
    Medium: "bg-yellow-100 text-yellow-700",
    Low: "bg-gray-100 text-gray-500",
};

const STATUS_BADGE = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-400",
};

const GENERATOR_STATUS_COLOR = {
    RUNNING: "bg-green-100 text-green-700",
    IDLE: "bg-gray-100 text-gray-500",
    MAINTENANCE: "bg-amber-100 text-amber-700",
    FAULT: "bg-red-100 text-red-700",
    DECOMMISSIONED: "bg-gray-200 text-gray-400",
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
    return `In ${n}d`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowSkeleton({ rows = 3 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                    <div className="w-8 h-8 rounded-full animate-pulse bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-2/3 rounded animate-pulse bg-gray-200" />
                        <div className="h-3 w-1/2 rounded animate-pulse bg-gray-100" />
                    </div>
                    <div className="w-12 h-3 rounded animate-pulse bg-gray-100" />
                </div>
            ))}
        </div>
    );
}

function StatPill({ value, label, accent = false, loading }) {
    return (
        <div className={`rounded-xl p-4 flex flex-col gap-1 ${accent ? "bg-orange-800 text-white" : "bg-gray-50 border border-gray-100"}`}>
            {loading ? (
                <div className={`h-8 w-12 rounded animate-pulse ${accent ? "bg-orange-700" : "bg-gray-200"}`} />
            ) : (
                <p className={`text-3xl font-bold tabular-nums ${accent ? "text-white" : "text-gray-900"}`}>{value}</p>
            )}
            <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-orange-200" : "text-gray-400"}`}>
                {label}
            </p>
        </div>
    );
}

function TaskRow({ task }) {
    const isCompleted = task.status === "COMPLETED";
    const isCancelled = task.status === "CANCELLED";
    const days = daysUntil(task.scheduledDate);
    const isOverdue = !isCompleted && !isCancelled && days != null && days < 0;

    // For completed tasks, show the completion date instead of the scheduled countdown
    const dateLabel = isCompleted && task.completedAt
        ? `Done ${formatDate(task.completedAt)}`
        : isCancelled
            ? "Cancelled"
            : daysLabel(task.scheduledDate);

    const dateLabelColor = isCompleted
        ? "text-green-600"
        : isCancelled
            ? "text-gray-400"
            : isOverdue
                ? "text-red-500"
                : "text-amber-600";

    const iconBg = isCompleted
        ? "bg-green-50"
        : isCancelled
            ? "bg-gray-50"
            : isOverdue
                ? "bg-red-50"
                : "bg-blue-50";

    const iconColor = isCompleted
        ? "text-green-500"
        : isCancelled
            ? "text-gray-400"
            : isOverdue
                ? "text-red-500"
                : "text-blue-500";

    return (
        <Link
            to="/maintenance"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
        >
            <div className={`rounded-full p-2 shrink-0 ${iconBg}`}>
                {isCompleted ? (
                    <CheckCircle2 className={`w-3.5 h-3.5 ${iconColor}`} />
                ) : isCancelled ? (
                    <XCircle className={`w-3.5 h-3.5 ${iconColor}`} />
                ) : (
                    <Wrench className={`w-3.5 h-3.5 ${iconColor}`} />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-medium truncate ${isCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {task.title}
                    </p>
                    {task.priority && !isCancelled && (
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority] ?? "bg-gray-100 text-gray-500"}`}>
                            {task.priority}
                        </span>
                    )}
                    {task.status && (
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[task.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {task.status.replace("_", " ")}
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                    {[task.property?.name, task.unit?.name].filter(Boolean).join(" · ") || "No location"}
                </p>
            </div>

            <div className="text-right shrink-0 ml-2">
                <p className={`text-xs font-semibold tabular-nums ${dateLabelColor}`}>
                    {dateLabel}
                </p>
                <p className="text-[11px] text-gray-400">{formatDate(task.scheduledDate)}</p>
            </div>
        </Link>
    );
}

function FuelBar({ percent, lowThreshold, criticalThreshold }) {
    const critical = percent <= (criticalThreshold ?? 10);
    const low = percent <= (lowThreshold ?? 20);
    const barColor = critical ? "bg-red-500" : low ? "bg-amber-400" : "bg-green-500";

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Fuel className="w-3 h-3" /> Fuel
                </span>
                <span className={`text-xs font-semibold tabular-nums ${critical ? "text-red-600" : low ? "text-amber-600" : "text-gray-700"}`}>
                    {percent}%
                </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
            </div>
        </div>
    );
}

function GeneratorCard({ gen }) {
    const serviceOverdue = gen.nextServiceDate && daysUntil(gen.nextServiceDate) < 0;
    const lowFuel = gen.currentFuelPercent != null && gen.currentFuelPercent <= (gen.lowFuelThresholdPercent ?? 20);
    const hasProblem = lowFuel || serviceOverdue || gen.status === "FAULT";

    return (
        <Link
            to="/maintenance/generator"
            className={`rounded-xl border p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow ${hasProblem ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {hasProblem
                        ? <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                        : <Zap className="w-4 h-4 text-violet-500 shrink-0" />
                    }
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{gen.name}</p>
                        {gen.property?.name && (
                            <p className="text-xs text-gray-400 truncate">{gen.property.name}</p>
                        )}
                    </div>
                </div>
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${GENERATOR_STATUS_COLOR[gen.status] ?? "bg-gray-100 text-gray-500"}`}>
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

            {gen.nextServiceDate && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Next service</span>
                    <span className={`text-xs font-semibold tabular-nums ${serviceOverdue ? "text-red-600" : "text-gray-700"}`}>
                        {serviceOverdue
                            ? `${Math.abs(daysUntil(gen.nextServiceDate))}d overdue`
                            : daysLabel(gen.nextServiceDate)
                        }
                    </span>
                </div>
            )}

            {gen.lastCheckedAt && (
                <p className="text-[11px] text-gray-400">
                    Last checked {formatDate(gen.lastCheckedAt)}
                </p>
            )}
        </Link>
    );
}

function Empty({ icon: Icon, message, subMessage }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <Icon className="w-8 h-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">{message}</p>
            {subMessage && <p className="text-xs text-gray-400">{subMessage}</p>}
        </div>
    );
}

function Tab({ active, onClick, children, count }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${active ? "bg-orange-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
        >
            {children}
            {count != null && count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${active ? "bg-white text-orange-800" : "bg-orange-100 text-orange-700"}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ─── Task tab configuration ───────────────────────────────────────────────────
// Add new tabs here without touching JSX below.

function useTaskTabs({ openTasks, completedTasks, cancelledTasks, maintenance }) {
    const [active, setActive] = useState("open");

    const tabs = [
        { key: "open", label: "Open", tasks: openTasks, count: openTasks.length },
        { key: "completed", label: "Completed", tasks: completedTasks, count: completedTasks.length },
        { key: "cancelled", label: "Cancelled", tasks: cancelledTasks, count: cancelledTasks.length },
        { key: "all", label: "All", tasks: maintenance, count: maintenance.length },
    ];

    const currentTab = tabs.find((t) => t.key === active) ?? tabs[0];

    return { tabs, active, setActive, displayedTasks: currentTab.tasks };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StaffDashboard() {
    const { user } = useAuth();
    const { greeting } = useTime();
    const {
        maintenance,
        openTasks,
        urgentTasks,
        completedTasks,
        cancelledTasks,
        generators,
        generatorsWithIssues,
        loading,
        error,
        refetch,
    } = useStaffStats(user);

    const { tabs, active, setActive, displayedTasks } = useTaskTabs({
        openTasks,
        completedTasks,
        cancelledTasks,
        maintenance,
    });

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

            {/* ── Greeting ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">
                        {greeting}, {user?.name?.split(" ")[0] ?? "Staff"}
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">Here's what's assigned to you today.</p>
                </div>
                <button
                    type="button"
                    onClick={refetch}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* ── Error banner ─────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                    <button
                        type="button"
                        onClick={refetch}
                        className="ml-auto text-xs font-semibold underline hover:no-underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── Summary stats ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Open Tasks" value={openTasks.length} accent={openTasks.length > 0} loading={loading} />
                <StatPill label="Urgent" value={urgentTasks.length} accent={urgentTasks.length > 0} loading={loading} />
                <StatPill label="Completed" value={completedTasks.length} loading={loading} />
                <StatPill label="Gen. Issues" value={generatorsWithIssues.length} accent={generatorsWithIssues.length > 0} loading={loading} />
            </div>

            {/* ── Assigned maintenance tasks ────────────────────────────────── */}
            <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
                    <CardTitle className="text-base font-semibold text-gray-900">My Maintenance Tasks</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                        {tabs.map((tab) => (
                            <Tab
                                key={tab.key}
                                active={active === tab.key}
                                onClick={() => setActive(tab.key)}
                                count={tab.count}
                            >
                                {tab.label}
                            </Tab>
                        ))}
                        <Link
                            to="/maintenance"
                            className="flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline ml-1"
                        >
                            View All <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {loading ? (
                        <RowSkeleton rows={3} />
                    ) : displayedTasks.length === 0 ? (
                        (() => {
                            const emptyStates = {
                                open: { icon: CheckCircle2, message: "No open tasks", subMessage: "You're all caught up 🎉" },
                                completed: { icon: CheckCircle2, message: "No completed tasks yet" },
                                cancelled: { icon: XCircle, message: "No cancelled tasks" },
                                all: { icon: Wrench, message: "No maintenance tasks assigned yet" },
                            };
                            const { icon, message, subMessage } = emptyStates[active] ?? emptyStates.all;
                            return <Empty icon={icon} message={message} subMessage={subMessage} />;
                        })()
                    ) : (
                        <div className="space-y-2">
                            {displayedTasks.map((task) => (
                                <TaskRow key={task._id} task={task} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Generator status ─────────────────────────────────────────── */}
            <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="text-base font-semibold text-gray-900">Generator Status</CardTitle>
                        {!loading && generatorsWithIssues.length > 0 && (
                            <p className="text-xs text-orange-600 font-medium mt-0.5">
                                {generatorsWithIssues.length} generator{generatorsWithIssues.length !== 1 ? "s" : ""} need{generatorsWithIssues.length === 1 ? "s" : ""} attention
                            </p>
                        )}
                    </div>
                    <Link
                        to="/maintenance/generator"
                        className="flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline"
                    >
                        View All <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                </CardHeader>

                <CardContent className="pt-0">
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
                                    <div className="h-4 w-32 rounded animate-pulse bg-gray-200" />
                                    <div className="h-2 w-full rounded animate-pulse bg-gray-100" />
                                    <div className="h-3 w-24 rounded animate-pulse bg-gray-100" />
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
                </CardContent>
            </Card>

            {/* ── Quick actions ─────────────────────────────────────────────── */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { label: "Maintenance", to: "/maintenance", icon: Wrench, color: "text-orange-700", bg: "bg-orange-50 hover:bg-orange-100" },
                        { label: "Generator", to: "/maintenance/generator", icon: Zap, color: "text-violet-600", bg: "bg-violet-50 hover:bg-violet-100" },
                        { label: "Electricity", to: "/electricity", icon: Zap, color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-100" },
                    ].map(({ label, to, icon: Icon, color, bg }) => (
                        <Link
                            key={label}
                            to={to}
                            className={`flex items-center gap-3 rounded-xl border border-gray-100 p-4 transition-colors ${bg}`}
                        >
                            <Icon className={`w-5 h-5 ${color}`} />
                            <span className="text-sm font-semibold text-gray-800">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>

        </div>
    );
}