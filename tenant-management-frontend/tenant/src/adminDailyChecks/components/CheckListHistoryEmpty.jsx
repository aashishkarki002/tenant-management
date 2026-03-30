import { Button } from "@/components/ui/button";
import { ClipboardX, FilterX } from "lucide-react";

/**
 * ChecklistHistoryEmpty
 *
 * Shown when there are no results — either because no checks
 * have been done yet, or because the active filters return nothing.
 *
 * Props:
 *   hasActiveFilters   boolean
 *   onClearFilters     () → void
 */
function ChecklistHistoryEmpty({ hasActiveFilters, onClearFilters }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            {hasActiveFilters ? (
                <>
                    <FilterX className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                        No results match your filters
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                        Try adjusting the category, block, or status filters.
                    </p>
                    <Button variant="outline" size="sm" onClick={onClearFilters}>
                        Clear filters
                    </Button>
                </>
            ) : (
                <>
                    <ClipboardX className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                        No checklist history yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Daily check results will appear here once submitted.
                    </p>
                </>
            )}
        </div>
    );
}

export default ChecklistHistoryEmpty;