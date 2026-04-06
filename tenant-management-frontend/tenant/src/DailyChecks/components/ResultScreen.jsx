import { AlertTriangle, PartyPopper, Wrench } from "lucide-react";

export function ResultScreen({ result, onNewCheck, onBack }) {
    const { data, autoCreatedTasks = [] } = result;
    const hasIssues = data.hasIssues;
    const passRate = data.totalItems > 0 ? Math.round((data.passedItems / data.totalItems) * 100) : 0;

    return (
        <div className="flex flex-col px-4 py-6 gap-5">
            <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${hasIssues ? "bg-amber-100" : "bg-emerald-100"}`}>
                    {hasIssues ? <AlertTriangle className="w-10 h-10 text-amber-500" /> : <PartyPopper className="w-10 h-10 text-emerald-600" />}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[var(--color-text-strong)]">
                        {hasIssues ? "Issues Logged" : "All Clear! 🎉"}
                    </h2>
                    <p className="text-sm text-[var(--color-text-sub)] mt-1">
                        {hasIssues
                            ? `${autoCreatedTasks.length} repair task${autoCreatedTasks.length !== 1 ? "s" : ""} auto-created`
                            : "No issues found. Great work!"}
                    </p>
                </div>
                <span className={`text-sm font-bold px-4 py-2 rounded-full border ${hasIssues ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"}`}>
                    {passRate}% pass rate · {data.passedItems}/{data.totalItems} items OK
                </span>
            </div>

            {autoCreatedTasks.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-bold text-amber-700 uppercase tracking-wide">
                            {autoCreatedTasks.length} Repair Task{autoCreatedTasks.length !== 1 ? "s" : ""} Created
                        </p>
                    </div>
                    <div className="divide-y divide-amber-100">
                        {autoCreatedTasks.map((task) => (
                            <div key={task._id} className="flex items-center gap-3 px-4 py-3">
                                <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                                <p className="flex-1 text-sm text-[var(--color-text-body)] line-clamp-2">
                                    {task.title.replace(/^\[Auto\] /, "")}
                                </p>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${task.priority === "Urgent" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                    {task.priority}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total", value: data.totalItems, color: "var(--color-text-body)" },
                    { label: "Passed", value: data.passedItems, color: "#10b981" },
                    { label: "Issues", value: data.failedItems, color: data.failedItems > 0 ? "#f59e0b" : "var(--color-text-weak)" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-4 rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                        <span className="text-3xl font-black tabular-nums" style={{ color }}>{value}</span>
                        <span className="text-xs text-[var(--color-text-sub)] mt-1">{label}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3">
                <button onClick={onNewCheck} className="w-full py-4 rounded-2xl bg-[var(--color-accent)] text-white text-base font-bold hover:bg-[var(--color-accent-hover)] transition-colors active:scale-[0.98]">
                    Start Another Check
                </button>
                <button onClick={onBack} className="w-full py-4 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-body)] text-base font-bold hover:bg-[var(--color-accent-light)] transition-colors active:scale-[0.98]">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
