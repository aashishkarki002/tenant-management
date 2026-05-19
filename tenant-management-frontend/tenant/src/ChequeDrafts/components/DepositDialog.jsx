import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { C } from "../../Loans/loan.constants";
import { formatPaisa } from "../../utils/formatter";
import { depositCheque } from "../hooks/useChequeDrafts";

export function DepositDialog({ draft, open, onOpenChange, onSuccess }) {
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [depositNotes, setDepositNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset fields each time dialog opens
  useEffect(() => {
    if (open) {
      setDepositDate(new Date().toISOString().split("T")[0]);
      setDepositNotes("");
    }
  }, [open]);

  if (!draft) return null;

  const isReceived = draft.direction === "RECEIVED";

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await depositCheque(draft._id, { depositDate, depositNotes: depositNotes || null });
      toast.success(`Cheque #${draft.chequeNumber} deposited — bank balance updated`);
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
            Cheque #{draft.chequeNumber} · {formatPaisa(draft.amountPaisa)}
            {draft.partyName ? ` · ${draft.partyName}` : ""}
          </p>
        </DialogHeader>

        {/* Lifecycle diagram */}
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-2 mt-1"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: C.textMuted }}>
              {isReceived ? "Cheques In Hand" : "Cheques Payable"}
            </p>
            <p className="text-[10px] font-bold mt-px" style={{ color: C.amber }}>
              {isReceived ? "1150" : "2150"}
            </p>
          </div>
          <ArrowRight size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <div className="text-center flex-1">
            <Banknote size={13} style={{ color: C.positive, margin: "0 auto 2px" }} />
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: C.textMuted }}>
              Bank
            </p>
            <p className="text-[10px] font-mono font-semibold mt-px" style={{ color: C.positive }}>
              {draft.bankAccountCode ?? "—"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold tabular-nums" style={{ color: C.positive }}>
              {formatPaisa(draft.amountPaisa)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              Deposit date
            </label>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              style={{ borderColor: C.border, color: C.text }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Bank reference, slip number…"
              className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
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
