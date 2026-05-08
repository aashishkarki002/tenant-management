import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { usePropertyPL } from "../../hooks/usePropertyPL";

function fmtPaisa(p = 0) {
  const sign = p < 0 ? "−" : "";
  return `${sign}Rs ${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PLSection({ title, rows = [], color }) {
  const total = rows.reduce((s, r) => s + (r.amountPaisa ?? 0), 0);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>
        {title}
      </div>
      {rows.map((r) => (
        <div key={r.accountCode} className="flex justify-between text-xs py-1 border-b border-[var(--color-border)]/20">
          <span className="text-[var(--color-text-sub)]">{r.accountName} <span className="text-[9px] font-mono opacity-50">{r.accountCode}</span></span>
          <span className="font-mono">{fmtPaisa(r.amountPaisa)}</span>
        </div>
      ))}
      <div className="flex justify-between text-xs pt-2 font-semibold">
        <span>Total {title}</span>
        <span className="font-mono" style={{ color }}>{fmtPaisa(total)}</span>
      </div>
    </div>
  );
}

export default function PropertyPLTab({ properties = [] }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const { data, loading, error, refetch } = usePropertyPL(propertyId || null);

  const netProfit = (data?.totalRevenuePaisa ?? 0) - (data?.totalExpensePaisa ?? 0);
  const profitable = netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Property selector */}
      {properties.length > 0 && (
        <div className="flex items-center gap-3">
          <Lbl>Property</Lbl>
          <select
            className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && data && (
        <Card className="space-y-6">
          <PLSection title="Revenue" rows={data.revenueLines ?? []} color="var(--color-success)" />
          <PLSection title="Expenses" rows={data.expenseLines ?? []} color="var(--color-danger)" />

          {/* Net profit */}
          <div
            className="flex justify-between items-center px-4 py-3 rounded-xl"
            style={{
              background: profitable ? "var(--color-success-bg)" : "var(--color-danger-bg)",
              border: `1px solid ${profitable ? "var(--color-success)" : "var(--color-danger)"}`,
            }}
          >
            <span className="text-sm font-bold">Net {profitable ? "Profit" : "Loss"}</span>
            <span className="text-sm font-bold font-mono" style={{ color: profitable ? "var(--color-success)" : "var(--color-danger)" }}>
              {fmtPaisa(Math.abs(netProfit))}
            </span>
          </div>
        </Card>
      )}

      {!loading && !error && !data && !propertyId && (
        <div className="p-8 text-center text-sm text-[var(--color-text-sub)]">
          Select a property to view P&L
        </div>
      )}
    </div>
  );
}
