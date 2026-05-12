import { useState } from "react";
import { useAdvanceRent } from "../../hooks/useAdvanceRent";
import { useEntity } from "../../../context/EntityContext";
import { Card, Lbl, Skeleton } from "../../components/AccountingPrimitives";
import { useTenant } from "../../../hooks/use-tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

function fmtPaisa(p = 0) {
  return `Rs ${(p / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_COLORS = {
  ACTIVE: "var(--color-info)",
  FULLY_RECOGNIZED: "var(--color-success)",
  REFUNDED: "var(--color-text-sub)",
};

function RecognizeModal({ advance, onClose, onRecognize }) {
  const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
  const { month: todayMonth, year: todayYear } = getCurrentNepaliMonthYear();

  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [month, setMonth] = useState(todayMonth);
  const [year, setYear] = useState(todayYear);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const yearOptions = getNepaliYearOptions(2075);

  const submit = async (e) => {
    e.preventDefault();
    const paisa = Math.round(Number(amount) * 100);
    if (paisa <= 0) { setErr("Amount must be positive"); return; }
    if (paisa > remaining) { setErr("Exceeds remaining balance"); return; }
    try {
      setSaving(true);
      setErr(null);
      await onRecognize(advance._id, {
        periodAmountPaisa: paisa,
        nepaliMonth: month,
        nepaliYear: year,
        recognitionDate: new Date().toISOString(),
      });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message ?? "Recognition failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Recognize Advance — {advance.tenant?.name}
          </DialogTitle>
          <div className="text-xs text-[var(--color-text-sub)]">
            Remaining: {fmtPaisa(remaining)}
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">BS Month</Label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEPALI_MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {name} ({i + 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label className="text-xs">BS Year</Label>
              <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value.toString()}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Amount to Recognize (Rs)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              className="h-9"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Recognize"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdvanceRentTab() {
  const { activeEntityId } = useEntity();
  const { tenants, loading: tenantsLoading } = useTenant();
  const { data, loading, error, refetch, receive, recognize } =
    useAdvanceRent(activeEntityId ?? null);
  const [recognizingAdv, setRecognizingAdv] = useState(null);
  const [form, setForm] = useState({
    tenantId: "",
    amountRupees: "",
    paymentMethod: "bank_transfer",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleReceive = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await receive({
        entityId: activeEntityId,
        tenantId: form.tenantId,
        amountPaisa: Math.round(Number(form.amountRupees) * 100),
        paymentMethod: form.paymentMethod,
        receiptDate: new Date().toISOString(),
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
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">
          Receive Advance Rent
        </div>
        <form onSubmit={handleReceive}>
          <div className="flex items-end gap-3">
            <div className="min-w-[160px]">
              <Label className="text-xs">Tenant</Label>
              <Select
                value={form.tenantId}
                onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-xs">Amount (Rs)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="h-9"
                value={form.amountRupees}
                onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving} className="h-9">
              {saving ? "Saving…" : "Record Advance"}
            </Button>
          </div>
          {formError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </form>
      </Card>

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            <Button variant="link" onClick={refetch} className="h-auto p-0 text-xs underline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Tenant", "Date", "Total", "Recognized", "Remaining", "Status", ""].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-widest">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-sub)]">
                      No advance rents
                    </TableCell>
                  </TableRow>
                )}
                {data.map((a) => {
                  const remaining = a.amountPaisa - a.recognizedAmountPaisa;
                  return (
                    <TableRow key={a._id}>
                      <TableCell className="text-xs">{a.tenant?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-[var(--color-text-sub)]">
                        {a.nepaliDate ?? a.receiptDate?.substring(0, 10)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {fmtPaisa(a.amountPaisa)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-[var(--color-success)]">
                        {fmtPaisa(a.recognizedAmountPaisa)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-[var(--color-warning)]">
                        {fmtPaisa(remaining)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold" style={{ color: STATUS_COLORS[a.status] }}>
                        {a.status}
                      </TableCell>
                      <TableCell>
                        {a.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRecognizingAdv(a)}
                            className="text-xs h-8"
                          >
                            Recognize
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}