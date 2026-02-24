import React, { useEffect, useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
// INITIAL STATE (matches seed defaults — shown to admin before any save)
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
    type: "percentage",
    amount: 2,
    appliesTo: "rent",
    compounding: false,
    maxLateFeeAmount: 5000,
};

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

    // ── Fetch all settings in one call ──────────────────────────────────────
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

    // ── Save escalation defaults ─────────────────────────────────────────────
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

    // ── Apply escalation to all tenants ─────────────────────────────────────
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

    // ── Disable escalation for all tenants ──────────────────────────────────
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

    // ── Save late fee policy ─────────────────────────────────────────────────
    async function saveLateFeePolicy() {
        try {
            setSavingLateFee(true);
            const res = await api.post("/api/settings/system/late-fee", {
                enabled: lateFee.enabled,
                gracePeriodDays: Number(lateFee.gracePeriodDays),
                type: lateFee.type,
                amount: Number(lateFee.amount),
                appliesTo: lateFee.appliesTo,
                compounding: lateFee.compounding,
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

            {/* ════════════════════════════════════════════════════════════
                ELECTRICITY RATE
            ════════════════════════════════════════════════════════════ */}
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

            {/* ════════════════════════════════════════════════════════════
                RENT ESCALATION
            ════════════════════════════════════════════════════════════ */}
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
                                    onCheckedChange={(v) =>
                                        setEscalation((p) => ({ ...p, enabled: v }))
                                    }
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Percentage Increase (%)</Label>
                                <Input
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={escalation.percentageIncrease}
                                    onChange={(e) =>
                                        setEscalation((p) => ({ ...p, percentageIncrease: e.target.value }))
                                    }
                                    disabled={!escalation.enabled}
                                />
                                <p className="text-xs text-muted-foreground">Typical range: 3–10%</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Interval (Months)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={escalation.intervalMonths}
                                    onChange={(e) =>
                                        setEscalation((p) => ({ ...p, intervalMonths: e.target.value }))
                                    }
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
                                        key={value}
                                        size="sm"
                                        variant={escalation.appliesTo === value ? "default" : "outline"}
                                        onClick={() =>
                                            setEscalation((p) => ({ ...p, appliesTo: value }))
                                        }
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
                                            on <strong>{escalation.appliesTo.replace("_", " ")}</strong> for
                                            every active tenant.
                                        </>
                                    }
                                    onConfirm={applyEscalationToAll}
                                />
                            )}

                            {tenantsConfigured > 0 && (
                                <ConfirmDialog
                                    trigger={
                                        <Button variant="destructive" size="sm">
                                            Disable for All Tenants
                                        </Button>
                                    }
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

            {/* ════════════════════════════════════════════════════════════
                LATE FEE POLICY
            ════════════════════════════════════════════════════════════ */}
            <section>
                <div className="mb-4">
                    <h3 className="text-base font-semibold">Late Fee Policy</h3>
                    <p className="text-sm text-muted-foreground">
                        Charged when rent is unpaid past the grace period.
                    </p>
                </div>

                <Card className="rounded-xl shadow-sm">
                    <CardContent className="pt-6 space-y-6">

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="font-medium">Enable Late Fee</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Automatically applied when generating overdue charges
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={lateFee.enabled ? "default" : "secondary"}>
                                    {lateFee.enabled ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                    checked={lateFee.enabled}
                                    onCheckedChange={(v) =>
                                        setLateFee((p) => ({ ...p, enabled: v }))
                                    }
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Grace period */}
                            <div className="space-y-1.5">
                                <Label>Grace Period (Days)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={lateFee.gracePeriodDays}
                                    onChange={(e) =>
                                        setLateFee((p) => ({ ...p, gracePeriodDays: e.target.value }))
                                    }
                                    disabled={!lateFee.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Days after due date before fee applies
                                </p>
                            </div>

                            {/* Fee type */}
                            <div className="space-y-1.5">
                                <Label>Fee Type</Label>
                                <div className="flex gap-2 mt-1">
                                    {[
                                        { value: "percentage", label: "Percentage %" },
                                        { value: "fixed", label: "Fixed Amount (Rs.)" },
                                    ].map(({ value, label }) => (
                                        <Button
                                            key={value}
                                            size="sm"
                                            variant={lateFee.type === value ? "default" : "outline"}
                                            onClick={() => setLateFee((p) => ({ ...p, type: value }))}
                                            disabled={!lateFee.enabled}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <Label>
                                    {lateFee.type === "percentage"
                                        ? "Percentage of Overdue Amount (%)"
                                        : "Fixed Fee Amount (Rs.)"}
                                </Label>
                                <Input
                                    type="number"
                                    min={0.1}
                                    step={lateFee.type === "percentage" ? 0.1 : 50}
                                    value={lateFee.amount}
                                    onChange={(e) =>
                                        setLateFee((p) => ({ ...p, amount: e.target.value }))
                                    }
                                    disabled={!lateFee.enabled}
                                />
                                {lateFee.type === "percentage" && (
                                    <p className="text-xs text-muted-foreground">
                                        e.g. 2% of Rs. 50,000 rent = Rs. 1,000 late fee
                                    </p>
                                )}
                            </div>

                            {/* Max cap */}
                            <div className="space-y-1.5">
                                <Label>Maximum Late Fee Cap (Rs.)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={lateFee.maxLateFeeAmount}
                                    onChange={(e) =>
                                        setLateFee((p) => ({ ...p, maxLateFeeAmount: e.target.value }))
                                    }
                                    disabled={!lateFee.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    0 = no cap
                                </p>
                            </div>
                        </div>

                        {/* Applies To + Compounding */}
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
                                            key={value}
                                            size="sm"
                                            variant={lateFee.appliesTo === value ? "default" : "outline"}
                                            onClick={() =>
                                                setLateFee((p) => ({ ...p, appliesTo: value }))
                                            }
                                            disabled={!lateFee.enabled}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {lateFee.type === "percentage" && (
                                <div className="flex items-start gap-3 pt-1">
                                    <Switch
                                        checked={lateFee.compounding}
                                        onCheckedChange={(v) =>
                                            setLateFee((p) => ({ ...p, compounding: v }))
                                        }
                                        disabled={!lateFee.enabled}
                                    />
                                    <div>
                                        <Label className="font-medium">Daily Compounding</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Fee compounds each day past grace period
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Live preview */}
                        {lateFee.enabled && lateFee.amount > 0 && (
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
// LATE FEE PREVIEW (no API call — calculated in browser)
// ─────────────────────────────────────────────────────────────────────────────
function LateFeePreview({ lateFee }) {
    // Example: Rs. 50,000 rent, 10 days late
    const exampleRent = 50000;
    const exampleDaysLate = 10;
    const effectiveDays = exampleDaysLate - Number(lateFee.gracePeriodDays);

    let fee = 0;
    if (effectiveDays > 0) {
        if (lateFee.type === "fixed") {
            fee = Number(lateFee.amount);
        } else if (lateFee.compounding) {
            const rate = Number(lateFee.amount) / 100;
            fee = exampleRent * (Math.pow(1 + rate, effectiveDays) - 1);
        } else {
            fee = exampleRent * (Number(lateFee.amount) / 100);
        }
        if (Number(lateFee.maxLateFeeAmount) > 0) {
            fee = Math.min(fee, Number(lateFee.maxLateFeeAmount));
        }
    }

    return (
        <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm">
            <p className="font-medium text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Example Preview
            </p>
            <p className="text-muted-foreground">
                Rent of <strong>Rs. {exampleRent.toLocaleString("en-NP")}</strong>, paid{" "}
                <strong>{exampleDaysLate} days late</strong>{" "}
                (grace: {lateFee.gracePeriodDays} days) →{" "}
                <strong className="text-foreground">
                    Late fee: Rs.{" "}
                    {fee > 0
                        ? fee.toLocaleString("en-NP", { maximumFractionDigits: 2 })
                        : "0 (within grace period)"}
                </strong>
            </p>
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