/**
 * TrialBalanceTab.jsx
 *
 * Shows all accounts with debit/credit totals.
 * A balanced ledger always has totalDebit === totalCredit.
 * Data source: GET /api/ledger/trial-balance
 */

import { CheckCircle2Icon, AlertTriangleIcon, ScaleIcon } from "lucide-react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useTrialBalance } from "../../hooks/useTrialBalance";
import { useEntity } from "../../../context/EntityContext";

function fmtPaisa(paisa = 0) {
  const abs = Math.abs(paisa);
  const sign = paisa < 0 ? "−" : "";
  return `${sign}Rs ${(abs / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TYPE_LABELS = {
  ASSET:     "Assets",
  LIABILITY: "Liabilities",
  EQUITY:    "Equity",
  REVENUE:   "Revenue",
  EXPENSE:   "Expenses",
};

const TYPE_COLORS = {
  ASSET:     "var(--color-info)",
  LIABILITY: "var(--color-danger)",
  EQUITY:    "var(--color-success)",
  REVENUE:   "var(--color-primary)",
  EXPENSE:   "var(--color-warning)",
};

const NORMAL_SIDE = { ASSET: "DR", EXPENSE: "DR", LIABILITY: "CR", REVENUE: "CR", EQUITY: "CR" };

function SectionHeader({ type }) {
  const color = TYPE_COLORS[type] ?? "var(--color-text-sub)";
  return (
    <tr>
      <td
        colSpan={4}
        className="pt-4 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase"
        style={{ color }}
      >
        {TYPE_LABELS[type] ?? type}
      </td>
    </tr>
  );
}

function AccountRow({ row }) {
  const isAbnormal = row.balanceSide?.includes("abnormal");
  return (
    <tr className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
      <td className="py-2 pr-4 text-xs font-mono text-[var(--color-text-sub)] w-20">
        {row.code}
      </td>
      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{row.name}</td>
      <td className="py-2 pr-4 text-right text-xs font-mono">
        {row.balanceSide === "DR" || row.balanceSide === "CR (abnormal)"
          ? fmtPaisa(row.balance?.paisa ?? 0)
          : "—"}
      </td>
      <td className="py-2 text-right text-xs font-mono">
        {row.balanceSide === "CR" || row.balanceSide === "DR (abnormal)"
          ? <span className={isAbnormal ? "text-[var(--color-danger)]" : ""}>
              {fmtPaisa(row.balance?.paisa ?? 0)}
            </span>
          : "—"}
      </td>
    </tr>
  );
}

export default function TrialBalanceTab({ filterProps = {} }) {
  const { activeEntityId } = useEntity();
  const { data, loading, error, refetch } = useTrialBalance(
    activeEntityId ?? null,
    filterProps,
  );

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-[var(--color-danger)]">
        {error}
        <button
          onClick={refetch}
          className="block mx-auto mt-2 text-xs underline text-[var(--color-text-sub)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { rows = [], totals, isBalanced, discrepancy } = data;

  // Group rows by type for section headers
  const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
  const grouped = {};
  for (const row of rows) {
    (grouped[row.type] = grouped[row.type] ?? []).push(row);
  }

  return (
    <div className="space-y-4">
      {/* Balance indicator */}
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-xl"
        style={{
          background: isBalanced ? "var(--color-success-bg)" : "var(--color-danger-bg)",
          border: `1px solid ${isBalanced ? "var(--color-success)" : "var(--color-danger)"}`,
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: isBalanced ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {isBalanced
            ? <CheckCircle2Icon size={16} color="#fff" />
            : <AlertTriangleIcon size={16} color="#fff" />}
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
            {isBalanced ? "Ledger Balanced" : "Out of Balance"}
          </div>
          <div className="text-sm font-semibold text-[var(--color-text)]">
            {isBalanced
              ? `Total Debits = Total Credits = ${fmtPaisa(totals?.totalDebit?.paisa ?? 0)}`
              : `Discrepancy: ${fmtPaisa(discrepancy?.paisa ?? 0)}`}
          </div>
        </div>
      </div>

      {/* Trial balance table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)] w-20">
                  Code
                </th>
                <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                  Account
                </th>
                <th className="py-2 pr-4 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                  Debit
                </th>
                <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map((type) =>
                grouped[type]?.length ? (
                  <>
                    <SectionHeader key={`hdr-${type}`} type={type} />
                    {grouped[type].map((row) => (
                      <AccountRow key={`${row.code}-${type}`} row={row} />
                    ))}
                  </>
                ) : null,
              )}

              {/* Totals row */}
              <tr className="border-t-2 border-[var(--color-border)] font-bold">
                <td colSpan={2} className="pt-3 pb-2 text-xs text-[var(--color-text-sub)] uppercase tracking-widest">
                  Grand Total
                </td>
                <td className="pt-3 pb-2 text-right text-sm font-mono">
                  {fmtPaisa(totals?.totalDebit?.paisa ?? 0)}
                </td>
                <td className="pt-3 pb-2 text-right text-sm font-mono">
                  {fmtPaisa(totals?.totalCredit?.paisa ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
