import { useEffect, useState } from "react";
import { toast } from "sonner";
import { XCircle, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { C, fmtRupees } from "../../Loans/loan.constants";
import { bounceCheque, cancelCheque } from "../hooks/useChequeDrafts";

/**
 * Handles both BOUNCE and CANCEL actions.
 * mode: "bounce" | "cancel"
 */
export function BounceDialog({ draft, mode = "bounce", open, onOpenChange, onSuccess }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset reason each time dialog opens
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!draft) return null;

  const isBounce = mode === "bounce";
  const title = isBounce ? "Mark as Bounced" : "Cancel Cheque";
  const actionLabel = isBounce ? "Mark bounced" : "Cancel cheque";

  const handleSubmit = async () => {
    try {
      setSaving(true);
      if (isBounce) {
        await bounceCheque(draft._id, { bounceReason: reason || null });
        toast.success(`Cheque #${draft.chequeNumber} marked as bounced`);
      } else {
        await cancelCheque(draft._id, { cancelReason: reason || null });
        toast.success(`Cheque #${draft.chequeNumber} cancelled`);
      }
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? `Failed to ${mode} cheque`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-border max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>{title}</DialogTitle>
          <p className="text-[12px]" style={{ color: C.textMuted }}>
            Cheque #{draft.chequeNumber} · {fmtRupees(draft.amountPaisa)}
          </p>
        </DialogHeader>

        <div className="mt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textMuted }}>
              {isBounce ? "Bounce reason" : "Cancellation reason"}{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isBounce ? "e.g. Insufficient funds" : "e.g. Voided by issuer"}
              className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              style={{ borderColor: C.border, color: C.text }}
            />
          </div>

          <p
            className="mt-3 text-[11px] px-3 py-2 rounded-lg"
            style={{
              background: isBounce ? C.negativeBg : C.amberBg,
              color: isBounce ? C.negative : C.amber,
            }}
          >
            This will post a reversal journal entry to restore the original accounts.
          </p>
        </div>

        <DialogFooter className="mt-3 flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 rounded-lg border text-[13px] font-semibold"
            style={{ borderColor: C.border, color: C.textMid }}
          >
            Go back
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
            style={{ background: C.negative, opacity: saving ? 0.7 : 1 }}
          >
            {isBounce ? <XCircle size={13} /> : <Ban size={13} />}
            {saving ? "Processing…" : actionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
