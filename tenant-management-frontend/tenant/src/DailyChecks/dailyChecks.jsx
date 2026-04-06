import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Loader2,
    AlertTriangle,
    ArrowLeft,
    History,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import useProperty from "../hooks/use-property";
import { ALL_CATEGORIES, CATEGORY_META } from "./constants/dailyChecksConstants";
import { getNepaliDay } from "./utils/dailyChecksDate";
import { useDayResults } from "./hooks/useDayResults";
import {
    ProgressBar,
    DateNav,
    CategoryCard,
    ConflictDialog,
    HistoryPanel,
    ChecklistView,
    SubmittedResultView,
    ResultScreen,
} from "./components";

export default function DailyChecklistPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { property } = useProperty();
    const propertyLoading = property === null;
    const propertyId = Array.isArray(property) ? property[0]?._id ?? null : property?._id ?? null;
    const currentUserId = user?._id ?? null;

    const [daysBack, setDaysBack] = useState(0);
    const nepaliInfo = useMemo(() => getNepaliDay(daysBack), [daysBack]);

    const [viewState, setViewState] = useState({ view: "picker" });
    const [conflictPending, setConflictPending] = useState(null);

    const { results: dayResults, loading: loadingDay, reload, updateResult } =
        useDayResults(propertyId, nepaliInfo?.nepaliISO ?? null);

    const [creating, setCreating] = useState(false);

    const resultsByCategory = useMemo(() => {
        const map = {};
        for (const r of dayResults) map[r.category] = r;
        return map;
    }, [dayResults]);

    const doneCount = useMemo(
        () => dayResults.filter((r) => r.status === "COMPLETED").length,
        [dayResults]
    );

    function goToPicker() { setViewState({ view: "picker" }); }
    function goToHistory() { setViewState({ view: "history" }); }

    async function openChecklist(cat, existing) {
        setCreating(true);
        try {
            if (existing && existing.status !== "COMPLETED") {
                const res = await api.get(`/api/checklists/results/${existing._id}`);
                setViewState({ view: "checklist", category: cat, checklist: res.data });
                return;
            }
            const tplRes = await api.get("/api/checklists/templates", {
                params: { propertyId, category: cat, isActive: true },
            });
            const templates = tplRes.data?.data ?? [];
            if (!templates.length) {
                toast.error(`No template for ${CATEGORY_META[cat].label}. Ask your admin to set one up.`);
                return;
            }
            const createRes = await api.post("/api/checklists/results", {
                templateId: templates[0]._id,
                checkDate: new Date(Date.now() - daysBack * 86_400_000).toISOString(),
                nepaliDate: nepaliInfo.nepaliISO,
                nepaliMonth: nepaliInfo.bsMonth,
                nepaliYear: nepaliInfo.bsYear,
            });
            const fullRes = await api.get(
                `/api/checklists/results/${createRes.data.data._id}`
            );
            setViewState({ view: "checklist", category: cat, checklist: fullRes.data.data });
        } catch (err) {
            toast.error(err?.response?.data?.message ?? "Please try again");
        } finally {
            setCreating(false);
        }
    }

    async function handleCategorySelect(cat, result) {
        if (result?.status === "COMPLETED") {
            setViewState({ view: "submitted", category: cat, result });
            return;
        }

        const inProgressByOther =
            result?.status === "IN_PROGRESS" &&
            result.submittedBy != null &&
            result.submittedBy._id !== currentUserId;

        if (inProgressByOther) {
            setConflictPending({ cat, result });
            return;
        }

        await openChecklist(cat, result);
    }

    function handleSubmitSuccess(submitResult) {
        updateResult(submitResult.data);
        setViewState({ view: "result", result: submitResult });
    }

    function handleHistorySelectDay(nepaliISO) {
        const today = getNepaliDay(0);
        if (!today) return;
        for (let d = 0; d <= 30; d++) {
            const info = getNepaliDay(d);
            if (info?.nepaliISO === nepaliISO) {
                setDaysBack(d);
                setViewState({ view: "picker" });
                return;
            }
        }
        toast.info("Navigate to that date using the date arrows (max 3 days back).");
        setViewState({ view: "picker" });
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    if (propertyLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[var(--color-accent)]" />
                <p className="text-sm text-[var(--color-text-sub)]">Loading property…</p>
            </div>
        );
    }

    if (!propertyId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-[var(--color-warning)]" />
                <p className="text-base font-semibold text-[var(--color-text-body)]">No property found.</p>
                <p className="text-sm text-[var(--color-text-sub)]">Please contact your administrator.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col max-w-2xl mx-auto">

            {creating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface-raised)] rounded-3xl px-10 py-8 flex flex-col items-center gap-4 shadow-xl">
                        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-accent)]" />
                        <p className="text-base font-semibold text-[var(--color-text-body)]">Loading…</p>
                    </div>
                </div>
            )}

            {conflictPending && (
                <ConflictDialog
                    staffName={conflictPending.result.submittedBy?.name ?? "Another staff"}
                    onCancel={() => setConflictPending(null)}
                    onContinue={async () => {
                        const { cat, result } = conflictPending;
                        setConflictPending(null);
                        await openChecklist(cat, result);
                    }}
                />
            )}

            {viewState.view === "picker" && (
                <div className="px-4 pt-5 pb-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-[var(--color-text-body)]" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-[var(--color-text-strong)]">Daily Checks</h1>
                            <p className="text-sm text-[var(--color-text-sub)]">Building inspection log</p>
                        </div>
                        <button
                            onClick={reload}
                            className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-[var(--color-text-sub)]" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <DateNav
                            daysBack={daysBack}
                            onDaysBackChange={setDaysBack}
                            nepaliInfo={nepaliInfo}
                            onHistoryOpen={goToHistory}
                        />
                    </div>

                    {daysBack > 0 && (
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                            <History className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800">
                                <strong>Catch-up mode.</strong> Filling checks for {daysBack === 1 ? "yesterday" : `${daysBack} days ago`}. These will be saved with the correct BS date.
                            </p>
                        </div>
                    )}

                    <div className="rounded-2xl bg-[var(--color-accent)] px-5 py-4 flex items-center gap-4 mb-4">
                        <div>
                            <p className="text-white/75 text-sm">{greeting}</p>
                            <p className="text-white font-bold text-lg leading-tight">{user?.name ?? "Staff"}</p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-white font-black text-3xl tabular-nums leading-none">{doneCount}/{ALL_CATEGORIES.length}</p>
                            <p className="text-white/70 text-xs mt-0.5">done {daysBack === 0 ? "today" : "that day"}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-[var(--color-text-sub)]">Day's progress</p>
                        <p className="text-xs font-bold text-[var(--color-accent)]">
                            {doneCount === ALL_CATEGORIES.length ? "All clear 🎉" : `${ALL_CATEGORIES.length - doneCount} remaining`}
                        </p>
                    </div>
                    <ProgressBar value={doneCount} max={ALL_CATEGORIES.length} />
                </div>
            )}

            <div className="flex-1 flex flex-col">
                {viewState.view === "picker" && (
                    <div className="px-4 py-4 space-y-2.5">
                        {loadingDay
                            ? Array.from({ length: 5 }, (_, i) => (
                                <div key={i} className="h-[72px] rounded-2xl animate-pulse bg-[var(--color-surface-raised)]" />
                            ))
                            : ALL_CATEGORIES.map((cat) => (
                                <CategoryCard
                                    key={cat}
                                    cat={cat}
                                    result={resultsByCategory[cat] ?? null}
                                    currentUserId={currentUserId}
                                    onSelect={handleCategorySelect}
                                    isLoading={creating}
                                />
                            ))
                        }
                    </div>
                )}

                {viewState.view === "checklist" && (
                    <ChecklistView
                        category={viewState.category}
                        checklist={viewState.checklist}
                        nepaliInfo={nepaliInfo}
                        onBack={goToPicker}
                        onSubmitSuccess={handleSubmitSuccess}
                    />
                )}

                {viewState.view === "submitted" && (
                    <SubmittedResultView
                        result={viewState.result}
                        category={viewState.category}
                        currentUserId={currentUserId}
                        onBack={goToPicker}
                    />
                )}

                {viewState.view === "result" && (
                    <ResultScreen
                        result={viewState.result}
                        onNewCheck={goToPicker}
                        onBack={() => navigate(-1)}
                    />
                )}

                {viewState.view === "history" && propertyId && (
                    <HistoryPanel
                        propertyId={propertyId}
                        onClose={goToPicker}
                        onSelectDay={handleHistorySelectDay}
                    />
                )}
            </div>
        </div>
    );
}
