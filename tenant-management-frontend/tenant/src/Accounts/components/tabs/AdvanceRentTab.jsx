import { useState } from "react";
import { useAdvanceRent } from "../../hooks/useAdvanceRent";
import { useEntity } from "../../../context/EntityContext";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function fmtPaisa(p = 0) {
  return `Rs ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS = {
  ACTIVE: "var(--color-info)",
  FULLY_RECOGNIZED: "var(--color-success)",
  REFUNDED: "var(--color-text-sub)",
};

function RecognizeModal({ advance, onClose, onRecognize }) {
  const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const paisa = Math.round(Number(amount) * 100);
    if (paisa > remaining) { setErr("Exceeds remaining balance"); return; }
    try {
      setSaving(true);
      setErr(null);
      await onRecognize(advance._id, { periodAmountPaisa: paisa });
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
        <div className="text-sm font-bold mb-1">Recognize Advance — {advance.tenant?.name}</div>
        <div className="text-xs text-[var(--color-text-sub)] mb-4">Remaining: {fmtPaisa(remaining)}</div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Amount to Recognize (Rs)</Label>
            <Input type="number" step="0.01" min="0.01" required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" onClick={onClose} variant="outline" className="px-4 py-1.5 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text-sub)]">Cancel</Button>
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
  const { selectedEntity } = useEntity();
  const { data, loading, error, refetch, receive, recognize } = useAdvanceRent(selectedEntity?.id ?? null);
  const [recognizingAdv, setRecognizingAdv] = useState(null);
  const [form, setForm] = useState({ tenantId: "", amountPaisa: "", paymentMethod: "bank_transfer" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleReceive = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await receive({
        entityId: selectedEntity?.id,
        tenantId: form.tenantId,
        amountPaisa: Math.round(Number(form.amountPaisa) * 100),
        paymentMethod: form.paymentMethod,
        receiptDate: new Date().toISOString(),
      });
      setForm({ tenantId: "", amountPaisa: "", paymentMethod: "bank_transfer" });
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to record advance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {recognizingAdv && (
        <RecognizeModal advance={recognizingAdv} onClose={() => setRecognizingAdv(null)} onRecognize={recognize} />
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">Receive Advance Rent</div>
          <form onSubmit={handleReceive} className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenantId} onValueChange={(value) => setForm((f) => ({ ...f, tenantId: value }))}>
                <SelectTrigger className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-40">
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (Rs)</Label>
              <Input type="number" step="0.01" min="0.01" required
                className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-32"
                value={form.amountPaisa} onChange={(e) => setForm((f) => ({ ...f, amountPaisa: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.paymentMethod} onValueChange={(value) => setForm((f) => ({ ...f, paymentMethod: value }))}>
                <SelectTrigger className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]">
                  <SelectValue placeholder="Select a payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
              {saving ? "Saving…" : "Record Advance"}
            </Button>
          </form>
          {formError && <div className="mt-2 text-xs text-[var(--color-danger)]">{formError}</div>}
        </CardContent>
      </Card>

      {loading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <Button variant="link" onClick={refetch} className="underline ml-2 text-xs">Retry</Button></div>}

      {!loading && !error && (
        <Card>
          <CardContent className="pt-6">
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
                            <Button variant="outline" onClick={() => setRecognizingAdv(a)} className="text-xs px-3 py-1 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                              Recognize
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}