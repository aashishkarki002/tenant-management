import { AlertOctagon } from "lucide-react";

export function ConflictDialog({ staffName, onContinue, onCancel }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl px-5 pb-8 pt-5 flex flex-col gap-4"
                style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}>
                <div className="flex justify-center mb-1">
                    <div className="w-12 h-1.5 rounded-full bg-[var(--color-border)]" />
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                        <AlertOctagon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-base font-bold text-[var(--color-text-strong)]">Check Already In Progress</p>
                        <p className="text-sm text-[var(--color-text-sub)] mt-1">
                            <strong>{staffName}</strong> is currently filling this checklist.
                            Opening it simultaneously may cause their progress to be overwritten.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3.5 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-sm font-bold hover:bg-[var(--color-muted)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-[2] py-3.5 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
                    >
                        Open Anyway
                    </button>
                </div>
            </div>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
    );
}
