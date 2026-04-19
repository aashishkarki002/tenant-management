/**
 * BalanceSheetTab.jsx
 *
 * Displays Assets = Liabilities + Equity for the selected entity.
 * Data source: GET /api/ledger/balance-sheet?entityId=...
 *
 * Patterns:
 *   - Hook: useBalanceSheet (mirrors useFundPositions pattern)
 *   - Primitives: Card, Lbl, Skeleton from AccountingPrimitives
 *   - Colors: CSS variables only (var(--color-*))
 *   - Money: paisa integers — divide by 100 for display, never floats
 */

import { useState } from "react";
import {
  ScaleIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  RefreshCwIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useBalanceSheet } from "../../hooks/useBalanceSheet";
import { exportBalanceSheetPDF } from "../../utils/exportUtils";
import { useEntity } from "../../../context/EntityContext";

// ─── Money formatter ──────────────────────────────────────────────────────────
function fmtPaisa(paisa = 0) {
  const abs = Math.abs(paisa);
  const sign = paisa < 0 ? "−" : "";
  return `${sign}₹ ${(abs / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── EquationBanner ───────────────────────────────────────────────────────────
function EquationBanner({ isBalanced, totalAssets, totalLiabilitiesAndEquity, discrepancy }) {
  const color   = isBalanced ? "var(--color-success)"    : "var(--color-danger)";
  const bgColor = isBalanced ? "var(--color-success-bg)" : "var(--color-danger-bg)";
  const Icon    = isBalanced ? CheckCircle2Icon : AlertTriangleIcon;
  const label   = isBalanced ? "Balanced" : "Out of Balance";

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-4 px-5 py-4 rounded-xl"
      style={{ background: bgColor, border: `1px solid ${color}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: color }}
        >
          <ScaleIcon size={18} color="#fff" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-sub)] mb-0.5">
            Balance Sheet Equation
          </div>
          <div className="text-[13px] font-semibold text-[var(--color-text-strong)]">
            Assets = Liabilities + Equity
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-right">
          <div className="text-[10px] text-[var(--color-text-sub)] uppercase tracking-wider mb-0.5">
            Total Assets
          </div>
          <div className="text-[15px] font-black tabular-nums" style={{ color }}>
            {fmtPaisa(totalAssets?.paisa ?? 0)}
          </div>
        </div>

        <div className="text-[var(--color-text-sub)] font-bold text-lg">=</div>

        <div className="text-right">
          <div className="text-[10px] text-[var(--color-text-sub)] uppercase tracking-wider mb-0.5">
            Liabilities + Equity
          </div>
          <div className="text-[15px] font-black tabular-nums" style={{ color }}>
            {fmtPaisa(totalLiabilitiesAndEquity?.paisa ?? 0)}
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
          style={{ background: color, color: "#fff" }}
        >
          <Icon size={13} />
          {label}
        </div>
      </div>

      {!isBalanced && discrepancy?.paisa > 0 && (
        <div className="w-full text-[11px] font-semibold mt-1" style={{ color: "var(--color-danger)" }}>
          Discrepancy: {fmtPaisa(discrepancy.paisa)} — check for unposted journals or data integrity issues.
        </div>
      )}
    </div>
  );
}

