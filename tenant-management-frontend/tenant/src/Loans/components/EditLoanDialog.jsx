import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { C, LOAN_TYPE_LABELS } from "../loan.constants";

export function EditLoanDialog({ loan, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({
    lender: "",
    loanAccountNumber: "",
    loanType: "MORTGAGE",
    firstEmiDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !loan) return;
    setForm({
      lender: loan.lender ?? "",
      loanAccountNumber: loan.loanAccountNumber ?? "",
      loanType: loan.loanType ?? "MORTGAGE",
      firstEmiDate: loan.firstEmiDate ? loan.firstEmiDate.split("T")[0] : "",
      notes: loan.notes ?? "",
    });
  }, [open, loan]);

  const handleSubmit = async () => {
    if (!form.lender.trim()) {
      toast.error("Lender name required");
      return;
    }
    try {
      setSaving(true);
      const res = await api.patch(`/api/loan/${loan._id}`, {
        lender: form.lender.trim(),
        loanAccountNumber: form.loanAccountNumber.trim() || null,
        loanType: form.loanType,
        firstEmiDate: form.firstEmiDate || null,
        notes: form.notes.trim() || null,
      });
      toast.success("Loan updated");
      onOpenChange(false);
      onSaved?.(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to update loan");
    } finally {
      setSaving(false);
    }
  };

  if (!loan) return null;

  const cls = "h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none w-full";
  const sty = { borderColor: C.border, color: C.text };
  const lbl = (t) => (
    <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
      {t}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: C.surface, maxWidth: 460 }}>
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>Edit loan details</DialogTitle>
          <p className="text-[12px]" style={{ color: C.textMuted }}>
            Financial terms (principal, rate, tenure) cannot be changed after disbursement.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1.5">
            {lbl("Lender / Bank name *")}
            <input
              type="text"
              value={form.lender}
              onChange={(e) => setForm((f) => ({ ...f, lender: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Loan type")}
            <select
              value={form.loanType}
              onChange={(e) => setForm((f) => ({ ...f, loanType: e.target.value }))}
              className={cls}
              style={sty}
            >
              {Object.entries(LOAN_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Loan account no.")}
            <input
              type="text"
              value={form.loanAccountNumber}
              placeholder="Optional"
              onChange={(e) => setForm((f) => ({ ...f, loanAccountNumber: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("First EMI date")}
            <input
              type="date"
              value={form.firstEmiDate}
              onChange={(e) => setForm((f) => ({ ...f, firstEmiDate: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Notes")}
            <input
              type="text"
              value={form.notes}
              placeholder="Purpose, remarks…"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2">
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
            className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white"
            style={{ background: C.accent, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
