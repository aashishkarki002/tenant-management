import React, { useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { NeaBillCard } from "./NeaBillCard";

/**
 * Collapsible table of all NEA bills for the property.
 * Each row rendered via NeaBillCard in compact mode.
 *
 * @param {Array}   bills   — NeaBill docs from useNeaBill
 * @param {boolean} loading
 */
export function NeaBillHistory({ bills = [], loading = false }) {
  const [open, setOpen] = useState(false);

  if (loading || !bills.length) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 18px",
          backgroundColor: "var(--color-surface)",
          border: "none",
          borderBottom: open ? "1px solid var(--color-border)" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <History size={14} color="var(--color-accent)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", flex: 1 }}>
          Bill History
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "99px",
            color: "var(--color-accent)",
            backgroundColor: "var(--color-accent-light)",
          }}
        >
          {bills.length} {bills.length === 1 ? "month" : "months"}
        </span>
        {open
          ? <ChevronUp size={13} color="var(--color-text-sub)" />
          : <ChevronDown size={13} color="var(--color-text-sub)" />}
      </button>

      {open && (
        <>
          {/* Column headers — must match CompactRow grid: 140 70 1fr 110 110 110 24 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 70px 1fr 110px 110px 110px 24px",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              backgroundColor: "var(--color-muted)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {[
              { label: "Period",       align: "left"  },
              { label: "Status",       align: "left"  },
              { label: "Units",        align: "left"  },
              { label: "Demand",       align: "right" },
              { label: "Total",        align: "right" },
              { label: "Difference",   align: "right" },
              { label: "",             align: "right" },
            ].map(({ label, align }) => (
              <span
                key={label}
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--color-text-sub)",
                  textAlign: align,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div>
            {bills.map((bill) => (
              <NeaBillCard
                key={bill._id ?? `${bill.nepaliYear}-${bill.nepaliMonth}`}
                bill={bill}
                compact
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
