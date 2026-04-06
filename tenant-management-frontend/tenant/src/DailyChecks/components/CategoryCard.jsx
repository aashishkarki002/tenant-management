import {
    CheckCircle2,
    AlertTriangle,
    Check,
    User,
    Clock,
    TrendingUp,
    AlertOctagon,
} from "lucide-react";
import { CATEGORY_META } from "../constants/dailyChecksConstants";
import { formatTime } from "../utils/dailyChecksDate";
import { ProgressBar } from "./ProgressBar";
import { StatusChip } from "./StatusChip";

export function CategoryCard({ cat, result, currentUserId, onSelect, isLoading }) {
    const meta = CATEGORY_META[cat];
    const Icon = meta.icon;
    const status = result?.status ?? "PENDING";
    const isCompleted = status === "COMPLETED";
    const isInProgress = status === "IN_PROGRESS";
    const hasIssues = result?.hasIssues ?? false;
    const submittedByMe = isCompleted && result?.submittedBy?._id === currentUserId;
    const submittedByOther = isCompleted && result?.submittedBy?._id !== currentUserId;
    const inProgressByOther = isInProgress && result?.submittedBy?._id != null && result?.submittedBy?._id !== currentUserId;

    const passRate = result && result.totalItems > 0
        ? Math.round((result.passedItems / result.totalItems) * 100)
        : null;

    const borderLeft =
        isCompleted && !hasIssues ? "border-l-emerald-500"
            : isCompleted && hasIssues ? "border-l-amber-500"
                : isInProgress ? "border-l-blue-400"
                    : "border-l-[var(--color-border)]";

    return (
        <button
            onClick={() => onSelect(cat, result)}
            disabled={isLoading}
            className={[
                "group w-full text-left rounded-2xl border border-[var(--color-border)] border-l-4",
                "bg-[var(--color-surface-raised)] overflow-hidden",
                "transition-all duration-150 active:scale-[0.985] disabled:opacity-50",
                borderLeft,
                !isCompleted ? "hover:border-[var(--color-accent-mid)] hover:bg-[var(--color-accent-light)]" : "",
            ].join(" ")}
        >
            <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isCompleted && !hasIssues ? "bg-emerald-100"
                    : isCompleted && hasIssues ? "bg-amber-100"
                        : meta.iconBg
                    }`}>
                    {isCompleted && !hasIssues
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : isCompleted && hasIssues
                            ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                            : <Icon className={`w-5 h-5 ${meta.iconColor}`} />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-sm font-bold leading-tight ${isCompleted ? "text-[var(--color-text-body)]" : "text-[var(--color-text-strong)]"}`}>
                            {meta.label}
                        </span>
                        {meta.urgency === "critical" && !isCompleted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest shrink-0">
                                First
                            </span>
                        )}
                    </div>

                    {isCompleted && (
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {submittedByMe && (
                                <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                                    <Check className="w-3 h-3 shrink-0" /> You submitted
                                </span>
                            )}
                            {submittedByOther && result?.submittedBy && (
                                <span className="flex items-center gap-1 text-xs text-[var(--color-text-sub)] font-medium">
                                    <User className="w-3 h-3 shrink-0" />
                                    <span className="font-bold text-[var(--color-text-body)]">{result.submittedBy.name}</span>
                                </span>
                            )}
                            {result?.submittedAt && (
                                <span className="flex items-center gap-1 text-xs text-[var(--color-text-weak)]">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {formatTime(result.submittedAt)}
                                </span>
                            )}
                            {passRate !== null && (
                                <span className={`flex items-center gap-1 text-xs font-bold ml-auto ${hasIssues ? "text-amber-600" : "text-emerald-600"}`}>
                                    <TrendingUp className="w-3 h-3 shrink-0" />
                                    {passRate}%
                                </span>
                            )}
                        </div>
                    )}

                    {inProgressByOther && result?.submittedBy && (
                        <span className="flex items-center gap-1 text-xs text-amber-700 font-medium mt-0.5">
                            <AlertOctagon className="w-3 h-3 shrink-0" />
                            In progress by <strong className="ml-0.5">{result.submittedBy.name}</strong>
                        </span>
                    )}

                    {isInProgress && !inProgressByOther && (
                        <span className="text-xs text-blue-600 font-medium mt-0.5 block">Resume where you left off →</span>
                    )}
                    {status === "PENDING" && (
                        <span className="text-xs text-[var(--color-text-weak)] mt-0.5 block">Tap to start check</span>
                    )}
                </div>

                <StatusChip status={status} hasIssues={hasIssues} />
            </div>

            {isCompleted && result && result.totalItems > 0 && (
                <div className="px-4 pb-3">
                    <ProgressBar
                        value={result.passedItems}
                        max={result.totalItems}
                        color={hasIssues ? "#f59e0b" : "#10b981"}
                    />
                </div>
            )}
        </button>
    );
}
