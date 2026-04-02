import {
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Building2,
  ChevronRight,
  Percent,
  TrendingDown,
  Landmark,
  CreditCard,
} from "lucide-react";
import { fmtRupees, toBSDate, LOAN_TYPE_LABELS, STATUS } from "../loan.constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ─── Arc progress ─────────────────────────────────────────────────────────────
// showLabel: render the center % label or not (caller may overlay their own)
export function ArcProgress({
  pct = 0,
  size = 88,
  stroke = 7,
  colorClass = "stroke-primary",   // Tailwind stroke-* utility
  colorHex,                        // optional hex override (used for dynamic colors)
  showLabel = false,
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-border"
          strokeWidth={stroke}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorHex ?? undefined}
          className={colorHex ? undefined : colorClass}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums text-foreground">
            {Math.round(pct)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  ACTIVE: "bg-accent-light   text-accent   dark:bg-accent-950   dark:text-accent-300",
  CLOSED: "bg-success-light text-success dark:bg-success-950 dark:text-success-300",
  DEFAULTED: "bg-danger-light text-danger dark:bg-danger-950 dark:text-danger-300",
  PENDING: "bg-amber-light text-amber dark:bg-amber-950 dark:text-amber-300",
};

const STATUS_LABELS = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  DEFAULTED: "Defaulted",
  PENDING: "Pending",
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${style}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────────
const KPI_ACCENT_MAP = {
  amber: { icon: "bg-amber-100 dark:bg-amber-900", text: "text-amber-600 dark:text-amber-400" },
  primary: { icon: "bg-[var(--color-accent)]/10", text: "text-[var(--color-accent)]" },
  danger: { icon: "bg-red-100 dark:bg-red-900", text: "text-red-600 dark:text-red-400" },
  success: { icon: "bg-emerald-100 dark:bg-emerald-900", text: "text-emerald-600 dark:text-emerald-400" },
  info: { icon: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
};

export function KpiCard({ label, value, sub, icon: Icon, colorKey = "primary" }) {
  const colors = KPI_ACCENT_MAP[colorKey] ?? KPI_ACCENT_MAP.primary;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.icon}`}>
            <Icon size={14} className={colors.text} />
          </div>
        )}
      </div>

      <div>
        <div className={`text-2xl font-bold tabular-nums leading-none ${colors.text}`}>
          {value}
        </div>
        {sub && (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Loan card ─────────────────────────────────────────────────────────────────
const arcColorHex = {
  ACTIVE: "var(--color-accent)",
  CLOSED: "var(--color-success, #16a34a)",
  DEFAULTED: "var(--color-danger,  #dc2626)",
  PENDING: "var(--color-warning, #d97706)",
};

export function LoanCard({ loan, onClick }) {
  const paidPct = parseFloat(loan.completionPercent ?? "0");
  const isDefaulted = loan.status === "DEFAULTED";
  const isClosed = loan.status === "CLOSED";
  const remaining = (loan.tenureMonths ?? 0) - (loan.installmentsPaid ?? 0);
  const colorHex = arcColorHex[loan.status] ?? arcColorHex.ACTIVE;

  const progressBarClass = isDefaulted
    ? "bg-red-500"
    : isClosed
      ? "bg-emerald-500"
      : "bg-[var(--color-accent)]";

  return (
    <button
      onClick={() => onClick(loan)}
      className={`w-full text-left rounded-2xl border bg-card p-5 transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
        ${isDefaulted ? "border-red-300 dark:border-red-800" : "border-border"}`}
    >
      {/* ── Row 1: lender + arc ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[14px] font-bold text-foreground truncate">
              {loan.lender}
            </span>
            <StatusBadge status={loan.status} />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 size={10} />
            <span>{LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}</span>
            <span className="opacity-40">·</span>
            <Percent size={10} />
            <span className="font-medium">{loan.interestRateAnnual}% p.a.</span>
          </div>
        </div>

        {/* Arc – single label rendered inside */}
        <div className="shrink-0 w-14 h-14">
          <ArcProgress
            pct={paidPct}
            size={56}
            stroke={5}
            colorHex={colorHex}
            showLabel={true}
          />
        </div>
      </div>

      {/* ── Row 2: amounts ── */}
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        {[
          { l: "Principal", v: fmtRupees(loan.principalPaisa) },
          { l: "Paid", v: fmtRupees((loan.principalPaisa ?? 0) - (loan.outstandingPaisa ?? 0)) },
          { l: "Outstanding", v: fmtRupees(loan.outstandingPaisa) },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-xl bg-muted px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-[0.12em] mb-0.5 text-muted-foreground font-semibold">
              {l}
            </div>
            <div className="text-[12px] font-bold tabular-nums text-foreground">{v}</div>
          </div>
        ))}
      </div>

      {/* ── Row 3: progress bar ── */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${progressBarClass}`}
          style={{ width: `${Math.min(100, paidPct)}%` }}
        />
      </div>

      {/* ── Row 4: EMI footer ── */}
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
        <div className="flex items-center gap-2">
          {isClosed ? (
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
          ) : isDefaulted ? (
            <AlertCircle size={13} className="text-red-500 shrink-0" />
          ) : (
            <CalendarDays size={13} className="text-blue-500 shrink-0" />
          )}
          <span className="text-[12px] font-semibold text-foreground">
            {isClosed
              ? "Loan closed"
              : `${remaining} EMI${remaining !== 1 ? "s" : ""} remaining`}
          </span>
        </div>

        {!isClosed && (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[13px] font-bold tabular-nums text-foreground">
              {fmtRupees(loan.emiPaisa)}
            </span>
            <span className="text-[10px] text-muted-foreground">/mo</span>
          </div>
        )}
      </div>

      {/* ── Row 5: cta hint ── */}
      <div className="flex items-center justify-end mt-3 gap-1 text-[11px] text-[var(--color-accent)] font-semibold">
        <span>View schedule</span>
        <ChevronRight size={12} />
      </div>
    </button>
  );
}

// ─── Amortization row ──────────────────────────────────────────────────────────
export function AmortizationRow({ row, isNext }) {
  const isPaid = !!row.paid;

  const circleClass = isPaid
    ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-600"
    : isNext
      ? "bg-blue-100 dark:bg-blue-900 text-blue-600"
      : "bg-muted text-muted-foreground";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors
        ${isNext ? "bg-blue-50/50 dark:bg-blue-950/30" : ""}
        ${isPaid ? "opacity-60" : ""}`}
    >
      {/* installment number / check */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${circleClass}`}
      >
        {isPaid ? <CheckCircle2 size={14} /> : row.installment}
      </div>

      {/* BS date if available */}
      <div className="flex-1 min-w-0">
        {isNext && (
          <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">
            Next due
          </div>
        )}
        {row.dueDateBS && (
          <div className="text-[11px] text-muted-foreground truncate">{row.dueDateBS}</div>
        )}
      </div>

      {/* principal + interest (hidden on small screens) */}
      <div className="hidden sm:flex gap-4 text-right shrink-0">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
            Principal
          </div>
          <div className="text-[12px] font-semibold tabular-nums text-foreground">
            {fmtRupees(row.principalPaisa)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
            Interest
          </div>
          <div className="text-[12px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {fmtRupees(row.interestPaisa)}
          </div>
        </div>
      </div>

      {/* total + balance */}
      <div className="text-right shrink-0 min-w-[90px]">
        <div className="text-[13px] font-bold tabular-nums text-foreground">
          {fmtRupees(row.totalPaisa)}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          bal: {fmtRupees(row.outstandingAfterPaisa)}
        </div>
      </div>
    </div>
  );
}