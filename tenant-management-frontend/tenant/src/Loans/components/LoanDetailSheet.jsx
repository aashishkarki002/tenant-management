import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Banknote, X, TrendingDown, Calendar, Hash, Building2, StickyNote } from "lucide-react";

import { fmtRupees, LOAN_TYPE_LABELS, toBSDate } from "../loan.constants";
import { ArcProgress, AmortizationRow, StatusBadge } from "./loan.ui";
import { useLoanSchedule } from "../hooks/useLoanSchedule";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

export function LoanDetailSheet({ loan, open, onClose, onPaymentSuccess }) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { scheduleData, loading } = useLoanSchedule(loan?._id, open);

  if (!loan) return null;

  const paidPct = parseFloat(loan.completionPercent ?? "0");
  const canPay = loan.status === "ACTIVE" && (loan.outstandingPaisa ?? 0) > 0;
  const paidAmount = (loan.principalPaisa ?? 0) - (loan.outstandingPaisa ?? 0);
  const schedule = scheduleData?.schedule ?? [];
  const summary = scheduleData?.summary ?? {};
  const firstUnpaid = schedule.findIndex((r) => !r.paid);

  const isDefaulted = loan.status === "DEFAULTED";
  const isClosed = loan.status === "CLOSED";

  const arcColorHex = isDefaulted
    ? "var(--color-danger, #dc2626)"
    : isClosed
      ? "var(--color-success, #16a34a)"
      : "var(--color-accent)";

  return (
    <>
      {/* ────────────────────────────────────────────────────────────
          SCROLL FIX:
          SheetContent → overflow-hidden  (clips flex children)
          ScrollArea   → flex-1 min-h-0   (min-h-0 allows flex shrink)
      ──────────────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-full max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* ── Header (sticky, never scrolls) ── */}
          <SheetHeader className="shrink-0 px-6 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SheetTitle className="text-base font-bold text-foreground truncate">
                    {loan.lender}
                  </SheetTitle>
                  <StatusBadge status={loan.status} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
                  {loan.loanAccountNumber && ` · ${loan.loanAccountNumber}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canPay && (
                  <Button
                    size="sm"
                    className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white h-8 px-3 text-[12px] font-bold"
                    onClick={() => setPaymentOpen(true)}
                  >
                    <Banknote className="w-3.5 h-3.5 mr-1.5" />
                    Pay EMI
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* ── Scrollable body ── */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">

              {/* ── Repayment summary card ── */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* top strip: progress ring + key numbers */}
                <div className="flex items-center gap-5 p-5">
                  <div className="shrink-0 relative w-[90px] h-[90px]">
                    <ArcProgress
                      pct={paidPct}
                      size={90}
                      stroke={7}
                      colorHex={arcColorHex}
                      showLabel={false}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[17px] font-bold tabular-nums text-foreground leading-none">
                        {Math.round(paidPct)}%
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                        repaid
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <SummaryRow label="Monthly EMI" value={fmtRupees(loan.emiPaisa)} bold />
                    <SummaryRow label="Outstanding" value={fmtRupees(loan.outstandingPaisa)} />
                    <SummaryRow label="Paid so far" value={fmtRupees(paidAmount)} highlight />
                    <SummaryRow label="Principal" value={fmtRupees(loan.principalPaisa)} />
                  </div>
                </div>

                {/* bottom strip: EMI progress */}
                <div className="border-t border-border px-5 py-3 bg-muted/50 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    EMI progress
                  </span>
                  <span className="text-[12px] font-bold tabular-nums text-foreground">
                    {loan.installmentsPaid ?? 0} / {loan.tenureMonths} paid
                  </span>
                </div>
              </div>

              {/* ── Loan details ── */}
              <Section title="Loan Details">
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  <DetailRow icon={Building2} label="Lender" value={loan.lender} />
                  <DetailRow icon={Building2} label="Loan type" value={LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType} />
                  <DetailRow icon={TrendingDown} label="Interest rate" value={`${loan.interestRateAnnual}% per annum`} />
                  <DetailRow icon={Calendar} label="Tenure" value={`${loan.tenureMonths} months`} />
                  <DetailRow icon={Calendar} label="Disbursed" value={toBSDate(loan.disbursedDate)} />
                  {loan.firstEmiDate && (
                    <DetailRow icon={Calendar} label="First EMI" value={toBSDate(loan.firstEmiDate)} />
                  )}
                  <DetailRow icon={Hash} label="Bank account" value={loan.bankAccountCode || "—"} />
                  {loan.loanAccountNumber && (
                    <DetailRow icon={Hash} label="Loan account no." value={loan.loanAccountNumber} />
                  )}
                  {loan.notes && (
                    <DetailRow icon={StickyNote} label="Notes" value={loan.notes} />
                  )}
                </div>
              </Section>

              {/* ── Amortization schedule ── */}
              <Section
                title="Amortization Schedule"
                badge={
                  (summary.remaining ?? 0) > 0
                    ? `${summary.remaining} remaining`
                    : undefined
                }
              >
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {loading ? (
                    <div className="py-12 flex flex-col items-center gap-3">
                      <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[12px] text-muted-foreground">Loading schedule…</span>
                    </div>
                  ) : schedule.length === 0 ? (
                    <p className="text-center text-sm py-10 text-muted-foreground">
                      Schedule not available
                    </p>
                  ) : (
                    schedule.map((row, idx) => (
                      <AmortizationRow
                        key={row.installment}
                        row={row}
                        isNext={firstUnpaid >= 0 && idx === firstUnpaid}
                      />
                    ))
                  )}
                </div>
              </Section>

            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <RecordPaymentDialog
        loan={loan}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={() => {
          setPaymentOpen(false);
          onPaymentSuccess?.();
          onClose();
        }}
      />
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function Section({ title, badge, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, highlight, bold }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-bold text-foreground" :
            highlight ? "font-semibold text-emerald-600 dark:text-emerald-400" :
              "font-medium text-foreground"
          }`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {Icon && <Icon size={12} className="text-muted-foreground shrink-0" />}
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-[12px] font-medium text-foreground text-right max-w-[200px] truncate">
        {value}
      </span>
    </div>
  );
}