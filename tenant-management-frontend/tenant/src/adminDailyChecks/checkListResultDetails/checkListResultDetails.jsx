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
    ChevronLeft,
    History,
    X,
    RefreshCw,
    Loader2,
    StickyNote,
    Building2,
    ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../plugins/axios";
import {
    CATEGORY_LABELS,
    STATUS_LABELS,
    getStatusBadgeClass,
} from "../constants/checkListConstants";
import { formatTime } from "../utils/checkListDateUtil";

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

const IMAGE_BASE = "https://app.sallyanhouse.com/tenantsDocs";

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ images, startIndex, onClose }) {
    const [current, setCurrent] = useState(startIndex ?? 0);

    // Close on Escape, nav with arrow keys
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") setCurrent((c) => Math.min(c + 1, images.length - 1));
            if (e.key === "ArrowLeft") setCurrent((c) => Math.max(c - 1, 0));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [images.length, onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/95"
            onClick={onClose}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                {images.length > 1 && (
                    <span className="text-white/50 text-xs tabular-nums">
                        {current + 1} / {images.length}
                    </span>
                )}
                <button
                    onClick={onClose}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label="Close"
                >
                    <X className="h-4 w-4 text-white" />
                </button>
            </div>

            {/* Image */}
            <div
                className="flex-1 flex items-center justify-center px-4 pb-4 min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={`${IMAGE_BASE}${images[current]}`}
                    alt={`Image ${current + 1}`}
                    className="max-h-full max-w-full object-contain rounded-lg select-none"
                    draggable={false}
                />
            </div>

            {/* Prev / Next */}
            {images.length > 1 && (
                <div
                    className="flex items-center justify-between px-4 pb-5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
                        disabled={current === 0}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="h-5 w-5 text-white" />
                    </button>

                    {/* Dot indicators */}
                    <div className="flex gap-1.5">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                className={cn(
                                    "h-1.5 rounded-full transition-all",
                                    i === current ? "w-4 bg-white" : "w-1.5 bg-white/30"
                                )}
                                aria-label={`Go to image ${i + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrent((c) => Math.min(c + 1, images.length - 1))}
                        disabled={current === images.length - 1}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
                        aria-label="Next image"
                    >
                        <ChevronRight className="h-5 w-5 text-white" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Segmented progress bar ───────────────────────────────────────────────────
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

// ─── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, index, onImageOpen }) {
    const passed = item.isOk ?? item.passed ?? item.status === "pass";
    const note = item.notes ?? item.note ?? item.remarks ?? "";
    const label = item.label ?? item.name ?? item.checkItem ?? `Item ${index + 1}`;
    const images = Array.isArray(item.issueImages) ? item.issueImages.filter(Boolean) : [];

    return (
        <div
            className={cn(
                "flex flex-col gap-2 border-l-2 pl-3 py-2.5 transition-colors",
                passed ? "border-l-emerald-300" : "border-l-rose-400"
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                    {passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "text-sm leading-snug",
                        passed ? "text-zinc-700 font-normal" : "text-zinc-900 font-medium"
                    )}>
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

            {/* Issue images — tap to open lightbox, no new tab */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-6 mt-1">
                    {images.map((src, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onImageOpen(images, i)}
                            className="relative group block focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-lg"
                            aria-label={`View image ${i + 1}`}
                        >
                            <img
                                src={`${IMAGE_BASE}${src}`}
                                alt={`Issue ${i + 1}`}
                                className="h-20 w-20 object-cover rounded-lg border border-rose-100 group-hover:opacity-80 transition-opacity"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                                <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                                    <ZoomIn className="h-3.5 w-3.5 text-white" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Section group ────────────────────────────────────────────────────────────
function SectionGroup({ section, onImageOpen }) {
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
                    <ItemRow key={item._id ?? i} item={item} index={i} onImageOpen={onImageOpen} />
                ))}
            </div>
        </div>
    );
}

// ─── History bottom sheet ─────────────────────────────────────────────────────
function HistorySheet({ isOpen, onClose, history = [], isLoading, categoryLabel, onSelect }) {
    const sheetRef = useRef(null);

    useEffect(() => {
        if (isOpen) sheetRef.current?.focus();
    }, [isOpen]);

    return (
        <>
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={sheetRef}
                tabIndex={-1}
                role="dialog"
                aria-label="Checklist history"
                aria-modal="true"
                className={cn(
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
                                <button
                                    key={entry._id ?? idx}
                                    type="button"
                                    onClick={() => { onClose(); onSelect(entry._id); }}
                                    className="w-full flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 hover:border-zinc-200 hover:shadow-sm transition-all text-left"
                                >
                                    <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />

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
                                </button>
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

    // Lightbox state
    const [lightbox, setLightbox] = useState(null); // { images: [], startIndex: 0 }

    const openLightbox = useCallback((images, startIndex = 0) => {
        setLightbox({ images, startIndex });
    }, []);

    const closeLightbox = useCallback(() => setLightbox(null), []);

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
                    ? list.filter((r) => String(r._id) !== id)
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
        const onKey = (e) => {
            if (e.key === "Escape" && !lightbox) setHistoryOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightbox]);

    // ── Derived values ────────────────────────────────────────────────────────
    const isPending = result?.status === "PENDING";
    const hasIssues = result?.hasIssues;
    const passRate = computePassRate(result);

    const categoryLabel = CATEGORY_LABELS?.[result?.category] ?? result?.category ?? "Inspection";
    // Checklist template name if provided by API
    const checklistName = result?.checklist?.name ?? result?.checklistName ?? null;
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

    const sections = result?.sections ?? result?.mergedSections ?? [];
    const flatItems = result?.items ?? result?.checkItems ?? result?.itemResults ?? [];
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
            {/* Image lightbox — full screen, no new tab */}
            {lightbox && (
                <ImageLightbox
                    images={lightbox.images}
                    startIndex={lightbox.startIndex}
                    onClose={closeLightbox}
                />
            )}

            <div className="checklist-detail w-full min-h-full bg-background px-4 pb-6 pt-2">

                {/* ── Top nav bar ─────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </button>

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
                    <div className="space-y-6">

                        {/* ── Header ──────────────────────────────────────────────────── */}
                        <div className="space-y-2.5">
                            {/* Status pill */}
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
                                            isPending ? "bg-zinc-400" : hasIssues ? "bg-rose-500" : "bg-emerald-500"
                                        )}
                                    />
                                    {isPending ? "Pending" : hasIssues ? "Issues found" : "All clear"}
                                </span>

                                {result.checklistType && (
                                    <span className="text-[11px] font-medium text-zinc-400 bg-zinc-100 rounded-full px-2.5 py-1">
                                        {result.checklistType.replace(/_/g, " ")}
                                    </span>
                                )}
                            </div>

                            {/* What check this is */}
                            <h1 className="serif text-3xl text-zinc-900 leading-tight tracking-[-0.01em]">
                                {categoryLabel}
                            </h1>

                            {/* Checklist template name — tells user exactly which checklist ran */}
                            {checklistName && (
                                <p className="text-sm text-zinc-500 font-medium">{checklistName}</p>
                            )}

                            {/* Meta: date, block, who, when */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
                                    {nepaliDate}
                                </span>
                                {englishDate && (
                                    <span className="text-zinc-400 text-xs hidden sm:inline">{englishDate}</span>
                                )}
                                {blockName && (
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                                        {blockName}
                                    </span>
                                )}
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
                        </div>

                        {/* ── Pass rate bar ─────────────────────────────────────────────── */}
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

                        {/* ── Issues callout ─────────────────────────────────────────────── */}
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

                        {/* ── Overall notes ──────────────────────────────────────────────── */}
                        {result.overallNotes && (
                            <div className="flex items-start gap-2.5 text-sm text-zinc-600">
                                <StickyNote className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">{result.overallNotes}</p>
                            </div>
                        )}

                        <div className="h-px bg-zinc-100" />

                        {/* ── Checklist items ────────────────────────────────────────────── */}
                        {isPending ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-center">
                                <Clock className="h-6 w-6 text-zinc-200" />
                                <p className="text-sm text-zinc-400">This check hasn't been submitted yet.</p>
                            </div>
                        ) : hasSections ? (
                            <div className="space-y-5">
                                {sections.map((section, si) => (
                                    <SectionGroup
                                        key={section._id ?? si}
                                        section={section}
                                        onImageOpen={openLightbox}
                                    />
                                ))}
                            </div>
                        ) : flatItems.length > 0 ? (
                            <div className="space-y-5">
                                {flatItems.filter((it) => !(it.isOk ?? it.passed ?? it.status === "pass")).length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 pb-1.5">
                                            Issues
                                        </p>
                                        {flatItems
                                            .filter((it) => !(it.isOk ?? it.passed ?? it.status === "pass"))
                                            .map((item, i) => (
                                                <ItemRow key={item._id ?? i} item={item} index={i} onImageOpen={openLightbox} />
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
                                                <ItemRow key={item._id ?? i} item={item} index={i} onImageOpen={openLightbox} />
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
                categoryLabel={categoryLabel}
                onSelect={(entryId) => navigate(`/admin-daily-checks/results/${entryId}`)}
            />
        </>
    );
}

export default ChecklistResultDetail;
