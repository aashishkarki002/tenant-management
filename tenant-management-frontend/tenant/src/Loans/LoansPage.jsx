import { useMemo, useState } from "react";
import {
  Landmark,
  Plus,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";

import { useHeaderSlot } from "../context/HeaderSlotContext";
import { useLoans } from "./hooks/useLoans";
import { fmtK, fmtRupees, paisaToRupees } from "./loan.constants";
import { getTodayNepali } from "../../utils/nepaliDate";
import { KpiCard, LoanCard } from "./components/loan.ui";
import { LoanDetailSheet } from "./components/LoanDetailSheet";
import { AddLoanDialog } from "./components/AddLoanDialog";
import { Button } from "@/components/ui/button";
// ↑ Fix: use @/ alias (was "../components/ui/button" which resolves incorrectly
//   from this file's depth for some bundler configs)
import { LiabilityBreakdown } from "./components/LiabilityBreakdown";

export default function LoansPage() {
  const { loans, loading, error, refetch } = useLoans();
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const todayLabel = useMemo(() => {
    const { day, monthName, year } = getTodayNepali();
    return `${day} ${monthName} ${year}`;
  }, []);

  const kpis = useMemo(() => {
    const active = loans.filter((l) => l.status === "ACTIVE");
    return {
      totalOutstandingPaisa: active.reduce((s, l) => s + (l.outstandingPaisa ?? 0), 0),
      totalPrincipalPaisa: loans.reduce((s, l) => s + (l.principalPaisa ?? 0), 0),
      defaultedCount: loans.filter((l) => l.status === "DEFAULTED").length,
      activeCount: active.length,
      // Next EMI: soonest by outstanding balance (lowest remaining = closest to end)
      nextEmiLoan: active
        .filter((l) => l.outstandingPaisa > 0)
        .sort((a, b) => a.outstandingPaisa - b.outstandingPaisa)[0],
    };
  }, [loans]);

  const activeLoans = useMemo(() => loans.filter((l) => l.status === "ACTIVE"), [loans]);

  const FILTERS = [
    { value: "ALL", label: "All", count: loans.length },
    { value: "ACTIVE", label: "Active", count: loans.filter((l) => l.status === "ACTIVE").length },
    { value: "CLOSED", label: "Closed", count: loans.filter((l) => l.status === "CLOSED").length },
    { value: "DEFAULTED", label: "Defaulted", count: loans.filter((l) => l.status === "DEFAULTED").length },
    { value: "PENDING", label: "Pending", count: loans.filter((l) => l.status === "PENDING").length },
  ];

  const visible = useMemo(
    () => statusFilter === "ALL" ? loans : loans.filter((l) => l.status === statusFilter),
    [loans, statusFilter]
  );

  /* ── Inject header actions ── */
  useHeaderSlot(
    () => (
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Button
          className="h-8 px-3.5 rounded-lg text-[12px] font-bold bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={13} className="mr-1" />
          <span className="hidden sm:inline">Add loan</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-border"
          onClick={refetch}
          title="Refresh"
        >
          <RefreshCw size={13} className="text-muted-foreground" />
        </Button>

      </div>
    ),
    [refetch, setAddOpen]
  );

  /* ── Total outstanding paisa across active (for bar widths) ── */
  const totalOutstanding = kpis.totalOutstandingPaisa;

  return (
    <>
      <div className="p-4 sm:p-6  mx-auto">

        {/* ── Page title ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={16} className="text-[var(--color-accent)]" />
            <h1 className="text-[22px] font-bold text-foreground tracking-tight">
              Loans & Liabilities
            </h1>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {todayLabel} — borrowed capital, EMI schedules &amp; outstanding obligations
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3">
            <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-red-700 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* ── KPI grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Total outstanding"
            value={fmtK(paisaToRupees(kpis.totalOutstandingPaisa))}
            sub={`across ${kpis.activeCount} active loan${kpis.activeCount !== 1 ? "s" : ""}`}
            icon={TrendingDown}
            colorKey="amber"
          />
          <KpiCard
            label="Total principal"
            value={fmtK(paisaToRupees(kpis.totalPrincipalPaisa))}
            sub={`${loans.length} loan${loans.length !== 1 ? "s" : ""} recorded`}
            icon={Landmark}
            colorKey="primary"
          />
          <KpiCard
            label="Defaulted"
            value={kpis.defaultedCount}
            sub={kpis.defaultedCount > 0 ? "Requires attention" : "All accounts current"}
            icon={AlertCircle}
            colorKey={kpis.defaultedCount > 0 ? "danger" : "success"}
          />
          <KpiCard
            label="Next EMI"
            value={kpis.nextEmiLoan ? fmtRupees(kpis.nextEmiLoan.emiPaisa) : "—"}
            sub={kpis.nextEmiLoan ? `${kpis.nextEmiLoan.lender} · open to see date` : "No active loans"}
            icon={CreditCard}
            colorKey="info"
          />
        </div>

        {/* ── Liability breakdown ── */}
        {activeLoans.length > 0 && (
          <div className="rounded-2xl border border-border bg-card mb-5 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Liability breakdown — active loans
              </span>
            </div>
            <div className="px-5 py-4 space-y-3.5">
              <LiabilityBreakdown activeLoans={activeLoans} onSelect={setSelectedLoan} />
            </div>
          </div>
        )}

        {/* ── Status filter tabs ── */}
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {FILTERS.filter((f) => f.value === "ALL" || f.count > 0).map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`h-7 px-3.5 rounded-full text-[11px] font-semibold transition-all duration-150 border
                  ${active
                    ? "bg-[var(--color-accent)] text-white border-transparent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-[var(--color-accent)]/40 hover:text-foreground"
                  }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`ml-1.5 ${active ? "opacity-70" : "opacity-50"}`}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Loan cards ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card animate-pulse h-56"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Landmark size={28} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[14px] font-semibold text-foreground mb-1">
              {statusFilter === "ALL" ? "No loans recorded yet" : `No ${statusFilter.toLowerCase()} loans`}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {statusFilter === "ALL"
                ? 'Click "Add loan" to record your first liability'
                : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visible.map((loan) => (
              <LoanCard key={loan._id} loan={loan} onClick={setSelectedLoan} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals / sheets ── */}
      <LoanDetailSheet
        loan={selectedLoan}
        open={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onPaymentSuccess={refetch}
      />

      <AddLoanDialog open={addOpen} onOpenChange={setAddOpen} onAdded={refetch} />
    </>
  );
}