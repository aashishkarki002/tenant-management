import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useCamReconciliation } from "../../hooks/useCamReconciliation";
import { useEntity } from "../../../context/EntityContext";
import NepaliDate from "nepali-datetime";
import { fmtRs } from "../../../utils/formatter";
export default function CamReconciliationTab() {
  const { activeEntityId } = useEntity();
  const currentYear = new NepaliDate(new Date()).getYear();
  const [nepaliYear, setNepaliYear] = useState(currentYear);
  const { data, loading, error, refetch } = useCamReconciliation(activeEntityId ?? null, nepaliYear);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Lbl>Year</Lbl>
        <select className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
          value={nepaliYear} onChange={(e) => setNepaliYear(Number(e.target.value))}>
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && data && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Tenant", "CAM Billed", "CAM Paid", "Outstanding"].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.tenants ?? []).map((t) => {
                  const outstanding = (t.billedPaisa ?? 0) - (t.paidPaisa ?? 0);
                  return (
                    <tr key={t.tenantId} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{t.tenantName}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{fmtRs(t.billedPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono text-[var(--color-success)]">{fmtRs(t.paidPaisa)}</td>
                      <td className="py-2 text-right text-xs font-mono font-semibold" style={{ color: outstanding > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                        {fmtRs(outstanding)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] font-bold">
                  <td className="pt-3 pb-2 text-xs text-[var(--color-text-sub)]">Total</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono">{fmtRs(data.totalBilledPaisa ?? 0)}</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono text-[var(--color-success)]">{fmtRs(data.totalPaidPaisa ?? 0)}</td>
                  <td className="pt-3 pb-2 text-right text-sm font-mono" style={{ color: "var(--color-danger)" }}>
                    {fmtRs((data.totalBilledPaisa ?? 0) - (data.totalPaidPaisa ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
