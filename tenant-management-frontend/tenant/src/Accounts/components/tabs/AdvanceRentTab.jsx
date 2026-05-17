import { useEffect, useState } from "react";
import { useAdvanceRent } from "../../hooks/useAdvanceRent";
import { useEntity } from "../../../context/EntityContext";
import { Card, Skeleton } from "../../components/AccountingPrimitives";
import { useTenant } from "../../../hooks/use-tenants";
import { useBankAccounts } from "../../../Loans/hooks/useBankAccounts";
import BankAccountSelect from "../../../components/BankAccountSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NEPALI_MONTH_NAMES } from "../../utils/nepaliCalendar";
import api from "../../../../plugins/axios";

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

const INVOICE_TYPES = [
  { value: "RENT",        label: "Rent Invoice" },
  { value: "CAM",         label: "CAM Invoice" },
  { value: "ELECTRICITY", label: "Electricity Bill" },
];

function getRemainingForInvoice(inv, type) {
  if (type === "RENT")        return inv.grossRentAmountPaisa - (inv.tdsAmountPaisa || 0) - inv.paidAmountPaisa;
  if (type === "CAM")         return inv.amountPaisa - inv.paidAmountPaisa;
  if (type === "ELECTRICITY") return inv.totalAmountPaisa - inv.paidAmountPaisa;
  return 0;
}

function getInvoiceLabel(inv, type) {
  const month = NEPALI_MONTH_NAMES[(inv.nepaliMonth ?? 1) - 1];
  const year  = inv.nepaliYear ?? "";
  const rm    = getRemainingForInvoice(inv, type);
  if (type === "ELECTRICITY") {
    return `${month} ${year} — ${inv.consumption ?? "?"} units — ${fmtPaisa(rm)} due`;
  }
  return `${month} ${year} — ${fmtPaisa(rm)} due`;
}

async function fetchOpenInvoices(tenantId, type) {
  const OPEN = ["pending", "overdue", "partially_paid"];
  if (type === "RENT") {
    const r = await api.get(`/api/rent/get-rents-by-tenant/${tenantId}`);
    return (r.data?.rents ?? []).filter((x) => OPEN.includes(x.status));
  }
  if (type === "CAM") {
    const r = await api.get(`/api/cam/get-cams`, { params: { tenantId, status: OPEN.join(",") } });
    return (r.data?.cams ?? []).filter((x) => OPEN.includes(x.status));
  }
  if (type === "ELECTRICITY") {
    const r = await api.get(`/api/electricity/get-readings`, { params: { tenantId } });
    return (r.data?.readings ?? r.data?.data ?? []).filter(
      (x) => x.billTo === "tenant" && OPEN.includes(x.status),
    );
  }
  return [];
}

