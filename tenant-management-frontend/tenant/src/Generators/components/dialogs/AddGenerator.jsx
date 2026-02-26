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

const EMPTY = {
    name: "", model: "", serialNumber: "",
    capacityKva: "", fuelType: "Diesel",
    tankCapacityLiters: "",
    lowFuelThresholdPercent: "20",
    criticalFuelThresholdPercent: "10",
};

const FUEL_TYPES = ["Diesel", "Petrol", "Gas", "Dual Fuel"];

/**
 * AddGeneratorDialog
 *
 * Props:
 *   open    {boolean}
 *   onClose {()=>void}
 *   onDone  {()=>void}
 */
export function AddGeneratorDialog({ open, onClose, onDone }) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const patch = (p) => setForm((f) => ({ ...f, ...p }));
    const reset = () => setForm(EMPTY);
    const handleClose = () => { reset(); onClose(); };

    const submit = async () => {
        if (!form.name || !form.tankCapacityLiters) {
            return toast.error("Name and tank capacity are required");
        }
        setBusy(true);
        try {
            await api.post("/api/maintenance/generator/create", {
                ...form,
                capacityKva: form.capacityKva ? Number(form.capacityKva) : undefined,
                tankCapacityLiters: Number(form.tankCapacityLiters),
                lowFuelThresholdPercent: Number(form.lowFuelThresholdPercent),
                criticalFuelThresholdPercent: Number(form.criticalFuelThresholdPercent),
            });
            toast.success("Generator added");
            reset();
            onDone();
            onClose();
        } catch {
            toast.error("Failed to add generator");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-white text-black sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Generator</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="col-span-2">
                        <Label>Generator Name *</Label>
                        <Input
                            className="mt-1" placeholder="e.g. DG Set – Block A"
                            value={form.name}
                            onChange={e => patch({ name: e.target.value })}
                        />
                    </div>

                    <div>
                        <Label>Model</Label>
                        <Input className="mt-1" value={form.model}
                            onChange={e => patch({ model: e.target.value })} />
                    </div>

                    <div>
                        <Label>Serial Number</Label>
                        <Input className="mt-1" value={form.serialNumber}
                            onChange={e => patch({ serialNumber: e.target.value })} />
                    </div>

                    <div>
                        <Label>Capacity (kVA)</Label>
                        <Input className="mt-1" type="number" value={form.capacityKva}
                            onChange={e => patch({ capacityKva: e.target.value })} />
                    </div>

                    <div>
                        <Label>Fuel Type</Label>
                        <Select value={form.fuelType} onValueChange={v => patch({ fuelType: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {FUEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Tank Capacity (L) *</Label>
                        <Input className="mt-1" type="number" value={form.tankCapacityLiters}
                            onChange={e => patch({ tankCapacityLiters: e.target.value })} />
                    </div>

                    <div>
                        <Label>Low Fuel Alert (%)</Label>
                        <div className="relative mt-1">
                            <Input
                                type="number" min="5" max="50" className="pr-8"
                                value={form.lowFuelThresholdPercent}
                                onChange={e => patch({ lowFuelThresholdPercent: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                    </div>

                    <div>
                        <Label>Critical Fuel Alert (%)</Label>
                        <div className="relative mt-1">
                            <Input
                                type="number" min="2" max="20" className="pr-8"
                                value={form.criticalFuelThresholdPercent}
                                onChange={e => patch({ criticalFuelThresholdPercent: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button disabled={busy} className="text-white" onClick={submit}>
                        {busy ? "Adding…" : "Add Generator"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}