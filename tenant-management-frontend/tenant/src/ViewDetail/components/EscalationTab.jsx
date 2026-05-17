import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import api from "../../../plugins/axios.js"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// ─── Constants ────────────────────────────────────────────────────────────────

const ESCALATION_TYPES = [
  { value: "percentage",     label: "Percentage (%)" },
  { value: "fixed_amount",   label: "Fixed Amount (Rs)" },
  { value: "fixed_per_sqft", label: "Fixed per Sqft (Rs/sqft)" },
  { value: "absolute",       label: "Absolute Rent (Rs)" },
]

const APPLIES_TO_OPTIONS = [
  { value: "rent_only", label: "Rent only" },
  { value: "cam_only",  label: "CAM only" },
  { value: "both",      label: "Rent & CAM" },
]

const DEFAULT_STEP = {
  intervalMonths: "12",
  type: "percentage",
  value: "",
  label: "",
  appliesTo: "rent_only",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAppliesTo(value) {
  return APPLIES_TO_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "—"
}

function formatRupee(amount) {
  if (amount == null || amount === "") return "—"
  return new Intl.NumberFormat("ne-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(amount)
}

function escalationTypeLabel(type) {
  return ESCALATION_TYPES.find((t) => t.value === type)?.label ?? type
}

function stepSummary(step) {
  if (!step) return "—"
  switch (step.type) {
    case "percentage":     return `${step.value >= 0 ? "+" : ""}${step.value}%`
    case "fixed_amount":   return `+${formatRupee(step.value)} / month`
    case "fixed_per_sqft": return `+Rs. ${step.value}/sqft`
    case "absolute":       return `Set to ${formatRupee(step.value)}`
    default:               return String(step.value)
  }
}

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

// ─── Inline Select ────────────────────────────────────────────────────────────

function Select({ value, onChange, options, disabled, className = "" }) {
  return (
    <select
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Schedule Step Row ────────────────────────────────────────────────────────

function ScheduleStepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown, disabled }) {
  const error = validateStep(step)
  const hasPreview = step.type && step.value !== "" && !isNaN(parseFloat(step.value))

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Step {index + 1}{step.label ? ` · ${step.label}` : ""}
        </span>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => onMoveUp(index)} disabled={disabled || index === 0}>↑</Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => onMoveDown(index)} disabled={disabled || index === total - 1}>↓</Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onRemove(index)} disabled={disabled || total === 1}>✕</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Label *</Label>
          <Input placeholder="e.g. Year 1" value={step.label}
            onChange={(e) => onChange(index, { label: e.target.value })} disabled={disabled} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Type</Label>
          <Select value={step.type} onChange={(val) => onChange(index, { type: val })}
            options={ESCALATION_TYPES} disabled={disabled} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Value *</Label>
          <Input type="number"
            placeholder={step.type === "percentage" ? "e.g. 5" : step.type === "absolute" ? "e.g. 50000" : "e.g. 2000"}
            value={step.value} onChange={(e) => onChange(index, { value: e.target.value })}
            disabled={disabled} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Interval (mo) *</Label>
          <Input type="number" placeholder="12" value={step.intervalMonths}
            onChange={(e) => onChange(index, { intervalMonths: e.target.value })}
            disabled={disabled} className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-48 space-y-1">
          <Label className="text-[11px]">Applies To</Label>
          <Select value={step.appliesTo} onChange={(val) => onChange(index, { appliesTo: val })}
            options={APPLIES_TO_OPTIONS} disabled={disabled} className="h-8 text-xs" />
        </div>
        {hasPreview && (
          <p className="text-[11px] text-muted-foreground mt-4">
            <span className="font-medium text-foreground">{stepSummary(step)}</span>
            {" "}every {step.intervalMonths || "?"} mo on{" "}
            <span className="font-medium">{formatAppliesTo(step.appliesTo)}</span>
          </p>
        )}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EscalationTab({ tenantId }) {
  const [escalation, setEscalation] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPct, setPreviewPct] = useState("")

  const [actionLoading, setActionLoading] = useState(null)

  const [scheduleSteps, setScheduleSteps] = useState([{ ...DEFAULT_STEP }])
  const [globalAppliesTo, setGlobalAppliesTo] = useState("rent_only")
  const [startNepaliDate, setStartNepaliDate] = useState("")
  const [formDirty, setFormDirty] = useState(false)

  const enabled = escalation?.enabled ?? false

  const getEscalation = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/escalation/data/${tenantId}`)
      const d = data?.data ?? null
      setEscalation(d)
      const rawSchedule = d?.schedule?.steps
      const cfg = d?.configuration ?? {}
      setGlobalAppliesTo(cfg.appliesTo || "rent_only")
      if (rawSchedule?.length > 0) {
        setScheduleSteps(rawSchedule.map((s) => ({
          intervalMonths: String(s.intervalMonths ?? 12),
          type: s.type ?? "percentage",
          value: String(s.value ?? s.percentageIncrease ?? ""),
          label: s.label ?? "",
          appliesTo: s.appliesTo ?? cfg.appliesTo ?? "rent_only",
        })))
      } else if (cfg.percentageIncrease) {
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

  const updateStep  = (index, patch) => { setScheduleSteps((p) => p.map((s, i) => i === index ? { ...s, ...patch } : s)); setFormDirty(true) }
  const addStep     = () => { setScheduleSteps((p) => [...p, { ...DEFAULT_STEP }]); setFormDirty(true) }
  const removeStep  = (index) => { setScheduleSteps((p) => p.filter((_, i) => i !== index)); setFormDirty(true) }
  const moveStep    = (index, dir) => {
    setScheduleSteps((p) => {
      const next = [...p]; const swap = index + dir
      if (swap < 0 || swap >= next.length) return p
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
    setFormDirty(true)
  }

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

  const handleApply = async () => {
    setActionLoading("apply")
    try {
      await api.post(`/api/escalation/apply/${tenantId}`, { note: "Applied from tenant detail" })
      await getEscalation(); await getHistory()
      setPreviewOpen(false)
    } catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const rawDisable = async () => {
    setActionLoading("disable")
    try { await api.patch(`/api/escalation/disable/${tenantId}`); await getEscalation(); await getHistory() }
    catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const handleDisable = async () => {
    if (!window.confirm("Disable rent escalation for this tenant?")) return
    await rawDisable()
  }

  const handleEnableOrSave = async () => {
    if (!scheduleValid) return
    setActionLoading(enabled ? "save" : "enable")
    try { await api.post(`/api/escalation/enable/${tenantId}`, buildEnablePayload()); await getEscalation(); setFormDirty(false) }
    catch (err) { console.error(err) }
    finally { setActionLoading(null) }
  }

  const handleEnableToggle = async (checked) => {
    if (checked) { if (scheduleValid) await handleEnableOrSave() }
    else await rawDisable()
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        </CardContent></Card>
      </div>
    )
  }

  const schedule      = escalation?.schedule ?? {}
  const configuration = escalation?.configuration ?? {}
  const currentValues = escalation?.currentValues ?? {}

  return (
    <div className="space-y-4">

      {/* ── 1. Overview ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Escalation Overview</p>
            <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
              {enabled ? "Active" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Schedule dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Next Escalation",  value: schedule.nextEscalationNepaliDate ?? "—" },
              { label: "Last Escalated",   value: schedule.lastEscalatedNepaliDate ?? "—" },
              { label: "Next Quarter",     value: schedule.nextEscalationQuarter ? `Q${schedule.nextEscalationQuarter}` : "—" },
              { label: "Applies To",       value: formatAppliesTo(configuration.appliesTo) },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-xs font-medium">{value}</p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Current rent values */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Current Rent Values</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Total Rent",       value: formatRupee(currentValues.totalRent) },
                { label: "CAM Charges",      value: formatRupee(currentValues.camCharges) },
                { label: "Net Amount",       value: formatRupee(currentValues.netAmount) },
                { label: "Price / Sqft",     value: formatRupee(currentValues.pricePerSqft) },
                { label: "CAM Rate / Sqft",  value: formatRupee(currentValues.camRatePerSqft) },
                { label: "Gross Amount",     value: formatRupee(currentValues.grossAmount) },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Configuration + Schedule Builder ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Escalation Configuration</p>
            <Switch
              checked={enabled}
              onCheckedChange={handleEnableToggle}
              disabled={!!actionLoading || (!enabled && !scheduleValid)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">

          {/* Global settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Global Applies To
                <span className="ml-1 text-muted-foreground font-normal">(default for steps)</span>
              </Label>
              <Select value={globalAppliesTo} onChange={(val) => { setGlobalAppliesTo(val); setFormDirty(true) }}
                options={APPLIES_TO_OPTIONS} disabled={!!actionLoading} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Start Date (Nepali)
                <span className="ml-1 text-muted-foreground font-normal">YYYY-MM-DD · optional</span>
              </Label>
              <Input placeholder="e.g. 2081-01-01 (default: lease start)"
                value={startNepaliDate}
                onChange={(e) => { setStartNepaliDate(e.target.value); setFormDirty(true) }}
                disabled={!!actionLoading} className="h-9 text-sm" />
            </div>
          </div>

          <Separator />

          {/* Schedule steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">
                Escalation Schedule
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {scheduleSteps.length} step{scheduleSteps.length !== 1 ? "s" : ""} · last step repeats
                </span>
              </p>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={addStep} disabled={!!actionLoading}>
                + Add Step
              </Button>
            </div>

            {scheduleSteps.map((step, i) => (
              <ScheduleStepRow
                key={i} step={step} index={i} total={scheduleSteps.length}
                onChange={updateStep} onRemove={removeStep}
                onMoveUp={(idx) => moveStep(idx, -1)} onMoveDown={(idx) => moveStep(idx, 1)}
                disabled={!!actionLoading}
              />
            ))}
          </div>

          {/* Type reference */}
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-xs mb-1">Type Reference</p>
            <p><span className="font-medium text-foreground">Percentage</span> — 5 = +5%, 0 = freeze, −10 = −10%</p>
            <p><span className="font-medium text-foreground">Fixed Amount</span> — Rs added per month, e.g. 5000</p>
            <p><span className="font-medium text-foreground">Fixed per Sqft</span> — Rs/sqft added to rate, e.g. 2</p>
            <p><span className="font-medium text-foreground">Absolute</span> — exact new total rent in Rs, e.g. 80000</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm"
              onClick={handleEnableOrSave}
              disabled={!!actionLoading || !scheduleValid}
              variant={enabled && formDirty ? "secondary" : "default"}
            >
              {actionLoading === "enable" || actionLoading === "save"
                ? (enabled ? "Saving…" : "Enabling…")
                : (enabled ? (formDirty ? "Save Changes" : "Reconfigure") : "Enable Escalation")}
            </Button>

            {enabled && (
              <>
                <Button size="sm" variant="outline"
                  onClick={() => { setPreviewPct(""); setPreviewOpen(true) }}
                  disabled={!!actionLoading}>
                  Preview Next Step
                </Button>
                <Button size="sm"
                  onClick={handleApply}
                  disabled={!!actionLoading}>
                  {actionLoading === "apply" ? "Applying…" : "Apply Now"}
                </Button>
                <Button size="sm" variant="destructive"
                  onClick={handleDisable}
                  disabled={!!actionLoading}>
                  {actionLoading === "disable" ? "Disabling…" : "Disable"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. History ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <p className="text-sm font-medium">Escalation History</p>
        </CardHeader>
        <CardContent className="pt-0">
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date (BS)</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs">Old Rent</TableHead>
                  <TableHead className="text-xs">New Rent</TableHead>
                  <TableHead className="text-xs">Old CAM</TableHead>
                  <TableHead className="text-xs">New CAM</TableHead>
                  <TableHead className="text-xs">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                      No escalation history yet.
                    </TableCell>
                  </TableRow>
                ) : history.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">
                      {entry.escalatedNepaliDate ?? entry.escalatedAt}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {escalationTypeLabel(entry.escalationType ?? "percentage")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.escalationType === "percentage" || !entry.escalationType
                        ? `${entry.percentageApplied ?? entry.escalationValue ?? "—"}%`
                        : entry.escalationValue != null ? formatRupee(entry.escalationValue) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{formatRupee(entry.before?.totalRent)}</TableCell>
                    <TableCell className="text-xs font-medium">{formatRupee(entry.after?.totalRent)}</TableCell>
                    <TableCell className="text-xs">{formatRupee(entry.before?.camCharges)}</TableCell>
                    <TableCell className="text-xs">{formatRupee(entry.after?.camCharges)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.note || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Preview Dialog ────────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreview(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Preview Next Rent Escalation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">
                Override Percentage
                <span className="ml-1 text-muted-foreground font-normal">(optional, for dry-run)</span>
              </Label>
              <Input
                type="number"
                placeholder={`Default: ${configuration.percentageIncrease ?? "from schedule"}%`}
                value={previewPct}
                onChange={(e) => setPreviewPct(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {previewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : preview ? (
              <div className="space-y-3">
                {preview.stepInfo && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs space-y-1">
                    <p className="font-medium">
                      Step {preview.stepInfo.index + 1} of {preview.stepInfo.totalSteps} · {preview.stepInfo.label}
                      {preview.stepInfo.isLastStep && <span className="ml-1.5 text-muted-foreground">(repeats)</span>}
                    </p>
                    <p className="text-muted-foreground">
                      Type: <span className="text-foreground">{escalationTypeLabel(preview.stepInfo.type)}</span>
                      {" "}· Value:{" "}
                      <span className="text-foreground">
                        {preview.stepInfo.type === "percentage"
                          ? `${preview.stepInfo.value}%`
                          : formatRupee(preview.stepInfo.value)}
                      </span>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Current</p>
                    <p className="text-xs">Rent: <span className="font-medium">{formatRupee(currentValues.totalRent)}</span></p>
                    <p className="text-xs">CAM: <span className="font-medium">{formatRupee(currentValues.camCharges)}</span></p>
                    <p className="text-xs">Net: <span className="font-medium">{formatRupee(currentValues.netAmount)}</span></p>
                    <p className="text-[11px] text-muted-foreground">Rs. {currentValues.pricePerSqft}/sqft</p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                    <p className="text-[10px] font-medium text-primary uppercase tracking-wide">After Escalation</p>
                    <p className="text-xs">Rent: <span className="font-semibold text-primary">{formatRupee(preview.totalRent)}</span></p>
                    <p className="text-xs">CAM: <span className="font-medium">{formatRupee(preview.camCharges)}</span></p>
                    <p className="text-xs">Net: <span className="font-medium">{formatRupee(preview.netAmount)}</span></p>
                    <p className="text-[11px] text-muted-foreground">Rs. {preview.pricePerSqft}/sqft</p>
                  </div>
                </div>

                {preview.context?.nextEscalation && (
                  <p className="text-[11px] text-muted-foreground">
                    Effective: <span className="font-medium text-foreground">{preview.context.nextEscalation.nepali}</span>
                    {" "}(Q{preview.context.nextEscalation.quarter})
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Unable to load preview. Ensure escalation is enabled.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleApply} disabled={!preview || !!actionLoading}>
              {actionLoading === "apply" ? "Applying…" : "Confirm Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
