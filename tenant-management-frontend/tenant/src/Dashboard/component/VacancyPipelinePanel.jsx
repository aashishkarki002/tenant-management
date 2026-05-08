import React from "react";
import { Link } from "react-router-dom";
import { Building2, Phone, ChevronRight } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

export default function VacancyPipelinePanel({ stats, loading }) {
  const kpi = stats?.kpi ?? {};
  const contracts = stats?.contractsEndingSoon ?? [];

  const totalUnits = kpi.totalUnits ?? 0;
  const occupiedUnits = kpi.occupiedUnits ?? 0;
  const vacantUnits = kpi.vacantUnits ?? 0;
  const expiringCount = contracts.filter((c) => (c.daysUntilEnd ?? 999) <= 30).length;
  const occupancyRate = kpi.occupancyRate ?? 0;
  const vacancyRevenueLost = kpi.vacancyRevenueLost ?? 0;

  // Long-term vacant = vacant units (we don't have sub-breakdown, so show total vacant)
  // For now just use vacantUnits as the figure
  const longTermVacant = Math.max(0, vacantUnits - expiringCount);

  const occupiedPct = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
  const expiringPct = totalUnits > 0 ? (expiringCount / totalUnits) * 100 : 0;
  const vacantPct = Math.max(0, 100 - occupiedPct - expiringPct);

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col gap-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted"/>
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map((x) => <div key={x} className="h-16 rounded bg-muted"/>)}
        </div>
        <div className="h-3 rounded bg-muted"/>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Vacancy pipeline &amp; lease risk
          </h3>
          {vacancyRevenueLost > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
              Est. lost revenue ·{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-danger)" }}>
                {formatRupeesCompact(vacancyRevenueLost)}/mo
              </span>
            </p>
          )}
        </div>
        <Link
          to="/units"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          View units <ChevronRight className="w-3 h-3"/>
        </Link>
      </div>

      {/* tile grid */}
      <div className="vac-grid mt-3">
        <div className="vac-tile">
          <div className="vac-tile-l">Occupied</div>
          <div className="vac-tile-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>
            {occupiedUnits} / {totalUnits}
          </div>
          <div className="vac-tile-d" style={{ color: "var(--color-text-sub)" }}>
            {occupancyRate}% occupancy
          </div>
        </div>

        <div className="vac-tile" style={{ background: "var(--color-warning-bg)" }}>
          <div className="vac-tile-l" style={{ color: "var(--color-warning)" }}>Expiring · 30 days</div>
          <div className="vac-tile-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning)" }}>
            {expiringCount} lease{expiringCount !== 1 ? "s" : ""}
          </div>
          <div className="vac-tile-d" style={{ color: "var(--color-text-sub)" }}>
            renewal at risk
          </div>
        </div>

        <div
          className="vac-tile"
          style={{ background: vacantUnits > 0 ? "var(--color-danger-bg)" : undefined }}
        >
          <div className="vac-tile-l" style={{ color: vacantUnits > 0 ? "var(--color-danger)" : undefined }}>
            Vacant units
          </div>
          <div
            className="vac-tile-v"
            style={{ fontFamily: "var(--font-mono)", color: vacantUnits > 0 ? "var(--color-danger)" : "var(--color-text-strong)" }}
          >
            {vacantUnits}
          </div>
          <div className="vac-tile-d" style={{ color: "var(--color-text-sub)" }}>
            {vacantUnits === 0 ? "Fully occupied" : "currently empty"}
          </div>
        </div>

        <div className="vac-tile">
          <div className="vac-tile-l">Expiring · 60 days</div>
          <div className="vac-tile-v" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-strong)" }}>
            {contracts.length}
          </div>
          <div className="vac-tile-d" style={{ color: "var(--color-text-sub)" }}>
            total upcoming
          </div>
        </div>
      </div>

      {/* occupancy bar */}
      <div className="occ-bar mt-4">
        <div
          className="occ-seg"
          style={{ width: `${occupiedPct}%`, background: "var(--color-accent)", borderRadius: "4px 0 0 4px" }}
        />
        {expiringPct > 0 && (
          <div
            className="occ-seg"
            style={{ width: `${expiringPct}%`, background: "var(--color-warning)" }}
          />
        )}
        <div
          className="occ-seg"
          style={{
            width: `${vacantPct}%`,
            background: "var(--color-muted-fill, #d6d3cc)",
            borderRadius: "0 4px 4px 0",
          }}
        />
      </div>
      <div className="occ-legend">
        <span className="occ-leg-item">
          <span className="occ-leg-sw" style={{ background: "var(--color-accent)" }}/>
          Occupied · {occupiedUnits}
        </span>
        {expiringCount > 0 && (
          <span className="occ-leg-item">
            <span className="occ-leg-sw" style={{ background: "var(--color-warning)" }}/>
            Expiring · {expiringCount}
          </span>
        )}
        <span className="occ-leg-item">
          <span className="occ-leg-sw" style={{ background: "var(--color-muted-fill, #d6d3cc)" }}/>
          Vacant · {vacantUnits}
        </span>
      </div>

      {/* actions */}
      {(expiringCount > 0 || vacantUnits > 0) && (
        <div className="vac-actions mt-3">
          {expiringCount > 0 && (
            <Link to="/tenant/allTenants" className="uc-btn primary">
              <Phone className="w-3 h-3"/>Start renewal talks
            </Link>
          )}
          <Link to="/units" className="uc-btn ghost">
            Review units
          </Link>
        </div>
      )}
    </div>
  );
}
