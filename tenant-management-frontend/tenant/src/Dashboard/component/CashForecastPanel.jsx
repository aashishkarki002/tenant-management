import React from "react";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRupeesCompact } from "@/lib/formatters";

export default function CashForecastPanel({ stats, loading }) {
  const kpi = stats?.kpi ?? {};

  // Expected IN: remaining billed (not yet collected)
  const expectedIn = Math.max(0, (kpi.totalBilled ?? 0) - (kpi.totalReceived ?? 0));
  // Very rough scheduled out: use maintenance cost estimate if available
  // We don't have exact expense data — use 0 as safe default
  const scheduledOut = 0;
  const netPosition = kpi.totalReceived ?? 0;

  const isHealthy = kpi.collectionRate >= 70;

  const overdueTenantsCount = stats?.attention?.overdueCount ?? 0;
  const overdueAmount = stats?.attention?.overdueAmount ?? 0;

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col gap-3 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted"/>
        <div className="h-16 rounded bg-muted"/>
        <div className="h-12 rounded bg-muted"/>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Collection snapshot
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            This month · live
          </p>
        </div>
        <div
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: isHealthy ? "var(--color-success)" : "var(--color-warning)" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5"/>
          {isHealthy ? "Healthy" : "Needs attention"}
        </div>
      </div>

      {/* hero */}
      <div className="fc-hero mt-3">
        <div className="fc-hero-label">Collected MTD</div>
        <div className="fc-hero-v" style={{ fontFamily: "var(--font-mono)" }}>
          {formatRupeesCompact(netPosition)}
          {isHealthy && (
            <CheckCircle2
              className="inline-block w-4 h-4 ml-1 align-baseline"
              style={{ color: "var(--color-success)" }}
            />
          )}
        </div>
        <div className="fc-hero-d" style={{ color: "var(--color-text-sub)" }}>
          {kpi.collectionRate ?? 0}% of billed amount
        </div>
      </div>

      {/* split */}
      <div className="fc-split mt-4">
        <div className="fc-col">
          <div className="fc-col-l">Still pending</div>
          <div
            className="fc-col-v"
            style={{
              fontFamily: "var(--font-mono)",
              color: expectedIn > 0 ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {formatRupeesCompact(expectedIn)}
          </div>
        </div>
        <div className="fc-divider"/>
        <div className="fc-col">
          <div className="fc-col-l">Tenants paid</div>
          <div className="fc-col-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-success)" }}>
            {kpi.tenantsPaid ?? 0}
            <span className="fc-col-of" style={{ color: "var(--color-text-sub)", fontFamily: "var(--font-sans)" }}>
              /{kpi.activeTenants ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* risk */}
      {overdueTenantsCount > 0 && (
        <div className="fc-risk mt-3">
          <div className="fc-risk-h">
            <AlertTriangle className="w-3.5 h-3.5 flex-none" style={{ color: "var(--color-danger)" }}/>
            Risk factors
          </div>
          <div className="fc-risk-body" style={{ color: "var(--color-text-body)" }}>
            {overdueTenantsCount} chronic late-payer{overdueTenantsCount !== 1 ? "s" : ""},{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-danger)" }}>
              {formatRupeesCompact(overdueAmount)}
            </span>{" "}
            outstanding
          </div>
        </div>
      )}

      {/* actions */}
      <div className="fc-recs mt-4 flex-1">
        <div className="fc-recs-h">Recommended</div>
        {expectedIn > 0 && (
          <div className="fc-rec">
            <span className="fc-dot"/>
            Send reminders to {kpi.tenantsWithBalance ?? 0} tenants with pending balances
          </div>
        )}
        {(stats?.contractsEndingSoon?.length ?? 0) > 0 && (
          <div className="fc-rec">
            <span className="fc-dot"/>
            {stats.contractsEndingSoon.length} lease{stats.contractsEndingSoon.length !== 1 ? "s" : ""} expiring soon — start renewal talks
          </div>
        )}
        {(stats?.maintenanceSummary?.open ?? 0) > 0 && (
          <div className="fc-rec">
            <span className="fc-dot"/>
            {stats.maintenanceSummary.open} open maintenance request{stats.maintenanceSummary.open !== 1 ? "s" : ""} · assign contractor
          </div>
        )}
      </div>

      <Link
        to="/rent-payment"
        className="mt-4 flex items-center gap-1 text-xs font-semibold"
        style={{ color: "var(--color-accent)" }}
      >
        Go to payments <ArrowRight className="w-3 h-3"/>
      </Link>
    </div>
  );
}
