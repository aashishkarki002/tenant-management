import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { IssueDialog } from "./IssueDialog";

export function CheckItemRow({ item, sectionKey, onChange }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const isIssue = item.isOk === false;
    const isCleared = item.isOk === true;

    return (
        <>
            <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${isIssue ? "border-amber-300 bg-amber-50"
                : isCleared ? "border-emerald-200 bg-emerald-50"
                    : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
                }`}>
                <div className="flex items-center gap-3 px-4 py-3.5 min-h-[56px]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isIssue ? "bg-amber-500" : isCleared ? "bg-emerald-500" : "bg-[var(--color-border)]"}`} />
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${isIssue ? "text-amber-800" : isCleared ? "text-emerald-700" : "text-[var(--color-text-body)]"}`}>
                            {item.label}
                        </p>
                        {item.quantity != null && (
                            <p className="text-xs text-[var(--color-text-weak)] mt-0.5">Qty: {item.quantity}</p>
                        )}
                        {isIssue && item.notes && (
                            <p className="text-xs text-amber-700 mt-1 bg-amber-100 rounded-lg px-2 py-1 line-clamp-2">
                                📝 {item.notes}
                            </p>
                        )}
                        {isIssue && item.images?.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                {item.images.slice(0, 4).map((img, i) => (
                                    <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-amber-300 shrink-0">
                                        <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                                        {i === 3 && item.images.length > 4 && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">+{item.images.length - 4}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                        {item.isOk === null && (
                            <button
                                onClick={() => setDialogOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-white border-2 border-amber-300 text-amber-700 hover:bg-amber-50 transition-all active:scale-95 min-h-[44px]"
                            >
                                <Flag className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Issue?</span>
                            </button>
                        )}
                        {isCleared && (
                            <button
                                onClick={() => setDialogOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-emerald-50 border-2 border-emerald-300 text-emerald-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-all active:scale-95 group min-h-[44px]"
                            >
                                <Check className="w-3.5 h-3.5 group-hover:hidden" />
                                <Flag className="w-3.5 h-3.5 hidden group-hover:block" />
                                <span className="group-hover:hidden">OK</span>
                                <span className="hidden group-hover:inline">Issue?</span>
                            </button>
                        )}
                        {isIssue && (
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => onChange(sectionKey, item._id, { isOk: true, notes: "" })}
                                    className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-bold bg-white border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 active:scale-95 min-h-[44px]"
                                    title="Mark as OK"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Clear</span>
                                </button>
                                <button
                                    onClick={() => setDialogOpen(true)}
                                    className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white active:scale-95 min-h-[44px]"
                                >
                                    <Flag className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Edit</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {dialogOpen && (
                <IssueDialog
                    item={item}
                    onConfirm={({ notes, images }) => { onChange(sectionKey, item._id, { isOk: false, notes, images }); setDialogOpen(false); }}
                    onCancel={() => setDialogOpen(false)}
                />
            )}
        </>
    );
}
