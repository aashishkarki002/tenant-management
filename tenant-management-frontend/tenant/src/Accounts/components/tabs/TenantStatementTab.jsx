import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useTenantStatement } from "../../hooks/useTenantStatement";

function fmtPaisa(p = 0) {
  const sign = p < 0 ? "−" : "";
  return `${sign}Rs ${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TenantStatementTab({ tenants = [] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const { data, loading, error, refetch } = useTenantStatement(tenantId || null);

  const balance = data?.closingBalancePaisa ?? 0;
  const isOverdue = balance > 0;

  return (
    <div className="space-y-4">
      {tenants.length > 0 && (
        <div className="flex items-center gap-3">
          <Lbl>Tenant</Lbl>
          <select
            className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            <option value="">-- Select --</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && data && (
        <>
          {/* Balance banner */}
          <div
            className="px-5 py-3 rounded-xl flex items-center justify-between"
            style={{
              background: isOverdue ? "var(--color-danger-bg)" : "var(--color-success-bg)",
              border: `1px solid ${isOverdue ? "var(--color-danger)" : "var(--color-success)"}`,
            }}
          >
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {data.tenantName} — Closing Balance
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-success)" }}>
              {isOverdue ? "Owes " : "Credit "}{fmtPaisa(Math.abs(balance))}
            </span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Date</th>
                    <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Description</th>
                    <th className="py-2 pr-4 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Debit</th>
                    <th className="py-2 pr-4 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Credit</th>
                    <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.entries ?? []).map((e, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)] whitespace-nowrap">{e.nepaliDate ?? e.date?.substring(0, 10)}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{e.description}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{e.debitPaisa ? fmtPaisa(e.debitPaisa) : "—"}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{e.creditPaisa ? fmtPaisa(e.creditPaisa) : "—"}</td>
                      <td className="py-2 text-right text-xs font-mono" style={{ color: e.runningBalancePaisa > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                        {fmtPaisa(e.runningBalancePaisa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!loading && !error && !data && !tenantId && (
        <div className="p-8 text-center text-sm text-[var(--color-text-sub)]">Select a tenant to view statement</div>
      )}
    </div>
  );
}