// ─── AccountRow ───────────────────────────────────────────────────────────────
function AccountRow({ account }) {
  const isSynthetic = account.isSynthetic;
  const isAbnormal  = account.balanceSide?.includes("abnormal") || account.balanceSide?.includes("deficit");
  const isDebitSide = account.balanceSide?.startsWith("DR");

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-lg",
        isSynthetic
          ? "border border-[var(--color-border)]"
          : "hover:bg-[var(--color-muted)] transition-colors",
      )}
      style={isSynthetic ? { background: "var(--color-surface)" } : {}}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[10px] font-mono text-[var(--color-text-sub)] shrink-0">
          {account.code}
        </span>
        <span
          className={cn(
            "text-[12px] font-medium truncate",
            isSynthetic ? "italic" : "text-[var(--color-text-body)]",
          )}
          style={isSynthetic ? { color: "var(--color-text-sub)" } : {}}
        >
          {account.name}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn("text-[13px] font-bold tabular-nums")}
          style={{
            color: isAbnormal
              ? "var(--color-danger)"
              : "var(--color-text-strong)",
          }}
        >
          {fmtPaisa(account.balance?.paisa ?? 0)}
        </span>
        {account.balanceSide && account.balanceSide !== "NIL" && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{
              background: isDebitSide
                ? "var(--color-info-bg)"
                : "var(--color-success-bg)",
              color: isDebitSide
                ? "var(--color-info)"
                : "var(--color-success)",
            }}
          >
            {account.balanceSide.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SectionTotal ─────────────────────────────────────────────────────────────
function SectionTotal({ label, amountObj }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 mt-2 rounded-lg"
      style={{
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-sub)]">
        {label}
      </span>
      <span className="text-[14px] font-black tabular-nums text-[var(--color-text-strong)]">
        {fmtPaisa(amountObj?.paisa ?? 0)}
      </span>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({ title, accentColor, accounts, extraRows = [], totalLabel, totalAmountObj }) {
  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      <div
        className="px-4 py-3"
        style={{
          borderBottom: "1px solid var(--color-border)",
          borderLeft: `3px solid ${accentColor}`,
        }}
      >
        <div
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: accentColor }}
        >
          {title}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-0.5">
        {accounts.length === 0 && extraRows.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-sub)] italic px-3 py-2">
            No accounts
          </p>
        ) : (
          <>
            {accounts.map((acc) => (
              <AccountRow key={acc.code} account={acc} />
            ))}
            {extraRows.map((acc) => (
              <AccountRow key={acc.code} account={acc} />
            ))}
          </>
        )}
      </div>

      <div className="px-3 pb-3">
        <SectionTotal label={totalLabel} amountObj={totalAmountObj} />
      </div>
    </Card>
  );
}

