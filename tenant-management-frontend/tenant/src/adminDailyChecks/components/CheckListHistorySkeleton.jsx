import { Skeleton } from "@/components/ui/skeleton";

/**
 * ChecklistHistorySkeleton
 *
 * Rendered while the history is loading. Mirrors the real layout
 * so there's no layout shift when content appears.
 *
 * Props:
 *   rows   number  — how many day-groups to fake (default 3)
 */
function ChecklistHistorySkeleton({ rows = 3 }) {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          {/* Date heading */}
          <div className="flex items-baseline gap-3 mb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>

          {/* Category label */}
          <Skeleton className="h-3 w-20 mb-2" />

          {/* Two side-by-side cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-lg border border-l-4 border-l-slate-200 p-4 space-y-2.5">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
            <div className="rounded-lg border border-l-4 border-l-slate-200 p-4 space-y-2.5">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          </div>

          {/* Second category — single card */}
          {i < 2 && (
            <>
              <Skeleton className="h-3 w-16 mb-2 mt-3" />
              <div className="rounded-lg border border-l-4 border-l-slate-200 p-4 space-y-2.5">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChecklistHistorySkeleton;