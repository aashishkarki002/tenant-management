import { useState } from "react";
import { useAdvanceRent } from "../../hooks/useAdvanceRent";
import { useEntity } from "../../../context/EntityContext";
import {  Card, Lbl, Skeleton } from "../../components/AccountingPrimitives";
function fmtPaisa(p = 0) {
  return `Rs ${(p / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_COLORS = {
  ACTIVE:            "var(--color-info)",
  FULLY_RECOGNIZED:  "var(--color-success)",
  REFUNDED:          "var(--color-text-sub)",
};

function RecognizeModal({ advance, onClose, onRecognize }) {
  const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
  const { month: todayMonth, year: todayYear } = getCurrentNepaliMonthYear();

  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [month, setMonth]   = useState(todayMonth);
  const [year, setYear]     = useState(todayYear);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const yearOptions = getNepaliYearOptions(2075);

  const submit = async (e) => {
    e.preventDefault();
    const paisa = Math.round(Number(amount) * 100);
    if (paisa <= 0)        { setErr("Amount must be positive"); return; }
    if (paisa > remaining) { setErr("Exceeds remaining balance"); return; }
    try {
      setSaving(true);
      setErr(null);
      await onRecognize(advance._id, {
        periodAmountPaisa: paisa,
        nepaliMonth:       month,
        nepaliYear:        year,
        recognitionDate:   new Date().toISOString(),
      });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message ?? "Recognition failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface-raised)] p-6 shadow-xl border border-[var(--color-border)]">
        <div className="text-sm font-bold mb-1">
          Recognize Advance — {advance.tenant?.name}
        </div>
        <div className="text-xs text-[var(--color-text-sub)] mb-4">
          Remaining: {fmtPaisa(remaining)}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Lbl>BS Month</Lbl>
              <select
                required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {NEPALI_MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name} ({i + 1})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <Lbl>BS Year</Lbl>
              <select
                required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Lbl>Amount to Recognize (Rs)</Lbl>
            <input type="number" step="0.01" min="0.01" required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {err && (
            <div className="text-xs text-[var(--color-danger)]">{err}</div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text-sub)]">Cancel</button>
            <Button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
              {saving ? "Saving…" : "Recognize"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdvanceRentTab({ tenants = [] }) {
  const { activeEntityId } = useEntity();
  const { data, loading, error, refetch, receive, recognize } =
    useAdvanceRent(activeEntityId ?? null);
  const [recognizingAdv, setRecognizingAdv] = useState(null);
  const [form, setForm] = useState({
    tenantId: "",
    amountRupees: "",
    paymentMethod: "bank_transfer",
  });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const handleReceive = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await receive({
        entityId:      activeEntityId,
        tenantId:      form.tenantId,
        amountPaisa:   Math.round(Number(form.amountRupees) * 100),
        paymentMethod: form.paymentMethod,
        receiptDate:   new Date().toISOString(),
      });
      setForm({ tenantId: "", amountRupees: "", paymentMethod: "bank_transfer" });
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to record advance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {recognizingAdv && (
        <RecognizeModal
          advance={recognizingAdv}
          onClose={() => setRecognizingAdv(null)}
          onRecognize={recognize}
        />
      )}

      <Card>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">Receive Advance Rent</div>
        <form onSubmit={handleReceive} className="flex flex-wrap gap-3 items-end">
          <div>
            <Lbl>Tenant</Lbl>
            <select required
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-40"
              value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}>
              <option value="">-- Select --</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Amount (Rs)</Lbl>
            <input type="number" step="0.01" min="0.01" required
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-32"
              value={form.amountPaisa} onChange={(e) => setForm((f) => ({ ...f, amountPaisa: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <Lbl>Method</Lbl>
            <select className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
            {saving ? "Saving…" : "Record Advance"}
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
                  {["Tenant", "Date", "Total", "Recognized", "Remaining", "Status", ""].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-sub)]">No advance rents</td></tr>}
                {data.map((a) => {
                  const remaining = a.amountPaisa - a.recognizedAmountPaisa;
                  return (
                    <tr key={a._id} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{a.tenant?.name ?? "—"}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)]">{a.nepaliDate ?? a.receiptDate?.substring(0, 10)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{fmtPaisa(a.amountPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono text-[var(--color-success)]">{fmtPaisa(a.recognizedAmountPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono text-[var(--color-warning)]">{fmtPaisa(remaining)}</td>
                      <td className="py-2 pr-4 text-xs font-semibold" style={{ color: STATUS_COLORS[a.status] }}>{a.status}</td>
                      <td className="py-2">
                        {a.status === "ACTIVE" && (
                          <button onClick={() => setRecognizingAdv(a)} className="text-xs px-3 py-1 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                            Recognize
                          </button>
                        )}
                      </td>
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