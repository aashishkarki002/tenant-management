import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectTrigger, SelectValue,
    SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "../../../../plugins/axios";
import DualCalendarTailwind from "../../../components/dualDate";
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from "../../constants/constant";

const EMPTY = {
    type: "FullService",
    description: "",
    cost: "",
    technician: "",
    nextServiceDate: "",
    nextServiceHours: "",
    notes: "",
    // ── Accounting fields ──
    nepaliDate: "",
    nepaliMonth: "",
    nepaliYear: "",
    paymentMethod: "bank_transfer",
    bankAccountId: "",
};

/**
 * ServiceLogDialog
 *
 * Props:
 *   gen           {object}
 *   open          {boolean}
 *   onClose       {()=>void}
 *   onDone        {()=>void}
 *   bankAccounts  {Array}    — [{ _id, name, accountCode }]
 */
export function ServiceLogDialog({ gen, open, onClose, onDone, bankAccounts = [] }) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const patch = (p) => setForm((f) => ({ ...f, ...p }));
    const reset = () => setForm(EMPTY);
    const handleClose = () => { reset(); onClose(); };

    const hasCost = !!form.cost && Number(form.cost) > 0;

    const validate = () => {
        if (!form.type) { toast.error("Service type is required"); return false; }
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
            await api.post(`/api/maintenance/generator/${gen._id}/service-log`, {
                type: form.type,
                description: form.description || undefined,
                cost: hasCost ? Number(form.cost) : undefined,
                technician: form.technician || undefined,
                nextServiceDate: form.nextServiceDate || undefined,
                nextServiceHours: form.nextServiceHours ? Number(form.nextServiceHours) : undefined,
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
            toast.success("Service log recorded" + (hasCost ? " and expense posted" : ""));
            reset();
            onDone();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to record service log");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-white text-black sm:max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">Record Service</DialogTitle>
                    <p className="text-xs text-gray-400">{gen.name}</p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* ── Service details ── */}
                    <div>
                        <Label>Service Type *</Label>
                        <Select value={form.type} onValueChange={v => patch({ type: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SERVICE_TYPES.map(t => (
                                    <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t] ?? t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Input
                            className="mt-1" placeholder="What was done?"
                            value={form.description}
                            onChange={e => patch({ description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Cost (₹)</Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                <Input
                                    type="number" className="pl-6"
                                    placeholder="Optional"
                                    value={form.cost}
                                    onChange={e => patch({ cost: e.target.value })}
                                />
                            </div>
                            {hasCost && (
                                <p className="text-[10px] text-blue-500 mt-1">
                                    ✦ Expense entry will be created
                                </p>
                            )}
                        </div>
                        <div>
                            <Label>Technician</Label>
                            <Input
                                className="mt-1"
                                value={form.technician}
                                onChange={e => patch({ technician: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Next Service Date</Label>
                            <DualCalendarTailwind
                                value={form.nextServiceDate}
                                onChange={date => patch({ nextServiceDate: date })}
                            />
                        </div>
                        <div>
                            <Label>Next at (hrs)</Label>
                            <div className="relative mt-1">
                                <Input
                                    type="number" className="pr-10"
                                    value={form.nextServiceHours}
                                    onChange={e => patch({ nextServiceHours: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Input
                            className="mt-1" value={form.notes}
                            onChange={e => patch({ notes: e.target.value })}
                        />
                    </div>

                    {/* ── Accounting fields ── */}
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
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={submit}
                    >
                        {busy ? "Saving…" : hasCost ? "Save Log & Post Expense" : "Save Log"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}