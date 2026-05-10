import { useState } from "react";
import { useVendorBills } from "../../hooks/useVendorBills";
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
  PENDING: "var(--color-warning)",
  APPROVED: "var(--color-info)",
  PAID: "var(--color-success)",
  CANCELLED: "var(--color-text-sub)",
};

function PayModal({ bill, onClose, onPay }) {
  const [amount, setAmount] = useState((bill.amountPaisa / 100).toFixed(2));
  const [tds, setTds] = useState("0.00");
  const [method, setMethod] = useState("bank_transfer");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr(null);
      await onPay(bill._id, {
        paidAmountPaisa: Math.round(Number(amount) * 100),
        tdsDeductedPaisa: Math.round(Number(tds) * 100),
        paymentMethod: method,
      });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message ?? "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface-raised)] p-6 shadow-xl border border-[var(--color-border)]">
        <div className="text-sm font-bold mb-4">Pay Bill — {bill.vendorName}</div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Amount Paid (Rs)</Label>
            <Input type="number" step="0.01" min="0.01" required
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>TDS Deducted (Rs)</Label>
            <Input type="number" step="0.01" min="0"
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]"
              value={tds} onChange={(e) => setTds(e.target.value)} />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value)}>
              <SelectTrigger className="w-full border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface)] text-[var(--color-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" onClick={onClose} variant="outline" className="px-4 py-1.5 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text-sub)]">Cancel</Button>
            <Button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
              {saving ? "Saving…" : "Confirm Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorBillsTab() {
  const { selectedEntity } = useEntity();
  const { data, loading, error, refetch, create, pay } = useVendorBills(selectedEntity?.id ?? null);
  const [payingBill, setPayingBill] = useState(null);
  const [form, setForm] = useState({ vendorName: "", billNumber: "", amountPaisa: "", expenseAccountCode: "5000", billDate: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await create({
        entityId: selectedEntity?.id,
        vendorName: form.vendorName,
        billNumber: form.billNumber || null,
        amountPaisa: Math.round(Number(form.amountPaisa) * 100),
        expenseAccountCode: form.expenseAccountCode,
        billDate: form.billDate || new Date().toISOString(),
      });
      setForm({ vendorName: "", billNumber: "", amountPaisa: "", expenseAccountCode: "5000", billDate: "" });
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to create bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {payingBill && <PayModal bill={payingBill} onClose={() => setPayingBill(null)} onPay={pay} />}

      {/* Create form */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">New Vendor Bill</div>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Vendor</Label>
              <Input type="text" required className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-36"
                value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} placeholder="Vendor name" />
            </div>
            <div>
              <Label>Bill #</Label>
              <Input type="text" className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-28"
                value={form.billNumber} onChange={(e) => setForm((f) => ({ ...f, billNumber: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Amount (Rs)</Label>
              <Input type="number" step="0.01" min="0.01" required className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-32"
                value={form.amountPaisa} onChange={(e) => setForm((f) => ({ ...f, amountPaisa: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Expense Code</Label>
              <Input type="text" className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-24"
                value={form.expenseAccountCode} onChange={(e) => setForm((f) => ({ ...f, expenseAccountCode: e.target.value }))} />
            </div>
            <Button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
              {saving ? "Saving…" : "Add Bill"}
            </Button>
          </form>
          {formError && <div className="mt-2 text-xs text-[var(--color-danger)]">{formError}</div>}
        </CardContent>
      </Card>

      {loading && <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <Button variant="link" onClick={refetch} className="underline ml-2 text-xs">Retry</Button></div>}

      {!loading && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {["Date", "Vendor", "Bill #", "Amount", "Paid", "Status", ""].map((h) => (
                      <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-sub)]">No bills</td></tr>}
                  {data.map((b) => (
                    <tr key={b._id} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="py-2 pr-4 text-xs text-[var(--color-text-sub)]">{b.billDate?.substring(0, 10)}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">{b.vendorName}</td>
                      <td className="py-2 pr-4 text-xs font-mono text-[var(--color-text-sub)]">{b.billNumber ?? "—"}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono">{fmtPaisa(b.amountPaisa)}</td>
                      <td className="py-2 pr-4 text-right text-xs font-mono text-[var(--color-success)]">{fmtPaisa(b.paidAmountPaisa)}</td>
                      <td className="py-2 pr-4 text-xs font-semibold" style={{ color: STATUS_COLORS[b.status] ?? "inherit" }}>{b.status}</td>
                      <td className="py-2">
                        {b.status !== "PAID" && b.status !== "CANCELLED" && (
                          <Button variant="outline" onClick={() => setPayingBill(b)} className="text-xs px-3 py-1 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                            Pay
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}