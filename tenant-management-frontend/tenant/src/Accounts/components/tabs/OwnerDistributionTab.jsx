import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useOwnerDistribution } from "../../hooks/useOwnerDistribution";
import { useEntity } from "../../../context/EntityContext";

function fmtPaisa(p = 0) {
  return `Rs ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque"];

export default function OwnerDistributionTab() {
  const { selectedEntity } = useEntity();
  const { data, loading, error, refetch, create } = useOwnerDistribution(selectedEntity?.id ?? null);

  const [form, setForm] = useState({ amountPaisa: "", paymentMethod: "bank_transfer", description: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.amountPaisa || Number(form.amountPaisa) <= 0) { setFormError("Enter valid amount"); return; }
    try {
      setSaving(true);
      setFormError(null);
      await create({
        entityId: selectedEntity?.id,
        amountPaisa: Math.round(Number(form.amountPaisa) * 100),
        paymentMethod: form.paymentMethod,
        description: form.description || null,
        distributionDate: new Date().toISOString(),
      });
      setForm({ amountPaisa: "", paymentMethod: "bank_transfer", description: "" });
    } catch (err) {
      setFormError(err.response?.data?.message ?? "Failed to create distribution");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <Card>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">New Distribution</div>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div>
            <Lbl>Amount (Rs)</Lbl>
            <input
              type="number" step="0.01" min="0.01" required
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-36"
              value={form.amountPaisa}
              onChange={(e) => setForm((f) => ({ ...f, amountPaisa: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <Lbl>Method</Lbl>
            <select
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            >
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Description</Lbl>
            <input
              type="text"
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-48"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional note"
            />
          </div>
          <button
            type="submit" disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record Distribution"}
          </button>
        </form>
        {formError && <div className="mt-2 text-xs text-[var(--color-danger)]">{formError}</div>}
      </Card>

      {loading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Date</th>
                  <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Method</th>
                  <th className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Description</th>
                  <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-xs text-[var(--color-text-sub)]">No distributions recorded</td></tr>
                )}
                {data.map((d) => (
                  <tr key={d._id} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)]">{d.nepaliDate ?? d.distributionDate?.substring(0, 10)}</td>
                    <td className="py-2 pr-4 text-xs capitalize text-[var(--color-text)]">{d.paymentMethod?.replace("_", " ")}</td>
                    <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)]">{d.description ?? "—"}</td>
                    <td className="py-2 text-right text-xs font-mono font-semibold">{fmtPaisa(d.amountPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
