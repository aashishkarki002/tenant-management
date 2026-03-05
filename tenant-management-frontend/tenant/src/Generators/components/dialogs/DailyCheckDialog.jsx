import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import api from "../../../../plugins/axios";
import DualCalendarTailwind from "../../../components/dualDate";

const EMPTY = {
    fuelPercent: "",
    runningHours: "",
    notes: "",
    // Grid electricity — only sent when gen.subMeter exists and user fills it
    gridCurrentReading: "",
    englishDate: "",
    nepaliDate: "",
    nepaliMonth: "",
    nepaliYear: "",
};

function parseNepaliDateStr(str) {
    if (!str) return null;
    const [year, month] = str.split("-").map(Number);
    return isNaN(year) || isNaN(month) ? null : { year, month };
}

/**
 * DailyCheckDialog
 *
 * Props:
 *   gen      {object}   — generator document (includes subMeter if provisioned)
 *   open     {boolean}
 *   onClose  {()=>void}
 *   onDone   {()=>void}
 */
export function DailyCheckDialog({ gen, open, onClose, onDone }) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const patch = (p) => setForm((f) => ({ ...f, ...p }));
    const reset = () => setForm(EMPTY);
    const handleClose = () => { reset(); onClose(); };

    // Only show electricity section if the generator has a linked sub-meter
    const hasSubMeter = !!gen.subMeter;
    const hasElecReading = hasSubMeter && !!form.gridCurrentReading;

    const validate = () => {
        if (!form.fuelPercent) { toast.error("Fuel % is required"); return false; }
        const pct = Number(form.fuelPercent);
        if (pct < 0 || pct > 100) { toast.error("Fuel % must be 0–100"); return false; }
        if (hasElecReading) {
            if (!form.nepaliDate || !form.nepaliMonth || !form.nepaliYear) {
                toast.error("Nepali date is required when recording a grid electricity reading");
                return false;
            }
        }
        return true;
    };

    const submit = async () => {
        if (!validate()) return;
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/daily-check`, {
                fuelPercent: Number(form.fuelPercent),
                runningHours: form.runningHours ? Number(form.runningHours) : undefined,
                notes: form.notes || undefined,
                // Electricity — only sent when sub-meter exists and reading is provided
                ...(hasElecReading && {
                    gridCurrentReading: Number(form.gridCurrentReading),
                    nepaliDate: form.nepaliDate,
                    nepaliMonth: Number(form.nepaliMonth),
                    nepaliYear: Number(form.nepaliYear),
                }),
            });
            toast.success("Daily check recorded");
            reset();
            onDone();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to record check");
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
            <DialogContent className="bg-white text-black sm:max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">Daily Fuel Check</DialogTitle>
                    <p className="text-xs text-gray-400">
                        {gen.name} · Tank: {gen.tankCapacityLiters}L ·
                        Low ≤{gen.lowFuelThresholdPercent}% · Critical ≤{gen.criticalFuelThresholdPercent}%
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* ── Fuel ── */}
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

                    {/* ── Grid Electricity Reading (only when sub-meter is linked) ── */}
                    {hasSubMeter && (
                        <div className="pt-2 border-t border-dashed border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                    Grid Electricity Reading
                                    <span className="normal-case text-gray-400 ml-1 font-normal">(optional)</span>
                                </p>
                            </div>
                            <p className="text-[10px] text-gray-400 mb-2">
                                Sub-meter: <span className="font-medium text-gray-600">{gen.subMeter?.name ?? "Linked"}</span>
                                {" · "}Last reading: <span className="font-medium text-gray-600">
                                    {gen.subMeter?.lastReading?.value != null
                                        ? `${gen.subMeter.lastReading.value} kWh`
                                        : "None yet"}
                                </span>
                            </p>
                            <div>
                                <Label>Current kWh Reading</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type="number" min="0" step="0.1"
                                        placeholder={gen.subMeter?.lastReading?.value
                                            ? `Last: ${gen.subMeter.lastReading.value}`
                                            : "e.g. 12450"}
                                        className="pr-14" value={form.gridCurrentReading}
                                        onChange={e => patch({ gridCurrentReading: e.target.value })}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">kWh</span>
                                </div>
                            </div>

                            {hasElecReading && (
                                <div className="mt-3 space-y-2">
                                    <Label>Date (Nepali) *</Label>
                                    <DualCalendarTailwind
                                        value={form.englishDate}
                                        onChange={(englishDate, nepaliDateStr) => {
                                            const parsed = parseNepaliDateStr(nepaliDateStr);
                                            patch({
                                                englishDate: englishDate || "",
                                                nepaliDate: nepaliDateStr || "",
                                                nepaliMonth: parsed?.month ?? "",
                                                nepaliYear: parsed?.year ?? "",
                                            });
                                        }}
                                    />
                                    {hasElecReading && form.nepaliDate && (
                                        <p className="text-[10px] text-blue-500">
                                            ✦ Grid electricity reading will be posted to the sub-meter
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button
                        disabled={busy}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={submit}
                    >
                        {busy ? "Saving…" : hasElecReading ? "Save Check & Electricity" : "Save Check"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}