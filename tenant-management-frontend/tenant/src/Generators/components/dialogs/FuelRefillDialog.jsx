import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "../../../../plugins/axios";
import DualCalendarTailwind from "../../../components/dualDate";
import { fmt } from "../../constants/constant";

const EMPTY = {
    liters: "",
    cost: "",
    fuelLevelAfterPercent: "",
    supplier: "",
    invoiceRef: "",
    notes: "",
    // ── Accounting fields (required by backend when cost > 0) ──
    nepaliDate: "",
    nepaliMonth: "",
    nepaliYear: "",
    paymentMethod: "bank_transfer",
    bankAccountId: "",
};

/**
 * FuelRefillDialog
 *
 * Props:
 *   gen           {object}   — generator document
 *   open          {boolean}
 *   onClose       {()=>void}
 *   onDone        {()=>void}
 *   bankAccounts  {Array}    — [{ _id, name, accountCode }] passed from parent
 */
export function FuelRefillDialog({ gen, open, onClose, onDone, bankAccounts = [] }) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const patch = (p) => setForm((f) => ({ ...f, ...p }));
    const reset = () => setForm(EMPTY);
    const handleClose = () => { reset(); onClose(); };

    const hasCost = !!form.cost && Number(form.cost) > 0;

    const validate = () => {
        if (!form.liters || Number(form.liters) <= 0) {
            toast.error("Liters added is required"); return false;
        }
        if (hasCost) {
            if (!form.nepaliDate) { toast.error("Nepali date is required when cost is provided"); return false; }
            if (!form.nepaliMonth) { toast.error("Nepali month is required when cost is provided"); return false; }
            if (!form.nepaliYear) { toast.error("Nepali year is required when cost is provided"); return false; }
        }
        return true;
    };

    const submit = async () => {
        if (!validate()) return;
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/fuel-refill`, {
                liters: Number(form.liters),
                cost: hasCost ? Number(form.cost) : undefined,
                fuelLevelAfterPercent: form.fuelLevelAfterPercent ? Number(form.fuelLevelAfterPercent) : undefined,
                supplier: form.supplier || undefined,
                invoiceRef: form.invoiceRef || undefined,
                notes: form.notes || undefined,
                // Accounting — only sent when cost is present
                ...(hasCost && {
                    nepaliDate: form.nepaliDate,
                    nepaliMonth: Number(form.nepaliMonth),
                    nepaliYear: Number(form.nepaliYear),
                    paymentMethod: form.paymentMethod,
                    bankAccountId: form.bankAccountId || undefined,
                }),
            });
            toast.success("Fuel refill recorded" + (hasCost ? " and expense posted" : ""));
            reset();
            onDone();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to record refill");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-white text-black sm:max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">Record Fuel Refill</DialogTitle>
                    <p className="text-xs text-gray-400">
                        {gen.name} · Current: {fmt.pct(gen.currentFuelPercent)} · Tank: {gen.tankCapacityLiters}L
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* ── Refill details ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Liters Added *</Label>
                            <div className="relative mt-1">
                                <Input
                                    type="number" min="0" step="0.1" placeholder="e.g. 50"
                                    className="pr-6" value={form.liters}
                                    onChange={e => patch({ liters: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">L</span>
                            </div>
                        </div>
                        <div>
                            <Label>Fuel Level After (%)</Label>
                            <div className="relative mt-1">
                                <Input
                                    type="number" min="0" max="100" placeholder="e.g. 90"
                                    className="pr-8" value={form.fuelLevelAfterPercent}
                                    onChange={e => patch({ fuelLevelAfterPercent: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Cost (₹)</Label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <Input
                                type="number" min="0" className="pl-6"
                                placeholder="Leave blank if no expense entry needed"
                                value={form.cost}
                                onChange={e => patch({ cost: e.target.value })}
                            />
                        </div>
                        {hasCost && (
                            <p className="text-[10px] text-blue-500 mt-1">
                                ✦ An expense + ledger entry will be created automatically
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Supplier</Label>
                            <Input
                                className="mt-1" placeholder="e.g. HP Petrol" value={form.supplier}
                                onChange={e => patch({ supplier: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Invoice Ref</Label>
                            <Input
                                className="mt-1" placeholder="INV-001" value={form.invoiceRef}
                                onChange={e => patch({ invoiceRef: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Input
                            className="mt-1" value={form.notes}
                            onChange={e => patch({ notes: e.target.value })}
                        />
                    </div>

                    {/* ── Accounting fields — shown always but required only when hasCost ── */}
                    <DualCalendarTailwind
                        value={form.nepaliDate}
                        onChange={date => patch({ nepaliDate: date })}
                        required={hasCost}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button
                        disabled={busy}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={submit}
                    >
                        {busy ? "Saving…" : hasCost ? "Record Refill & Post Expense" : "Record Refill"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}