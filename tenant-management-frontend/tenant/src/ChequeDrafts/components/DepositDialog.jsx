import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { C, fmtRupees } from "../../Loans/loan.constants";
import { depositCheque } from "../hooks/useChequeDrafts";

export function DepositDialog({ draft, open, onOpenChange, onSuccess }) {
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [depositNotes, setDepositNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!draft) return null;

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await depositCheque(draft._id, { depositDate, depositNotes: depositNotes || null });
      toast.success(`Cheque #${draft.chequeNumber} marked as deposited`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to deposit cheque");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-border max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>Mark as Deposited</DialogTitle>
          <p className="text-[12px]" style={{ color: C.textMuted }}>
            Cheque #{draft.chequeNumber} · {fmtRupees(draft.amountPaisa)}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              Deposit date
            </label>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
              style={{ borderColor: C.border, color: C.text }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              placeholder="Bank reference, remarks…"
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
            style={{ background: C.positive, opacity: saving ? 0.7 : 1 }}
          >
            <CheckCircle size={13} />
            {saving ? "Saving…" : "Confirm deposit"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
