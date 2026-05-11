/**
 * ArAgingTab.jsx
 *
 * Accounts Receivable Aging Report.
 * Shows outstanding rent balances per tenant bucketed by months overdue.
 * Data source: GET /api/ledger/ar-aging
 */

import { AlertCircleIcon, UserIcon } from "lucide-react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useArAging } from "../../hooks/useArAging";
import { fmtRs } from "../../../utils/formatter";


const BUCKETS = [
  { key: "current",   label: "Current",     color: "var(--color-success)" },
  { key: "1_month",  label: "1 Mo",         color: "var(--color-warning)" },
  { key: "2_months", label: "2 Mo",         color: "var(--color-warning-dark, #c47a00)" },
  { key: "3_months", label: "3 Mo",         color: "var(--color-danger-light, #e05252)" },
  { key: "over_3",   label: "3+ Mo",        color: "var(--color-danger)" },
];

function TenantRow({ tenant }) {
  const maxBucket = BUCKETS.reduce(
    (best, b) => (tenant.buckets[b.key]?.paisa > best.paisa ? { paisa: tenant.buckets[b.key].paisa, color: b.color } : best),
    { paisa: 0, color: "var(--color-text-sub)" },
  );

  return (
    <tr className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-surface-sub)" }}
          >
            <UserIcon size={13} className="text-[var(--color-text-sub)]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--color-text)]">{tenant.tenantName}</div>
            {tenant.propertyName && (
              <div className="text-[10px] text-[var(--color-text-sub)]">{tenant.propertyName}</div>
            )}
          </div>
        </div>
      </td>
      {BUCKETS.map((b) => (
        <td key={b.key} className="py-3 pr-3 text-right text-xs font-mono">
          {tenant.buckets[b.key]?.paisa > 0 ? (
            <span style={{ color: b.color, fontWeight: 600 }}>
              {fmtRs(tenant.buckets[b.key].paisa)}
            </span>
          ) : (
            <span className="text-[var(--color-border)]">—</span>
          )}
        </td>
      ))}
      <td className="py-3 text-right text-xs font-mono font-bold" style={{ color: maxBucket.color }}>
        {fmtRs(tenant.total?.paisa ?? 0)}
      </td>
    </tr>
  );
}

export default function ArAgingTab({ entityId }) {
  const { data, loading, error, refetch } = useArAging(entityId);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-[var(--color-danger)]">
        {error}
        <button onClick={refetch} className="block mx-auto mt-2 text-xs underline text-[var(--color-text-sub)]">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { tenants = [], grandTotal, asOf } = data;

  const totalOutstanding = grandTotal?.total?.paisa ?? 0;
  const over3Paisa = grandTotal?.buckets?.over_3?.paisa ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <Lbl>Total Outstanding AR</Lbl>
          <div className="text-xl font-bold text-[var(--color-text)]">
            {fmtRs(totalOutstanding)}
          </div>
          <div className="text-[10px] text-[var(--color-text-sub)] mt-1">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} with unpaid rent
          </div>
        </Card>
        <Card>
          <Lbl>3+ Months Overdue</Lbl>
          <div
            className="text-xl font-bold"
            style={{ color: over3Paisa > 0 ? "var(--color-danger)" : "var(--color-text)" }}
          >
            {fmtRs(over3Paisa)}
          </div>
          {over3Paisa > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircleIcon size={11} className="text-[var(--color-danger)]" />
              <span className="text-[10px] text-[var(--color-danger)]">Requires attention</span>
            </div>
          )}
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <Lbl>As Of</Lbl>
          <div className="text-sm font-semibold text-[var(--color-text)]">
            BS {asOf?.bsYear}/{String(asOf?.bsMonth).padStart(2, "0")}
          </div>
          <div className="text-[10px] text-[var(--color-text-sub)] mt-1">Current BS month</div>
        </Card>
      </div>

      {/* Aging table */}
      {tenants.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-[var(--color-text-sub)]">
            No outstanding AR — all rents are paid up.
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                    Tenant
                  </th>
                  {BUCKETS.map((b) => (
                    <th
                      key={b.key}
                      className="py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: b.color }}
                    >
                      {b.label}
                    </th>
                  ))}
                  <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <TenantRow key={t.tenantId} tenant={t} />
                ))}

                {/* Grand total row */}
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-sub)]">
                  <td className="py-3 pr-4 text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)]">
                    Total
                  </td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="py-3 pr-3 text-right text-xs font-mono font-bold" style={{ color: b.color }}>
                      {grandTotal?.buckets?.[b.key]?.paisa > 0
                        ? fmtRs(grandTotal.buckets[b.key].paisa)
                        : "—"}
                    </td>
                  ))}
                  <td className="py-3 text-right text-sm font-mono font-bold text-[var(--color-text)]">
                    {fmtRs(grandTotal?.total?.paisa ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
