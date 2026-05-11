import { Card, Skeleton } from "../AccountingPrimitives";
import { usePettyCash } from "../../hooks/usePettyCash";
import { useEntity } from "../../../context/EntityContext";

function fmtPaisa(p = 0) {
  const sign = p < 0 ? "−" : "";
  return `${sign}Rs ${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PettyCashTab({ filterProps = {} }) {
  const { activeEntityId } = useEntity();
  const { data, loading, error, refetch } = usePettyCash(activeEntityId ?? null, filterProps);

  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (error) return <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>;
  if (!data) return null;

  const { entries = [], openingBalancePaisa = 0, closingBalancePaisa = 0 } = data;

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-5 py-4 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-1">Opening Balance</div>
          <div className="text-lg font-bold font-mono text-[var(--color-text)]">{fmtPaisa(openingBalancePaisa)}</div>
        </div>
        <div className="px-5 py-4 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-1">Closing Balance</div>
          <div className="text-lg font-bold font-mono text-[var(--color-text)]">{fmtPaisa(closingBalancePaisa)}</div>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Date", "Description", "Debit", "Credit", "Balance"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-[var(--color-text-sub)]">No petty cash transactions</td></tr>
              )}
              {entries.map((e, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)] whitespace-nowrap">{e.nepaliDate ?? e.date?.substring(0, 10)}</td>
                  <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{e.description}</td>
                  <td className="py-2 pr-4 text-right text-xs font-mono">{e.debitPaisa ? fmtPaisa(e.debitPaisa) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-xs font-mono">{e.creditPaisa ? fmtPaisa(e.creditPaisa) : "—"}</td>
                  <td className="py-2 text-right text-xs font-mono font-semibold">{fmtPaisa(e.runningBalancePaisa ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
