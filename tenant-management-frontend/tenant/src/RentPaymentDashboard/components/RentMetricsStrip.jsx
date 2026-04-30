import { cn } from "@/lib/utils";

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Single-line muted summary strip — no cards, minimal visual weight.
 * Example: "0% collected · Rs 0 received · Rs 24,011 outstanding · 0/1 tenants paid"
 */
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

  return (
    <p className="text-xs text-muted-foreground tabular-nums select-none">
      <span className="text-foreground font-medium">{pct}%</span>
      {" collected · "}
      <span className="text-foreground font-medium">{fmtRs(totalCollected)}</span>
      {" received · "}
      <span
        className={cn(
          "font-medium",
          outstanding > 0 ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {fmtRs(outstanding)}
      </span>
      {" outstanding · "}
      <span className="text-foreground font-medium">
        {tenantsPaid}/{tenantsTotal}
      </span>
      {" tenants paid"}
    </p>
  );
};
