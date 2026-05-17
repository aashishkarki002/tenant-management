import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import api from "../../../../plugins/axios";
import { toast } from "sonner";

const STRATEGIES = [
  {
    value: "clear",
    label: "Clear pending & overdues",
    description:
      "Cancel all unpaid rent and CAM records. Ledger reversals are posted automatically. Clean slate for the new billing cycle.",
  },
  {
    value: "carry_forward",
    label: "Carry forward to tenant balance",
    description:
      "Existing pending records stay as-is. Outstanding amounts remain in the tenant balance and must be collected alongside the new billing cycle.",
  },
];

function FrequencyToggle({ current, selected, onSelect }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onSelect("monthly")}
        className={[
          "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
          selected === "monthly"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:border-primary/50",
        ].join(" ")}
      >
        Monthly
        {current === "monthly" && (
          <span className="ml-1.5 text-xs opacity-70">(current)</span>
        )}
      </button>

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />

      <button
        type="button"
        onClick={() => onSelect("quarterly")}
        className={[
          "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
          selected === "quarterly"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:border-primary/50",
        ].join(" ")}
      >
        Quarterly
        {current === "quarterly" && (
          <span className="ml-1.5 text-xs opacity-70">(current)</span>
        )}
      </button>
    </div>
  );
}

function RentFrequencyModal({ open, onOpenChange, tenantId, currentFrequency, onSuccess }) {
  const [newFrequency, setNewFrequency] = useState(
    currentFrequency === "monthly" ? "quarterly" : "monthly",
  );
  const [reason, setReason] = useState("");
  const [strategy, setStrategy] = useState("carry_forward");
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const isChanged = newFrequency !== currentFrequency;
  const canProceed = isChanged && reason.trim().length >= 5;

  function handleClose() {
    if (loading) return;
    setReason("");
    setStrategy("carry_forward");
    setConfirmStep(false);
    setNewFrequency(currentFrequency === "monthly" ? "quarterly" : "monthly");
    onOpenChange(false);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const response = await api.post(`/api/tenant/change-frequency/${tenantId}`, {
        newFrequency,
        reason: reason.trim(),
        strategy,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        handleClose();
        onSuccess?.();
      } else {
        toast.error(response.data.message || "Failed to change frequency");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change frequency");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <DialogTitle>Change Rent Frequency</DialogTitle>
          </div>
          <DialogDescription>
            Switch between monthly and quarterly billing. This affects how rent
            and CAM charges are generated going forward.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-5">
            {/* Frequency toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">New Frequency</Label>
              <FrequencyToggle
                current={currentFrequency}
                selected={newFrequency}
                onSelect={setNewFrequency}
              />
              {!isChanged && (
                <p className="text-xs text-amber-600">
                  Select a different frequency to proceed.
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="freq-reason" className="text-sm font-medium">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="freq-reason"
                placeholder="e.g. Tenant requested quarterly billing per new agreement signed 2081-03-15"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Stored in tenant audit trail. Min 5 characters.
              </p>
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                How to handle existing pending records
              </Label>
              <div className="space-y-2">
                {STRATEGIES.map((s) => (
                  <label
                    key={s.value}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      strategy === s.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="freq-strategy"
                      value={s.value}
                      checked={strategy === s.value}
                      onChange={() => setStrategy(s.value)}
                      className="mt-0.5 shrink-0 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Confirm step */
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <span className="font-semibold">Review before confirming:</span>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>
                    Frequency:{" "}
                    <Badge variant="outline" className="text-xs capitalize">
                      {currentFrequency}
                    </Badge>
                    {" → "}
                    <Badge variant="outline" className="text-xs capitalize">
                      {newFrequency}
                    </Badge>
                  </li>
                  <li>
                    Strategy:{" "}
                    <span className="font-medium">
                      {strategy === "clear"
                        ? "Clear pending & overdues"
                        : "Carry forward to balance"}
                    </span>
                  </li>
                  {strategy === "clear" && (
                    <li className="font-semibold text-red-700">
                      All unpaid rent and CAM records will be cancelled and reversed in the ledger. This cannot be undone.
                    </li>
                  )}
                  <li>
                    Reason:{" "}
                    <span className="italic">&ldquo;{reason}&rdquo;</span>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>

          {!confirmStep ? (
            <Button onClick={() => setConfirmStep(true)} disabled={!canProceed}>
              Review &amp; Confirm
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirmStep(false)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant={strategy === "clear" ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? "Saving..." : "Confirm Change"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RentFrequencyModal;
