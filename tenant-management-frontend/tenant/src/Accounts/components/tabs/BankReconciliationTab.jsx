import { Card, Skeleton } from "../AccountingPrimitives";
import { useBankReconciliation } from "../../hooks/useBankReconciliation";
import { useEntity } from "../../../context/EntityContext";
import { CheckCircle2Icon, AlertTriangleIcon } from "lucide-react";

import { fmtRs } from "../../../utils/formatter";
export default function BankReconciliationTab() {
  const { activeEntityId } = useEntity();
  const { data, loading, error, refetch } = useBankReconciliation(activeEntityId ?? null);

  if (loading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error) return <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>;
  if (!data) return null;

  const allMatch = data.every((r) => r.difference === 0);

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl"
        style={{
          background: allMatch ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          border: `1px solid ${allMatch ? "var(--color-success)" : "var(--color-warning)"}`,
        }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: allMatch ? "var(--color-success)" : "var(--color-warning)" }}>
          {allMatch ? <CheckCircle2Icon size={14} color="#fff" /> : <AlertTriangleIcon size={14} color="#fff" />}
        </div>
        <div className="text-sm font-semibold text-[var(--color-text)]">
          {allMatch ? "All bank accounts reconcile" : "Discrepancies found — review rows below"}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Account", "Code", "Ledger Balance", "Bank Balance", "Difference"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const diff = r.difference ?? (r.ledgerBalancePaisa - r.bankBalancePaisa);
                const hasGap = diff !== 0;
                return (
                  <tr key={r.bankAccountId} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{r.bankName}</td>
                    <td className="py-2 pr-4 text-xs font-mono text-[var(--color-text-sub)]">{r.accountCode}</td>
                    <td className="py-2 pr-4 text-right text-xs font-mono">{fmtRs(r.ledgerBalancePaisa)}</td>
                    <td className="py-2 pr-4 text-right text-xs font-mono">{fmtRs(r.bankBalancePaisa)}</td>
                    <td className="py-2 text-right text-xs font-mono font-semibold"
                      style={{ color: hasGap ? "var(--color-danger)" : "var(--color-success)" }}>
                      {hasGap ? fmtRs(diff) : "✓"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
