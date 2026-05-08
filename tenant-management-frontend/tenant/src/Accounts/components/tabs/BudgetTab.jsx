import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useBudget } from "../../hooks/useBudget";
import { useEntity } from "../../../context/EntityContext";
import NepaliDate from "nepali-datetime";

function fmtPaisa(p = 0) {
  const sign = p < 0 ? "−" : "";
  return `${sign}Rs ${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(actual, budget) {
  if (!budget) return null;
  return Math.round((actual / budget) * 100);
}

export default function BudgetTab() {
  const { selectedEntity } = useEntity();
  const currentYear = new NepaliDate(new Date()).getYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const { lines, vsActual, loading, error, refetch, upsert, remove } = useBudget(selectedEntity?.id ?? null, fiscalYear);

  const [form, setForm] = useState({ accountCode: "", accountName: "", accountType: "EXPENSE", budgetedAmountPaisa: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleUpsert = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await upsert({
        entityId: selectedEntity?.id,
        fiscalYear,
        accountCode: form.accountCode,
        accountName: form.accountName,
        accountType: form.accountType,
        budgetedAmountPaisa: Math.round(Number(form.budgetedAmountPaisa) * 100),
      });
      setForm({ accountCode: "", accountName: "", accountType: "EXPENSE", budgetedAmountPaisa: "" });
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to save budget line");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Fiscal year selector + form */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <Lbl>Fiscal Year</Lbl>
            <select className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-3">Add / Update Budget Line</div>
        <form onSubmit={handleUpsert} className="flex flex-wrap gap-3 items-end">
          <div>
            <Lbl>Account Code</Lbl>
            <input type="text" required className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-24"
              value={form.accountCode} onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))} placeholder="e.g. 5000" />
          </div>
          <div>
            <Lbl>Account Name</Lbl>
            <input type="text" required className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-40"
              value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Account name" />
          </div>
          <div>
            <Lbl>Type</Lbl>
            <select className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}>
              {["REVENUE","EXPENSE","ASSET","LIABILITY","EQUITY"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Budgeted Amount (Rs)</Lbl>
            <input type="number" step="0.01" min="0" required className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-36"
              value={form.budgetedAmountPaisa} onChange={(e) => setForm((f) => ({ ...f, budgetedAmountPaisa: e.target.value }))} placeholder="0.00" />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
            {saving ? "Saving…" : "Save Line"}
          </button>
        </form>
        {formError && <div className="mt-2 text-xs text-[var(--color-danger)]">{formError}</div>}
      </Card>

      {loading && <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && vsActual && (
        <Card>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-3">Budget vs Actual</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Code", "Account", "Type", "Budgeted", "Actual", "Variance", "%"].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(vsActual.lines ?? []).map((l) => {
                  const variance = l.actualPaisa - l.budgetedAmountPaisa;
                  const p = pct(l.actualPaisa, l.budgetedAmountPaisa);
                  const over = l.accountType === "EXPENSE" ? variance > 0 : variance < 0;
                  return (
                    <tr key={l.accountCode} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="py-2 pr-4 text-xs font-mono text-[var(--color-text-sub)]">{l.accountCode}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{l.accountName}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)]">{l.accountType}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{fmtPaisa(l.budgetedAmountPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{fmtPaisa(l.actualPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono font-semibold" style={{ color: over ? "var(--color-danger)" : "var(--color-success)" }}>
                        {fmtPaisa(Math.abs(variance))} {over ? "↑" : "↓"}
                      </td>
                      <td className="py-2 text-right text-xs font-mono">{p != null ? `${p}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
