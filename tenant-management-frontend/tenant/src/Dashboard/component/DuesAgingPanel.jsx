import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, Mail, ChevronRight } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

// Group arrears by age (using consecutiveUnpaidMonths as proxy)
function groupByAge(arrears) {
  const fresh = [];   // 0-1 month (0-30 days equiv)
  const warn = [];    // 2-3 months (31-90 days)
  const danger = [];  // 4+ months (90+ days)

  for (const a of arrears) {
    const m = a.consecutiveUnpaidMonths ?? 0;
    if (m <= 1) fresh.push(a);
    else if (m <= 3) warn.push(a);
    else danger.push(a);
  }

  return { fresh, warn, danger };
}

function sum(arr) {
  return arr.reduce((s, a) => s + (a.totalDuePaisa ?? 0), 0) / 100;
}

// ── Aging row ────────────────────────────────────────────────────────────
function AgingRow({ label, sublabel, count, amount, zone, cta, ctaHref }) {
  const zones = {
    good: {
      stripe: "var(--color-success)",
      bg: "var(--color-success-bg)",
      amtColor: "var(--color-text-strong)",
    },
    warn: {
      stripe: "var(--color-warning)",
      bg: "var(--color-warning-bg)",
      amtColor: "var(--color-warning)",
    },
    danger: {
      stripe: "var(--color-danger)",
      bg: "var(--color-danger-bg)",
      amtColor: "var(--color-danger)",
    },
  };
  const cfg = zones[zone] ?? zones.good;

  return (
    <div
      className="age-row"
      style={{ background: cfg.bg }}
    >
      <div className="age-stripe" style={{ background: cfg.stripe }}/>
      <div className="age-body">
        <div className="age-top">
          <span className="age-range">{label}</span>
          <span className="age-count">{count} tenant{count !== 1 ? "s" : ""}</span>
        </div>
        <div className="age-note" style={{ color: "var(--color-text-sub)" }}>{sublabel}</div>
      </div>
      <div className="age-right">
        <div
          className="age-amt"
          style={{ fontFamily: "var(--font-mono)", color: cfg.amtColor }}
        >
          {formatRupeesCompact(amount)}
        </div>
        {cta && (
          <Link to={ctaHref ?? "/rent-payment"} className="uc-btn ghost text-xs">
            {cta}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Worst case banner ─────────────────────────────────────────────────────
function WorstCase({ arrear }) {
  if (!arrear) return null;
  const unit = arrear.units?.[0];
  return (
    <div className="worst-case">
      <AlertTriangle className="w-3.5 h-3.5 flex-none" style={{ color: "var(--color-danger)" }}/>
      <div className="wc-text">
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
          {unit?.unitNumber ?? unit?.name ?? "Unit"} — {arrear.tenant?.name ?? "Tenant"} ·{" "}
          {formatRupeesCompact((arrear.totalDuePaisa ?? 0) / 100)} owed
        </span>
        <small style={{ display: "block", color: "var(--color-text-sub)", marginTop: 2 }}>
          {(arrear.consecutiveUnpaidMonths ?? 0)} month{(arrear.consecutiveUnpaidMonths ?? 0) !== 1 ? "s" : ""} consecutive · consider formal notice
        </small>
      </div>
      <Link to="/rent-payment" className="uc-btn danger text-xs shrink-0">
        Open file
      </Link>
    </div>
  );
}

export default function DuesAgingPanel({ arrears = [], loading }) {
  const { fresh, warn, danger } = useMemo(() => groupByAge(arrears), [arrears]);

  const totalOutstanding = sum([...fresh, ...warn, ...danger]);

  // worst case = highest debt in danger zone
  const worstCase = danger.length > 0
    ? [...danger].sort((a, b) => (b.totalDuePaisa ?? 0) - (a.totalDuePaisa ?? 0))[0]
    : null;

  if (loading && arrears.length === 0) {
    return (
      <div className="h-full flex flex-col gap-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted"/>
        {[1, 2, 3].map((x) => <div key={x} className="h-14 rounded bg-muted"/>)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="panel-h">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
            Outstanding dues by age
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Total ·{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {formatRupeesCompact(totalOutstanding)}
            </span>
          </p>
        </div>
        <Link
          to="/rent-payment"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          View all <ChevronRight className="w-3 h-3"/>
        </Link>
      </div>

      {arrears.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-1" style={{ color: "var(--color-success)" }}>✓</div>
            <div className="text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>
              No outstanding dues
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-text-sub)" }}>
              All tenants are current
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="age-list mt-3 flex-1">
            <AgingRow
              label="0–30 days"
              sublabel="Likely to collect · normal cycle"
              count={fresh.length}
              amount={sum(fresh)}
              zone="good"
              cta={fresh.length > 0 ? "View list" : null}
            />
            <AgingRow
              label="31–90 days"
              sublabel="Follow-up needed · grace period elapsed"
              count={warn.length}
              amount={sum(warn)}
              zone="warn"
              cta={warn.length > 0 ? "Send reminders" : null}
            />
            <AgingRow
              label="90+ days"
              sublabel="Legal action zone · written notice required"
              count={danger.length}
              amount={sum(danger)}
              zone="danger"
              cta={danger.length > 0 ? "Issue notice" : null}
            />
          </div>

          {worstCase && <WorstCase arrear={worstCase}/>}
        </>
      )}
    </div>
  );
}
