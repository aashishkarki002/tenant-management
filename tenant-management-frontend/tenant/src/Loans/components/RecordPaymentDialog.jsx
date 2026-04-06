import { useEffect, useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { C, fmtRupees } from "../loan.constants";
import { resolveEntityId } from "../loan.service";
import { useBankAccounts } from "../hooks/useBankAccounts";
import {
  PAYMENT_METHODS,
  getLedgerPaymentMethodSelectOptions,
} from "@/constants/paymentMethods.js";

export function RecordPaymentDialog({ loan, open, onOpenChange, onSuccess }) {
  const { banks } = useBankAccounts(open);

  const [form, setForm] = useState({
    bankAccountCode: "",
    paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
    customAmount: false,
    customPrincipalRupees: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!banks?.length) return;
    setForm((p) => (p.bankAccountCode ? p : { ...p, bankAccountCode: banks[0].accountCode }));
  }, [open, banks]);

  const handleSubmit = async () => {
    if (!form.bankAccountCode) {
      toast.error("Select a bank account");
      return;
    }

    try {
      setSaving(true);
      const entityId = await resolveEntityId();
      const payload = {
        entityId,
        paymentDate: form.paymentDate,
        bankAccountCode: form.bankAccountCode,
        paymentMethod: form.paymentMethod,
        notes: form.notes || null,
      };

      if (form.customAmount && form.customPrincipalRupees) {
        payload.customPrincipalPaisa = Math.round(Number(form.customPrincipalRupees) * 100);
      }

      const res = await api.post(`/api/loan/${loan._id}/payment`, payload);
      const s = res.data?.data?.summary ?? {};
      toast.success(
        s.loanClosed ? "Loan fully paid off!" : `EMI #${s.installmentNumber} recorded — ${fmtRupees(s.outstandingAfterPaisa)} remaining`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  if (!loan) return null;

  const r = loan.interestRateAnnual / 12 / 100;
  const estI = Math.round((loan.outstandingPaisa ?? 0) * r);
  const estP = (loan.emiPaisa ?? 0) - estI;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>Record EMI payment</DialogTitle>
          <p className="text-[12px]" style={{ color: C.textMuted }}>
            {loan.lender} · EMI #{(loan.installmentsPaid ?? 0) + 1}
          </p>
        </DialogHeader>

        {/* Preview */}
        <div className="grid grid-cols-3 gap-2 my-1">
          {[
            { l: "Total EMI", v: fmtRupees(loan.emiPaisa), c: C.text },
            { l: "≈ Principal", v: fmtRupees(estP), c: C.accent },
            { l: "≈ Interest", v: fmtRupees(estI), c: C.amber },
          ].map(({ l, v, c }) => (
            <div key={l} className="rounded-xl px-3 py-2 text-center" style={{ background: C.surfaceAlt }}>
              <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>
                {l}
              </div>
              <div className="text-[12px] font-bold font-sans" style={{ color: c }}>
                {v}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 mt-1">
          {[
            {
              key: "bankAccountCode",
              label: "Bank account",
              type: "select",
              options: banks.map((b) => ({ value: b.accountCode, label: `${b.bankName} — ${b.accountCode}` })),
              placeholder: "Select bank…",
            },
            {
              key: "paymentMethod",
              label: "Payment method",
              type: "select",
              options: getLedgerPaymentMethodSelectOptions(),
            },
            { key: "paymentDate", label: "Payment date", type: "date" },
          ].map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                  style={{ borderColor: C.border, color: C.text }}
                >
                  {f.placeholder && <option value="">{f.placeholder}</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                  style={{ borderColor: C.border, color: C.text }}
                />
              )}
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.customAmount}
              onChange={(e) => setForm((p) => ({ ...p, customAmount: e.target.checked }))}
            />
            <span className="text-[12px]" style={{ color: C.textMid }}>
              Prepayment / custom principal
            </span>
          </label>

          {form.customAmount && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
                Custom principal (रू)
              </label>
              <input
                type="number"
                value={form.customPrincipalRupees}
                onChange={(e) => setForm((p) => ({ ...p, customPrincipalRupees: e.target.value }))}
                placeholder="e.g. 50000"
                className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                style={{ borderColor: C.border, color: C.text }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Cheque no., remarks…"
              className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
              style={{ borderColor: C.border, color: C.text }}
            />
          </div>
        </div>

        <DialogFooter className="mt-3 flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 rounded-lg border text-[13px] font-semibold"
            style={{ borderColor: C.border, color: C.textMid }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
            style={{ background: C.accent, opacity: saving ? 0.7 : 1 }}
          >
            <Banknote size={13} />
            {saving ? "Recording…" : "Record payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

