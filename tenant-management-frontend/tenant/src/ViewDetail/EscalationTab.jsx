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

function formatRupee(amount) {
    if (amount == null) return "—"
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
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
    const [actionLoading, setActionLoading] = useState(null) // "apply" | "disable" | "enable"
    const [enableForm, setEnableForm] = useState({ percentageIncrease: "", intervalMonths: "12", appliesTo: "rent_only" })

    const enabled = escalation?.enabled ?? false

    const getEscalation = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        try {
            const response = await api.get(`/api/escalation/data/${tenantId}`)
            setEscalation(response.data?.data ?? null)
            const cfg = response.data?.data?.configuration
            if (cfg) {
                setEnableForm((f) => ({
                    ...f,
                    percentageIncrease: String(cfg.percentageIncrease || ""),
                    intervalMonths: String(cfg.intervalMonths ?? 12),
                    appliesTo: cfg.appliesTo || "rent_only",
                }))
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

    useEffect(() => {
        if (previewOpen && escalation?.enabled) fetchPreview()
    }, [previewOpen, escalation?.enabled, fetchPreview])

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

    const handleDisable = async () => {
        if (!window.confirm("Disable rent escalation for this tenant?")) return
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

    const handleEnableToggle = async (checked) => {
        if (checked) {
            const pct = parseFloat(enableForm.percentageIncrease)
            if (Number.isNaN(pct) || pct <= 0) {
                return
            }
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
            await handleDisable()
        }
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
                        <p className="font-medium">{configuration.percentageIncrease ? `${configuration.percentageIncrease}% every ${configuration.intervalMonths ?? 12} months` : "—"}</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Percentage Increase (%)</Label>
                            <Input
                                type="number"
                                placeholder="5"
                                value={enableForm.percentageIncrease}
                                onChange={(e) => setEnableForm((f) => ({ ...f, percentageIncrease: e.target.value }))}
                                disabled={enabled}
                            />
                        </div>
                        <div>
                            <Label>Interval (Months)</Label>
                            <Input
                                type="number"
                                placeholder="12"
                                value={enableForm.intervalMonths}
                                onChange={(e) => setEnableForm((f) => ({ ...f, intervalMonths: e.target.value }))}
                                disabled={enabled}
                            />
                        </div>
                    </div>
                    {enabled && (
                        <div className="flex gap-2 pt-4">
                            <Button onClick={() => { setPreviewPct(""); setPreviewOpen(true); }} variant="outline">
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
            <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreview(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Preview Rent Escalation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        {previewLoading ? (
                            <p className="text-muted-foreground">Loading preview…</p>
                        ) : preview ? (
                            <>
                                <p>Current Rent: {formatRupee(currentValues.totalRent)}</p>
                                <p>Increase: {preview.percentageApplied ?? configuration.percentageIncrease}%</p>
                                <p className="font-semibold text-base">New Rent: {formatRupee(preview.totalRent)}</p>
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
