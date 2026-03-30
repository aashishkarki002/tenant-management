import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChecklistPagination
 *
 * Props:
 *   pagination   { page, totalPages, total, limit }
 *   goToPage     (pageNum) → void
 *   isLoading    boolean
 */
function ChecklistPagination({ pagination, goToPage, isLoading }) {
    const { page, totalPages, total } = pagination;

    if (totalPages <= 1) return null;

    const start = (page - 1) * pagination.limit + 1;
    const end = Math.min(page * pagination.limit, total);

    return (
        <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">
                Showing {start}–{end} of {total} results
            </p>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="h-7 w-7 p-0"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show pages around current
                    let pageNum;
                    if (totalPages <= 5) {
                        pageNum = i + 1;
                    } else if (page <= 3) {
                        pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                    } else {
                        pageNum = page - 2 + i;
                    }

                    return (
                        <Button
                            key={pageNum}
                            variant={pageNum === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            disabled={isLoading}
                            className={cn("h-7 w-7 p-0 text-xs", pageNum === page && "pointer-events-none")}
                        >
                            {pageNum}
                        </Button>
                    );
                })}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    className="h-7 w-7 p-0"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

export default ChecklistPagination;