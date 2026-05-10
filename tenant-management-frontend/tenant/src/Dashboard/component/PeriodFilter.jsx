import React, { useMemo } from "react";
import { getTodayNepali, getFYStartYear } from "@/utils/nepaliDate";

const QUARTERS = [
  { id: "Q1", range: "Baisakh – Ashadh" },
  { id: "Q2", range: "Shrawan – Ashwin" },
  { id: "Q3", range: "Kartik – Poush" },
  { id: "Q4", range: "Magh – Chaitra" },
];

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={
        active
          ? {
              background: "var(--color-accent)",
              color: "#fff",
            }
          : {
              background: "var(--color-surface)",
              color: "var(--color-text-sub)",
              border: "1px solid var(--color-border)",
            }
      }
    >
      {children}
    </button>
  );
}

export default function PeriodFilter({
  quarter,
  fy,
  onQuarterChange,
  onFyChange,
  fyStartYear,
}) {
  const dateRange = useMemo(() => {
    const ranges = {
      Q1: "Baisakh 1 – Ashadh 30",
      Q2: "Shrawan 1 – Ashwin 30",
      Q3: "Kartik 1 – Poush 30",
      Q4: "Magh 1 – Chaitra 30",
    };
    return `${ranges[quarter]}, ${fy}`;
  }, [quarter, fy]);

  const fyOptions = useMemo(() => {
    const cur = fyStartYear;
    return [
      {
        id: `${cur}-${String(cur + 1).slice(-2)}`,
        label: `FY ${cur}–${String(cur + 1).slice(-2)}`,
      },
      {
        id: `${cur - 1}-${String(cur).slice(-2)}`,
        label: `FY ${cur - 1}–${String(cur).slice(-2)}`,
      },
    ];
  }, [fyStartYear]);

  return (
    <div
      className="flex items-center gap-2 px-4 shrink-0 border-b"
      style={{
        height: 44,
        background: "var(--color-surface-raised)",
        borderColor: "var(--color-border)",
      }}
      role="tablist"
      aria-label="Period filter"
    >
      {/* Quarter pills */}
      <div className="flex items-center gap-1.5">
        {QUARTERS.map((q) => (
          <Pill
            key={q.id}
            active={quarter === q.id}
            onClick={() => onQuarterChange(q.id)}
          >
            {q.id}
          </Pill>
        ))}
      </div>

      {/* Divider */}
      <div
        className="h-4 w-px shrink-0 mx-1"
        style={{ background: "var(--color-border)" }}
      />

      {/* FY pills */}
      <div className="flex items-center gap-1.5">
        {fyOptions.map((f) => (
          <Pill
            key={f.id}
            active={fy === f.id}
            onClick={() => onFyChange(f.id)}
          >
            {f.label}
          </Pill>
        ))}
      </div>

      {/* Date range label */}
      <span
        className="ml-auto text-[11px] shrink-0 tabular-nums"
        style={{ color: "var(--color-text-sub)" }}
      >
        {dateRange}
      </span>
    </div>
  );
}
