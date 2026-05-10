import React from "react";
import { formatPaisaCompact } from "@/lib/formatters";

function BreakdownItem({ label, collected, due }) {
  const pct = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg p-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
      >
        {label}
      </span>
      <span
        className="text-lg font-semibold tabular-nums leading-none"
        style={{ color: "var(--color-text-strong)" }}
      >
        {formatPaisaCompact(collected)}
      </span>
      <div
        className="h-[3px] w-full rounded-full overflow-hidden"
        style={{ background: "var(--color-muted-fill)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: "var(--color-accent)" }}
        />
      </div>
      <span
        className="text-[9px] tabular-nums"
        style={{ color: "var(--color-text-sub)" }}
      >
        {pct}% of {formatPaisaCompact(due)}
      </span>
    </div>
  );
}

export default function RevenueCard({ data, loading }) {
  const totalCollected = data?.totalCollected ?? 0;
  const totalDue = data?.totalDue ?? 0;
  const collectionRate = data?.collectionRate ?? 0;
  const breakdown = data?.breakdown ?? {};

  const rateDir =
    collectionRate >= 80 ? "up" : collectionRate >= 50 ? "flat" : "down";
  const rateStyle = {
    up: {
      color: "var(--color-success)",
      background: "var(--color-success-bg)",
      border: "1px solid var(--color-success-border)",
    },
    flat: {
      color: "var(--color-warning)",
      background: "var(--color-warning-bg)",
      border: "1px solid var(--color-warning-border)",
    },
    down: {
      color: "var(--color-danger)",
      background: "var(--color-danger-bg)",
      border: "1px solid var(--color-danger-border)",
    },
  }[rateDir];

  return (
    <div
      className="h-full flex flex-col gap-3 rounded-[14px] p-4"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
      role="region"
      aria-label="Revenue collected"
    >
      {/* Label */}
      <span
        className="text-[11px] font-semibold uppercase"
        style={{
          color: "var(--color-text-sub)",
          letterSpacing: "0.5px",
        }}
      >
        Revenue Collected
      </span>

      {/* Hero number */}
      {loading ? (
        <div
          className="h-12 w-36 rounded-lg animate-pulse"
          style={{ background: "var(--color-muted-fill)" }}
        />
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="tabular-nums font-medium leading-none"
            style={{
              fontSize: 48,
              letterSpacing: "-0.02em",
              color: "var(--color-text-strong)",
            }}
          >
            {formatPaisaCompact(totalCollected)}
          </span>
          <span
            className="text-lg tabular-nums"
            style={{ color: "var(--color-text-sub)" }}
          >
            of {formatPaisaCompact(totalDue)}
          </span>
        </div>
      )}

      {/* Rate badge */}
      {!loading && (
        <span
          className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold tabular-nums"
          style={rateStyle}
        >
          {rateDir === "up" ? "↑" : rateDir === "down" ? "↓" : "→"}{" "}
          {collectionRate}% collection rate
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Breakdown grid */}
      <div className="grid grid-cols-3 gap-2">
        <BreakdownItem
          label="Rent"
          collected={breakdown.rent?.collected ?? 0}
          due={breakdown.rent?.due ?? 0}
        />
        <BreakdownItem
          label="CAM"
          collected={breakdown.cam?.collected ?? 0}
          due={breakdown.cam?.due ?? 0}
        />
        <BreakdownItem
          label="Elec"
          collected={breakdown.electricity?.collected ?? 0}
          due={breakdown.electricity?.due ?? 0}
        />
      </div>
    </div>
  );
}
