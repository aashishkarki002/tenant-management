import { cn } from "@/lib/utils";

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const RentMetricsStrip = ({
  totalCollected,
  totalDue,
  tenantsPaid,
  tenantsTotal,
}) => {
  if (totalDue === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No rents in this period.{" "}
        <span className="text-foreground font-medium">Process Rent</span>{" "}
        to generate records.
      </p>
    );
  }

  const pct = Math.round(Math.min((totalCollected / totalDue) * 100, 100));
  const outstanding = Math.max(0, totalDue - totalCollected);
  const allPaid = pct === 100;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700",
              allPaid
                ? "bg-emerald-500"
                : pct >= 60
                  ? "bg-primary"
                  : "bg-amber-500",
            )}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of rent collected`}
          />
        </div>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums shrink-0 w-9 text-right",
            allPaid
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {pct}%
        </span>
      </div>

      {/* Stat row */}
      <div className="flex items-center gap-3 text-xs tabular-nums flex-wrap">
        <div>
          <span className="text-muted-foreground">Collected </span>
          <span className="font-semibold text-foreground">
            {fmtRs(totalCollected)}
          </span>
        </div>

        <span className="text-border select-none">·</span>

        {outstanding > 0 ? (
          <div>
            <span className="text-muted-foreground">Outstanding </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {fmtRs(outstanding)}
            </span>
          </div>
        ) : (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Fully collected
          </span>
        )}

        <span className="text-border select-none">·</span>

        <div>
          <span className="font-semibold text-foreground">
            {tenantsPaid}/{tenantsTotal}
          </span>
          <span className="text-muted-foreground"> tenants paid</span>
        </div>
      </div>
    </div>
  );
};
