import {
    ChevronLeft,
    AlertTriangle,
    PartyPopper,
    User,
    Clock,
    CheckSquare,
} from "lucide-react";
import { CATEGORY_META } from "../constants/dailyChecksConstants";
import { formatTime } from "../utils/dailyChecksDate";

export function SubmittedResultView({ result, category, currentUserId, onBack }) {
    const meta = CATEGORY_META[category];
    const Icon = meta.icon;
    const hasIssues = result?.hasIssues ?? false;
    const passRate = result.totalItems > 0 ? Math.round((result.passedItems / result.totalItems) * 100) : null;
    const submittedByOther = result.submittedBy && result.submittedBy._id !== currentUserId;

    return (
        <div className="flex flex-col min-h-full">
            <div className="sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors">
                        <ChevronLeft className="w-6 h-6 text-[var(--color-text-body)]" />
                    </button>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                        <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-[var(--color-text-strong)] truncate">{meta.label}</p>
                        <p className="text-xs text-[var(--color-text-sub)]">Submitted result — read only</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                {submittedByOther && result.submittedBy && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                        <User className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-800">
                            This check was completed by <strong>{result.submittedBy.name}</strong>.
                            You are viewing their submitted result. Contact admin to make corrections.
                        </p>
                    </div>
                )}

                <div className={`rounded-2xl p-5 border-2 ${hasIssues ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${hasIssues ? "bg-amber-100" : "bg-emerald-100"}`}>
                            {hasIssues ? <AlertTriangle className="w-8 h-8 text-amber-600" /> : <PartyPopper className="w-8 h-8 text-emerald-600" />}
                        </div>
                        <div>
                            <p className={`text-lg font-black ${hasIssues ? "text-amber-800" : "text-emerald-800"}`}>
                                {hasIssues ? "Issues Logged" : "All Clear ✓"}
                            </p>
                            {passRate !== null && (
                                <p className={`text-sm font-semibold ${hasIssues ? "text-amber-700" : "text-emerald-700"}`}>
                                    {passRate}% pass rate · {result.passedItems}/{result.totalItems} items OK
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-current border-opacity-20">
                        {result.submittedBy?.name && (
                            <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-body)]">
                                <User className="w-4 h-4 shrink-0" />
                                <span className="font-semibold">{result.submittedBy.name}</span>
                            </span>
                        )}
                        {result.submittedAt && (
                            <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-sub)]">
                                <Clock className="w-4 h-4 shrink-0" />
                                {formatTime(result.submittedAt)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Total", value: result.totalItems, color: "var(--color-text-body)" },
                        { label: "Passed", value: result.passedItems, color: "#10b981" },
                        { label: "Issues", value: result.failedItems, color: result.failedItems > 0 ? "#f59e0b" : "var(--color-text-weak)" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="flex flex-col items-center py-4 rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                            <span className="text-3xl font-black tabular-nums" style={{ color }}>{value}</span>
                            <span className="text-xs text-[var(--color-text-sub)] mt-1">{label}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                    <CheckSquare className="w-4 h-4 text-[var(--color-text-sub)] mt-0.5 shrink-0" />
                    <p className="text-sm text-[var(--color-text-sub)]">
                        This check has been submitted. Contact your admin if corrections are needed.
                    </p>
                </div>
            </div>

            <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-4">
                <button onClick={onBack} className="w-full py-4 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-body)] text-base font-bold hover:bg-[var(--color-accent-light)] transition-colors active:scale-[0.98]">
                    ← Back to Checklist
                </button>
            </div>
        </div>
    );
}
