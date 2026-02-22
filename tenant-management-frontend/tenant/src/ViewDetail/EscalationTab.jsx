"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "../../plugins/axios.js"
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

function formatAppliesTo(value) {
    if (!value) return "—"
    const map = { rent_only: "Rent only", cam_only: "CAM only", both: "Rent & CAM" }
    return map[value] || value
}

// FIX 5: NPR not INR — this is a Nepal property system
function formatRupee(amount) {
    if (amount == null) return "—"
    return new Intl.NumberFormat("ne-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(amount)
}

export function EscalationTab({ tenantId }) {
    const [escalation, setEscalation] = useState(null)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [preview, setPreview] = useState(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewPct, setPreviewPct] = useState("")
    const [actionLoading, setActionLoading] = useState(null) // "apply" | "disable" | "enable" | "save"
    const [enableForm, setEnableForm] = useState({
        percentageIncrease: "",
        intervalMonths: "12",
        appliesTo: "rent_only",
    })
    // FIX 2: Track whether the form has unsaved changes so we can show "Save Changes"
    const [formDirty, setFormDirty] = useState(false)

    const enabled = escalation?.enabled ?? false

    const getEscalation = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        try {
            const response = await api.get(`/api/escalation/data/${tenantId}`)
            setEscalation(response.data?.data ?? null)
            const cfg = response.data?.data?.configuration
            if (cfg) {
                setEnableForm({
                    percentageIncrease: String(cfg.percentageIncrease || ""),
                    intervalMonths: String(cfg.intervalMonths ?? 12),
                    appliesTo: cfg.appliesTo || "rent_only",
                })
                setFormDirty(false)
            }
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
            const response = await api.get(`/api/escalation/history/${tenantId}`)
            setHistory(Array.isArray(response.data?.history) ? response.data.history : [])
        } catch {
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }, [tenantId])

    useEffect(() => {
        getEscalation()
    }, [getEscalation])

    useEffect(() => {
        if (tenantId && escalation !== null) getHistory()
    }, [tenantId, escalation, getHistory])

    // FIX 4: Added previewPct to the effect deps so re-fetches happen when user
    // types a custom percentage while the dialog is already open
    const fetchPreview = useCallback(async () => {
        if (!tenantId || !escalation?.enabled) return
        setPreview(null)
        setPreviewLoading(true)
        try {
            const pct = previewPct ? parseFloat(previewPct) : escalation?.configuration?.percentageIncrease
            const url = pct != null && !Number.isNaN(pct)
                ? `/api/escalation/preview/${tenantId}?percentage=${pct}`
                : `/api/escalation/preview/${tenantId}`
            const response = await api.get(url)
            setPreview(response.data?.preview ?? null)
        } catch {
            setPreview(null)
        } finally {
            setPreviewLoading(false)
        }
    }, [tenantId, escalation?.enabled, escalation?.configuration?.percentageIncrease, previewPct])

    // FIX 4: previewPct added so typing a new % re-fetches while dialog is open
    useEffect(() => {
        if (previewOpen && escalation?.enabled) fetchPreview()
    }, [previewOpen, escalation?.enabled, previewPct, fetchPreview])

    const handleApply = async () => {
        setActionLoading("apply")
        try {
            await api.post(`/api/escalation/apply/${tenantId}`, {
                note: "Applied from tenant detail",
            })
            await getEscalation()
            await getHistory()
            setPreviewOpen(false)
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    // FIX 1: Extracted raw disable (no confirm) so the toggle can call it silently.
    // handleDisable (confirm-guarded) is only wired to the explicit "Disable" button.
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

    // FIX 1: Toggle off uses rawDisable (no double-confirm)
    const handleEnableToggle = async (checked) => {
        if (checked) {
            const pct = parseFloat(enableForm.percentageIncrease)
            if (Number.isNaN(pct) || pct <= 0) return
            setActionLoading("enable")
            try {
                await api.post(`/api/escalation/enable/${tenantId}`, {
                    percentageIncrease: pct,
                    intervalMonths: parseInt(enableForm.intervalMonths, 10) || 12,
                    appliesTo: enableForm.appliesTo || "rent_only",
                })
                await getEscalation()
            } catch (err) {
                console.error(err)
            } finally {
                setActionLoading(null)
            }
        } else {
            // FIX 1: No confirm dialog when using the toggle — the switch itself is confirmation enough
            await rawDisable()
        }
    }

    // FIX 2: Save changes while escalation is already enabled (re-calls enable endpoint which does upsert)
    const handleSaveChanges = async () => {
        const pct = parseFloat(enableForm.percentageIncrease)
        if (Number.isNaN(pct) || pct <= 0) return
        setActionLoading("save")
        try {
            await api.post(`/api/escalation/enable/${tenantId}`, {
                percentageIncrease: pct,
                intervalMonths: parseInt(enableForm.intervalMonths, 10) || 12,
                appliesTo: enableForm.appliesTo || "rent_only",
            })
            await getEscalation()
            setFormDirty(false)
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(null)
        }
    }

    // FIX 2: Helper to update form and mark dirty
    const updateForm = (patch) => {
        setEnableForm((f) => ({ ...f, ...patch }))
        setFormDirty(true)
    }

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

    return (
        <div className="space-y-6">
            {/* 1️⃣ STATUS CARD */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Escalation Status
                        <Badge variant={enabled ? "default" : "secondary"}>
                            {enabled ? "Active" : "Disabled"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Next Escalation</p>
                        <p className="font-medium">{schedule.nextEscalationNepaliDate ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Last Escalated</p>
                        <p className="font-medium">{schedule.lastEscalatedNepaliDate ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Increase</p>
                        <p className="font-medium">
                            {configuration.percentageIncrease
                                ? `${configuration.percentageIncrease}% every ${configuration.intervalMonths ?? 12} months`
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Applies To</p>
                        <p className="font-medium">{formatAppliesTo(configuration.appliesTo)}</p>
                    </div>
                </CardContent>
            </Card>

            {/* 2️⃣ CONFIGURATION CARD */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle>Escalation Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Enable Escalation</Label>
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleEnableToggle}
                            disabled={!!actionLoading}
                        />
                    </div>

                    {/* FIX 2: Fields always editable — "Save Changes" appears when dirty + enabled */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <Label>Percentage Increase (%)</Label>
                            <Input
                                type="number"
                                placeholder="5"
                                value={enableForm.percentageIncrease}
                                onChange={(e) => updateForm({ percentageIncrease: e.target.value })}
                                disabled={!!actionLoading}
                            />
                        </div>
                        <div>
                            <Label>Interval (Months)</Label>
                            <Input
                                type="number"
                                placeholder="12"
                                value={enableForm.intervalMonths}
                                onChange={(e) => updateForm({ intervalMonths: e.target.value })}
                                disabled={!!actionLoading}
                            />
                        </div>
                        {/* FIX 3: appliesTo selector was missing from UI entirely */}
                        <div>
                            <Label>Applies To</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={enableForm.appliesTo}
                                onChange={(e) => updateForm({ appliesTo: e.target.value })}
                                disabled={!!actionLoading}
                            >
                                <option value="rent_only">Rent only</option>
                                <option value="cam_only">CAM only</option>
                                <option value="both">Rent & CAM</option>
                            </select>
                        </div>
                    </div>

                    {/* FIX 2: Show Save Changes when enabled and form has unsaved edits */}
                    {enabled && formDirty && (
                        <div className="pt-2">
                            <Button
                                onClick={handleSaveChanges}
                                disabled={!!actionLoading}
                                variant="secondary"
                            >
                                {actionLoading === "save" ? "Saving…" : "Save Changes"}
                            </Button>
                        </div>
                    )}

                    {enabled && (
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={() => { setPreviewPct(""); setPreviewOpen(true) }}
                                variant="outline"
                                disabled={!!actionLoading}
                            >
                                Preview Increase
                            </Button>
                            <Button onClick={handleApply} disabled={!!actionLoading}>
                                {actionLoading === "apply" ? "Applying…" : "Apply Now"}
                            </Button>
                            <Button variant="destructive" onClick={handleDisable} disabled={!!actionLoading}>
                                {actionLoading === "disable" ? "Disabling…" : "Disable"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3️⃣ CURRENT RENT */}
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle>Current Rent</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                </CardContent>
            </Card>

            {/* 4️⃣ HISTORY TABLE */}
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
                                        <th className="text-left py-2">Date</th>
                                        <th className="text-left py-2">Old Rent</th>
                                        <th className="text-left py-2">New Rent</th>
                                        <th className="text-left py-2">%</th>
                                        <th className="text-left py-2">Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-muted-foreground">
                                                No escalation history yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((entry, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="py-2">{entry.escalatedNepaliDate ?? entry.escalatedAt}</td>
                                                <td>{formatRupee(entry.before?.totalRent)}</td>
                                                <td>{formatRupee(entry.after?.totalRent)}</td>
                                                <td>{entry.percentageApplied != null ? `${entry.percentageApplied}%` : "—"}</td>
                                                <td>{entry.note || "—"}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 5️⃣ PREVIEW DIALOG */}
            {/* FIX 4: previewPct input inside the dialog so user can try custom % and get live re-fetch */}
            <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreview(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Preview Rent Escalation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <div>
                            <Label>Override Percentage (optional)</Label>
                            <Input
                                type="number"
                                placeholder={`Default: ${configuration.percentageIncrease ?? "—"}%`}
                                value={previewPct}
                                onChange={(e) => setPreviewPct(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        {previewLoading ? (
                            <p className="text-muted-foreground">Loading preview…</p>
                        ) : preview ? (
                            <>
                                <p>Current Rent: {formatRupee(currentValues.totalRent)}</p>
                                <p>Increase: {preview.percentageApplied ?? configuration.percentageIncrease}%</p>
                                <p className="font-semibold text-base">New Rent: {formatRupee(preview.totalRent)}</p>
                                <p>CAM Charges: {formatRupee(preview.camCharges)}</p>
                                <p>Net Amount: {formatRupee(preview.netAmount)}</p>
                                {preview.context?.nextEscalation && (
                                    <p className="text-muted-foreground">
                                        Effective from (next escalation): {preview.context.nextEscalation.nepali}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-muted-foreground">Unable to load preview. Ensure escalation is enabled.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
                        <Button onClick={handleApply} disabled={!preview || !!actionLoading}>
                            {actionLoading === "apply" ? "Applying…" : "Confirm Apply"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}