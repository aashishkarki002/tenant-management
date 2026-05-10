import React from "react";
import { formatPaisaCompact } from "@/lib/formatters";

const AGING_CONFIG = [
  { key: "severe", label: "60+ days", color: "#e24b4a" },
  { key: "moderate", label: "30–60 days", color: "#ef9f27" },
  { key: "mild", label: "0–30 days", color: "#fac775" },
];

function AgingRow({ label, amount, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((amount / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-sub)" }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: "var(--color-text-strong)" }}
        >
          {formatPaisaCompact(amount)}
        </span>
      </div>
      <div
        className="h-[3px] w-full rounded-full overflow-hidden"
        style={{ background: "var(--color-muted-fill)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ArrearsCard({ data, loading }) {
  const totalArrears = data?.totalArrears ?? 0;
  const tenantCount = data?.tenantCount ?? 0;
  const aging = data?.aging ?? { severe: 0, moderate: 0, mild: 0 };
  const allClear = totalArrears === 0;

  return (
    <div
      className="h-full flex flex-col gap-3 rounded-[14px] p-4"
      style={{
        background: "var(--color-surface-raised)",
        border: `1px solid ${allClear ? "var(--color-border)" : "var(--color-danger-border)"}`,
        boxShadow: "var(--shadow-card)",
      }}
      role="region"
      aria-label="Arrears"
    >
      {/* Label */}
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
      >
        Arrears
      </span>

      {/* Hero number */}
      {loading ? (
        <div
          className="h-8 w-28 rounded-lg animate-pulse"
          style={{ background: "var(--color-muted-fill)" }}
        />
      ) : allClear ? (
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[28px] font-bold tabular-nums leading-none"
            style={{ color: "var(--color-success)" }}
          >
            All clear
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-sub)" }}
          >
            No outstanding arrears
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[28px] font-bold tabular-nums leading-none"
            style={{
              color: "var(--color-danger)",
              letterSpacing: "-0.01em",
            }}
          >
            {formatPaisaCompact(totalArrears)}
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-sub)" }}
          >
            {tenantCount} tenant{tenantCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Aging buckets */}
      {!loading && !allClear && (
        <div className="flex flex-col gap-2.5 mt-auto">
          {AGING_CONFIG.map(({ key, label, color }) => (
            <AgingRow
              key={key}
              label={label}
              amount={aging[key] ?? 0}
              total={totalArrears}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
