import { cn } from "@/lib/utils";
import { Camera, Zap, Droplets, LayoutGrid, Car, Flame, Waves } from "lucide-react";
import {
    CATEGORY_LABELS,
    STATUS_LABELS,
} from "../constants/checkListConstants";
import { formatTime } from "../utils/checkListDateUtil";

// ─── Category icon map ────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
    CCTV: Camera,
    ELECTRICAL: Zap,
    SANITARY: Droplets,
    COMMON_AREA: LayoutGrid,
    PARKING: Car,
    FIRE: Flame,
    WATER_TANK: Waves,
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    PENDING: { dot: "bg-zinc-300", badge: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
    IN_PROGRESS: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-600 ring-amber-200" },
    COMPLETED: { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
    INCOMPLETE: { dot: "bg-orange-400", badge: "bg-orange-50 text-orange-600 ring-orange-200" },
};

// ─── Dot matrix — each dot = one check item ───────────────────────────────────
// This immediately shows density + issue distribution at a glance.
function ItemDotMatrix({ totalItems, failedItems, isPending }) {
    const MAX_DOTS = 48; // cap for very large templates
    const displayCount = Math.min(totalItems, MAX_DOTS);
    const hasOverflow = totalItems > MAX_DOTS;

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: displayCount }).map((_, i) => {
                const isFailed = !isPending && i >= (displayCount - failedItems);
                return (
                    <span
                        key={i}
                        className={cn(
                            "rounded-sm transition-colors",
                            // slightly larger dots for small templates, smaller for large
                            displayCount <= 20 ? "w-2.5 h-2.5" : "w-2 h-2",
                            isPending
                                ? "bg-zinc-200 dark:bg-zinc-700"
                                : isFailed
                                    ? "bg-rose-400"
                                    : "bg-emerald-400"
                        )}
                    />
                );
            })}
            {hasOverflow && (
                <span className="text-[10px] font-mono text-muted-foreground">
                    +{totalItems - MAX_DOTS}
                </span>
            )}
        </div>
    );
}

// ─── Main card ────────────────────────────────────────────────────────────────

/**
 * ResultCard
 *
 * Redesigned: data-dense tile, no left-border gimmick.
 * Signature: dot matrix showing every check item as a colored dot.
 *
 * Props:
 *   result   ChecklistResult
 *   onClick  (result) → void
 */
function ResultCard({ result, onClick }) {
    const Icon = CATEGORY_ICONS[result.category] ?? LayoutGrid;
    const isPending = result.status === "PENDING";
    const isCompleted = result.status === "COMPLETED";
    const hasIssues = result.hasIssues;
    const cfg = STATUS_CONFIG[result.status] ?? STATUS_CONFIG.PENDING;

    const passRate = result.totalItems
        ? Math.round((result.passedItems / result.totalItems) * 100)
        : 0;

    const blockName = result.block?.name ?? "Property-wide";
    const categoryLabel = CATEGORY_LABELS[result.category] ?? result.category;
    const submitterName = result.submittedBy?.name ?? null;
    const submittedTime = result.submittedAt ? formatTime(result.submittedAt) : null;

    return (
        <button
            onClick={() => onClick?.(result)}
            className={cn(
                "group relative w-full text-left",
                "rounded-xl border bg-card",
                "p-4 space-y-3.5",
                "transition-all duration-150",
                "hover:shadow-md hover:border-border",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // Subtle tint for issue cards — not a border, just a background hint
                hasIssues && !isPending && "bg-rose-50/30 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30",
            )}
        >
            {/* ── Row 1: Category icon + name + status pill ─────────────────────── */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Icon badge */}
                    <span
                        className={cn(
                            "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg",
                            isPending
                                ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                                : hasIssues
                                    ? "bg-rose-100 text-rose-500 dark:bg-rose-900/40"
                                    : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40",
                        )}
                    >
                        <Icon className="w-3.5 h-3.5" />
                    </span>

                    {/* Category + block */}
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground leading-none truncate">
                            {categoryLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {blockName}
                        </p>
                    </div>
                </div>

                {/* Status pill */}
                <span
                    className={cn(
                        "flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5",
                        "rounded-full ring-1 ring-inset uppercase tracking-wider",
                        cfg.badge,
                    )}
                >
                    <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                    {STATUS_LABELS[result.status] ?? result.status}
                </span>
            </div>

            {/* ── Row 2: Big pass/fail numbers ─────────────────────────────────── */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    {isPending ? (
                        <>
                            <p className="text-2xl font-mono font-bold text-muted-foreground/25 leading-none tracking-tight">
                                — / {result.totalItems}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">awaiting check</p>
                        </>
                    ) : (
                        <>
                            <p className="text-2xl font-mono font-bold leading-none tracking-tight">
                                <span className={cn(hasIssues ? "text-rose-500" : "text-emerald-500")}>
                                    {result.passedItems}
                                </span>
                                <span className="text-muted-foreground/25 mx-0.5 font-light">/</span>
                                <span className="text-foreground">{result.totalItems}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">items passed</p>
                        </>
                    )}
                </div>

                {/* Pass rate — shown only when submitted */}
                {!isPending && (
                    <div className="text-right flex-shrink-0">
                        <p
                            className={cn(
                                "text-xl font-mono font-bold leading-none",
                                hasIssues ? "text-rose-500" : "text-emerald-500",
                            )}
                        >
                            {passRate}
                            <span className="text-sm font-semibold">%</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">pass rate</p>
                    </div>
                )}
            </div>

            {/* ── Row 3: Item dot matrix ────────────────────────────────────────── */}
            <ItemDotMatrix
                totalItems={result.totalItems}
                failedItems={result.failedItems}
                isPending={isPending}
            />

            {/* ── Row 4: Footer — submitter info + issue count ──────────────────── */}
            <div
                className={cn(
                    "flex items-center justify-between pt-2.5",
                    "border-t border-border/50",
                )}
            >
                {isPending ? (
                    <p className="text-[11px] text-muted-foreground/50">Not checked yet</p>
                ) : (
                    <p className="text-[11px] text-muted-foreground leading-tight">
                        {submitterName && (
                            <span className="font-medium text-foreground/70">{submitterName}</span>
                        )}
                        {submittedTime && (
                            <span className="text-muted-foreground">
                                {submitterName ? " · " : ""}{submittedTime}
                            </span>
                        )}
                        {!submitterName && !submittedTime && "Submitted"}
                    </p>
                )}

                {/* Issue count chip */}
                {!isPending && hasIssues && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full ring-1 ring-inset ring-rose-200 dark:ring-rose-800">
                        {result.failedItems} failed
                    </span>
                )}

                {/* All clear chip */}
                {isCompleted && !hasIssues && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800">
                        All clear
                    </span>
                )}
            </div>
        </button>
    );
}

export default ResultCard;