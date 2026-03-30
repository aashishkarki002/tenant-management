/**
 * checkListResultDetails.jsx  — tenant-owner view (redesigned)
 *
 * Design: warm editorial minimalism
 *   – Instrument Serif headline + Outfit body
 *   – Paper-white (#F9F8F5) background
 *   – Left-border accent rows instead of full-bg chips
 *   – Bottom sheet for history (industry standard mobile pattern)
 *   – Horizontal segmented pass-rate bar (cleaner than radial for quick read)
 */

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import {
    ArrowLeft,
    CalendarDays,
    User,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronRight,
    History,
    X,
    RefreshCw,
    Loader2,
    StickyNote,
    Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../plugins/axios";
import {
    CATEGORY_LABELS,
    STATUS_LABELS,
    getStatusBadgeClass,
} from "../constants/checkListConstants";
import { formatTime } from "../utils/checkListDateUtil";

// ─── Google Fonts injection ───────────────────────────────────────────────────
// In production, add these to your index.html <head> instead.
// <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />

// ─── Token palette ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    PENDING: {
        label: "Pending",
        dot: "bg-zinc-400",
        text: "text-zinc-500",
        bar: "#A1A1AA",
        border: "border-l-zinc-300",
        bg: "bg-zinc-50",
    },
    IN_PROGRESS: {
        label: "In Progress",
        dot: "bg-blue-500",
        text: "text-blue-600",
        bar: "#3B82F6",
        border: "border-l-blue-400",
        bg: "bg-blue-50",
    },
    COMPLETED: {
        label: "Completed",
        dot: "bg-emerald-500",
        text: "text-emerald-600",
        bar: "#10B981",
        border: "border-l-emerald-400",
        bg: "bg-emerald-50",
    },
    INCOMPLETE: {
        label: "Incomplete",
        dot: "bg-amber-500",
        text: "text-amber-600",
        bar: "#F59E0B",
        border: "border-l-amber-400",
        bg: "bg-amber-50",
    },
};

function computePassRate(result) {
    if (!result?.totalItems) return 0;
    return Math.round((result.passedItems / result.totalItems) * 100);
}

// ─── Segmented progress bar ───────────────────────────────────────────────────
// Industry standard for pass/fail ratios in inspection-style UIs
function SegmentedBar({ passed, failed, total }) {
    if (!total) return null;
    const passW = Math.round((passed / total) * 100);
    const failW = Math.round((failed / total) * 100);
    const emptyW = 100 - passW - failW;

    return (
        <div className="space-y-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                {passW > 0 && (
                    <div
                        className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                        style={{ width: `${passW}%` }}
                    />
                )}
                {failW > 0 && (
                    <div
                        className="h-full bg-rose-500 transition-all duration-700 ease-out"
                        style={{ width: `${failW}%` }}
                    />
                )}
                {emptyW > 0 && (
                    <div className="h-full bg-zinc-200" style={{ width: `${emptyW}%` }} />
                )}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {passed} passed
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {failed} failed
                </span>
                <span className="flex items-center gap-1.5 ml-auto font-medium text-zinc-700">
                    {passW}% pass rate
                </span>
            </div>
        </div>
    );
}

// ─── Single item row ──────────────────────────────────────────────────────────
// Left-border pattern: passes = subtle, failures = prominent
function ItemRow({ item, index }) {
    const passed = item.isOk ?? item.passed ?? item.status === "pass";
    const note = item.notes ?? item.note ?? item.remarks ?? "";
    const label = item.label ?? item.name ?? item.checkItem ?? `Item ${index + 1}`;

    return (
        <div
            className={cn(
                "flex items-start gap-3 border-l-2 pl-3 py-2.5 transition-colors",
                passed
                    ? "border-l-emerald-300"
                    : "border-l-rose-400"
            )}
        >
            <div className="mt-0.5 shrink-0">
                {passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p
                    className={cn(
                        "text-sm leading-snug",
                        passed ? "text-zinc-700 font-normal" : "text-zinc-900 font-medium"
                    )}
                >
                    {label}
                </p>
                {note && (
                    <p className="mt-0.5 text-xs text-zinc-400 flex items-start gap-1">
                        <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
                        {note}
                    </p>
                )}
            </div>
            {!passed && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-rose-500/80 mt-0.5">
                    Issue
                </span>
            )}
        </div>
    );
}

