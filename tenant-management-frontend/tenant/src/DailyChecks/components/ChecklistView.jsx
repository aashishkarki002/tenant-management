import { useState, useCallback } from "react";
import {
    ChevronLeft,
    AlertTriangle,
    Eye,
    EyeOff,
    MessageSquare,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Wrench,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { CATEGORY_META } from "../constants/dailyChecksConstants";
import { ProgressBar } from "./ProgressBar";
import { SectionGroup } from "./SectionGroup";

export function ChecklistView({ category, checklist, nepaliInfo, onBack, onSubmitSuccess }) {
    const meta = CATEGORY_META[category];
    const Icon = meta.icon;

    const [sections, setSections] = useState(() => {
        const raw = checklist?.data?.sections;
        if (!raw) return [];
        const status = checklist.data.status ?? "PENDING";
        const deltaMap = {};
        for (const ir of checklist.data.itemResults ?? []) {
            deltaMap[ir.itemId] = ir;
        }
        return JSON.parse(JSON.stringify(raw)).map((s) => ({
            ...s,
            items: s.items.map((it) => {
                const saved = deltaMap[it._id];
                if (saved) return { ...it, isOk: saved.isOk, notes: saved.notes ?? "" };
                return { ...it, isOk: status === "PENDING" ? null : true, notes: "" };
            }),
        }));
    });

    const [overallNotes, setOverallNotes] = useState(checklist?.data?.overallNotes ?? "");
    const [submitting, setSubmitting] = useState(false);

    const totalItems = sections.reduce((a, s) => a + s.items.length, 0);
    const reviewedCount = sections.reduce((a, s) => a + s.items.filter((it) => it.isOk !== null).length, 0);
    const issueCount = sections.reduce((a, s) => a + s.items.filter((it) => it.isOk === false).length, 0);
    const pendingCount = totalItems - reviewedCount;
    const reviewedSections = sections.filter((s) => s.items.every((it) => it.isOk !== null)).length;

    const handleItemChange = useCallback((sectionKey, itemId, patch) => {
        setSections((prev) =>
            prev.map((sec) =>
                sec.sectionKey !== sectionKey ? sec : {
                    ...sec,
                    items: sec.items.map((it) => String(it._id) !== String(itemId) ? it : { ...it, ...patch }),
                }
            )
        );
    }, []);

    const handleSectionAllClear = useCallback((sectionKey) => {
        setSections((prev) =>
            prev.map((sec) =>
                sec.sectionKey !== sectionKey ? sec : {
                    ...sec,
                    items: sec.items.map((it) => it.isOk === null ? { ...it, isOk: true, notes: "" } : it),
                }
            )
        );
    }, []);

    async function handleSubmit() {
        if (submitting) return;
        setSubmitting(true);
        try {
            const itemResults = [];
            for (const sec of sections) {
                for (const item of sec.items) {
                    const effectiveIsOk = item.isOk === null ? true : item.isOk;
                    if (!effectiveIsOk || item.notes?.trim()) {
                        itemResults.push({
                            itemId: item._id,
                            sectionKey: sec.sectionKey,
                            isOk: effectiveIsOk,
                            notes: item.notes?.trim() ?? "",
                        });
                    }
                }
            }
            const res = await api.patch(`/api/checklists/results/${checklist.data._id}/submit`, {
                itemResults,
                overallNotes,
                status: "COMPLETED",
                nepaliDate: nepaliInfo.nepaliISO,
                nepaliMonth: nepaliInfo.bsMonth,
                nepaliYear: nepaliInfo.bsYear,
            });
            onSubmitSuccess(res.data);
        } catch (err) {
            const e = err;
            toast.error(e?.response?.data?.message ?? "Please try again");
        } finally {
            setSubmitting(false);
        }
    }

    if (!checklist?.data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
                <AlertTriangle className="w-12 h-12 text-[var(--color-warning)]" />
                <p className="text-base text-[var(--color-text-sub)]">No checklist data found.</p>
                <button onClick={onBack} className="text-base font-semibold text-[var(--color-accent)] underline">Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full">
            <div >
                <div className="flex items-center gap-3 mb-2.5">
                    <button
                        onClick={onBack}
                        className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-[var(--color-text-body)]" />
                    </button>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                        <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-[var(--color-text-strong)] truncate">{meta.label}</p>
                        <p className="text-xs text-[var(--color-text-sub)]">
                            {nepaliInfo.bsDay} {nepaliInfo.monthName} {nepaliInfo.bsYear} BS
                            · {reviewedSections}/{sections.length} sections
                        </p>
                    </div>
                    {issueCount > 0 && (
                        <span className="text-sm font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300 shrink-0">
                            {issueCount} ⚠
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <ProgressBar value={reviewedCount} max={totalItems} className="flex-1" color={issueCount > 0 ? "#f59e0b" : meta.color} />
                    <span className="text-sm font-semibold text-[var(--color-text-sub)] shrink-0 min-w-[70px] text-right">
                        {pendingCount > 0 ? `${pendingCount} left` : "All walked ✓"}
                    </span>
                </div>
            </div>

            {reviewedCount === 0 && (
                <div className="mx-4 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)]">
                    <Eye className="w-4 h-4 text-[var(--color-accent)] mt-0.5 shrink-0" />
                    <p className="text-sm text-[var(--color-accent)] leading-relaxed">
                        Walk each section. Tap <strong>All Clear</strong> when everything is fine. Only tap <strong>Issue?</strong> when something is wrong.
                    </p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {sections.map((sec) => (
                    <SectionGroup
                        key={sec.sectionKey}
                        section={sec}
                        onChange={handleItemChange}
                        onSectionClear={handleSectionAllClear}
                    />
                ))}

                <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-body)] mb-2">
                        <MessageSquare className="w-4 h-4" />
                        Overall Notes
                        <span className="font-normal text-[var(--color-text-weak)]">(optional)</span>
                    </label>
                    <textarea
                        value={overallNotes}
                        onChange={(e) => setOverallNotes(e.target.value)}
                        placeholder="Any general observations…"
                        rows={3}
                        className="w-full text-base rounded-xl px-4 py-3 resize-none border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] placeholder:text-[var(--color-text-weak)] text-[var(--color-text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                    />
                </div>
                <div className="h-4" />
            </div>

            <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-4">
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2.5 mb-3 px-4 py-2.5 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                        <EyeOff className="w-4 h-4 text-[var(--color-text-sub)] shrink-0" />
                        <p className="text-sm text-[var(--color-text-sub)]">
                            {pendingCount} item{pendingCount > 1 ? "s" : ""} not reviewed — will be treated as OK on submit
                        </p>
                    </div>
                )}
                {issueCount > 0 && (
                    <div className="flex items-center gap-2.5 mb-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800">
                            {issueCount} issue{issueCount > 1 ? "s" : ""} — repair task{issueCount > 1 ? "s" : ""} will be auto-created
                        </p>
                    </div>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] min-h-[56px] ${submitting ? "opacity-60 cursor-not-allowed" : ""} ${issueCount > 0 ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"}`}
                >
                    {submitting
                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
                        : issueCount > 0
                            ? <><AlertCircle className="w-5 h-5" /> Submit with {issueCount} Issue{issueCount > 1 ? "s" : ""}</>
                            : <><CheckCircle2 className="w-5 h-5" /> Submit — All Clear</>
                    }
                </button>
            </div>
        </div>
    );
}
