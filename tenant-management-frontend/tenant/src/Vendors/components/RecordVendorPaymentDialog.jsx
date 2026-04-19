import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { recordVendorPayment } from "../services/vendorService";
import { useBankAccounts } from "../../Loans/hooks/useBankAccounts";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

export default function RecordVendorPaymentDialog({
  open,
  onClose,
  vendorId,
  contracts = [],
  onSuccess,
}) {
  const { banks } = useBankAccounts(open);

  const [form, setForm] = useState({
    paymentDirection: "outflow",
    amountRupees: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    bankAccountId: "",
    contractId: "",
    referenceNumber: "",
    tdsDeductedRupees: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Default direction based on contracts: if there's a stall_lease contract, default to inflow
      const hasStallLease = contracts.some((c) => c.contractType === "stall_lease");
      const hasService = contracts.some((c) => !c.contractType || c.contractType === "service");
      const defaultDirection = hasStallLease && !hasService ? "inflow" : "outflow";
      setForm({
        paymentDirection: defaultDirection,
        amountRupees: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: "cash",
        bankAccountId: "",
        contractId: "",
        referenceNumber: "",
        tdsDeductedRupees: "",
        notes: "",
      });
    }
  }, [open, contracts]);

  const needsBankAccount =
    form.paymentMethod === "bank_transfer" || form.paymentMethod === "cheque";

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(form.amountRupees);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (needsBankAccount && !form.bankAccountId) {
      toast.error("Select a bank account for this payment method");
      return;
    }

    try {
      setSubmitting(true);
      const tds = parseFloat(form.tdsDeductedRupees) || 0;
      await recordVendorPayment(vendorId, {
        paymentDirection: form.paymentDirection,
        amountPaisa: Math.round(amount * 100),
        paymentDate: form.paymentDate,
        paymentMethod: form.paymentMethod,
        bankAccountId: needsBankAccount ? form.bankAccountId : undefined,
        contractId: form.contractId || undefined,
        referenceNumber: form.referenceNumber || undefined,
        tdsDeductedPaisa: Math.round(tds * 100),
        notes: form.notes || undefined,
      });
      toast.success("Payment recorded");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (val) =>
    setForm((prev) => ({ ...prev, [field]: val }));
  const setInput = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--color-text-strong)" }}>
            {form.paymentDirection === "inflow" ? "Record Receipt from Vendor" : "Record Payment to Vendor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Direction Toggle */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>Direction</Label>
            <div className="flex gap-2">
              {[
                { value: "outflow", label: "Pay Vendor" },
                { value: "inflow", label: "Receive from Vendor" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("paymentDirection")(opt.value)}
                  className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor:
                      form.paymentDirection === opt.value
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    backgroundColor:
                      form.paymentDirection === opt.value
                        ? "var(--color-accent-bg)"
                        : "var(--color-surface)",
                    color:
                      form.paymentDirection === opt.value
                        ? "var(--color-accent)"
                        : "var(--color-text-body)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>
              Amount (Rs.) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amountRupees}
              onChange={setInput("amountRupees")}
              required
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-body)",
              }}
            />
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>
              Payment Date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={form.paymentDate}
              onChange={setInput("paymentDate")}
              required
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-body)",
              }}
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>
              Payment Method <span className="text-red-500">*</span>
            </Label>
            <Select value={form.paymentMethod} onValueChange={set("paymentMethod")}>
              <SelectTrigger
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account (conditional) */}
          {needsBankAccount && (
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Bank Account <span className="text-red-500">*</span>
              </Label>
              <Select value={form.bankAccountId} onValueChange={set("bankAccountId")}>
                <SelectTrigger
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-body)",
                  }}
                >
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.bankName} — {b.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contract (optional) */}
          {contracts.length > 0 && (
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Against Contract (optional)
              </Label>
              <Select value={form.contractId} onValueChange={set("contractId")}>
                <SelectTrigger
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-body)",
                  }}
                >
                  <SelectValue placeholder="Select contract" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.description || c.serviceType} — Rs.{" "}
                      {((c.contractAmountPaisa ?? 0) / 100).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reference Number */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>
              Reference / Cheque No. (optional)
            </Label>
            <Input
              placeholder="e.g. CHQ-0023"
              value={form.referenceNumber}
              onChange={setInput("referenceNumber")}
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-body)",
              }}
            />
          </div>

          {/* TDS Deducted */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>
              TDS Deducted (Rs.)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.tdsDeductedRupees}
              onChange={setInput("tdsDeductedRupees")}
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-body)",
              }}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label style={{ color: "var(--color-text-body)" }}>Notes (optional)</Label>
            <Input
              placeholder="Any remarks…"
              value={form.notes}
              onChange={setInput("notes")}
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-body)",
              }}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
