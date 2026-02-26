import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "../../../../plugins/axios";

const EMPTY = { fuelPercent: "", runningHours: "", notes: "" };

/**
 * DailyCheckDialog
 *
 * Props:
 *   gen      {object}   — generator document
 *   open     {boolean}
 *   onClose  {()=>void}
 *   onDone   {()=>void} — called after successful save so parent can re-fetch
 */
export function DailyCheckDialog({ gen, open, onClose, onDone }) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const patch = (p) => setForm((f) => ({ ...f, ...p }));

    const reset = () => setForm(EMPTY);

    const handleClose = () => { reset(); onClose(); };

    const submit = async () => {
        if (!form.fuelPercent) return toast.error("Fuel % is required");
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/daily-check`, {
                fuelPercent: Number(form.fuelPercent),
                runningHours: form.runningHours ? Number(form.runningHours) : undefined,
                notes: form.notes || undefined,
                // status intentionally omitted — backend auto-derives from thresholds
            });
            toast.success("Daily check recorded");
            reset();
            onDone();
            onClose();
        } catch {
            toast.error("Failed to record check");
        } finally {
            setBusy(false);
        }
    };

    const approxLiters =
        gen.tankCapacityLiters > 0 && form.fuelPercent
            ? ((Number(form.fuelPercent) / 100) * gen.tankCapacityLiters).toFixed(1)
            : null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-white text-black sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">Daily Fuel Check</DialogTitle>
                    <p className="text-xs text-gray-400">
                        {gen.name} · Tank: {gen.tankCapacityLiters}L ·
                        Low ≤{gen.lowFuelThresholdPercent}% · Critical ≤{gen.criticalFuelThresholdPercent}%
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    <div>
                        <Label>Current Fuel Level (%) *</Label>
                        <div className="relative mt-1">
                            <Input
                                type="number" min="0" max="100" placeholder="e.g. 75"
                                className="pr-8" value={form.fuelPercent}
                                onChange={e => patch({ fuelPercent: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                        {approxLiters && (
                            <p className="text-xs text-gray-400 mt-1">≈ {approxLiters} L in tank</p>
                        )}
                    </div>

                    <div>
                        <Label>Running Hours (optional)</Label>
                        <div className="relative mt-1">
                            <Input
                                type="number" min="0" placeholder="e.g. 1240"
                                className="pr-10" value={form.runningHours}
                                onChange={e => patch({ runningHours: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
                        </div>
                    </div>

                    <div>
                        <Label>Notes (optional)</Label>
                        <Input
                            placeholder="Any observations…" value={form.notes}
                            onChange={e => patch({ notes: e.target.value })} className="mt-1"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button
                        disabled={busy}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={submit}
                    >
                        {busy ? "Saving…" : "Save Check"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}