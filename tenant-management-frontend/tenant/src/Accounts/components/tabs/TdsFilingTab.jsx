import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useTdsFilingSummary } from "../../hooks/useTdsFilingSummary";
import NepaliDate from "nepali-datetime";

function fmtPaisa(p = 0) {
  return `Rs ${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS = ["Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"];

export default function TdsFilingTab() {
  const currentYear = new NepaliDate(new Date()).getYear();
  const [nepaliYear, setNepaliYear] = useState(currentYear);
  const { data, loading, error, refetch } = useTdsFilingSummary(nepaliYear);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Lbl>Fiscal Year</Lbl>
        <select
          className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
          value={nepaliYear}
          onChange={(e) => setNepaliYear(Number(e.target.value))}
        >
          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {error && (
        <div className="p-4 text-sm text-[var(--color-danger)] text-center">
          {error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Tenant</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{m.substring(0,3)}</th>
                  ))}
                  <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Total TDS</th>
                  <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Paid</th>
                  <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Pending</th>
                </tr>
              </thead>
              <tbody>
                {(data.tenants ?? []).map((t) => (
                  <tr key={t.tenantId} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{t.tenantName}</td>
                    {MONTHS.map((_, mi) => {
                      const month = t.monthly?.find((m) => m.month === mi + 1);
                      return (
                        <td key={mi} className="py-2 pr-3 text-right text-xs font-mono text-[var(--color-text-sub)]">
                          {month ? fmtPaisa(month.tdsAmountPaisa) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 text-right text-xs font-mono font-semibold">{fmtPaisa(t.totalTdsPaisa)}</td>
                    <td className="py-2 text-right text-xs font-mono text-[var(--color-success)]">{fmtPaisa(t.paidPaisa ?? 0)}</td>
                    <td className="py-2 text-right text-xs font-mono text-[var(--color-warning)]">{fmtPaisa(t.pendingPaisa ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] font-bold">
                  <td colSpan={13} className="pt-3 pb-2 text-xs text-[var(--color-text-sub)]">Grand Total</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono">{fmtPaisa(data.grandTotalTdsPaisa ?? 0)}</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono text-[var(--color-success)]">{fmtPaisa(data.grandTotalPaidPaisa ?? 0)}</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono text-[var(--color-warning)]">{fmtPaisa(data.grandTotalPendingPaisa ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
