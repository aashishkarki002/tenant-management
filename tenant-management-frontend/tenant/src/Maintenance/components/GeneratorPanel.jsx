import { useState, useEffect, useCallback } from "react";
import {
    Zap, Plus, Droplets, Wrench, ChevronDown, ChevronUp,
    AlertTriangle, CheckCircle2, Clock, Calendar, BarChart3,
    Fuel, Settings, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import api from "../../../plugins/axios";
import { toast } from "sonner";

/* ─── Tiny helpers ───────────────────────────────────────────────────────── */
function FuelGauge({ pct = 0, size = 96 }) {
    const r = 38;
    const cx = 52;
    const cy = 52;
    const circum = 2 * Math.PI * r;
    // Only bottom 3/4 arc  (270°)
    const arcLen = circum * 0.75;
    const dashOff = arcLen - (arcLen * Math.max(0, Math.min(100, pct)) / 100);
    const color = pct <= 20 ? "#ef4444" : pct <= 40 ? "#f59e0b" : "#22c55e";

    return (
        <svg width={size} height={size} viewBox="0 0 104 104" className="shrink-0">
            {/* track */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none" stroke="#e5e7eb" strokeWidth={10}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={-circum * 0.125}
                strokeLinecap="round"
                transform="rotate(135 52 52)"
            />
            {/* fill */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none" stroke={color} strokeWidth={10}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={-circum * 0.125 + dashOff}
                strokeLinecap="round"
                transform="rotate(135 52 52)"
                style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }}
            />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>
                {pct}%
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" fontSize={9} fill="#9ca3af">
                FUEL
            </text>
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

const SERV_STATUS = {
    SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
};

const GEN_STATUS = {
    ACTIVE: "bg-green-100 text-green-700 border-green-200",
    INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
    UNDER_MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
    DECOMMISSIONED: "bg-red-100 text-red-700 border-red-200",
};

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ─── GeneratorCard ──────────────────────────────────────────────────────── */
function GeneratorCard({ gen, onRefresh }) {
    const [tab, setTab] = useState("overview"); // overview | checks | refills | servicing
    const [open, setOpen] = useState(false);

    // dialogs
    const [checkDialog, setCheckDialog] = useState(false);
    const [refillDialog, setRefillDialog] = useState(false);
    const [servicDialog, setServicDialog] = useState(false);

    const [checkForm, setCheckForm] = useState({ fuelPercentage: "", engineOilOk: true, coolantOk: true, batteryOk: true, notes: "" });
    const [refillForm, setRefillForm] = useState({ liters: "", cost: "", supplier: "", invoiceNumber: "", notes: "" });
    const [servicForm, setServicForm] = useState({ scheduledDate: "", serviceType: "Full Service", technician: "", cost: "", notes: "", nextServiceDate: "" });

    const fuelPct = gen.currentFuelPercentage ?? 0;
    const isLow = fuelPct <= (gen.lowFuelThreshold ?? 20);

    /* ── Submit handlers ─────────────────────────────────────────────────── */
    const submitCheck = async () => {
        if (!checkForm.fuelPercentage) return toast.error("Enter fuel percentage");
        try {
            const res = await api.post(`/api/maintenance/generator/${gen._id}/daily-check`, {
                ...checkForm,
                fuelPercentage: Number(checkForm.fuelPercentage),
            });
            if (res.data.lowFuelAlert) toast.warning(res.data.lowFuelAlert);
            else toast.success("Daily check recorded");
            setCheckDialog(false);
            setCheckForm({ fuelPercentage: "", engineOilOk: true, coolantOk: true, batteryOk: true, notes: "" });
            onRefresh();
        } catch { toast.error("Failed to record check"); }
    };

    const submitRefill = async () => {
        if (!refillForm.liters || Number(refillForm.liters) <= 0) return toast.error("Enter liters");
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/refill`, {
                ...refillForm,
                liters: Number(refillForm.liters),
                cost: refillForm.cost ? Number(refillForm.cost) : 0,
            });
            toast.success("Refill recorded");
            setRefillDialog(false);
            setRefillForm({ liters: "", cost: "", supplier: "", invoiceNumber: "", notes: "" });
            onRefresh();
        } catch { toast.error("Failed to record refill"); }
    };

    const submitServicing = async () => {
        if (!servicForm.scheduledDate) return toast.error("Select a scheduled date");
        try {
            await api.post(`/api/maintenance/generator/${gen._id}/servicing`, {
                ...servicForm,
                cost: servicForm.cost ? Number(servicForm.cost) : 0,
            });
            toast.success("Servicing scheduled");
            setServicDialog(false);
            setServicForm({ scheduledDate: "", serviceType: "Full Service", technician: "", cost: "", notes: "", nextServiceDate: "" });
            onRefresh();
        } catch { toast.error("Failed to schedule servicing"); }
    };

    const updateServicStatus = async (servicingId, status) => {
        try {
            await api.patch(`/api/maintenance/generator/${gen._id}/servicing/${servicingId}/status`, { status });
            toast.success("Status updated");
            onRefresh();
        } catch { toast.error("Failed to update"); }
    };

    // Sorted arrays newest first
    const checks = [...(gen.dailyChecks || [])].reverse().slice(0, 10);
    const refills = [...(gen.fuelRefills || [])].reverse().slice(0, 10);
    const servicings = [...(gen.scheduledServicing || [])].sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

    const overdueServicing = servicings.filter(s => s.status === "OVERDUE").length;

    return (
        <>
            {/* ── Daily check dialog ─────────────────────────────────────────── */}
            <Dialog open={checkDialog} onOpenChange={setCheckDialog}>
                <DialogContent className="bg-white text-black sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Daily Fuel Check</DialogTitle>
                        <p className="text-xs text-gray-500">{gen.name}</p>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Fuel Level (%)</Label>
                            <div className="relative mt-1">
                                <Input
                                    type="number" min="0" max="100"
                                    value={checkForm.fuelPercentage}
                                    onChange={e => setCheckForm(p => ({ ...p, fuelPercentage: e.target.value }))}
                                    placeholder="e.g. 75"
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                            </div>
                            {gen.tankCapacityLiters > 0 && checkForm.fuelPercentage && (
                                <p className="text-xs text-gray-400 mt-1">
                                    ≈ {((Number(checkForm.fuelPercentage) / 100) * gen.tankCapacityLiters).toFixed(1)} L in tank
                                </p>
                            )}
                        </div>

                        {/* System checks */}
                        <div className="grid grid-cols-3 gap-2">
                            {[["engineOilOk", "Engine Oil"], ["coolantOk", "Coolant"], ["batteryOk", "Battery"]].map(([field, label]) => (
                                <button
                                    key={field}
                                    type="button"
                                    onClick={() => setCheckForm(p => ({ ...p, [field]: !p[field] }))}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${checkForm[field] ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-600"}`}
                                >
                                    {checkForm[field] ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div>
                            <Label>Notes (optional)</Label>
                            <Input className="mt-1" value={checkForm.notes} onChange={e => setCheckForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any observations..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCheckDialog(false)}>Cancel</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={submitCheck}>Save Check</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Refill dialog ──────────────────────────────────────────────── */}
            <Dialog open={refillDialog} onOpenChange={setRefillDialog}>
                <DialogContent className="bg-white text-black sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Record Fuel Refill</DialogTitle>
                        <p className="text-xs text-gray-500">Current: {fuelPct}% · Tank: {gen.tankCapacityLiters}L</p>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Liters Added</Label>
                            <div className="relative mt-1">
                                <Input
                                    type="number" min="0" step="0.1"
                                    value={refillForm.liters}
                                    onChange={e => setRefillForm(p => ({ ...p, liters: e.target.value }))}
                                    placeholder="e.g. 50"
                                    className="pr-6"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">L</span>
                            </div>
                            {gen.tankCapacityLiters > 0 && refillForm.liters && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Estimated after refill: {Math.min(100, Math.round(
                                        (((fuelPct / 100) * gen.tankCapacityLiters + Number(refillForm.liters)) / gen.tankCapacityLiters) * 100
                                    ))}%
                                </p>
                            )}
                        </div>
                        <div>
                            <Label>Cost (₹)</Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                <Input type="number" min="0" value={refillForm.cost} onChange={e => setRefillForm(p => ({ ...p, cost: e.target.value }))} className="pl-6" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label>Supplier</Label>
                                <Input className="mt-1" value={refillForm.supplier} onChange={e => setRefillForm(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. HP Petrol" />
                            </div>
                            <div>
                                <Label>Invoice #</Label>
                                <Input className="mt-1" value={refillForm.invoiceNumber} onChange={e => setRefillForm(p => ({ ...p, invoiceNumber: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Input className="mt-1" value={refillForm.notes} onChange={e => setRefillForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRefillDialog(false)}>Cancel</Button>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={submitRefill}>Record Refill</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Servicing dialog ───────────────────────────────────────────── */}
            <Dialog open={servicDialog} onOpenChange={setServicDialog}>
                <DialogContent className="bg-white text-black sm:max-w-sm">
                    <DialogHeader><DialogTitle>Schedule Servicing</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Service Type</Label>
                            <Select value={servicForm.serviceType} onValueChange={v => setServicForm(p => ({ ...p, serviceType: v }))}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Oil Change", "Filter Replacement", "Full Service", "Inspection", "Battery Check", "Other"].map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Scheduled Date</Label>
                            <Input type="date" className="mt-1" value={servicForm.scheduledDate} onChange={e => setServicForm(p => ({ ...p, scheduledDate: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label>Technician</Label>
                                <Input className="mt-1" value={servicForm.technician} onChange={e => setServicForm(p => ({ ...p, technician: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Est. Cost (₹)</Label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                    <Input type="number" value={servicForm.cost} onChange={e => setServicForm(p => ({ ...p, cost: e.target.value }))} className="pl-6" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>Next Service Date</Label>
                            <Input type="date" className="mt-1" value={servicForm.nextServiceDate} onChange={e => setServicForm(p => ({ ...p, nextServiceDate: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Input className="mt-1" value={servicForm.notes} onChange={e => setServicForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setServicDialog(false)}>Cancel</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={submitServicing}>Schedule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Generator card ─────────────────────────────────────────────── */}
            <div className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow ${isLow ? "border-red-300" : "border-gray-200"}`}>

                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${gen.status === "ACTIVE" ? "bg-green-100" : "bg-gray-100"}`}>
                        <Zap className={`w-5 h-5 ${gen.status === "ACTIVE" ? "text-green-600" : "text-gray-400"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-sm">{gen.name}</h3>
                            <Pill className={GEN_STATUS[gen.status] || GEN_STATUS.INACTIVE}>{gen.status?.replace("_", " ")}</Pill>
                            {isLow && (
                                <Pill className="bg-red-50 text-red-600 border-red-300">
                                    <AlertTriangle className="w-3 h-3" /> LOW FUEL
                                </Pill>
                            )}
                            {overdueServicing > 0 && (
                                <Pill className="bg-amber-50 text-amber-700 border-amber-300">
                                    <Clock className="w-3 h-3" /> {overdueServicing} OVERDUE SERVICE
                                </Pill>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-400">
                            {gen.make && <span>{gen.make} {gen.model}</span>}
                            {gen.capacityKva && <span>{gen.capacityKva} kVA</span>}
                            {gen.fuelType && <span>{gen.fuelType}</span>}
                            {gen.tankCapacityLiters && <span>Tank: {gen.tankCapacityLiters}L</span>}
                            {gen.serialNumber && <span>S/N: {gen.serialNumber}</span>}
                            {gen.property?.name && <span>{gen.property.name}</span>}
                        </div>
                    </div>

                    {/* Gauge */}
                    <FuelGauge pct={fuelPct} size={88} />

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setCheckDialog(true)}>
                            <BarChart3 className="w-3.5 h-3.5" /> Daily Check
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setRefillDialog(true)}>
                            <Fuel className="w-3.5 h-3.5" /> Refill
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50" onClick={() => setServicDialog(true)}>
                            <Settings className="w-3.5 h-3.5" /> Service
                        </Button>
                    </div>

                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setOpen(o => !o)}>
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>

                {/* Quick stats strip */}
                <div className="grid grid-cols-4 border-t border-gray-100 bg-gray-50/60 divide-x divide-gray-100">
                    {[
                        { label: "Last Check", value: gen.lastCheckedAt ? fmtDate(gen.lastCheckedAt) : "Never" },
                        { label: "Checks (total)", value: gen.dailyChecks?.length ?? 0 },
                        { label: "Total Refills", value: gen.fuelRefills?.length ?? 0 },
                        { label: "Upcoming Service", value: servicings.find(s => s.status === "SCHEDULED") ? fmtDate(servicings.find(s => s.status === "SCHEDULED").scheduledDate) : "—" },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-2.5 px-2">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
                            <span className="text-sm font-bold text-gray-700 mt-0.5">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Expanded tabs */}
                {open && (
                    <div className="border-t border-gray-200">
                        {/* Tab bar */}
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            {["overview", "checks", "refills", "servicing"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${tab === t ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-gray-400 hover:text-gray-600"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="p-4">
                            {/* ── Overview ──────────────────────────────────────────── */}
                            {tab === "overview" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Fuel trend (last 7 checks) */}
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Fuel Trend (last 7 checks)</p>
                                        {checks.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">No checks recorded yet</p>
                                        ) : (
                                            <div className="flex items-end gap-1.5 h-16">
                                                {checks.slice(0, 7).reverse().map((c, i) => {
                                                    const pct = c.fuelPercentage;
                                                    const color = pct <= 20 ? "bg-red-500" : pct <= 40 ? "bg-amber-400" : "bg-green-500";
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                                            <span className="text-[9px] text-gray-400">{pct}%</span>
                                                            <div className={`w-full rounded-t ${color}`} style={{ height: `${(pct / 100) * 48}px`, minHeight: 4 }} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Next servicing */}
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Next Scheduled Service</p>
                                        {(() => {
                                            const next = servicings.find(s => s.status === "SCHEDULED");
                                            if (!next) return <p className="text-xs text-gray-400 italic">No upcoming servicing</p>;
                                            const daysAway = Math.ceil((new Date(next.scheduledDate) - new Date()) / 86400000);
                                            return (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                    <p className="text-sm font-semibold text-blue-800">{next.serviceType}</p>
                                                    <p className="text-xs text-blue-600 mt-0.5">{fmtDate(next.scheduledDate)}</p>
                                                    <p className="text-xs text-blue-400 mt-0.5">
                                                        {daysAway > 0 ? `In ${daysAway} days` : daysAway === 0 ? "Today" : `${Math.abs(daysAway)} days overdue`}
                                                    </p>
                                                    {next.technician && <p className="text-xs text-blue-500 mt-1">Tech: {next.technician}</p>}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* ── Daily Checks ──────────────────────────────────────── */}
                            {tab === "checks" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Recent Daily Checks</p>
                                        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCheckDialog(true)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Check
                                        </Button>
                                    </div>
                                    {checks.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-6">No daily checks recorded</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {checks.map((c, i) => (
                                                <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5 bg-gray-50/60">
                                                    <div className="shrink-0">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${c.fuelPercentage <= 20 ? "bg-red-100 text-red-600" : c.fuelPercentage <= 40 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                                                            {c.fuelPercentage}%
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            <Pill className={c.engineOilOk ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}>Oil {c.engineOilOk ? "✓" : "✗"}</Pill>
                                                            <Pill className={c.coolantOk ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}>Coolant {c.coolantOk ? "✓" : "✗"}</Pill>
                                                            <Pill className={c.batteryOk ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}>Battery {c.batteryOk ? "✓" : "✗"}</Pill>
                                                        </div>
                                                        {c.notes && <p className="text-xs text-gray-500 mt-1 truncate">{c.notes}</p>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(c.checkedAt)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Fuel Refills ──────────────────────────────────────── */}
                            {tab === "refills" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Fuel Refill Log</p>
                                        <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setRefillDialog(true)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Refill
                                        </Button>
                                    </div>
                                    {refills.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-6">No refills recorded</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {refills.map((r, i) => (
                                                <div key={i} className="flex items-center gap-3 border border-orange-100 rounded-lg p-2.5 bg-orange-50/30">
                                                    <div className="w-10 h-10 bg-orange-100 rounded-full flex flex-col items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-orange-600">{r.liters}L</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {r.fuelPercentageBefore !== undefined && r.fuelPercentageAfter !== undefined && (
                                                                <span className="text-xs text-gray-600">
                                                                    {r.fuelPercentageBefore}% → {r.fuelPercentageAfter}%
                                                                </span>
                                                            )}
                                                            {r.costPaisa > 0 && (
                                                                <span className="text-xs font-medium text-gray-700">₹{(r.costPaisa / 100).toFixed(0)}</span>
                                                            )}
                                                            {r.supplier && <span className="text-xs text-gray-500">{r.supplier}</span>}
                                                            {r.invoiceNumber && <span className="text-xs text-gray-400">#{r.invoiceNumber}</span>}
                                                        </div>
                                                        {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(r.refilledAt)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Servicing ─────────────────────────────────────────── */}
                            {tab === "servicing" && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-xs font-semibold text-gray-600">Scheduled Servicing</p>
                                        <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setServicDialog(true)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Schedule
                                        </Button>
                                    </div>
                                    {servicings.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-6">No servicing scheduled</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {servicings.map((s) => (
                                                <div key={s._id} className={`border rounded-lg p-3 ${s.status === "OVERDUE" ? "bg-red-50 border-red-200" : s.status === "COMPLETED" ? "bg-green-50/50 border-green-200" : "bg-white border-gray-200"}`}>
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-semibold text-gray-800">{s.serviceType}</p>
                                                                <Pill className={SERV_STATUS[s.status] || SERV_STATUS.SCHEDULED}>{s.status}</Pill>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(s.scheduledDate)}</span>
                                                                {s.technician && <span>Tech: {s.technician}</span>}
                                                                {s.costPaisa > 0 && <span>₹{(s.costPaisa / 100).toFixed(0)}</span>}
                                                                {s.nextServiceDate && <span>Next: {fmtDate(s.nextServiceDate)}</span>}
                                                            </div>
                                                            {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
                                                        </div>
                                                        {/* Quick status update */}
                                                        {s.status !== "COMPLETED" && s.status !== "CANCELLED" && (
                                                            <Select onValueChange={v => updateServicStatus(s._id, v)}>
                                                                <SelectTrigger className="h-7 text-[11px] w-[110px] border-gray-200">
                                                                    <SelectValue placeholder="Update" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {["IN_PROGRESS", "COMPLETED", "CANCELLED"].map(v => (
                                                                        <SelectItem key={v} value={v} className="text-xs">{v.replace("_", " ")}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
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

/* ─── Add Generator dialog ───────────────────────────────────────────────── */
function AddGeneratorDialog({ open, onClose, onCreated }) {
    const [form, setForm] = useState({
        name: "", make: "", model: "", serialNumber: "",
        capacityKva: "", fuelType: "Diesel", tankCapacityLiters: "",
        lowFuelThreshold: "20",
    });

    const handleSubmit = async () => {
        if (!form.name || !form.tankCapacityLiters) return toast.error("Name and tank capacity are required");
        try {
            await api.post("/api/maintenance/generator/create", {
                ...form,
                capacityKva: form.capacityKva ? Number(form.capacityKva) : undefined,
                tankCapacityLiters: Number(form.tankCapacityLiters),
                lowFuelThreshold: Number(form.lowFuelThreshold),
            });
            toast.success("Generator added");
            onCreated();
            onClose();
            setForm({ name: "", make: "", model: "", serialNumber: "", capacityKva: "", fuelType: "Diesel", tankCapacityLiters: "", lowFuelThreshold: "20" });
        } catch { toast.error("Failed to add generator"); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-white text-black sm:max-w-md">
                <DialogHeader><DialogTitle>Add Generator</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="col-span-2">
                        <Label>Generator Name *</Label>
                        <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. DG Set - Block A" />
                    </div>
                    <div>
                        <Label>Make</Label>
                        <Input className="mt-1" value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} placeholder="e.g. Cummins" />
                    </div>
                    <div>
                        <Label>Model</Label>
                        <Input className="mt-1" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Serial Number</Label>
                        <Input className="mt-1" value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Capacity (kVA)</Label>
                        <Input className="mt-1" type="number" value={form.capacityKva} onChange={e => setForm(p => ({ ...p, capacityKva: e.target.value }))} />
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
                        <Input className="mt-1" type="number" value={form.tankCapacityLiters} onChange={e => setForm(p => ({ ...p, tankCapacityLiters: e.target.value }))} />
                    </div>
                    <div>
                        <Label>Low Fuel Alert (%)</Label>
                        <div className="relative mt-1">
                            <Input type="number" min="5" max="50" value={form.lowFuelThreshold} onChange={e => setForm(p => ({ ...p, lowFuelThreshold: e.target.value }))} className="pr-7" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit}>Add Generator</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export default function GeneratorPanel() {
    const [generators, setGenerators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    const fetchGenerators = useCallback(async () => {
        try {
            const res = await api.get("/api/maintenance/generator/all");
            setGenerators(res.data?.data || []);
        } catch { toast.error("Failed to load generators"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchGenerators(); }, [fetchGenerators]);

    const lowFuelCount = generators.filter(g => (g.currentFuelPercentage ?? 0) <= (g.lowFuelThreshold ?? 20)).length;
    const overdueCount = generators.reduce((n, g) => n + (g.scheduledServicing?.filter(s => s.status === "OVERDUE").length || 0), 0);
    const checkedToday = generators.filter(g => g.lastCheckedAt && new Date(g.lastCheckedAt).toDateString() === new Date().toDateString()).length;

    return (
        <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Generators", value: generators.length, color: "text-gray-800", bg: "bg-gray-50  border-gray-200" },
                    { label: "Checked Today", value: checkedToday, color: "text-blue-700", bg: "bg-blue-50  border-blue-200" },
                    { label: "Low Fuel", value: lowFuelCount, color: "text-red-700", bg: "bg-red-50   border-red-200" },
                    { label: "Overdue Service", value: overdueCount, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} border rounded-xl px-4 py-3 flex flex-col`}>
                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                        <span className={`text-2xl font-bold mt-1 ${color}`}>{value}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                    {generators.length} Generator{generators.length !== 1 ? "s" : ""}
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fetchGenerators}>
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add Generator
                    </Button>
                </div>
            </div>

            {/* Generator list */}
            {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-400">Loading generators…</div>
            ) : generators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <Zap className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">No generators added yet</p>
                    <Button size="sm" className="mt-4 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add your first generator
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {generators.map(g => (
                        <GeneratorCard key={g._id} gen={g} onRefresh={fetchGenerators} />
                    ))}
                </div>
            )}

            <AddGeneratorDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={fetchGenerators} />
        </div>
    );
}