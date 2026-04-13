import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Banknote,
  Pencil,
  TrendingDown,
  Calendar,
  Hash,
  Building2,
  StickyNote,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { fmtRupees, LOAN_TYPE_LABELS, toBSDate, C } from "../loan.constants";
import { ArcProgress, AmortizationRow, StatusBadge } from "./loan.ui";
import { useLoanSchedule } from "../hooks/useLoanSchedule";
import { useLoanPayments } from "../hooks/useLoanPayments";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { EditLoanDialog } from "./EditLoanDialog";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "history", label: "History" },
];

export function LoanDetailSheet({ loan: initialLoan, open, onClose, onPaymentSuccess }) {
  const [loan, setLoan] = useState(initialLoan);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");

  // Sync loan prop changes (e.g. after refetch from parent)
  if (initialLoan !== loan && !paymentOpen && !editOpen) {
    setLoan(initialLoan);
  }

  const { scheduleData, loading: scheduleLoading } = useLoanSchedule(loan?._id, open);
  const { payments, loading: paymentsLoading } = useLoanPayments(
    loan?._id,
    open && activeTab === "history",
  );

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
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-full max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* ── Header ── */}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[12px] border-border"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="w-3 h-3 mr-1.5" />
                  Edit
                </Button>
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
              </div>
            </div>
          </SheetHeader>

          {/* ── Scrollable body ── */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">

              {/* ── Repayment summary card ── */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
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

                <div className="border-t border-border px-5 py-3 bg-muted/50 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">EMI progress</span>
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

              {/* ── Tabs: Schedule / History ── */}
              <div>
                {/* Tab bar */}
                <div className="flex items-center gap-1 mb-3 border-b border-border">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors duration-150 ${
                        activeTab === tab.id
                          ? "border-[var(--color-accent)] text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {activeTab === "schedule" && (summary.remaining ?? 0) > 0 && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      {summary.remaining} remaining
                    </span>
                  )}
                </div>

                {/* Schedule tab */}
                {activeTab === "schedule" && (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {scheduleLoading ? (
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
                )}

                {/* History tab */}
                {activeTab === "history" && (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {paymentsLoading ? (
                      <div className="py-12 flex flex-col items-center gap-3">
                        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[12px] text-muted-foreground">Loading history…</span>
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="py-12 text-center">
                        <Clock size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-[13px] text-muted-foreground">No payments recorded yet</p>
                      </div>
                    ) : (
                      payments.map((p) => (
                        <PaymentHistoryRow key={p._id} payment={p} />
                      ))
                    )}
                  </div>
                )}
              </div>

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

      <EditLoanDialog
        loan={loan}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(updated) => {
          if (updated) setLoan((prev) => ({ ...prev, ...updated }));
          onPaymentSuccess?.();
        }}
      />
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
        {title}
      </p>
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

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  mobile_wallet: "Mobile Wallet",
};

function PaymentHistoryRow({ payment }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--color-success-bg)" }}
        >
          <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-foreground">
            EMI #{payment.installmentNumber}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {toBSDate(payment.paymentDate)} · {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}
            {payment.notes && ` · ${payment.notes}`}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[12px] font-bold text-foreground tabular-nums">
          {fmtRupees(payment.totalPaisa)}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          P: {fmtRupees(payment.principalPaisa)} · I: {fmtRupees(payment.interestPaisa)}
        </p>
      </div>
    </div>
  );
}
