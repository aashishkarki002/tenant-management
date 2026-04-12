import { cn } from "@/lib/utils";

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const MetricItem = ({ label, value, valueClass }) => (
  <div className="flex flex-col gap-0.5 min-w-0 px-3 sm:px-4 first:pl-0 last:pr-0">
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span
      className={cn(
        "text-sm font-semibold tabular-nums tracking-tight text-foreground",
        valueClass,
      )}
    >
      {value}
    </span>
  </div>
);

const Divider = () => (
  <div
    className="hidden sm:block h-8 w-px shrink-0 bg-border"
    aria-hidden
  />
);

/**
 * Compact inline KPI strip (Stripe-style) — no large cards.
 */
export const RentMetricsStrip = ({
  totalCollected,
  totalDue,
  tenantsPaid,
  tenantsTotal,
}) => {
  if (totalDue === 0) {
    return (
      <div className="rounded-lg border border-border bg-background px-4 py-3">
        <p className="text-xs text-muted-foreground">
          No rents in this period for the selected frequency. Use{" "}
          <span className="font-medium text-foreground">Process Rent</span> to
          generate records.
        </p>
      </div>
    );
  }

  const progressPct = Math.min((totalCollected / totalDue) * 100, 100);
  const pct = Math.round(progressPct);
  const outstanding = Math.max(0, totalDue - totalCollected);

  return (
    <div className="flex flex-wrap items-stretch gap-y-2 sm:gap-y-0 rounded-lg border border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
      <MetricItem label="Collection rate" value={`${pct}%`} />
      <Divider />
      <MetricItem label="Collected" value={fmtRs(totalCollected)} />
      <Divider />
      <MetricItem
        label="Outstanding"
        value={fmtRs(outstanding)}
        valueClass={outstanding > 0 ? "text-destructive" : undefined}
      />
      <Divider />
      <MetricItem
        label="Tenants paid"
        value={`${tenantsPaid} / ${tenantsTotal}`}
      />
    </div>
  );
};
