import { useEffect, useMemo, useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { C, fmtRupees, LOAN_TYPE_LABELS } from "../loan.constants";
import { useBankAccounts } from "../hooks/useBankAccounts";
import useOwnership from "@/hooks/use-ownership";

const entityDot = (type) => type === "private" ? "#16a34a" : C.accent;

export function AddLoanDialog({ open, onOpenChange, onAdded, defaultEntityId = null }) {
  const { banks } = useBankAccounts(open);
  const { entities, loading: entitiesLoading } = useOwnership();

  // Entities eligible for loan ownership — exclude head_office
  const loanEntities = useMemo(
    () => (entities ?? []).filter((e) => e.type !== "head_office"),
    [entities],
  );

  const [form, setForm] = useState({
    entityId: "",
    lender: "",
    loanAccountNumber: "",
    loanType: "MORTGAGE",
    principalRupees: "",
    interestRateAnnual: "",
    tenureMonths: "",
    disbursedDate: new Date().toISOString().split("T")[0],
    firstEmiDate: "",
    bankAccountCode: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Auto-select entity when dialog opens
  useEffect(() => {
    if (!open) return;
    if (entitiesLoading) return;
    setForm((prev) => {
      if (prev.entityId) return prev; // already set — don't override
      const preferred = defaultEntityId ?? (loanEntities.length === 1 ? loanEntities[0]._id : "");
      return { ...prev, entityId: preferred };
    });
  }, [open, entitiesLoading, loanEntities, defaultEntityId]);

  // Auto-select first bank account
  useEffect(() => {
    if (!open) return;
    if (!banks?.length) return;
    setForm((p) => (p.bankAccountCode ? p : { ...p, bankAccountCode: banks[0].accountCode }));
  }, [open, banks]);

  // Reset form when dialog closes
  useEffect(() => {
    if (open) return;
    setForm({
      entityId: "",
      lender: "",
      loanAccountNumber: "",
      loanType: "MORTGAGE",
      principalRupees: "",
      interestRateAnnual: "",
      tenureMonths: "",
      disbursedDate: new Date().toISOString().split("T")[0],
      firstEmiDate: "",
      bankAccountCode: "",
      notes: "",
    });
  }, [open]);

  const previewEmi = useMemo(() => {
    try {
      const p = Number(form.principalRupees) * 100;
      const r = Number(form.interestRateAnnual) / 12 / 100;
      const n = Number(form.tenureMonths);
      if (!p || !n) return null;
      if (r === 0) return fmtRupees(Math.round(p / n));
      const factor = Math.pow(1 + r, n);
      return fmtRupees(Math.round((p * r * factor) / (factor - 1)));
    } catch {
      return null;
    }
  }, [form.principalRupees, form.interestRateAnnual, form.tenureMonths]);

  const handleSubmit = async () => {
    if (!form.entityId) {
      toast.error("Select an entity for this loan");
      return;
    }
    if (!form.lender.trim()) {
      toast.error("Lender name required");
      return;
    }
    if (!form.principalRupees) {
      toast.error("Principal required");
      return;
    }
    if (!form.interestRateAnnual) {
      toast.error("Interest rate required");
      return;
    }
    if (!form.tenureMonths) {
      toast.error("Tenure required");
      return;
    }
    if (!form.bankAccountCode) {
      toast.error("Select receiving bank account");
      return;
    }

    try {
      setSaving(true);
      await api.post("/api/loan", {
        entityId: form.entityId,
        lender: form.lender.trim(),
        loanAccountNumber: form.loanAccountNumber.trim() || null,
        loanType: form.loanType,
        principalPaisa: Math.round(Number(form.principalRupees) * 100),
        interestRateAnnual: Number(form.interestRateAnnual),
        tenureMonths: Number(form.tenureMonths),
        disbursedDate: form.disbursedDate,
        firstEmiDate: form.firstEmiDate || null,
        bankAccountCode: form.bankAccountCode,
        notes: form.notes.trim() || null,
      });

      toast.success("Loan recorded. Disbursement journal posted.");
      onOpenChange(false);
      onAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to create loan");
    } finally {
      setSaving(false);
    }
  };

  const cls = "h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none w-full";
  const sty = { borderColor: C.border, color: C.text };
  const lbl = (t) => (
    <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
      {t}
    </label>
  );

  const showEntityPicker = loanEntities.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: C.surface, maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>Record new loan</DialogTitle>
          <p className="text-[12px]" style={{ color: C.textMuted }}>
            A double-entry disbursement journal (DR Bank / CR Loan Liability) will be posted automatically.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">

          {/* ── Entity selector (multi-entity only) ── */}
          {showEntityPicker && (
            <div className="col-span-2 flex flex-col gap-1.5">
              {lbl("Ownership entity *")}
              <div className="flex flex-wrap gap-1.5">
                {loanEntities.map((e) => {
                  const active = form.entityId === e._id;
                  const dot = entityDot(e.type);
                  return (
                    <button
                      key={e._id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, entityId: e._id }))}
                      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors duration-150 cursor-pointer"
                      style={active
                        ? { background: dot, borderColor: dot, color: "white" }
                        : { borderColor: C.border, color: C.textMid, background: "transparent" }
                      }
                    >
                      <span
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ background: active ? "rgba(255,255,255,0.6)" : dot }}
                      />
                      {e.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="col-span-2 flex flex-col gap-1.5">
            {lbl("Lender / Bank name *")}
            <input
              type="text"
              value={form.lender}
              placeholder="e.g. Nepal SBI Bank"
              onChange={(e) => setForm((f) => ({ ...f, lender: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Loan type *")}
            <select
              value={form.loanType}
              onChange={(e) => setForm((f) => ({ ...f, loanType: e.target.value }))}
              className={cls}
              style={sty}
            >
              {Object.entries(LOAN_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
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
            {lbl("Principal amount (रू) *")}
            <input
              type="number"
              value={form.principalRupees}
              placeholder="e.g. 2500000"
              onChange={(e) => setForm((f) => ({ ...f, principalRupees: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Interest rate (% p.a.) *")}
            <input
              type="number"
              step="0.1"
              value={form.interestRateAnnual}
              placeholder="e.g. 11.5"
              onChange={(e) => setForm((f) => ({ ...f, interestRateAnnual: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Tenure (months) *")}
            <input
              type="number"
              value={form.tenureMonths}
              placeholder="e.g. 120"
              onChange={(e) => setForm((f) => ({ ...f, tenureMonths: e.target.value }))}
              className={cls}
              style={sty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Receiving bank account *")}
            <select
              value={form.bankAccountCode}
              onChange={(e) => setForm((f) => ({ ...f, bankAccountCode: e.target.value }))}
              className={cls}
              style={sty}
            >
              <option value="">Select…</option>
              {banks.map((b) => (
                <option key={b.accountCode} value={b.accountCode}>
                  {b.bankName} — {b.accountCode}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            {lbl("Disbursed date *")}
            <input
              type="date"
              value={form.disbursedDate}
              onChange={(e) => setForm((f) => ({ ...f, disbursedDate: e.target.value }))}
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

          <div className="col-span-2 flex flex-col gap-1.5">
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

        {/* Live EMI preview */}
        {previewEmi && (
          <div className="mt-1 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: C.infoBg, border: `1px solid ${C.info}30` }}>
            <span className="text-[11px]" style={{ color: C.info }}>
              Estimated monthly EMI
            </span>
            <span className="text-[13px] font-bold font-sans" style={{ color: C.info }}>
              {previewEmi}
            </span>
          </div>
        )}

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
            className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white"
            style={{ background: C.accent, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Record loan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
