import {
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Clock,
} from "lucide-react";

export function StatusChip({ status, hasIssues }) {
    if (status === "COMPLETED") {
        return hasIssues
            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide shrink-0">
                <AlertTriangle className="w-3 h-3" /> Issues
            </span>
            : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase tracking-wide shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Done
            </span>;
    }
    if (status === "IN_PROGRESS") {
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 uppercase tracking-wide shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" /> Active
        </span>;
    }
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-weak)] border border-[var(--color-border)] uppercase tracking-wide shrink-0">
        <Clock className="w-3 h-3" /> Pending
    </span>;
}
