import { ShieldCheck } from "lucide-react";
import { CheckItemRow } from "./CheckItemRow";

export function SectionGroup({ section, onChange, onSectionClear }) {
    const total = section.items.length;
    const pending = section.items.filter((it) => it.isOk === null).length;
    const issues = section.items.filter((it) => it.isOk === false).length;
    const reviewed = total - pending;
    const isDone = pending === 0;

    return (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text-strong)] truncate">{section.sectionLabel}</h3>
                    {isDone && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest shrink-0">
                            ✓ Done
                        </span>
                    )}
                    {issues > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                            {issues} issue{issues > 1 ? "s" : ""}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-[var(--color-text-weak)]">{reviewed}/{total}</span>
                    {pending > 0 && (
                        <button
                            onClick={() => onSectionClear(section.sectionKey)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold min-h-[40px] bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" /> All Clear
                        </button>
                    )}
                </div>
            </div>
            <div className="p-3 space-y-2">
                {section.items.map((item) => (
                    <CheckItemRow
                        key={item._id}
                        item={item}
                        sectionKey={section.sectionKey}
                        onChange={onChange}
                    />
                ))}
            </div>
        </div>
    );
}
