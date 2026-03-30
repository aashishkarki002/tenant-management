import { cn } from "@/lib/utils";
import ResultCard from "./ResultCard";
import { CATEGORY_LABELS } from "../constants/checkListConstants";

/**
 * CategoryRow
 *
 * Redesigned: lighter category label, adaptive grid.
 *
 * Props:
 *   category    string
 *   results     ChecklistResult[]
 *   onCardClick (result) → void
 */
function CategoryRow({ category, results, onCardClick }) {
    const sorted = [...results].sort((a, b) =>
        (a.block?.name ?? "").localeCompare(b.block?.name ?? ""),
    );

    return (
        <div>
            {/* Category label — subtle, not shouting */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-2 pl-0.5">
                {CATEGORY_LABELS[category] ?? category}
            </p>

            {/* Adaptive grid: 1 col → 2 col → 3 col as blocks scale */}
            <div
                className={cn(
                    "grid gap-3",
                    sorted.length === 1 && "grid-cols-1 max-w-sm",
                    sorted.length === 2 && "grid-cols-1 sm:grid-cols-2",
                    sorted.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                )}
            >
                {sorted.map((result) => (
                    <ResultCard key={result._id} result={result} onClick={onCardClick} />
                ))}
            </div>
        </div>
    );
}

export default CategoryRow;