import React from "react";
import { Link } from "react-router-dom";
import { PieChart, ChevronRight, AlertTriangle } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

// Simple horizontal bar
function ExpBar({ label, pct, amount, color, subLabel }) {
  return (
    <div className="exp-row">
      <div className="exp-row-label">
        <span className="exp-sw" style={{ background: color }}/>
        <span style={{ color: "var(--color-text-body)", fontSize: 12 }}>{label}</span>
      </div>
      <div className="exp-track">
        <div
          className="exp-fill"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      <div className="exp-val">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-strong)" }}>
          {formatRupeesCompact(amount)}
        </span>
        {subLabel && (
          <small style={{ color: "var(--color-text-sub)", marginLeft: 4, fontSize: 10 }}>
            {subLabel}
          </small>
        )}
      </div>
    </div>
  );
}

export default function ExpenseBreakdownPanel({ stats, loading }) {
  const kpi = stats?.kpi ?? {};
  const buildings = stats?.buildings ?? [];

  // Derive expense-like breakdown from what we have:
  // We use collection data to show: Rent collected, CAM collected, Overdue
  const rentCollected = kpi.rentCollected ?? 0;
  const camCollected = kpi.camCollected ?? 0;
  const overdueAmount = stats?.attention?.overdueAmount ?? 0;
  const lateFeeOutstanding = kpi.lateFeeOutstanding ?? 0;

  const total = rentCollected + camCollected + (overdueAmount > 0 ? overdueAmount : 0);

  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);

  // Per-building collection (if available)
  const buildingRows = buildings.slice(0, 3);

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col gap-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted"/>
        {[1, 2, 3].map((x) => <div key={x} className="h-8 rounded bg-muted"/>)}
      </div>
    );
  }

  // Show buildings if we have them, else show collection breakdown
  const hasBuildingData = buildingRows.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            {hasBuildingData ? "Building performance" : "Collection breakdown"}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            This month
          </p>
        </div>
        <Link
          to="/accounting"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          Accounting <ChevronRight className="w-3 h-3"/>
        </Link>
      </div>

      {hasBuildingData ? (
        /* Building performance rows */
        <div className="exp-list mt-3 flex-1">
          {buildingRows.map((b) => (
            <div key={b._id} className="exp-row">
              <div className="exp-row-label">
                <span className="exp-sw" style={{ background: "var(--color-accent)" }}/>
                <span style={{ color: "var(--color-text-body)", fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.name}
                </span>
              </div>
              <div className="exp-track">
                <div
                  className="exp-fill"
                  style={{ width: `${b.collection?.rate ?? 0}%`, background: (b.collection?.rate ?? 0) >= 80 ? "var(--color-accent)" : "var(--color-warning)" }}
                />
              </div>
              <div className="exp-val">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-strong)" }}>
                  {b.collection?.rate ?? 0}%
                </span>
                <small style={{ color: "var(--color-text-sub)", marginLeft: 4, fontSize: 10 }}>
                  {b.occupancy?.occupied ?? 0}/{b.occupancy?.total ?? 0} occ.
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Collection breakdown */
        <div className="exp-list mt-3 flex-1">
          {rentCollected > 0 && (
            <ExpBar
              label="Rent collected"
              pct={pct(rentCollected)}
              amount={rentCollected}
              color="var(--color-accent)"
              subLabel={`${pct(rentCollected)}%`}
            />
          )}
          {camCollected > 0 && (
            <ExpBar
              label="CAM collected"
              pct={pct(camCollected)}
              amount={camCollected}
              color="var(--color-accent-mid)"
              subLabel={`${pct(camCollected)}%`}
            />
          )}
          {overdueAmount > 0 && (
            <ExpBar
              label="Outstanding"
              pct={pct(overdueAmount)}
              amount={overdueAmount}
              color="var(--color-danger)"
              subLabel="overdue"
            />
          )}
          {lateFeeOutstanding > 0 && (
            <ExpBar
              label="Late fees"
              pct={pct(lateFeeOutstanding)}
              amount={lateFeeOutstanding}
              color="var(--color-warning)"
              subLabel="owed"
            />
          )}
        </div>
      )}

      {/* Late fee alert */}
      {kpi.hasActiveFees && lateFeeOutstanding > 0 && (
        <div className="exp-alert mt-3">
          <AlertTriangle className="w-3.5 h-3.5 flex-none" style={{ color: "var(--color-warning)" }}/>
          <span style={{ color: "var(--color-text-body)", fontSize: 12 }}>
            {kpi.lateFeeTenantsCharged ?? 0} tenant{(kpi.lateFeeTenantsCharged ?? 0) !== 1 ? "s" : ""} accruing late fees ·{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {formatRupeesCompact(lateFeeOutstanding)}
            </span> outstanding
          </span>
        </div>
      )}
    </div>
  );
}
