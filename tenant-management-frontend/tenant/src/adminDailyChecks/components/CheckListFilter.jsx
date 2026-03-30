import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "../constants/checkListConstants";

/**
 * ChecklistFilters
 *
 * Props:
 *   filters      { category, blockId, status, hasIssues }
 *   setFilters   (updater) → void
 *   blocks       [{ _id, name }]   — populated from the property's block list
 *   isLoading    boolean
 */
function ChecklistFilters({ filters, setFilters, blocks = [], isLoading }) {
    const hasActiveFilters =
        filters.category || filters.blockId || filters.status || filters.hasIssues !== "";

    function handleChange(key, value) {
        setFilters((prev) => ({
            ...prev,
            [key]: value === "__all__" ? "" : value,
        }));
    }

    function clearFilters() {
        setFilters({ category: "", blockId: "", status: "", hasIssues: "" });
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Category */}
            <Select
                value={filters.category || "__all__"}
                onValueChange={(v) => handleChange("category", v)}
                disabled={isLoading}
            >
                <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Block */}
            {blocks.length > 0 && (
                <Select
                    value={filters.blockId || "__all__"}
                    onValueChange={(v) => handleChange("blockId", v)}
                    disabled={isLoading}
                >
                    <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue placeholder="All blocks" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All blocks</SelectItem>
                        {blocks.map((b) => (
                            <SelectItem key={b._id} value={b._id}>
                                {b.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {/* Status */}
            <Select
                value={filters.status || "__all__"}
                onValueChange={(v) => handleChange("status", v)}
                disabled={isLoading}
            >
                <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__all__">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Issues filter */}
            <Select
                value={filters.hasIssues === "" ? "__all__" : String(filters.hasIssues)}
                onValueChange={(v) =>
                    handleChange("hasIssues", v === "__all__" ? "" : v)
                }
                disabled={isLoading}
            >
                <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Any result" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__all__">Any result</SelectItem>
                    <SelectItem value="true">Issues only</SelectItem>
                    <SelectItem value="false">No issues</SelectItem>
                </SelectContent>
            </Select>

            {/* Clear button — only shown when something is active */}
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    disabled={isLoading}
                    className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3 w-3" />
                    Clear
                </Button>
            )}
        </div>
    );
}

export default ChecklistFilters;