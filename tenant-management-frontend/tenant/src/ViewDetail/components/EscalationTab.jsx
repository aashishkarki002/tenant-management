"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "../../../plugins/axios.js"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ESCALATION_TYPES = [
    { value: "percentage", label: "Percentage (%)" },
    { value: "fixed_amount", label: "Fixed Amount (Rs)" },
    { value: "fixed_per_sqft", label: "Fixed per Sqft (Rs/sqft)" },
    { value: "absolute", label: "Absolute Rent (Rs)" },
]

const APPLIES_TO_OPTIONS = [
    { value: "rent_only", label: "Rent only" },
    { value: "cam_only", label: "CAM only" },
    { value: "both", label: "Rent & CAM" },
]

const DEFAULT_STEP = {
    intervalMonths: "12",
    type: "percentage",
    value: "",
    label: "",
    appliesTo: "rent_only",
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatAppliesTo(value) {
    if (!value) return "—"
    return APPLIES_TO_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function formatRupee(amount) {
    if (amount == null || amount === "") return "—"
    return new Intl.NumberFormat("ne-NP", {
        style: "currency",
        currency: "NPR",
        maximumFractionDigits: 0,
    }).format(amount)
}

function escalationTypeLabel(type) {
    return ESCALATION_TYPES.find((t) => t.value === type)?.label ?? type
}

/** Human-readable summary of what a step does */
function stepSummary(step) {
    if (!step) return "—"
    switch (step.type) {
        case "percentage":
            return `${step.value >= 0 ? "+" : ""}${step.value}%`
        case "fixed_amount":
            return `+${formatRupee(step.value)} / month`
        case "fixed_per_sqft":
            return `+Rs. ${step.value}/sqft`
        case "absolute":
            return `Set to ${formatRupee(step.value)}`
        default:
            return String(step.value)
    }
}

/** Validate one schedule step — returns error string or null */
function validateStep(step) {
    const interval = parseInt(step.intervalMonths, 10)
    if (!interval || interval < 1) return "Interval must be ≥ 1 month"
    if (!step.label?.trim()) return "Label is required"
    const val = parseFloat(step.value)
    if (isNaN(val)) return "Value is required"
    if (step.type === "percentage" && val < -100) return "Percentage can't be less than −100%"
    if (step.type !== "percentage" && val < 0) return "Value can't be negative"
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Inline select that matches shadcn Input styling */
function Select({ value, onChange, options, disabled, className = "" }) {
    return (
        <select
            className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    )
}

/** One editable step row in the schedule builder */
function ScheduleStepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown, disabled }) {
    const error = validateStep(step)

    return (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                    Step {index + 1}
                    {step.label ? ` · ${step.label}` : ""}
                </span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => onMoveUp(index)}
                        disabled={disabled || index === 0}
                        title="Move up"
                    >↑</Button>
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => onMoveDown(index)}
                        disabled={disabled || index === total - 1}
                        title="Move down"
                    >↓</Button>
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => onRemove(index)}
                        disabled={disabled || total === 1}
                        className="text-destructive hover:text-destructive"
                        title="Remove step"
                    >✕</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                    <Label className="text-xs">Label *</Label>
                    <Input
                        placeholder="e.g. Year 1"
                        value={step.label}
                        onChange={(e) => onChange(index, { label: e.target.value })}
                        disabled={disabled}
                    />
                </div>
                <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                        value={step.type}
                        onChange={(val) => onChange(index, { type: val })}
                        options={ESCALATION_TYPES}
                        disabled={disabled}
                    />
                </div>
                <div>
                    <Label className="text-xs">Value *</Label>
                    <Input
                        type="number"
                        placeholder={
                            step.type === "percentage" ? "e.g. 5"
                                : step.type === "absolute" ? "e.g. 50000"
                                    : "e.g. 2000"
                        }
                        value={step.value}
                        onChange={(e) => onChange(index, { value: e.target.value })}
                        disabled={disabled}
                    />
                </div>
                <div>
                    <Label className="text-xs">Interval (months) *</Label>
                    <Input
                        type="number"
                        placeholder="12"
                        value={step.intervalMonths}
                        onChange={(e) => onChange(index, { intervalMonths: e.target.value })}
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Applies To</Label>
                    <Select
                        value={step.appliesTo}
                        onChange={(val) => onChange(index, { appliesTo: val })}
                        options={APPLIES_TO_OPTIONS}
                        disabled={disabled}
                    />
                </div>
                <div className="flex items-end gap-2">
                    {step.type && step.value !== "" && !isNaN(parseFloat(step.value)) && (
                        <p className="text-xs text-muted-foreground pb-1">
                            Preview: <span className="font-medium text-foreground">{stepSummary(step)}</span>
                            {" "}every {step.intervalMonths || "?"} months on{" "}
                            <span className="font-medium">{formatAppliesTo(step.appliesTo)}</span>
                        </p>
                    )}
                </div>
            </div>

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function EscalationTab({ tenantId }) {
    const [escalation, setEscalation] = useState(null)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [historyLoading, setHistoryLoading] = useState(false)

    // Preview dialog
    const [previewOpen, setPreviewOpen] = useState(false)
    const [preview, setPreview] = useState(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewPct, setPreviewPct] = useState("")

    // Action state
    const [actionLoading, setActionLoading] = useState(null) // "apply"|"disable"|"enable"|"save"

    // ── Schedule builder state ───────────────────────────────────────────────
    const [scheduleSteps, setScheduleSteps] = useState([{ ...DEFAULT_STEP }])
    const [globalAppliesTo, setGlobalAppliesTo] = useState("rent_only")
    const [startNepaliDate, setStartNepaliDate] = useState("")
    const [formDirty, setFormDirty] = useState(false)

    const enabled = escalation?.enabled ?? false

    // ── Fetch helpers ────────────────────────────────────────────────────────

    const getEscalation = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        try {
            const { data } = await api.get(`/api/escalation/data/${tenantId}`)
            const d = data?.data ?? null
            setEscalation(d)

            // Populate form from existing schedule if present
            const rawSchedule = d?.schedule?.steps   // ← populated by getEscalationData if you expose it
            // Fallback: read from raw escalation fields the service returns
            // The getEscalationData service doesn't currently return the raw schedule array,
            // so we hydrate from configuration for backward-compat and leave schedule editable.
            const cfg = d?.configuration ?? {}
            setGlobalAppliesTo(cfg.appliesTo || "rent_only")

            if (rawSchedule && rawSchedule.length > 0) {
                setScheduleSteps(
                    rawSchedule.map((s) => ({
                        intervalMonths: String(s.intervalMonths ?? 12),
                        type: s.type ?? "percentage",
                        value: String(s.value ?? s.percentageIncrease ?? ""),
                        label: s.label ?? "",
                        appliesTo: s.appliesTo ?? cfg.appliesTo ?? "rent_only",
                    }))
                )
            } else if (cfg.percentageIncrease) {
                // Legacy single-step
                setScheduleSteps([{
                    intervalMonths: String(cfg.intervalMonths ?? 12),
                    type: "percentage",
                    value: String(cfg.percentageIncrease),
                    label: "Default",
                    appliesTo: cfg.appliesTo ?? "rent_only",
                }])
            }
            setFormDirty(false)
        } catch {
            setEscalation(null)
        } finally {
            setLoading(false)
        }
    }, [tenantId])

    const getHistory = useCallback(async () => {
        if (!tenantId) return
        setHistoryLoading(true)
        try {
            const { data } = await api.get(`/api/escalation/history/${tenantId}`)
            setHistory(Array.isArray(data?.history) ? data.history : [])
        } catch {
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }, [tenantId])

    useEffect(() => { getEscalation() }, [getEscalation])
    useEffect(() => { if (tenantId && escalation !== null) getHistory() }, [tenantId, escalation, getHistory])

    // ── Preview ──────────────────────────────────────────────────────────────

    const fetchPreview = useCallback(async () => {
        if (!tenantId || !escalation?.enabled) return
        setPreview(null)
        setPreviewLoading(true)
        try {
            const pct = previewPct ? parseFloat(previewPct) : escalation?.configuration?.percentageIncrease
            const url = pct != null && !Number.isNaN(pct)
                ? `/api/escalation/preview/${tenantId}?percentage=${pct}`
                : `/api/escalation/preview/${tenantId}`
            const { data } = await api.get(url)
            setPreview(data?.preview ?? null)
        } catch {
            setPreview(null)
        } finally {
            setPreviewLoading(false)
        }
    }, [tenantId, escalation?.enabled, escalation?.configuration?.percentageIncrease, previewPct])

    useEffect(() => {
        if (previewOpen && escalation?.enabled) fetchPreview()
    }, [previewOpen, escalation?.enabled, previewPct, fetchPreview])

    // ── Schedule builder helpers ─────────────────────────────────────────────

    const updateStep = (index, patch) => {
        setScheduleSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
        setFormDirty(true)
    }

    const addStep = () => {
        setScheduleSteps((prev) => [...prev, { ...DEFAULT_STEP }])
        setFormDirty(true)
    }

    const removeStep = (index) => {
        setScheduleSteps((prev) => prev.filter((_, i) => i !== index))
        setFormDirty(true)
    }

    const moveStep = (index, direction) => {
        setScheduleSteps((prev) => {
            const next = [...prev]
            const swapWith = index + direction
            if (swapWith < 0 || swapWith >= next.length) return prev
                ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
            return next
        })
        setFormDirty(true)
    }

    /** Build the payload the enable endpoint expects */
    const buildEnablePayload = () => ({
        schedule: scheduleSteps.map((s) => ({
            intervalMonths: parseInt(s.intervalMonths, 10) || 12,
            type: s.type,
            value: parseFloat(s.value),
            label: s.label.trim(),
            appliesTo: s.appliesTo,
        })),
        appliesTo: globalAppliesTo,
        ...(startNepaliDate ? { startNepaliDate } : {}),
    })

    const scheduleValid = scheduleSteps.every((s) => !validateStep(s))

    // ── Actions ──────────────────────────────────────────────────────────────

    const handleApply = async () => {
        setActionLoading("apply")
        try {
            await api.post(`/api/escalation/apply/${tenantId}`, { note: "Applied from tenant detail" })
            await getEscalation()
            await getHistory()
            setPreviewOpen(false)
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    const rawDisable = async () => {
        setActionLoading("disable")
        try {
            await api.patch(`/api/escalation/disable/${tenantId}`)
            await getEscalation()
            await getHistory()
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    const handleDisable = async () => {
        if (!window.confirm("Disable rent escalation for this tenant?")) return
        await rawDisable()
    }

    const handleEnableOrSave = async () => {
        if (!scheduleValid) return
        setActionLoading(enabled ? "save" : "enable")
        try {
            await api.post(`/api/escalation/enable/${tenantId}`, buildEnablePayload())
            await getEscalation()
            setFormDirty(false)
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    // Toggle: if turning on, enable with current form; if turning off, raw disable
    const handleEnableToggle = async (checked) => {
        if (checked) {
            if (!scheduleValid) return
            await handleEnableOrSave()
        } else {
            await rawDisable()
        }
    }

    // ── Render guards ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading escalation data…
            </div>
        )
    }

    const schedule = escalation?.schedule ?? {}
    const configuration = escalation?.configuration ?? {}
    const currentValues = escalation?.currentValues ?? {}

    // Current active step info from API (if returned)
    const currentStepIndex = escalation?.currentStepIndex ?? 0

    return (
        <div className="space-y-6">

            {/* ─── 1. STATUS CARD ─────────────────────────────────────────── */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Escalation Status
                        <Badge variant={enabled ? "default" : "secondary"}>
                            {enabled ? "Active" : "Disabled"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Next Escalation</p>
                        <p className="font-medium">{schedule.nextEscalationNepaliDate ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Last Escalated</p>
                        <p className="font-medium">{schedule.lastEscalatedNepaliDate ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Next Quarter</p>
                        <p className="font-medium">
                            {schedule.nextEscalationQuarter ? `Q${schedule.nextEscalationQuarter}` : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Applies To</p>
                        <p className="font-medium">{formatAppliesTo(configuration.appliesTo)}</p>
                    </div>
                </CardContent>
            </Card>

            {/* ─── 2. CURRENT RENT ────────────────────────────────────────── */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle>Current Rent Values</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Total Rent</p>
                        <p className="font-medium">{formatRupee(currentValues.totalRent)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">CAM Charges</p>
                        <p className="font-medium">{formatRupee(currentValues.camCharges)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Net Amount</p>
                        <p className="font-medium">{formatRupee(currentValues.netAmount)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Price / Sqft</p>
                        <p className="font-medium">{formatRupee(currentValues.pricePerSqft)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">CAM Rate / Sqft</p>
                        <p className="font-medium">{formatRupee(currentValues.camRatePerSqft)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Gross Amount</p>
                        <p className="font-medium">{formatRupee(currentValues.grossAmount)}</p>
                    </div>
                </CardContent>
            </Card>

            {/* ─── 3. CONFIGURATION + SCHEDULE BUILDER ────────────────────── */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Escalation Configuration
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleEnableToggle}
                            disabled={!!actionLoading || (!enabled && !scheduleValid)}
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                    {/* Global settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Global Applies To <span className="text-muted-foreground text-xs">(default for steps)</span></Label>
                            <Select
                                value={globalAppliesTo}
                                onChange={(val) => { setGlobalAppliesTo(val); setFormDirty(true) }}
                                options={APPLIES_TO_OPTIONS}
                                disabled={!!actionLoading}
                            />
                        </div>
                        <div>
                            <Label>Custom Start Date (Nepali) <span className="text-muted-foreground text-xs">YYYY-MM-DD · optional</span></Label>
                            <Input
                                placeholder="e.g. 2081-01-01 (default: lease start)"
                                value={startNepaliDate}
                                onChange={(e) => { setStartNepaliDate(e.target.value); setFormDirty(true) }}
                                disabled={!!actionLoading}
                            />
                        </div>
                    </div>

                    {/* Schedule steps */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">
                                Escalation Schedule
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    ({scheduleSteps.length} step{scheduleSteps.length !== 1 ? "s" : ""} · last step repeats)
                                </span>
                            </Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addStep}
                                disabled={!!actionLoading}
                            >
                                + Add Step
                            </Button>
                        </div>

                        {scheduleSteps.map((step, i) => (
                            <ScheduleStepRow
                                key={i}
                                step={step}
                                index={i}
                                total={scheduleSteps.length}
                                onChange={updateStep}
                                onRemove={removeStep}
                                onMoveUp={(idx) => moveStep(idx, -1)}
                                onMoveDown={(idx) => moveStep(idx, 1)}
                                disabled={!!actionLoading}
                            />
                        ))}
                    </div>

                    {/* Type reference */}
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground">Escalation Type Reference</p>
                        <p><span className="font-medium">Percentage</span> — e.g. 5 = +5%, 0 = freeze, −10 = −10% discount</p>
                        <p><span className="font-medium">Fixed Amount</span> — Rs added to monthly rent, e.g. 5000 = +Rs. 5,000/mo</p>
                        <p><span className="font-medium">Fixed per Sqft</span> — Rs/sqft added to rate, e.g. 2 = +Rs. 2/sqft</p>
                        <p><span className="font-medium">Absolute</span> — exact new total rent in Rs, e.g. 80000</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            onClick={handleEnableOrSave}
                            disabled={!!actionLoading || !scheduleValid || (!enabled && !formDirty && !scheduleValid)}
                            variant={enabled && formDirty ? "secondary" : "default"}
                        >
                            {actionLoading === "enable" || actionLoading === "save"
                                ? (enabled ? "Saving…" : "Enabling…")
                                : (enabled ? (formDirty ? "Save Changes" : "Reconfigure") : "Enable Escalation")}
                        </Button>

                        {enabled && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => { setPreviewPct(""); setPreviewOpen(true) }}
                                    disabled={!!actionLoading}
                                >
                                    Preview Next Step
                                </Button>
                                <Button
                                    onClick={handleApply}
                                    disabled={!!actionLoading}
                                    variant="default"
                                >
                                    {actionLoading === "apply" ? "Applying…" : "Apply Now"}
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDisable}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === "disable" ? "Disabling…" : "Disable"}
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ─── 4. HISTORY TABLE ───────────────────────────────────────── */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle>Escalation History</CardTitle>
                </CardHeader>
                <CardContent>
                    {historyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading history…</p>
                    ) : (
                        <div className="overflow-x-auto text-sm">
                            <table className="w-full">
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th className="text-left py-2 pr-4">Date (BS)</th>
                                        <th className="text-left py-2 pr-4">Type</th>
                                        <th className="text-left py-2 pr-4">Value</th>
                                        <th className="text-left py-2 pr-4">Old Rent</th>
                                        <th className="text-left py-2 pr-4">New Rent</th>
                                        <th className="text-left py-2 pr-4">Old CAM</th>
                                        <th className="text-left py-2 pr-4">New CAM</th>
                                        <th className="text-left py-2">Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-4 text-center text-muted-foreground">
                                                No escalation history yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((entry, i) => (
                                            <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="py-2 pr-4 font-mono text-xs">
                                                    {entry.escalatedNepaliDate ?? entry.escalatedAt}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <Badge variant="outline" className="text-xs">
                                                        {escalationTypeLabel(entry.escalationType ?? "percentage")}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    {entry.escalationType === "percentage" || !entry.escalationType
                                                        ? `${entry.percentageApplied ?? entry.escalationValue ?? "—"}%`
                                                        : entry.escalationValue != null
                                                            ? formatRupee(entry.escalationValue)
                                                            : "—"}
                                                </td>
                                                <td className="py-2 pr-4">{formatRupee(entry.before?.totalRent)}</td>
                                                <td className="py-2 pr-4 font-medium">{formatRupee(entry.after?.totalRent)}</td>
                                                <td className="py-2 pr-4">{formatRupee(entry.before?.camCharges)}</td>
                                                <td className="py-2 pr-4">{formatRupee(entry.after?.camCharges)}</td>
                                                <td className="py-2 text-muted-foreground">{entry.note || "—"}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── 5. PREVIEW DIALOG ──────────────────────────────────────── */}
            <Dialog
                open={previewOpen}
                onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreview(null) }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Preview Next Rent Escalation</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 text-sm">
                        {/* Override percentage — only relevant for percentage-type steps */}
                        <div>
                            <Label>Override Percentage <span className="text-muted-foreground">(optional, for dry-run)</span></Label>
                            <Input
                                type="number"
                                placeholder={`Default: ${configuration.percentageIncrease ?? "from schedule"}%`}
                                value={previewPct}
                                onChange={(e) => setPreviewPct(e.target.value)}
                                className="mt-1"
                            />
                        </div>

                        {previewLoading ? (
                            <p className="text-muted-foreground">Calculating preview…</p>
                        ) : preview ? (
                            <div className="space-y-3">
                                {/* Step info banner */}
                                {preview.stepInfo && (
                                    <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                                        <p className="font-semibold text-foreground">
                                            Step {preview.stepInfo.index + 1} of {preview.stepInfo.totalSteps}
                                            {" "}· {preview.stepInfo.label}
                                            {preview.stepInfo.isLastStep && (
                                                <span className="ml-2 text-muted-foreground">(repeats)</span>
                                            )}
                                        </p>
                                        <p>
                                            Type: <span className="font-medium">{escalationTypeLabel(preview.stepInfo.type)}</span>
                                            {" "}· Value: <span className="font-medium">
                                                {preview.stepInfo.type === "percentage"
                                                    ? `${preview.stepInfo.value}%`
                                                    : formatRupee(preview.stepInfo.value)}
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {/* Before / After */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border p-3 space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current</p>
                                        <p>Rent: <span className="font-medium">{formatRupee(currentValues.totalRent)}</span></p>
                                        <p>CAM: <span className="font-medium">{formatRupee(currentValues.camCharges)}</span></p>
                                        <p>Net: <span className="font-medium">{formatRupee(currentValues.netAmount)}</span></p>
                                        <p className="text-xs text-muted-foreground">
                                            Rs. {currentValues.pricePerSqft}/sqft
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">After Escalation</p>
                                        <p>Rent: <span className="font-semibold text-primary">{formatRupee(preview.totalRent)}</span></p>
                                        <p>CAM: <span className="font-medium">{formatRupee(preview.camCharges)}</span></p>
                                        <p>Net: <span className="font-medium">{formatRupee(preview.netAmount)}</span></p>
                                        <p className="text-xs text-muted-foreground">
                                            Rs. {preview.pricePerSqft}/sqft
                                        </p>
                                    </div>
                                </div>

                                {/* Next date context */}
                                {preview.context?.nextEscalation && (
                                    <p className="text-xs text-muted-foreground">
                                        Effective date: <span className="font-medium">{preview.context.nextEscalation.nepali}</span>
                                        {" "}(Q{preview.context.nextEscalation.quarter})
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">
                                Unable to load preview. Ensure escalation is enabled.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleApply}
                            disabled={!preview || !!actionLoading}
                        >
                            {actionLoading === "apply" ? "Applying…" : "Confirm Apply"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}