import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Wrench,
  Zap,
  CalendarClock,
} from "lucide-react";

const ICON_MAP = {
  AlertTriangle,
  Wrench,
  Zap,
  CalendarClock,
};

function AlertRow({ severity, icon, label, badge, route }) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[icon] ?? AlertTriangle;
  const urgent = severity === "urgent";

  return (
    <button
      onClick={() => route && navigate(route)}
      className="w-full flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors"
      style={{
        background: "var(--color-surface)",
        borderLeft: `3px solid ${urgent ? "var(--color-danger)" : "var(--color-warning)"}`,
        cursor: route ? "pointer" : "default",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--color-accent-light)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--color-surface)")
      }
      role="button"
      aria-label={label}
    >
      <Icon
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: urgent ? "var(--color-danger)" : "var(--color-warning)" }}
      />
      <span
        className="flex-1 text-xs truncate"
        style={{ color: "var(--color-text-body)" }}
      >
        {label}
      </span>
      <span
        className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full shrink-0"
        style={{
          background: urgent ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
          color: urgent ? "var(--color-danger)" : "var(--color-warning)",
        }}
      >
        {badge}
      </span>
    </button>
  );
}

export default function NeedsAttentionCard({ alerts, loading }) {
  const list = Array.isArray(alerts) ? alerts.slice(0, 4) : [];
  const totalCount = Array.isArray(alerts) ? alerts.length : 0;
  const allClear = totalCount === 0;

  return (
    <div
      className="h-full flex flex-col gap-3 rounded-[14px] p-4"
      style={{
        background: "var(--color-surface-raised)",
        border: `1px solid ${
          allClear
            ? "var(--color-border)"
            : list.some((a) => a.severity === "urgent")
              ? "var(--color-danger-border)"
              : "var(--color-warning-border)"
        }`,
        boxShadow: "var(--shadow-card)",
      }}
      role="region"
      aria-label="Needs attention"
    >
      {/* Label */}
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: "var(--color-text-sub)", letterSpacing: "0.5px" }}
      >
        Needs Attention
      </span>

      {/* Count */}
      {loading ? (
        <div
          className="h-8 w-12 rounded-lg animate-pulse"
          style={{ background: "var(--color-muted-fill)" }}
        />
      ) : (
        <span
          className="text-[28px] font-bold tabular-nums leading-none"
          style={{
            color: allClear
              ? "var(--color-success)"
              : "var(--color-text-strong)",
          }}
        >
          {allClear ? "All clear" : totalCount}
        </span>
      )}

      {/* Alert rows */}
      {!loading && (
        <div className="flex flex-col gap-1.5 mt-auto">
          {allClear ? (
            <p
              className="text-xs"
              style={{ color: "var(--color-text-sub)" }}
            >
              No overdue rents, open maintenance, or expiring leases.
            </p>
          ) : (
            list.map((alert, i) => <AlertRow key={i} {...alert} />)
          )}
        </div>
      )}
    </div>
  );
}
