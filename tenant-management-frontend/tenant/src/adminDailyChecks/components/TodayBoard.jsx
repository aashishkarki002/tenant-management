import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Camera, Zap, Droplets, LayoutGrid, Car, Flame, Waves, ChevronRight, AlertTriangle, CheckCircle2, Clock, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { useTodayBoard } from "../hooks/useTodayBoard.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META = {
    CCTV: { label: "CCTV", Icon: Camera, color: "blue" },
    ELECTRICAL: { label: "Electrical", Icon: Zap, color: "amber" },
    SANITARY: { label: "Sanitary", Icon: Droplets, color: "teal" },
    COMMON_AREA: { label: "Common Area", Icon: LayoutGrid, color: "purple" },
    PARKING: { label: "Parking", Icon: Car, color: "gray" },
    FIRE: { label: "Fire Safety", Icon: Flame, color: "red" },
    WATER_TANK: { label: "Water Tank", Icon: Waves, color: "blue" },
};

// Palette per semantic color — keeps light + dark values together
const COLOR_TOKENS = {
    blue: { icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" },
    amber: { icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" },
    teal: { icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" },
    purple: { icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400" },
    gray: { icon: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
    red: { icon: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" },
};

const STATUS_CONFIG = {
    PENDING: { label: "Pending", bar: "bg-zinc-200 dark:bg-zinc-700", text: "text-muted-foreground", dot: "bg-zinc-400" },
    IN_PROGRESS: { label: "In progress", bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-400" },
    COMPLETED: { label: "All clear", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    INCOMPLETE: { label: "Incomplete", bar: "bg-orange-400", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400" },
};

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ summary }) {
    if (!summary) return null;

    const stats = [
        { value: summary.completed, label: "Done", color: "text-emerald-600 dark:text-emerald-400" },
        { value: summary.withIssues, label: "Issues", color: "text-rose-500" },
        { value: summary.inProgress, label: "Active", color: "text-amber-600 dark:text-amber-400" },
        { value: summary.pending, label: "Pending", color: "text-muted-foreground" },
    ];

    return (
        <div className="grid grid-cols-4 gap-2">
            {stats.map(({ value, label, color }) => (
                <div
                    key={label}
                    className="flex flex-col items-center justify-center rounded-lg bg-muted/40 py-2.5 px-2"
                >
                    <span className={cn("text-xl font-semibold tabular-nums leading-none", color)}>
                        {value}
                    </span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Individual result row ────────────────────────────────────────────────────

/**
 * ResultRow
 *
 * Compact, single-line row for one ChecklistResult.
 * Category icon | name + block | progress bar | status
 */
function ResultRow({ result, onClick }) {
    const meta = CATEGORY_META[result.category] ?? { label: result.category, Icon: LayoutGrid, color: "gray" };
    const tokens = COLOR_TOKENS[meta.color] ?? COLOR_TOKENS.gray;
    const cfg = result.hasIssues && result.status !== "PENDING"
        ? { label: `${result.failedItems} failed`, bar: "bg-rose-500", text: "text-rose-500", dot: "bg-rose-500" }
        : STATUS_CONFIG[result.status] ?? STATUS_CONFIG.PENDING;

    const isPending = result.status === "PENDING";
    const blockName = result.block?.name ?? "Property-wide";
    const passRate = result.totalItems && !isPending
        ? Math.round((result.passedItems / result.totalItems) * 100)
        : null;

    // Progress bar fill — 0 for pending, proportion otherwise
    const fillPct = isPending ? 0 : Math.round(((result.passedItems ?? 0) / (result.totalItems || 1)) * 100);

    return (
        <button
            onClick={() => onClick?.(result)}
            className={cn(
                "group w-full flex items-center gap-3 px-3 py-3 rounded-xl border",
                "bg-card transition-all duration-100",
                "hover:border-border hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                result.hasIssues && !isPending
                    ? "border-rose-100 dark:border-rose-900/30"
                    : "border-transparent",
            )}
        >
            {/* Category icon */}
            <span className={cn("flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg", tokens.icon)}>
                <meta.Icon className="w-3.5 h-3.5" />
            </span>

            {/* Name + block */}
            <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-semibold leading-none truncate text-foreground">
                    {meta.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{blockName}</p>
            </div>

            {/* Progress bar + counters */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[80px]">
                {/* Bar */}
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all", cfg.bar)}
                        style={{ width: `${fillPct}%` }}
                    />
                </div>
                {/* Count or rate */}
                {isPending ? (
                    <p className="text-[10px] text-muted-foreground/60">Not started</p>
                ) : (
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                        {result.passedItems}/{result.totalItems}
                        {passRate !== null && (
                            <span className={cn("ml-1 font-semibold", cfg.text)}>{passRate}%</span>
                        )}
                    </p>
                )}
            </div>

            {/* Status pill */}
            <span className={cn("flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full", cfg.text)}>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                {cfg.label}
            </span>

            {/* Chevron */}
            <ChevronRight className="flex-shrink-0 h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </button>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyToday({ onRefetch, propertyId, onGenerated }) {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = useCallback(async () => {
        setGenerating(true);
        try {
            // 1. Fetch all active templates for this property
            const tmplRes = await api.get("/api/checklists/templates", {
                params: { propertyId, isActive: true },
            });
            const templates = tmplRes.data?.data ?? [];

            if (!templates.length) {
                toast.error("No active templates found. Create a template first.");
                return;
            }

            // 2. Today's English date — what the backend expects as checkDate
            const checkDate = new Date().toISOString().split("T")[0];

            // 3. POST a result for each template (backend deduplicates via upsert)
            const outcomes = await Promise.allSettled(
                templates.map((t) =>
                    api.post("/api/checklists/results", {
                        templateId: t._id,
                        checkDate,
                    })
                )
            );

            const created = outcomes.filter(
                (o) => o.status === "fulfilled" && o.value.data?.success && !o.value.data?.alreadyExisted
            ).length;
            const existed = outcomes.filter(
                (o) => o.status === "fulfilled" && o.value.data?.alreadyExisted
            ).length;
            const failed = outcomes.filter((o) => o.status === "rejected").length;

            if (created > 0) {
                toast.success(`${created} checklist${created !== 1 ? "s" : ""} created for today.`);
            } else if (existed > 0) {
                toast.info("Today's checklists already exist — refreshing.");
            }
            if (failed > 0) {
                toast.error(`${failed} checklist${failed !== 1 ? "s" : ""} failed to create.`);
            }

            onGenerated?.();
        } catch (e) {
            toast.error(e.response?.data?.message ?? e.message ?? "Failed to generate checklists");
        } finally {
            setGenerating(false);
        }
    }, [propertyId, onGenerated]);

    return (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div>
                <p className="text-sm font-medium text-foreground">No checklists for today</p>
                <p className="text-xs text-muted-foreground mt-1">
                    The daily cron hasn't run yet, or it was missed.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="h-8 text-xs gap-1.5"
                >
                    {generating
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Plus className="h-3 w-3" />
                    }
                    {generating ? "Generating…" : "Generate today's checks"}
                </Button>
                <Button variant="outline" size="sm" onClick={onRefetch} className="text-xs h-8">
                    Refresh
                </Button>
            </div>
        </div>
    );
}

// ─── Overall health badge ─────────────────────────────────────────────────────

function HealthBadge({ summary }) {
    if (!summary || summary.total === 0) return null;

    const allDone = summary.completed === summary.total;
    const hasIssues = summary.withIssues > 0;
    const anyPending = summary.pending > 0;

    if (allDone && !hasIssues) {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                All clear
            </span>
        );
    }
    if (hasIssues) {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-full ring-1 ring-inset ring-rose-200 dark:ring-rose-800">
                <AlertTriangle className="h-3 w-3" />
                {summary.withIssues} {summary.withIssues === 1 ? "issue" : "issues"}
            </span>
        );
    }
    if (anyPending) {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                {summary.pending} pending
            </span>
        );
    }
    return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * TodayBoard
 *
 * Primary daily-use view — replaces the old card grid for "today".
 * Shows every category/block as a compact row with a progress bar.
 * One screenful. No scrolling needed for typical buildings.
 *
 * Props:
 *   propertyId    string   required
 *   nepaliDate    string   optional — override (used when opened from calendar)
 *   onCardClick   (result) → void   optional — opens detail sheet / navigates
 *   refreshKey    number   optional — increment to trigger a silent refetch (e.g. after template edit)
 */
function TodayBoard({ propertyId, nepaliDate: overrideDate, onCardClick, refreshKey = 0 }) {
    const navigate = useNavigate();

    const { results, summary, nepaliDate, isLoading, error, refetch } =
        useTodayBoard(propertyId, overrideDate ?? null);

    const prevRefreshKey = useRef(refreshKey);
    useEffect(() => {
        if (prevRefreshKey.current === refreshKey) return;
        prevRefreshKey.current = refreshKey;
        refetch();
    }, [refreshKey, refetch]);

    function handleClick(result) {
        if (onCardClick) {
            onCardClick(result);
        } else {
            navigate(`/admin-daily-checks/check-result-details/${result._id}`);
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-sm font-semibold text-foreground">
                        {overrideDate ? "Day's checks" : "Today's checks"}
                    </h2>
                    {nepaliDate && (
                        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            {nepaliDate}
                        </span>
                    )}
                    {!isLoading && summary && <HealthBadge summary={summary} />}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetch}
                    disabled={isLoading}
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Refresh"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* ── Summary strip ────────────────────────────────────────────────── */}
            {!isLoading && summary && summary.total > 0 && (
                <SummaryStrip summary={summary} />
            )}

            {/* ── Divider ─────────────────────────────────────────────────────── */}
            <div className="h-px bg-border/50" />

            {/* ── Content ─────────────────────────────────────────────────────── */}
            {isLoading ? (
                <TodayBoardSkeleton />
            ) : error ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 text-center space-y-2">
                    <p className="text-sm font-medium text-destructive">{error}</p>
                    <Button variant="link" size="sm" onClick={refetch} className="h-auto p-0 text-xs text-destructive underline">
                        Try again
                    </Button>
                </div>
            ) : results.length === 0 ? (
                <EmptyToday onRefetch={refetch} propertyId={propertyId} onGenerated={refetch} />
            ) : (
                <div className="space-y-1.5">
                    {results.map((result) => (
                        <ResultRow
                            key={result._id}
                            result={result}
                            onClick={handleClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TodayBoardSkeleton() {
    return (
        <div className="space-y-1.5 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-transparent">
                    <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-2.5 w-16 bg-muted/60 rounded" />
                    </div>
                    <div className="space-y-1.5 items-end flex flex-col">
                        <div className="h-1.5 w-20 bg-muted rounded-full" />
                        <div className="h-2.5 w-14 bg-muted/60 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-muted rounded-full flex-shrink-0" />
                    <div className="h-3.5 w-3.5 bg-muted/40 rounded flex-shrink-0" />
                </div>
            ))}
        </div>
    );
}

export default TodayBoard;