// ─── Section group ────────────────────────────────────────────────────────────
function SectionGroup({ section }) {
    const failedCount = section.items.filter(
        (it) => !(it.isOk ?? it.passed ?? it.status === "pass")
    ).length;

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                    {section.sectionLabel ?? section.sectionKey}
                </span>
                {failedCount > 0 && (
                    <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">
                        {failedCount} {failedCount === 1 ? "issue" : "issues"}
                    </span>
                )}
            </div>
            <div className="space-y-0.5">
                {section.items.map((item, i) => (
                    <ItemRow key={item._id ?? i} item={item} index={i} />
                ))}
            </div>
        </div>
    );
}

// ─── History bottom sheet ─────────────────────────────────────────────────────
/**
 * Industry pattern: bottom sheet (like Google Maps / Airbnb)
 * – Slides up from bottom on mobile
 * – Centered modal sheet on desktop
 * – Backdrop dismisses on click
 * – Drag handle at top (visual affordance)
 */
function HistorySheet({ isOpen, onClose, history = [], isLoading, categoryLabel }) {
    const sheetRef = useRef(null);

    // Trap focus inside sheet when open (a11y)
    useEffect(() => {
        if (isOpen) {
            sheetRef.current?.focus();
        }
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                tabIndex={-1}
                role="dialog"
                aria-label="Checklist history"
                aria-modal="true"
                className={cn(
                    // Mobile: bottom sheet | Desktop: centered modal-like sheet
                    "fixed z-50 bg-[#FAFAF8] shadow-2xl outline-none",
                    "left-0 right-0 bottom-0 rounded-t-2xl max-h-[80vh]",
                    "sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 sm:w-full sm:max-w-md sm:rounded-2xl",
                    "transition-all duration-300 ease-out",
                    isOpen
                        ? "translate-y-0 opacity-100"
                        : "translate-y-full sm:translate-y-4 opacity-0 pointer-events-none"
                )}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="h-1 w-10 rounded-full bg-zinc-300" />
                </div>

                {/* Sheet header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">Check History</h2>
                        <p className="text-xs text-zinc-400">{categoryLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
                        aria-label="Close history"
                    >
                        <X className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                </div>

                {/* Sheet body */}
                <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-zinc-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <p className="text-xs">Loading history…</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-10 text-center">
                            <History className="h-7 w-7 text-zinc-200 mx-auto mb-2" />
                            <p className="text-sm text-zinc-400">No past checks found</p>
                        </div>
                    ) : (
                        history.map((entry, idx) => {
                            const cfg =
                                STATUS_CONFIG[entry.hasIssues ? "INCOMPLETE" : entry.status] ??
                                STATUS_CONFIG.PENDING;
                            const passRate = computePassRate(entry);

                            return (
                                <div
                                    key={entry._id ?? idx}
                                    className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 hover:border-zinc-200 hover:shadow-sm transition-all cursor-pointer"
                                >
                                    {/* Status dot */}
                                    <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />

                                    {/* Date */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-800 truncate">
                                            {entry.nepaliDate ?? "—"}
                                        </p>
                                        <p className="text-xs text-zinc-400 truncate">
                                            {entry.submittedBy?.name
                                                ? `By ${entry.submittedBy.name}`
                                                : cfg.label}
                                        </p>
                                    </div>

                                    {/* Pass rate chip */}
                                    {entry.status !== "PENDING" && (
                                        <span
                                            className={cn(
                                                "shrink-0 text-xs font-semibold tabular-nums rounded-full px-2 py-0.5",
                                                entry.hasIssues
                                                    ? "bg-rose-50 text-rose-600"
                                                    : "bg-emerald-50 text-emerald-600"
                                            )}
                                        >
                                            {passRate}%
                                        </span>
                                    )}

                                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return <div className={cn("animate-pulse rounded bg-zinc-100", className)} />;
}

function DetailSkeleton() {
    return (
        <div className="space-y-6 pt-2">
            <Skeleton className="h-4 w-20" />
            <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 pl-3 border-l-2 border-zinc-100">
                        <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                        <Skeleton className="h-3 flex-1" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function ChecklistResultDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // ── Fetch current result ──────────────────────────────────────────────────
    const fetchResult = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/api/checklists/results/${id}`);
            setResult(data?.data ?? data);
        } catch (err) {
            setError(err?.response?.data?.message ?? "Failed to load checklist result.");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchResult();
    }, [id, fetchResult]);
    const openHistory = useCallback(async () => {
        setHistoryOpen(true);
        if (history.length > 0 || !result) return;

        setHistoryLoading(true);
        try {
            const { data } = await api.get(`/api/checklists/results`, {
                params: {
                    propertyId: result.property?._id ?? result.property,
                    category: result.category,
                    blockId: result.block?._id ?? result.block ?? undefined,
                    status: "COMPLETED,INCOMPLETE",
                    limit: 30,
                },
            });

            const list = data?.data ?? data?.results ?? [];
            setHistory(
                Array.isArray(list)
                    ? list.filter((r) => String(r._id) !== id)  // ← Bug 1 fix
                    : []
            );
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [result, history.length, id]);

    // ── Close sheet on Escape ─────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") setHistoryOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // ── Derived values ────────────────────────────────────────────────────────
    const isPending = result?.status === "PENDING";
    const hasIssues = result?.hasIssues;
    const passRate = computePassRate(result);
    const cfg = STATUS_CONFIG[result?.status] ?? STATUS_CONFIG.PENDING;

    const categoryLabel = CATEGORY_LABELS?.[result?.category] ?? result?.category ?? "Inspection";
    const blockName = result?.block?.name ?? null;
    const submittedBy = result?.submittedBy?.name ?? null;
    const submittedTime = result?.submittedAt ? formatTime(result.submittedAt) : null;
    const nepaliDate = result?.nepaliDate ?? "—";
    const englishDate = result?.checkDate
        ? new Date(result.checkDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : null;

    // Support section-based structure (new API) and flat items (old API)
    const sections = result?.mergedSections ?? result?.sections ?? [];
    const flatItems = result?.items ?? result?.checkItems ?? [];
    const hasSections = sections.length > 0;

    const allFlatItems = hasSections
        ? sections.flatMap((s) => s.items ?? [])
        : flatItems;

    const totalFailed = allFlatItems.filter(
        (it) => !(it.isOk ?? it.passed ?? it.status === "pass")
    ).length;
    const totalPassed = allFlatItems.length - totalFailed;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="checklist-detail w-full min-h-full bg-background px-4 pb-4 pt-2">

                {/* ── Top nav bar ─────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-7">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </button>

                    {/* History trigger */}
                    {!isLoading && !error && result && (
                        <button
                            onClick={openHistory}
                            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors bg-white border border-zinc-200 hover:border-zinc-300 rounded-full px-3 py-1.5 shadow-sm"
                        >
                            <History className="h-3 w-3" />
                            History
                        </button>
                    )}
                </div>

                {/* ── States ──────────────────────────────────────────────────────── */}
                {isLoading ? (
                    <DetailSkeleton />
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-50 border border-rose-100">
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-700">{error}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">Something went wrong</p>
                        </div>
                        <button
                            onClick={fetchResult}
                            className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 bg-white rounded-full px-3 py-1.5 hover:border-zinc-300 transition-colors mt-1"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Try again
                        </button>
                    </div>
                ) : !result ? null : (
                    <div className="space-y-7">

                        {/* ── Header block ──────────────────────────────────────────────
                Category as editorial display heading (Instrument Serif)
                Status as inline pill — no card, just open typography
            ────────────────────────────────────────────────────────────── */}
                        <div className="space-y-2.5">
                            {/* Status + category type row */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border",
                                        isPending
                                            ? "text-zinc-500 bg-zinc-50 border-zinc-200"
                                            : hasIssues
                                                ? "text-rose-600 bg-rose-50 border-rose-100"
                                                : "text-emerald-700 bg-emerald-50 border-emerald-100"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            isPending
                                                ? "bg-zinc-400"
                                                : hasIssues
                                                    ? "bg-rose-500"
                                                    : "bg-emerald-500"
                                        )}
                                    />
                                    {isPending ? "Pending" : hasIssues ? "Issues found" : "All clear"}
                                </span>

                                {result.checklistType && (
                                    <span className="text-[11px] font-medium text-zinc-400 bg-zinc-100 rounded-full px-2.5 py-1">
                                        {result.checklistType.replace("_", " ")}
                                    </span>
                                )}
                            </div>

                            {/* Category heading */}
                            <h1 className="serif text-3xl text-zinc-900 leading-tight tracking-[-0.01em]">
                                {categoryLabel}
                            </h1>

                            {/* Meta line */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
                                    {nepaliDate}
                                </span>
                                {englishDate && (
                                    <span className="text-zinc-400 text-xs">{englishDate}</span>
                                )}
                                {blockName && (
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                                        {blockName}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Pass rate bar ──────────────────────────────────────────────
                Clean horizontal segmented bar — instant read for tenant owner
            ────────────────────────────────────────────────────────────── */}
                        {!isPending && result.totalItems > 0 && (
                            <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                <div className="flex items-baseline justify-between mb-3">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                                        Pass rate
                                    </span>
                                    <span className="serif text-2xl text-zinc-900 leading-none">
                                        {passRate}
                                        <span className="text-lg text-zinc-400">%</span>
                                    </span>
                                </div>
                                <SegmentedBar
                                    passed={result.passedItems}
                                    failed={result.failedItems}
                                    total={result.totalItems}
                                />
                            </div>
                        )}

                        {/* ── Submitted by / time meta ───────────────────────────────── */}
                        {!isPending && (submittedBy || submittedTime) && (
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                {submittedBy && (
                                    <span className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-zinc-400" />
                                        {submittedBy}
                                    </span>
                                )}
                                {submittedTime && (
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                        {submittedTime}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Divider */}
                        <div className="h-px bg-zinc-100" />

                        {/* ── Issues summary callout (if any) ───────────────────────────
                Shown at top so tenant owner sees it immediately
            ────────────────────────────────────────────────────────────── */}
                        {!isPending && hasIssues && (
                            <div className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3.5">
                                <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-rose-700">
                                        {result.failedItems} {result.failedItems === 1 ? "item" : "items"} need attention
                                    </p>
                                    <p className="text-xs text-rose-500/80 mt-0.5">
                                        Maintenance will be notified for unresolved issues.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Overall notes ──────────────────────────────────────────── */}
                        {result.overallNotes && (
                            <div className="flex items-start gap-2.5 text-sm text-zinc-600">
                                <StickyNote className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">{result.overallNotes}</p>
                            </div>
                        )}

                        {/* ── Checklist items (section-aware) ───────────────────────────
                Sections: group by section with section label header
                Flat items: single unified list sorted failed-first
            ────────────────────────────────────────────────────────────── */}
                        {isPending ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-center">
                                <Clock className="h-6 w-6 text-zinc-200" />
                                <p className="text-sm text-zinc-400">This check hasn't been submitted yet.</p>
                            </div>
                        ) : hasSections ? (
                            <div className="space-y-5">
                                {sections.map((section, si) => (
                                    <SectionGroup key={section._id ?? si} section={section} />
                                ))}
                            </div>
                        ) : flatItems.length > 0 ? (
                            <div className="space-y-5">
                                {/* Failed first — standard UX: show problems at top */}
                                {flatItems.filter((it) => !(it.isOk ?? it.passed ?? it.status === "pass")).length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 pb-1.5">
                                            Issues
                                        </p>
                                        {flatItems
                                            .filter((it) => !(it.isOk ?? it.passed ?? it.status === "pass"))
                                            .map((item, i) => (
                                                <ItemRow key={item._id ?? i} item={item} index={i} />
                                            ))}
                                    </div>
                                )}
                                {flatItems.filter((it) => it.isOk ?? it.passed ?? it.status === "pass").length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 pb-1.5">
                                            Passed
                                        </p>
                                        {flatItems
                                            .filter((it) => it.isOk ?? it.passed ?? it.status === "pass")
                                            .map((item, i) => (
                                                <ItemRow key={item._id ?? i} item={item} index={i} />
                                            ))}
                                    </div>
                                )}
                            </div>
                        ) : null}

                    </div>
                )}
            </div>

            {/* ── History bottom sheet ───────────────────────────────────────────── */}
            <HistorySheet
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                history={history}
                isLoading={historyLoading}
                categoryLabel={
                    CATEGORY_LABELS?.[result?.category] ?? result?.category ?? "Inspection"
                }
            />
        </>
    );
}

export default ChecklistResultDetail;