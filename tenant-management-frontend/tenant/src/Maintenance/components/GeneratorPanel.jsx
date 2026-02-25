import { useState, useEffect, useCallback } from "react";
import {
    Zap, Plus, ChevronDown, ChevronUp, AlertTriangle,
    Clock, Calendar, BarChart3, Fuel, Settings, RefreshCw,
    Wrench, Activity, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import api from "../../../plugins/axios";
import { toast } from "sonner";

// ─── Pure formatting helpers (no business logic) ──────────────────────────────

const fmt = {
    date: (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    time: (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—",
    rupees: (paisa) => paisa ? `₹${(paisa / 100).toLocaleString("en-IN")}` : "—",
    pct: (n) => `${n ?? 0}%`,
};

// ─── Status maps (purely visual, driven by backend-provided status string) ────

const GEN_STATUS_STYLE = {
    ACTIVE: { pill: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
    IDLE: { pill: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-400" },
    MAINTENANCE: { pill: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    FAULT: { pill: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
    DECOMMISSIONED: { pill: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
};

const CHECK_STATUS_STYLE = {
    NORMAL: "bg-green-50 text-green-700 border-green-200",
    LOW_FUEL: "bg-amber-50 text-amber-700 border-amber-200",
    FAULT: "bg-red-50 text-red-700 border-red-200",
};

const SERVICE_TYPES = ["Oil Change", "Filter Replacement", "Full Service", "Inspection", "Battery Check", "Other"];

// ─── FuelGauge — renders the percent the backend gives us ────────────────────

function FuelGauge({ pct = 0, size = 80 }) {
    const r = 36, cx = 48, cy = 48, circum = 2 * Math.PI * r;
    const arcLen = circum * 0.75;
    const fill = arcLen * Math.max(0, Math.min(100, pct)) / 100;
    const dashOffset = -circum * 0.125 + (arcLen - fill);
    const color = pct <= 10 ? "#ef4444" : pct <= 25 ? "#f59e0b" : "#22c55e";

    return (
        <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={9}
                strokeDasharray={`${arcLen} ${circum}`} strokeDashoffset={-circum * 0.125}
                strokeLinecap="round" transform="rotate(135 48 48)" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
                strokeDasharray={`${arcLen} ${circum}`} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(135 48 48)"
                style={{ transition: "stroke-dashoffset .5s ease, stroke .3s" }} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={15} fontWeight={700} fill={color}>{pct}%</text>
            <text x={cx} y={cy + 17} textAnchor="middle" fontSize={8} fill="#94a3b8" letterSpacing={1}>FUEL</text>
        </svg>
    );
}

function Pill({ children, className = "" }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
            {children}
        </span>
    );
}

function StatusDot({ status }) {
    const style = GEN_STATUS_STYLE[status] || GEN_STATUS_STYLE.IDLE;
    return <span className={`inline-block w-2 h-2 rounded-full ${style.dot}`} />;
}

// ─── Daily Check Dialog ───────────────────────────────────────────────────────
// Sends exactly what the backend recordDailyCheck() expects:
// { fuelPercent, runningHours, status (optional), notes }

function DailyCheckDialog({ gen, open, onClose, onDone }) {
    const [form, setForm] = useState({ fuelPercent: "", runningHours: "", notes: "" });
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!form.fuelPercent) return toast.error("Fuel % is required");
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/daily-check`, {
                fuelPercent: Number(form.fuelPercent),
                runningHours: form.runningHours ? Number(form.runningHours) : undefined,
                notes: form.notes || undefined,
                // status intentionally omitted — backend derives it from thresholds
            });
            toast.success("Daily check recorded");
            setForm({ fuelPercent: "", runningHours: "", notes: "" });
            onDone();
            onClose();
        } catch { toast.error("Failed to record check"); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
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
                        <Label>Current Fuel Level (%)</Label>
                        <div className="relative mt-1">
                            <Input type="number" min="0" max="100" placeholder="e.g. 75"
                                className="pr-8" value={form.fuelPercent}
                                onChange={e => setForm(p => ({ ...p, fuelPercent: e.target.value }))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                        {gen.tankCapacityLiters > 0 && form.fuelPercent && (
                            <p className="text-xs text-gray-400 mt-1">
                                ≈ {((Number(form.fuelPercent) / 100) * gen.tankCapacityLiters).toFixed(1)} L in tank
                            </p>
                        )}
                    </div>

                    <div>
                        <Label>Running Hours (optional)</Label>
                        <div className="relative mt-1">
                            <Input type="number" min="0" placeholder="e.g. 1240"
                                className="pr-10" value={form.runningHours}
                                onChange={e => setForm(p => ({ ...p, runningHours: e.target.value }))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
                        </div>
                    </div>

                    <div>
                        <Label>Notes (optional)</Label>
                        <Input placeholder="Any observations…" value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white" onClick={submit}>
                        {busy ? "Saving…" : "Save Check"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Fuel Refill Dialog ───────────────────────────────────────────────────────
// Sends exactly what recordFuelRefill() expects:
// { liters, cost, fuelLevelAfterPercent, supplier, invoiceRef, notes }

function FuelRefillDialog({ gen, open, onClose, onDone }) {
    const [form, setForm] = useState({ liters: "", cost: "", fuelLevelAfterPercent: "", supplier: "", invoiceRef: "", notes: "" });
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!form.liters || Number(form.liters) <= 0) return toast.error("Liters added is required");
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/fuel-refill`, {
                liters: Number(form.liters),
                cost: form.cost ? Number(form.cost) : undefined,
                fuelLevelAfterPercent: form.fuelLevelAfterPercent ? Number(form.fuelLevelAfterPercent) : undefined,
                supplier: form.supplier || undefined,
                invoiceRef: form.invoiceRef || undefined,
                notes: form.notes || undefined,
            });
            toast.success("Refill recorded");
            setForm({ liters: "", cost: "", fuelLevelAfterPercent: "", supplier: "", invoiceRef: "", notes: "" });
            onDone();
            onClose();
        } catch { toast.error("Failed to record refill"); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-white text-black sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">Record Fuel Refill</DialogTitle>
                    <p className="text-xs text-gray-400">{gen.name} · Current: {fmt.pct(gen.currentFuelPercent)} · Tank: {gen.tankCapacityLiters}L</p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Liters Added *</Label>
                            <div className="relative mt-1">
                                <Input type="number" min="0" step="0.1" placeholder="e.g. 50"
                                    className="pr-6" value={form.liters}
                                    onChange={e => setForm(p => ({ ...p, liters: e.target.value }))} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">L</span>
                            </div>
                        </div>
                        <div>
                            <Label>Fuel Level After (%)</Label>
                            <div className="relative mt-1">
                                <Input type="number" min="0" max="100" placeholder="e.g. 90"
                                    className="pr-8" value={form.fuelLevelAfterPercent}
                                    onChange={e => setForm(p => ({ ...p, fuelLevelAfterPercent: e.target.value }))} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Cost (₹)</Label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <Input type="number" min="0" className="pl-6" value={form.cost}
                                onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Supplier</Label>
                            <Input className="mt-1" placeholder="e.g. HP Petrol" value={form.supplier}
                                onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Invoice Ref</Label>
                            <Input className="mt-1" placeholder="INV-001" value={form.invoiceRef}
                                onChange={e => setForm(p => ({ ...p, invoiceRef: e.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Input className="mt-1" value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={busy} className="bg-orange-500 hover:bg-orange-600 text-white" onClick={submit}>
                        {busy ? "Saving…" : "Record Refill"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Service Log Dialog ───────────────────────────────────────────────────────
// Sends exactly what recordServiceLog() expects:
// { type, description, cost, technician, nextServiceDate, nextServiceHours, notes }

function ServiceLogDialog({ gen, open, onClose, onDone }) {
    const [form, setForm] = useState({
        type: "Full Service", description: "", cost: "",
        technician: "", nextServiceDate: "", nextServiceHours: "", notes: "",
    });
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!form.type) return toast.error("Service type is required");
        setBusy(true);
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/service-log`, {
                type: form.type,
                description: form.description || undefined,
                cost: form.cost ? Number(form.cost) : undefined,
                technician: form.technician || undefined,
                nextServiceDate: form.nextServiceDate || undefined,
                nextServiceHours: form.nextServiceHours ? Number(form.nextServiceHours) : undefined,
                notes: form.notes || undefined,
            });
            toast.success("Service log recorded");
            setForm({ type: "Full Service", description: "", cost: "", technician: "", nextServiceDate: "", nextServiceHours: "", notes: "" });
            onDone();
            onClose();
        } catch { toast.error("Failed to record service log"); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-white text-black sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">Record Service</DialogTitle>
                    <p className="text-xs text-gray-400">{gen.name}</p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    <div>
                        <Label>Service Type *</Label>
                        <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Input className="mt-1" placeholder="What was done?" value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Cost (₹)</Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                <Input type="number" className="pl-6" value={form.cost}
                                    onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Technician</Label>
                            <Input className="mt-1" value={form.technician}
                                onChange={e => setForm(p => ({ ...p, technician: e.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Next Service Date</Label>
                            <Input type="date" className="mt-1" value={form.nextServiceDate}
                                onChange={e => setForm(p => ({ ...p, nextServiceDate: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Next at (hrs)</Label>
                            <div className="relative mt-1">
                                <Input type="number" className="pr-10" value={form.nextServiceHours}
                                    onChange={e => setForm(p => ({ ...p, nextServiceHours: e.target.value }))} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Input className="mt-1" value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={busy} className="bg-purple-600 hover:bg-purple-700 text-white" onClick={submit}>
                        {busy ? "Saving…" : "Save Log"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Add Generator Dialog ─────────────────────────────────────────────────────

function AddGeneratorDialog({ open, onClose, onDone }) {
    const [form, setForm] = useState({
        name: "", make: "", model: "", serialNumber: "",
        capacityKva: "", fuelType: "Diesel",
        tankCapacityLiters: "", lowFuelThresholdPercent: "20", criticalFuelThresholdPercent: "10",
    });
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!form.name || !form.tankCapacityLiters) return toast.error("Name and tank capacity are required");
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
            setForm({ name: "", make: "", model: "", serialNumber: "", capacityKva: "", fuelType: "Diesel", tankCapacityLiters: "", lowFuelThresholdPercent: "20", criticalFuelThresholdPercent: "10" });
            onDone();
            onClose();
        } catch { toast.error("Failed to add generator"); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-white text-black sm:max-w-md">
                <DialogHeader><DialogTitle>Add Generator</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="col-span-2">
                        <Label>Generator Name *</Label>
                        <Input className="mt-1" placeholder="e.g. DG Set – Block A" value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Make</Label>
                        <Input className="mt-1" placeholder="e.g. Cummins" value={form.make}
                            onChange={e => setForm(p => ({ ...p, make: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Model</Label>
                        <Input className="mt-1" value={form.model}
                            onChange={e => setForm(p => ({ ...p, model: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Serial Number</Label>
                        <Input className="mt-1" value={form.serialNumber}
                            onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Capacity (kVA)</Label>
                        <Input className="mt-1" type="number" value={form.capacityKva}
                            onChange={e => setForm(p => ({ ...p, capacityKva: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Fuel Type</Label>
                        <Select value={form.fuelType} onValueChange={v => setForm(p => ({ ...p, fuelType: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["Diesel", "Petrol", "Gas", "Dual Fuel"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Tank Capacity (L) *</Label>
                        <Input className="mt-1" type="number" value={form.tankCapacityLiters}
                            onChange={e => setForm(p => ({ ...p, tankCapacityLiters: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Low Fuel Alert (%)</Label>
                        <div className="relative mt-1">
                            <Input type="number" min="5" max="50" className="pr-8" value={form.lowFuelThresholdPercent}
                                onChange={e => setForm(p => ({ ...p, lowFuelThresholdPercent: e.target.value }))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                    </div>
                    <div>
                        <Label>Critical Fuel Alert (%)</Label>
                        <div className="relative mt-1">
                            <Input type="number" min="2" max="20" className="pr-8" value={form.criticalFuelThresholdPercent}
                                onChange={e => setForm(p => ({ ...p, criticalFuelThresholdPercent: e.target.value }))} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={busy} className="text-white" onClick={submit}>
                        {busy ? "Adding…" : "Add Generator"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── GeneratorCard ────────────────────────────────────────────────────────────
// Pure renderer — reads backend fields directly, no derived state

function GeneratorCard({ gen, onRefresh }) {
    const [tab, setTab] = useState("overview");
    const [expanded, setExpanded] = useState(false);
    const [checkOpen, setCheckOpen] = useState(false);
    const [refillOpen, setRefillOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);

    const statusStyle = GEN_STATUS_STYLE[gen.status] || GEN_STATUS_STYLE.IDLE;

    // Backend-provided values — no derivation
    const fuelPct = gen.currentFuelPercent ?? 0;
    const isFault = gen.status === "FAULT";
    const isMaintenance = gen.status === "MAINTENANCE";

    // Sorted newest-first — display only
    const checks = [...(gen.dailyChecks || [])].reverse().slice(0, 15);
    const refills = [...(gen.fuelRefills || [])].reverse().slice(0, 15);
    const services = [...(gen.serviceLogs || [])].reverse().slice(0, 15);

    return (
        <>
            <DailyCheckDialog gen={gen} open={checkOpen} onClose={() => setCheckOpen(false)} onDone={onRefresh} />
            <FuelRefillDialog gen={gen} open={refillOpen} onClose={() => setRefillOpen(false)} onDone={onRefresh} />
            <ServiceLogDialog gen={gen} open={serviceOpen} onClose={() => setServiceOpen(false)} onDone={onRefresh} />

            <div className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden
                ${isFault ? "border-red-300" : isMaintenance ? "border-amber-300" : "border-gray-200"}`}>

                {/* ── Header row ─────────────────────────────────────────────── */}
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 flex-wrap sm:flex-nowrap">

                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusStyle.pill}`}>
                        <Zap className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-gray-900 truncate">{gen.name}</h3>
                            <Pill className={statusStyle.pill}>
                                <StatusDot status={gen.status} />
                                {gen.status?.replace(/_/g, " ")}
                            </Pill>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
                            {gen.make && <span>{gen.make}{gen.model ? ` · ${gen.model}` : ""}</span>}
                            {!gen.make && gen.model && <span>{gen.model}</span>}
                            {gen.capacityKva && <span>{gen.capacityKva} kVA</span>}
                            {gen.fuelType && <span>{gen.fuelType}</span>}
                            {gen.tankCapacityLiters && <span>Tank {gen.tankCapacityLiters}L</span>}
                            {gen.serialNumber && <span>S/N {gen.serialNumber}</span>}
                            {gen.property?.name && <span>{gen.property.name}</span>}
                        </div>
                    </div>

                    {/* Gauge — renders backend currentFuelPercent as-is */}
                    <FuelGauge pct={fuelPct} size={80} />

                    {/* Action buttons */}
                    <div className="flex sm:flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setCheckOpen(true)}
                            className="text-xs h-7 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 px-2">
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Check</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRefillOpen(true)}
                            className="text-xs h-7 gap-1 border-orange-200 text-orange-600 hover:bg-orange-50 px-2">
                            <Fuel className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Refill</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setServiceOpen(true)}
                            className="text-xs h-7 gap-1 border-purple-200 text-purple-600 hover:bg-purple-50 px-2">
                            <Wrench className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Service</span>
                        </Button>
                    </div>

                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => setExpanded(e => !e)}>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>

                {/* ── Stats strip — all values from backend ──────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 bg-gray-50/50 divide-x divide-gray-100">
                    {[
                        { label: "Last Check", value: fmt.date(gen.lastCheckedAt) },
                        { label: "Daily Checks", value: gen.dailyChecks?.length ?? 0 },
                        { label: "Refills", value: gen.fuelRefills?.length ?? 0 },
                        { label: "Service Logs", value: gen.serviceLogs?.length ?? 0 },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-2.5 px-2 border-b sm:border-b-0 border-gray-100">
                            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                            <span className="text-sm font-bold text-gray-700 mt-0.5">{value}</span>
                        </div>
                    ))}
                </div>

                {/* ── Threshold row — rendered directly from backend fields ──── */}
                <div className="flex gap-2 px-4 py-2 border-t border-gray-100 bg-white flex-wrap items-center">
                    <span className="text-[10px] text-gray-400">Thresholds:</span>
                    <Pill className="bg-amber-50 text-amber-700 border-amber-200">Low ≤ {gen.lowFuelThresholdPercent}%</Pill>
                    <Pill className="bg-red-50 text-red-700 border-red-200">Critical ≤ {gen.criticalFuelThresholdPercent}%</Pill>
                    {gen.nextServiceDate && (
                        <Pill className="bg-purple-50 text-purple-700 border-purple-200 ml-auto">
                            <Calendar className="w-3 h-3" /> Next service {fmt.date(gen.nextServiceDate)}
                        </Pill>
                    )}
                </div>

                {/* ── Expanded detail ────────────────────────────────────────── */}
                {expanded && (
                    <div className="border-t border-gray-200">
                        <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto">
                            {[
                                { key: "overview", label: "Overview" },
                                { key: "checks", label: `Checks (${gen.dailyChecks?.length ?? 0})` },
                                { key: "refills", label: `Refills (${gen.fuelRefills?.length ?? 0})` },
                                { key: "services", label: `Services (${gen.serviceLogs?.length ?? 0})` },
                            ].map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors whitespace-nowrap px-3
                                        ${tab === t.key ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-gray-400 hover:text-gray-600"}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 space-y-3">

                            {/* ── Overview ──────────────────────────────────────── */}
                            {tab === "overview" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Fuel trend bars — values from backend dailyChecks[].fuelPercent */}
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
                                            Fuel Trend (last {Math.min(checks.length, 7)} checks)
                                        </p>
                                        {checks.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">No checks yet</p>
                                        ) : (
                                            <div className="flex items-end gap-1.5 h-14">
                                                {[...checks].reverse().slice(-7).map((c, i) => {
                                                    const p = c.fuelPercent ?? 0;
                                                    // Color thresholds from backend fields — no inline derivation
                                                    const color = p <= (gen.criticalFuelThresholdPercent ?? 10) ? "bg-red-500"
                                                        : p <= (gen.lowFuelThresholdPercent ?? 20) ? "bg-amber-400"
                                                            : "bg-green-500";
                                                    return (
                                                        <div key={i} title={`${p}% — ${fmt.date(c.date)}`}
                                                            className="flex-1 flex flex-col items-center gap-0.5 group cursor-default">
                                                            <span className="text-[8px] text-gray-400 group-hover:text-gray-600">{p}%</span>
                                                            <div className={`w-full rounded-t ${color}`}
                                                                style={{ height: `${Math.max(4, (p / 100) * 40)}px` }} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest service entry */}
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Latest Service</p>
                                        {services.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">No service logs yet</p>
                                        ) : (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-0.5">
                                                <p className="text-sm font-semibold text-purple-800">{services[0].type}</p>
                                                <p className="text-xs text-purple-600">{fmt.date(services[0].date)}</p>
                                                {services[0].technician && <p className="text-xs text-purple-500">Tech: {services[0].technician}</p>}
                                                {services[0].costPaisa > 0 && <p className="text-xs text-purple-500">Cost: {fmt.rupees(services[0].costPaisa)}</p>}
                                                {services[0].nextServiceDate && (
                                                    <p className="text-xs text-purple-400">Next: {fmt.date(services[0].nextServiceDate)}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Daily Checks ──────────────────────────────────── */}
                            {tab === "checks" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Daily Check Log</p>
                                        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                            onClick={() => setCheckOpen(true)}>
                                            <Plus className="w-3.5 h-3.5" /> Add
                                        </Button>
                                    </div>
                                    {checks.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-8">No checks recorded yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {checks.map((c, i) => (
                                                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 bg-gray-50/60">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
                                                        ${(c.fuelPercent ?? 0) <= (gen.criticalFuelThresholdPercent ?? 10) ? "bg-red-100 text-red-600"
                                                            : (c.fuelPercent ?? 0) <= (gen.lowFuelThresholdPercent ?? 20) ? "bg-amber-100 text-amber-700"
                                                                : "bg-green-100 text-green-700"}`}>
                                                        {c.fuelPercent ?? 0}%
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex gap-1.5 items-center flex-wrap">
                                                            {c.status && (
                                                                <Pill className={CHECK_STATUS_STYLE[c.status] || CHECK_STATUS_STYLE.NORMAL}>
                                                                    {c.status.replace(/_/g, " ")}
                                                                </Pill>
                                                            )}
                                                            {c.runningHours != null && (
                                                                <span className="text-[11px] text-gray-400">{c.runningHours} hrs</span>
                                                            )}
                                                            {c.checkedBy?.name && (
                                                                <span className="text-[11px] text-gray-400">by {c.checkedBy.name}</span>
                                                            )}
                                                        </div>
                                                        {c.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.notes}</p>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 shrink-0">{fmt.time(c.date)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Fuel Refills ──────────────────────────────────── */}
                            {tab === "refills" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Fuel Refill Log</p>
                                        <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1"
                                            onClick={() => setRefillOpen(true)}>
                                            <Plus className="w-3.5 h-3.5" /> Add
                                        </Button>
                                    </div>
                                    {refills.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-8">No refills recorded yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {refills.map((r, i) => (
                                                <div key={i} className="flex items-center gap-3 rounded-lg border border-orange-100 p-2.5 bg-orange-50/30">
                                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-orange-600">{r.litersAdded}L</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex gap-2 flex-wrap items-center">
                                                            {r.fuelLevelAfterPercent != null && (
                                                                <span className="text-xs text-gray-600">→ {r.fuelLevelAfterPercent}% after</span>
                                                            )}
                                                            {r.costPaisa > 0 && (
                                                                <span className="text-xs font-semibold text-gray-700">{fmt.rupees(r.costPaisa)}</span>
                                                            )}
                                                            {r.supplier && <span className="text-xs text-gray-500">{r.supplier}</span>}
                                                            {r.invoiceRef && <span className="text-xs text-gray-400">#{r.invoiceRef}</span>}
                                                        </div>
                                                        {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 shrink-0">{fmt.time(r.date)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Service Logs ──────────────────────────────────── */}
                            {tab === "services" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Service History</p>
                                        <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                                            onClick={() => setServiceOpen(true)}>
                                            <Plus className="w-3.5 h-3.5" /> Add
                                        </Button>
                                    </div>
                                    {services.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-8">No service records yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {services.map((s, i) => (
                                                <div key={i} className="rounded-lg border border-gray-200 p-3 bg-white">
                                                    <div className="flex items-start gap-2 flex-wrap">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-semibold text-gray-800">{s.type}</p>
                                                                {s.costPaisa > 0 && (
                                                                    <span className="text-xs font-medium text-gray-500">{fmt.rupees(s.costPaisa)}</span>
                                                                )}
                                                            </div>
                                                            {s.description && <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>}
                                                            <div className="flex gap-3 mt-1 flex-wrap text-xs text-gray-400">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />{fmt.date(s.date)}
                                                                </span>
                                                                {s.technician && <span>Tech: {s.technician}</span>}
                                                                {s.nextServiceDate && <span>Next: {fmt.date(s.nextServiceDate)}</span>}
                                                                {s.nextServiceHours && <span>Next at {s.nextServiceHours} hrs</span>}
                                                            </div>
                                                            {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── GeneratorPanel (main export) ─────────────────────────────────────────────

export default function GeneratorPanel() {
    const [generators, setGenerators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    const fetchGenerators = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/maintenance/generator/all");
            setGenerators(res.data?.data || []);
        } catch { toast.error("Failed to load generators"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchGenerators(); }, [fetchGenerators]);

    // Summary counts — derived from backend-provided status strings & array lengths only
    const total = generators.length;
    const faultCount = generators.filter(g => g.status === "FAULT").length;
    const maintCount = generators.filter(g => g.status === "MAINTENANCE").length;
    const checkedToday = generators.filter(g =>
        g.lastCheckedAt && new Date(g.lastCheckedAt).toDateString() === new Date().toDateString()
    ).length;

    return (
        <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total", value: total, color: "text-gray-800", bg: "bg-gray-50 border-gray-200" },
                    { label: "Checked Today", value: checkedToday, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                    { label: "Fault", value: faultCount, color: "text-red-700", bg: "bg-red-50 border-red-200" },
                    { label: "Maintenance", value: maintCount, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} border rounded-xl px-4 py-3 flex flex-col`}>
                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                        <span className={`text-2xl font-bold mt-1 ${color}`}>{value}</span>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                    {total} Generator{total !== 1 ? "s" : ""}
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fetchGenerators} disabled={loading}>
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1.5 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add Generator
                    </Button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading generators…
                </div>
            ) : total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <Zap className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm font-medium">No generators added yet</p>
                    <Button size="sm" className="mt-4 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add your first generator
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {generators.map(g => <GeneratorCard key={g._id} gen={g} onRefresh={fetchGenerators} />)}
                </div>
            )}

            <AddGeneratorDialog open={addOpen} onClose={() => setAddOpen(false)} onDone={fetchGenerators} />
        </div>
    );
}