function AllocateModal({ advance, onClose, onAllocate }) {
  const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
  const [invoiceType, setInvoiceType] = useState("RENT");
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setInvoices([]);
    setSelectedId("");
    setAmount("");
    setErr(null);
    setLoadingInvoices(true);
    fetchOpenInvoices(advance.tenant._id, invoiceType)
      .then((list) => {
        setInvoices(list);
        if (list.length > 0) {
          setSelectedId(list[0]._id);
          const rm = getRemainingForInvoice(list[0], invoiceType);
          setAmount((Math.min(remaining, rm) / 100).toFixed(2));
        }
      })
      .catch(() => setErr("Failed to load invoices"))
      .finally(() => setLoadingInvoices(false));
  }, [advance.tenant._id, invoiceType, remaining]);

  const selected = invoices.find((i) => i._id === selectedId);
  const invoiceRemaining = selected ? getRemainingForInvoice(selected, invoiceType) : 0;

  const handleInvoiceChange = (v) => {
    setSelectedId(v);
    const inv = invoices.find((i) => i._id === v);
    if (inv) {
      const rm = getRemainingForInvoice(inv, invoiceType);
      setAmount((Math.min(remaining, rm) / 100).toFixed(2));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const paisa = Math.round(Number(amount) * 100);
    if (paisa <= 0) { setErr("Amount must be positive"); return; }
    if (paisa > remaining) { setErr("Exceeds advance balance"); return; }
    if (paisa > invoiceRemaining) { setErr("Exceeds invoice balance"); return; }
    try {
      setSaving(true);
      setErr(null);
      await onAllocate(advance._id, {
        invoiceType,
        invoiceId: selectedId,
        amountPaisa: paisa,
        allocationDate: new Date().toISOString(),
      });
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message ?? "Allocation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate Advance — {advance.tenant?.name}</DialogTitle>
          <div className="text-xs text-[var(--color-text-sub)]">
            Advance balance: {fmtPaisa(remaining)}
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs">Apply to</Label>
            <Select value={invoiceType} onValueChange={setInvoiceType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingInvoices ? (
            <Skeleton className="h-9 w-full" />
          ) : invoices.length === 0 ? (
            <Alert>
              <AlertDescription>No open {invoiceType.toLowerCase()} invoices for this tenant.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label className="text-xs">Invoice</Label>
                <Select value={selectedId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((inv) => (
                      <SelectItem key={inv._id} value={inv._id}>
                        {getInvoiceLabel(inv, invoiceType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected && (
                  <div className="text-xs text-[var(--color-text-sub)] mt-1">
                    Remaining on invoice: {fmtPaisa(invoiceRemaining)}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Amount to Apply (Rs)</Label>
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
                  {saving ? "Applying…" : "Apply to Invoice"}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdvanceRentTab() {
  const { activeEntityId } = useEntity();
  const { tenants } = useTenant();
  const { banks } = useBankAccounts(true, activeEntityId ?? null);
  const { data, loading, error, refetch, receive, allocate } =
    useAdvanceRent(activeEntityId ?? null);
  const EMPTY_FORM = {
    tenantId: "", amountRupees: "", paymentMethod: "bank_transfer",
    bankAccountId: "", bankAccountCode: "",
    chequeNumber: "", chequeDate: "",
  };
  const [allocatingAdv, setAllocatingAdv] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const requiresBank   = form.paymentMethod === "bank_transfer" || form.paymentMethod === "cheque";
  const isCheque       = form.paymentMethod === "cheque";

  const handleReceive = async (e) => {
    e.preventDefault();
    if (requiresBank && !form.bankAccountCode) { setFormError("Select a bank account"); return; }
    if (isCheque && !form.chequeNumber.trim()) { setFormError("Cheque number required"); return; }
    if (isCheque && !form.chequeDate) { setFormError("Cheque date required"); return; }
    try {
      setSaving(true);
      setFormError(null);
      await receive({
        tenantId: form.tenantId,
        amountPaisa: Math.round(Number(form.amountRupees) * 100),
        paymentMethod: form.paymentMethod,
        bankAccount: form.bankAccountId || undefined,
        bankAccountCode: form.bankAccountCode || undefined,
        chequeNumber: isCheque ? form.chequeNumber.trim() : undefined,
        chequeDate: isCheque ? new Date(form.chequeDate).toISOString() : undefined,
        receiptDate: new Date().toISOString(),
      });
      setForm(EMPTY_FORM);
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to record advance");
    } finally {
      setSaving(false);
    }
  };

  const handleBankChange = (v) => {
    const bank = banks.find((b) => b._id === v);
    setForm((f) => ({
      ...f,
      bankAccountId: v,
      bankAccountCode: bank?.accountCode ?? "",
    }));
  };

  return (
    <div className="space-y-4">
      {allocatingAdv && (
        <AllocateModal
          advance={allocatingAdv}
          onClose={() => setAllocatingAdv(null)}
          onAllocate={allocate}
        />
      )}

      <Card>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-4">
          Receive Advance Rent
        </div>
        <form onSubmit={handleReceive}>
          <div className="flex flex-wrap items-end gap-3">
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
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, paymentMethod: v, bankAccountId: "", bankAccountCode: "", chequeNumber: "", chequeDate: "" }))
                }
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
            {requiresBank && (
              <div className="min-w-[200px]">
                <Label className="text-xs">{isCheque ? "Deposit Bank" : "Bank Account"}</Label>
                <BankAccountSelect
                  bankAccounts={banks}
                  value={form.bankAccountId}
                  onValueChange={handleBankChange}
                  placeholder="Select bank account"
                  showBalance
                />
              </div>
            )}
            {isCheque && (
              <>
                <div className="w-36">
                  <Label className="text-xs">Cheque No.</Label>
                  <Input
                    className="h-9"
                    placeholder="e.g. 001234"
                    value={form.chequeNumber}
                    onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))}
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs">Cheque Date</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={form.chequeDate}
                    onChange={(e) => setForm((f) => ({ ...f, chequeDate: e.target.value }))}
                  />
                </div>
              </>
            )}
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
                  {["Tenant", "Date", "Total", "Applied", "Remaining", "Status", ""].map((h) => (
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
                            onClick={() => setAllocatingAdv(a)}
                            className="text-xs h-8"
                          >
                            Allocate
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
