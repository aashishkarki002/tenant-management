import React, { useEffect, useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ElectricityRateTab from "./electricityRateTab";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE  (matches systemSettingSeed.js defaults)
// ─────────────────────────────────────────────────────────────────────────────
const ESCALATION_DEFAULTS = {
    enabled: false,
    percentageIncrease: 5,
    intervalMonths: 12,
    appliesTo: "rent_only",
};

const LATE_FEE_DEFAULTS = {
    enabled: false,
    gracePeriodDays: 5,
    type: "simple_daily",   // ← matches seed default
    amount: 2,
    appliesTo: "rent",
    compounding: false,
    maxLateFeeAmount: 5000,
};

// ─────────────────────────────────────────────────────────────────────────────
// FEE TYPE CONFIG  (single source of truth for labels + descriptions)
// ─────────────────────────────────────────────────────────────────────────────
const FEE_TYPES = [
    {
        value: "simple_daily",
        label: "Daily (Linear)",
        description: "balance × rate% × days overdue — grows linearly each day",
        example: (rent, rate, days) => rent * (rate / 100) * days,
        recommended: true,
    },
    {
        value: "percentage",
        label: "One-Time %",
        description: "balance × rate% charged once on the first day past grace",
        example: (rent, rate) => rent * (rate / 100),
        recommended: false,
    },
    {
        value: "fixed",
        label: "Fixed Amount",
        description: "flat rupee amount charged once regardless of overdue balance",
        example: (_rent, amount) => amount,
        recommended: false,
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SystemSettingsTab({ propertyId }) {
    const [escalation, setEscalation] = useState(ESCALATION_DEFAULTS);
    const [lateFee, setLateFee] = useState(LATE_FEE_DEFAULTS);
    const [tenantsConfigured, setTenantsConfigured] = useState(0);

    const [fetching, setFetching] = useState(true);
    const [savingEscalation, setSavingEscalation] = useState(false);
    const [savingLateFee, setSavingLateFee] = useState(false);
    const [applying, setApplying] = useState(false);

    async function fetchSettings() {
        try {
            setFetching(true);
            const res = await api.get("/api/settings/system");
            if (res.data.success) {
                const { escalation: esc, lateFee: lf } = res.data.data;
                setEscalation(esc);
                setLateFee(lf);
                setTenantsConfigured(esc.tenantsConfigured ?? 0);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load system settings");
        } finally {
            setFetching(false);
        }
    }

    async function saveEscalation() {
        try {
            setSavingEscalation(true);
            const res = await api.post("/api/settings/system/escalation", {
                enabled: escalation.enabled,
                percentageIncrease: Number(escalation.percentageIncrease),
                intervalMonths: Number(escalation.intervalMonths),
                appliesTo: escalation.appliesTo,
            });
            if (res.data.success) {
                toast.success("Escalation defaults saved");
                await fetchSettings();
            } else {
                toast.error(res.data.message || "Failed to save");
            }
        } catch {
            toast.error("Failed to save escalation settings");
        } finally {
            setSavingEscalation(false);
        }
    }

    async function applyEscalationToAll() {
        try {
            setApplying(true);
            const res = await api.post("/api/settings/system/escalation/apply-all");
            if (res.data.success) {
                const { applied, failed } = res.data;
                failed > 0
                    ? toast.warning(`Applied to ${applied} tenant(s). ${failed} failed.`)
                    : toast.success(`Escalation enabled for ${applied} tenant(s)`);
                await fetchSettings();
            } else {
                toast.error(res.data.message || "Failed to apply");
            }
        } catch {
            toast.error("Failed to apply escalation");
        } finally {
            setApplying(false);
        }
    }

    async function disableEscalationAll() {
        try {
            setSavingEscalation(true);
            const res = await api.patch("/api/settings/system/escalation/disable-all");
            if (res.data.success) {
                toast.success(res.data.message);
                await fetchSettings();
            }
        } catch {
            toast.error("Failed to disable escalation");
        } finally {
            setSavingEscalation(false);
        }
    }

    async function saveLateFeePolicy() {
        try {
            setSavingLateFee(true);
            const res = await api.post("/api/settings/system/late-fee", {
                enabled: lateFee.enabled,
                gracePeriodDays: Number(lateFee.gracePeriodDays),
                type: lateFee.type,
                amount: Number(lateFee.amount),
                appliesTo: lateFee.appliesTo,
                // compounding only meaningful for type="percentage" — backend also guards this
                compounding: lateFee.type === "percentage" ? lateFee.compounding : false,
                maxLateFeeAmount: Number(lateFee.maxLateFeeAmount),
            });
            if (res.data.success) {
                toast.success("Late fee policy saved");
                await fetchSettings();
            } else {
                toast.error(res.data.message || "Failed to save");
            }
        } catch {
            toast.error("Failed to save late fee policy");
        } finally {
            setSavingLateFee(false);
        }
    }

    // When the type changes, clear compounding so it doesn't silently persist
    function handleTypeChange(newType) {
        setLateFee((p) => ({
            ...p,
            type: newType,
            compounding: newType === "percentage" ? p.compounding : false,
        }));
    }

    useEffect(() => { fetchSettings(); }, []);

    if (fetching) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading system settings…
            </div>
        );
    }

    return (
        <div className="space-y-8">

            {/* ── Electricity Rate ─────────────────────────────────────── */}
            <section>
                <div className="mb-4">
                    <h3 className="text-base font-semibold">Electricity Rate</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure default electricity rates and per-meter-type overrides.
                    </p>
                </div>
                <ElectricityRateTab propertyId={propertyId} />
            </section>

            <Separator />

            {/* ── Rent Escalation ──────────────────────────────────────── */}
            <section>
                <div className="mb-4">
                    <h3 className="text-base font-semibold">Rent Escalation Policy</h3>
                    <p className="text-sm text-muted-foreground">
                        Default settings applied automatically when a new tenant is created.
                    </p>
                </div>

                <Card className="rounded-xl shadow-sm">
                    <CardContent className="pt-6 space-y-6">

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Enable System-Wide Escalation</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    New tenants will be auto-configured with these defaults
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={escalation.enabled ? "default" : "secondary"}>
                                    {escalation.enabled
                                        ? `Active · ${tenantsConfigured} tenant(s)`
                                        : "Inactive"}
                                </Badge>
                                <Switch
                                    checked={escalation.enabled}
                                    onCheckedChange={(v) => setEscalation((p) => ({ ...p, enabled: v }))}
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Percentage Increase (%)</Label>
                                <Input
                                    type="number" min={0.1} step={0.1}
                                    value={escalation.percentageIncrease}
                                    onChange={(e) => setEscalation((p) => ({ ...p, percentageIncrease: e.target.value }))}
                                    disabled={!escalation.enabled}
                                />
                                <p className="text-xs text-muted-foreground">Typical range: 3–10%</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Interval (Months)</Label>
                                <Input
                                    type="number" min={1}
                                    value={escalation.intervalMonths}
                                    onChange={(e) => setEscalation((p) => ({ ...p, intervalMonths: e.target.value }))}
                                    disabled={!escalation.enabled}
                                />
                                <p className="text-xs text-muted-foreground">12 = annual, 6 = semi-annual</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Applies To</Label>
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { value: "rent_only", label: "Rent Only" },
                                    { value: "cam_only", label: "CAM Only" },
                                    { value: "both", label: "Both" },
                                ].map(({ value, label }) => (
                                    <Button
                                        key={value} size="sm"
                                        variant={escalation.appliesTo === value ? "default" : "outline"}
                                        onClick={() => setEscalation((p) => ({ ...p, appliesTo: value }))}
                                        disabled={!escalation.enabled}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button onClick={saveEscalation} disabled={savingEscalation}>
                                {savingEscalation ? "Saving…" : "Save Escalation Settings"}
                            </Button>
                            {escalation.enabled && (
                                <ConfirmDialog
                                    trigger={
                                        <Button variant="secondary" disabled={applying}>
                                            {applying ? "Applying…" : "Apply to All Tenants"}
                                        </Button>
                                    }
                                    title="Apply to all active tenants?"
                                    description={
                                        <>
                                            This will configure <strong>{escalation.percentageIncrease}%</strong>{" "}
                                            escalation every <strong>{escalation.intervalMonths} month(s)</strong>{" "}
                                            on <strong>{escalation.appliesTo.replace("_", " ")}</strong> for every active tenant.
                                        </>
                                    }
                                    onConfirm={applyEscalationToAll}
                                />
                            )}
                            {tenantsConfigured > 0 && (
                                <ConfirmDialog
                                    trigger={<Button variant="destructive" size="sm">Disable for All Tenants</Button>}
                                    title="Disable system-wide escalation?"
                                    description={
                                        <>
                                            Escalation will be turned off for{" "}
                                            <strong>{tenantsConfigured} tenant(s)</strong>. History is kept.
                                        </>
                                    }
                                    onConfirm={disableEscalationAll}
                                    destructive
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </section>

            <Separator />

            {/* ── Late Fee Policy ──────────────────────────────────────── */}
            <section>
                <div className="mb-4">
                    <h3 className="text-base font-semibold">Late Fee Policy</h3>
                    <p className="text-sm text-muted-foreground">
                        Charged automatically when rent remains unpaid past the grace period.
                    </p>
                </div>

                <Card className="rounded-xl shadow-sm">
                    <CardContent className="pt-6 space-y-6">

                        {/* Enable toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Enable Late Fee</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Applied by the nightly cron when overdue rents are processed
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={lateFee.enabled ? "default" : "secondary"}>
                                    {lateFee.enabled ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                    checked={lateFee.enabled}
                                    onCheckedChange={(v) => setLateFee((p) => ({ ...p, enabled: v }))}
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Fee type selector — 3 options */}
                        <div className="space-y-2">
                            <Label>Fee Calculation Type</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                                {FEE_TYPES.map(({ value, label, description, recommended }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        disabled={!lateFee.enabled}
                                        onClick={() => handleTypeChange(value)}
                                        className={[
                                            "relative text-left rounded-lg border px-3.5 py-3 transition-all",
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                            lateFee.type === value
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                                        ].join(" ")}
                                    >
                                        {recommended && (
                                            <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                        <p className="font-medium text-sm">{label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed pr-16">
                                            {description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grace + Amount + Cap */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>Grace Period (Nepali Days)</Label>
                                <Input
                                    type="number" min={0}
                                    value={lateFee.gracePeriodDays}
                                    onChange={(e) => setLateFee((p) => ({ ...p, gracePeriodDays: e.target.value }))}
                                    disabled={!lateFee.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    No fee charged within this many days of the Nepali due date
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>
                                    {lateFee.type === "fixed" ? "Fixed Amount (Rs.)" : "Rate (% of overdue balance)"}
                                </Label>
                                <Input
                                    type="number" min={0.1}
                                    step={lateFee.type === "fixed" ? 50 : 0.1}
                                    value={lateFee.amount}
                                    onChange={(e) => setLateFee((p) => ({ ...p, amount: e.target.value }))}
                                    disabled={!lateFee.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {lateFee.type === "simple_daily" && "Applied per day after grace period"}
                                    {lateFee.type === "percentage" && !lateFee.compounding && "Applied once on first overdue day"}
                                    {lateFee.type === "percentage" && lateFee.compounding && "Compounds daily after grace period"}
                                    {lateFee.type === "fixed" && "Flat charge in rupees, once per overdue period"}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Maximum Cap (Rs.)</Label>
                                <Input
                                    type="number" min={0} step={500}
                                    value={lateFee.maxLateFeeAmount}
                                    onChange={(e) => setLateFee((p) => ({ ...p, maxLateFeeAmount: e.target.value }))}
                                    disabled={!lateFee.enabled}
                                />
                                <p className="text-xs text-muted-foreground">0 = no cap</p>
                            </div>
                        </div>

                        {/* Applies to + Compounding (compounding only shown for percentage type) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Applies To</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { value: "rent", label: "Rent Only" },
                                        { value: "cam", label: "CAM Only" },
                                        { value: "both", label: "Both" },
                                    ].map(({ value, label }) => (
                                        <Button
                                            key={value} size="sm"
                                            variant={lateFee.appliesTo === value ? "default" : "outline"}
                                            onClick={() => setLateFee((p) => ({ ...p, appliesTo: value }))}
                                            disabled={!lateFee.enabled}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Compounding only available for one-time percentage */}
                            {lateFee.type === "percentage" && (
                                <div className="flex items-start gap-3 pt-1">
                                    <Switch
                                        checked={lateFee.compounding}
                                        onCheckedChange={(v) => setLateFee((p) => ({ ...p, compounding: v }))}
                                        disabled={!lateFee.enabled}
                                    />
                                    <div>
                                        <Label className="font-medium">Daily Compounding</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Instead of charging once, compounds the rate daily:
                                            balance × ((1 + rate%)^days − 1).
                                            Warning: grows exponentially.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Live preview */}
                        {lateFee.enabled && Number(lateFee.amount) > 0 && (
                            <LateFeePreview lateFee={lateFee} />
                        )}

                        <div className="pt-2">
                            <Button onClick={saveLateFeePolicy} disabled={savingLateFee}>
                                {savingLateFee ? "Saving…" : "Save Late Fee Policy"}
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LATE FEE PREVIEW
// Shows a comparison table across day 1, 5, 10, 30 so the admin can see
// exactly how the fee grows (or doesn't) under the current settings.
// No API call — calculated entirely in browser to match lateFee.cron.js logic.
// ─────────────────────────────────────────────────────────────────────────────
function LateFeePreview({ lateFee }) {
    const EXAMPLE_RENT = 50000;   // Rs. 50,000
    const grace = Number(lateFee.gracePeriodDays) || 0;
    const rate = Number(lateFee.amount) || 0;
    const cap = Number(lateFee.maxLateFeeAmount) || 0;

    function feeAt(totalDaysLate) {
        const effectiveDays = totalDaysLate - grace;
        if (effectiveDays <= 0 || EXAMPLE_RENT <= 0) return null; // within grace

        let fee = 0;
        if (lateFee.type === "fixed") {
            fee = rate;
        } else if (lateFee.type === "simple_daily") {
            // linear: balance × rate% × days
            fee = EXAMPLE_RENT * (rate / 100) * effectiveDays;
        } else if (lateFee.type === "percentage" && lateFee.compounding) {
            // exponential compound
            fee = EXAMPLE_RENT * (Math.pow(1 + rate / 100, effectiveDays) - 1);
        } else {
            // flat one-time percentage
            fee = EXAMPLE_RENT * (rate / 100);
        }

        if (cap > 0) fee = Math.min(fee, cap);
        return Math.round(fee * 100) / 100; // 2dp
    }

    const PREVIEW_DAYS = [1, grace + 1, 5, 10, 30].filter((d, i, arr) => {
        // Remove duplicates and day≤0
        return d > 0 && arr.indexOf(d) === i;
    });

    // Build a human-readable formula label
    const formulaLabel =
        lateFee.type === "simple_daily"
            ? `Rs. ${EXAMPLE_RENT.toLocaleString("en-NP")} × ${rate}% × days`
            : lateFee.type === "percentage" && lateFee.compounding
                ? `Rs. ${EXAMPLE_RENT.toLocaleString("en-NP")} × ((1 + ${rate}%)^days − 1)`
                : lateFee.type === "percentage"
                    ? `Rs. ${EXAMPLE_RENT.toLocaleString("en-NP")} × ${rate}% (once)`
                    : `Rs. ${rate} flat (once)`;

    return (
        <div className="rounded-lg border bg-muted/30 px-4 py-4 space-y-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    Live Preview · Rent of Rs. {EXAMPLE_RENT.toLocaleString("en-NP")}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{formulaLabel}</p>
                {grace > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Grace period: {grace} Nepali day{grace !== 1 ? "s" : ""} — no fee before day {grace + 1}
                    </p>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground text-xs">
                                Day overdue
                            </th>
                            <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground text-xs">
                                Effective days<br />
                                <span className="font-normal">(after grace)</span>
                            </th>
                            <th className="text-right py-1.5 font-medium text-muted-foreground text-xs">
                                Late fee
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {PREVIEW_DAYS.map((day) => {
                            const effectiveDays = day - grace;
                            const fee = feeAt(day);
                            const inGrace = fee === null;
                            return (
                                <tr key={day} className="border-b border-border/50 last:border-0">
                                    <td className="py-1.5 pr-4 text-muted-foreground">
                                        Day {day}
                                    </td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">
                                        {inGrace
                                            ? <span className="text-xs text-muted-foreground/60 italic">within grace</span>
                                            : effectiveDays
                                        }
                                    </td>
                                    <td className="py-1.5 text-right font-medium tabular-nums">
                                        {inGrace ? (
                                            <span className="text-xs text-muted-foreground/60 italic">—</span>
                                        ) : (
                                            <span className={cap > 0 && fee >= cap ? "text-amber-600" : ""}>
                                                Rs. {fee.toLocaleString("en-NP", { maximumFractionDigits: 2 })}
                                                {cap > 0 && fee >= cap && (
                                                    <span className="ml-1.5 text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                        capped
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {lateFee.type === "simple_daily" && (
                <p className="text-xs text-muted-foreground">
                    Fee grows by Rs. {((EXAMPLE_RENT * rate) / 100).toLocaleString("en-NP", { maximumFractionDigits: 2 })} per Nepali day
                    {cap > 0 ? `, capped at Rs. ${cap.toLocaleString("en-NP")}` : ""}.
                </p>
            )}
            {lateFee.type === "percentage" && !lateFee.compounding && (
                <p className="text-xs text-muted-foreground">
                    Charged once on the first day past the grace period. Amount does not grow.
                </p>
            )}
            {lateFee.type === "percentage" && lateFee.compounding && (
                <p className="text-xs text-amber-600">
                    ⚠ Exponential growth — the fee accelerates each day. Consider using Daily (Linear) instead.
                </p>
            )}
            {lateFee.type === "fixed" && (
                <p className="text-xs text-muted-foreground">
                    Flat charge regardless of overdue balance or number of days.
                </p>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ trigger, title, description, onConfirm, destructive = false }) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={
                            destructive
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : undefined
                        }
                    >
                        Confirm
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}