// ─── TrialBalanceStrip ────────────────────────────────────────────────────────
function TrialBalanceStrip({ trialBalance }) {
  if (!trialBalance) return null;
  const { totalDebit, totalCredit, isBalanced, discrepancy } = trialBalance;

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl"
      style={{
        background: isBalanced ? "var(--color-success-bg)" : "var(--color-danger-bg)",
        border: `1px solid ${isBalanced ? "var(--color-success)" : "var(--color-danger)"}`,
      }}
    >
      <Lbl className="mb-0">Ledger Trial Balance</Lbl>
      <div className="flex gap-4 flex-wrap items-center">
        <div>
          <div className="text-[10px] text-[var(--color-text-sub)] uppercase tracking-wider mb-0.5">
            Total Debits
          </div>
          <div className="text-[13px] font-black tabular-nums text-[var(--color-info)]">
            {totalDebit?.formatted ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-sub)] uppercase tracking-wider mb-0.5">
            Total Credits
          </div>
          <div className="text-[13px] font-black tabular-nums text-[var(--color-success)]">
            {totalCredit?.formatted ?? "—"}
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{
            background: isBalanced ? "var(--color-success)" : "var(--color-danger)",
            color: "#fff",
          }}
        >
          {isBalanced ? (
            <><CheckCircle2Icon size={11} /> Debits = Credits</>
          ) : (
            <><AlertTriangleIcon size={11} /> Off by {discrepancy?.formatted}</>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ExplainerAccordion ───────────────────────────────────────────────────────
function ExplainerAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold text-[var(--color-text-body)] cursor-pointer transition-colors"
        style={{ background: "var(--color-surface)" }}
      >
        How are these balances calculated?
        <ChevronDownIcon
          size={15}
          className={cn(
            "transition-transform text-[var(--color-text-sub)]",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          className="px-4 py-4 text-[11px] text-[var(--color-text-sub)] flex flex-col gap-2.5"
          style={{
            background: "var(--color-surface)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <p>
            <strong className="text-[var(--color-text-body)]">T-Account rule:</strong>{" "}
            Asset and Expense accounts increase on the <em>Debit (DR)</em> side.
            Liability, Revenue, and Equity accounts increase on the <em>Credit (CR)</em> side.
            A balance tagged "DR (abnormal)" means an account that should normally carry a credit
            balance has flipped — this may indicate a data issue.
          </p>
          <p>
            <strong className="text-[var(--color-text-body)]">Retained Earnings</strong>{" "}
            is computed as <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--color-muted)" }}>Total Revenue − Total Expenses</code>.
            It represents the cumulative profit not yet distributed. It is derived at
            report time, not stored as a separate ledger account.
          </p>
          <p>
            <strong className="text-[var(--color-text-body)]">Balance check:</strong>{" "}
            Total Assets must equal Total Liabilities + Total Equity.
            If the sheet is out of balance, it usually means a journal entry was posted
            without its offsetting leg, or account seeding is incomplete.
          </p>
          <p>
            All amounts are stored as <em>paisa</em> integers (1 rupee = 100 paisa)
            to eliminate floating-point rounding errors.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton layout ──────────────────────────────────────────────────────────
function SkeletonLayout() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BalanceSheetTab({ entityId, filterProps = {}, filterLabel }) {
  const { balanceSheet, loading, error, refetch } = useBalanceSheet(entityId, filterProps);
  const [exporting, setExporting] = useState(false);
  const { entities, activeEntityId } = useEntity();
  const entityName = entities?.find(e => e._id === activeEntityId)?.name ?? "";

  if (loading) return <SkeletonLayout />;

  if (error) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] font-semibold"
        style={{
          background: "var(--color-danger-bg)",
          color: "var(--color-danger)",
          border: "1px solid var(--color-danger)",
        }}
      >
        <AlertTriangleIcon size={14} />
        {error}
        <button
          onClick={refetch}
          className="ml-auto flex items-center gap-1 text-[11px] underline cursor-pointer"
        >
          <RefreshCwIcon size={11} /> Retry
        </button>
      </div>
    );
  }

  if (!balanceSheet) return null;

  const {
    assetAccounts,
    liabilityAccounts,
    equityAccounts,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
    discrepancy,
    trialBalance,
  } = balanceSheet;

  return (
    <div className="flex flex-col gap-5">
      {/* 0. Period label + export button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {filterLabel && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
            {filterLabel}
          </span>
        )}
        <button
          onClick={async () => {
            setExporting(true);
            await new Promise(r => setTimeout(r, 0));
            exportBalanceSheetPDF(balanceSheet, filterLabel, entityName);
            setExporting(false);
          }}
          disabled={exporting}
          title="Download Balance Sheet as PDF"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] border border-[var(--color-border)] bg-transparent text-[11px] font-semibold cursor-pointer text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting
            ? <Loader2Icon size={12} className="animate-spin" />
            : <DownloadIcon size={12} />}
          Export PDF
        </button>
      </div>

      {/* 1. Equation banner */}
      <EquationBanner
        isBalanced={isBalanced}
        totalAssets={totalAssets}
        totalLiabilitiesAndEquity={totalLiabilitiesAndEquity}
        discrepancy={discrepancy}
      />

      {/* 2. Three-section grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard
          title="Assets"
          accentColor="var(--color-info)"
          accounts={assetAccounts}
          totalLabel="Total Assets"
          totalAmountObj={totalAssets}
        />
        <SectionCard
          title="Liabilities"
          accentColor="var(--color-danger)"
          accounts={liabilityAccounts}
          totalLabel="Total Liabilities"
          totalAmountObj={totalLiabilities}
        />
        <SectionCard
          title="Equity"
          accentColor="var(--color-success)"
          accounts={equityAccounts}
          extraRows={retainedEarnings ? [retainedEarnings] : []}
          totalLabel="Total Equity"
          totalAmountObj={totalEquity}
        />
      </div>

      {/* 3. Trial balance validator */}
      <TrialBalanceStrip trialBalance={trialBalance} />

      {/* 4. Explainer accordion */}
      <ExplainerAccordion />
    </div>
  );
}
