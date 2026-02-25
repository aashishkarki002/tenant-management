'use client'

import React, { useState, useEffect, useCallback } from 'react'
import api from '../plugins/axios'
import useProperty from './hooks/use-property'
import { useUnits } from './hooks/use-units'
import { toast } from 'sonner'

// ─── Quick-action draft templates ───────────────────────────────────────────
const QUICK_TEMPLATES = [
    {
        id: 'rent',

        label: 'Rent Reminder',
        subject: 'Rent Due – Action Required',
        body: `Dear {{tenantName}},

This is a friendly reminder that your monthly rent of Rs. {{totalRent}} is due.

Please make your payment at the earliest to avoid any late fees.

Property: {{property}}
Unit: {{units}}

Thank you for your cooperation.

Best regards,
Management Team`,
    },
    {
        id: 'cam',

        label: 'CAM Reminder',
        subject: 'Common Area Maintenance (CAM) Charges Due',
        body: `Dear {{tenantName}},

This is to inform you that your Common Area Maintenance (CAM) charges are due for this month.

Kindly settle the amount at your earliest convenience.

Property: {{property}} | Unit: {{units}}

For queries, contact the management office.

Regards,
Management Team`,
    },
    {
        id: 'electricity',

        label: 'Electricity Bill',
        subject: 'Electricity Bill Due for {{units}}',
        body: `Dear {{tenantName}},

Your electricity bill for unit {{units}} at {{property}} is due.

Please clear the outstanding amount to avoid service interruption.

If you have already paid, please ignore this notice.

Thank you,
Management Team`,
    },
    {
        id: 'maintenance',

        label: 'Maintenance Notice',
        subject: 'Scheduled Maintenance – Action Required',
        body: `Dear {{tenantName}},

We would like to inform you that scheduled maintenance work will be carried out in your building.

Please make necessary arrangements. We apologize for any inconvenience caused.

Property: {{property}} | Block: {{block}}

For any concerns, reach out to the management office.

Regards,
Management Team`,
    },
    {
        id: 'water',

        label: 'Water Disruption',
        subject: 'Water Supply Interruption Notice',
        body: `Dear {{tenantName}},

Please be advised that water supply will be temporarily interrupted due to pipeline maintenance work.

We apologize for the inconvenience and request your cooperation.

Property: {{property}} | Unit: {{units}}

Thank you for your understanding.

Management Team`,
    },
    {
        id: 'custom',

        label: 'Custom Message',
        subject: '',
        body: '',
    },
]

const PLACEHOLDERS = [
    { key: '{{tenantName}}', label: 'Tenant Name' },
    { key: '{{property}}', label: 'Property' },
    { key: '{{block}}', label: 'Block' },
    { key: '{{units}}', label: 'Units' },
    { key: '{{totalRent}}', label: 'Total Rent' },
    { key: '{{phone}}', label: 'Phone' },
    { key: '{{email}}', label: 'Email' },
    { key: '{{securityDeposit}}', label: 'Security Deposit' },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function Badge({ children, color = 'blue', onRemove }) {
    const colors = {
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        red: 'bg-red-100 text-red-700 border-red-200',
    }
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
            {children}
            {onRemove && (
                <button onClick={onRemove} className="hover:opacity-60 transition-opacity ml-0.5">
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            )}
        </span>
    )
}

function RecipientPreviewPanel({ filters, onClose }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            setLoading(true)
            try {
                const res = await api.post('/api/broadcast/preview-recipients', { filters })
                setData(res.data)
            } catch {
                toast.error('Failed to preview recipients')
                onClose()
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [])

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Preview Recipients</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4l8 8" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-32 gap-3 text-slate-500">
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                            Loading recipients…
                        </div>
                    ) : data ? (
                        <>
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                {[
                                    { label: 'Total', val: data.totalCount, color: 'text-slate-700' },
                                    { label: 'With Email', val: data.withEmailCount, color: 'text-emerald-600' },
                                    { label: 'No Email', val: data.withoutEmailCount, color: 'text-red-500' },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                                        <div className={`text-2xl font-bold ${color}`}>{val}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                                    </div>
                                ))}
                            </div>
                            {data.tenantsWithoutEmail?.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
                                    ⚠ {data.tenantsWithoutEmail.length} tenant(s) won't receive emails — no email on file.
                                </div>
                            )}
                            <div className="space-y-2">
                                {data.tenants?.slice(0, 20).map((t) => (
                                    <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-800">{t.name}</p>
                                            <p className="text-slate-400 text-xs">{t.units || 'No unit'} · {t.block || ''}</p>
                                        </div>
                                        <span className={`text-xs ${t.email ? 'text-emerald-600' : 'text-red-400'}`}>
                                            {t.email || 'No email'}
                                        </span>
                                    </div>
                                ))}
                                {data.tenants?.length > 20 && (
                                    <p className="text-xs text-center text-slate-400 pt-2">+{data.tenants.length - 20} more</p>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function ConfirmModal({ summary, onConfirm, onCancel, loading }) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
                <div className="p-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
                            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-1">Send Broadcast Email</h2>
                    <p className="text-sm text-slate-500 mb-5">This will send emails to all matching tenants. Review the details below.</p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm mb-5">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Subject</span>
                            <span className="font-medium text-slate-800 text-right max-w-[60%] truncate">{summary.subject}</span>
                        </div>
                        {summary.property && <div className="flex justify-between"><span className="text-slate-500">Property</span><span className="font-medium">{summary.property}</span></div>}
                        {summary.block && <div className="flex justify-between"><span className="text-slate-500">Block</span><span className="font-medium">{summary.block}</span></div>}
                        {summary.status && <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium capitalize">{summary.status}</span></div>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                        <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                            {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            {loading ? 'Sending…' : 'Send Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadCast() {
    // Filter state
    const [selectedProperty, setSelectedProperty] = useState('')
    const [selectedBlock, setSelectedBlock] = useState('')
    const [selectedInnerBlock, setSelectedInnerBlock] = useState('')
    const [selectedUnit, setSelectedUnit] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')

    // Email content
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [activeTemplate, setActiveTemplate] = useState(null)

    // UI state
    const [showPreview, setShowPreview] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [bodyRef, setBodyRef] = useState(null)

    // Fetch properties from hook
    const { property: properties } = useProperty()

    // Derive blocks from selected property
    const selectedPropertyObj = properties?.find(p => p._id === selectedProperty)
    const blocks = selectedPropertyObj?.blocks || []

    // Derive inner blocks
    const selectedBlockObj = blocks.find(b => b._id === selectedBlock)
    const innerBlocks = selectedBlockObj?.innerBlocks || []

    // Fetch units filtered by property+block
    const { units } = useUnits({
        propertyId: selectedProperty || undefined,
        blockId: selectedBlock || undefined,
    })

    // Build filters object for API calls
    const filters = {
        ...(selectedProperty && { property: selectedProperty }),
        ...(selectedBlock && { block: selectedBlock }),
        ...(selectedInnerBlock && { innerBlock: selectedInnerBlock }),
        ...(selectedUnit && { unit: selectedUnit }),
        ...(selectedStatus && { status: selectedStatus }),
    }

    const applyTemplate = (tpl) => {
        setActiveTemplate(tpl.id)
        setSubject(tpl.subject)
        setBody(tpl.body)
    }

    const insertPlaceholder = (placeholder) => {
        if (!bodyRef) return
        const start = bodyRef.selectionStart
        const end = bodyRef.selectionEnd
        const newBody = body.slice(0, start) + placeholder + body.slice(end)
        setBody(newBody)
        setTimeout(() => {
            bodyRef.focus()
            bodyRef.setSelectionRange(start + placeholder.length, start + placeholder.length)
        }, 0)
    }

    const handleSend = async () => {
        setIsSending(true)
        try {
            const res = await api.post('/api/broadcast/send-email', {
                filters,
                subject,
                body,
            })
            if (res.data.success) {
                toast.success(` Sent to ${res.data.sentCount} tenant(s)${res.data.failedCount ? ` · ${res.data.failedCount} failed` : ''}`)
                setShowConfirm(false)
                setSubject('')
                setBody('')
                setActiveTemplate(null)
            } else {
                toast.error(res.data.message || 'Failed to send')
                setShowConfirm(false)
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Something went wrong')
        } finally {
            setIsSending(false)
        }
    }

    const isValid = subject.trim().length > 0 && body.trim().length > 0

    const confirmSummary = {
        subject,
        property: properties?.find(p => p._id === selectedProperty)?.name,
        block: blocks.find(b => b._id === selectedBlock)?.name,
        status: selectedStatus,
    }

    return (
        <div className="min-h-screen bg-[#f8f9fb] font-sans">
            {/* Modals */}
            {showPreview && <RecipientPreviewPanel filters={filters} onClose={() => setShowPreview(false)} />}
            {showConfirm && (
                <ConfirmModal
                    summary={confirmSummary}
                    onConfirm={handleSend}
                    onCancel={() => setShowConfirm(false)}
                    loading={isSending}
                />
            )}

            {/* Page header */}
            {/* Page header */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto flex items-center justify-center">
                    <div className="flex items-center gap-3 text-center">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                                Broadcast Message
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500">
                                Send personalised messages to filtered tenants
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

                {/* ── Left column ── */}
                <div className="space-y-5">

                    {/* Quick templates */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Templates</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {QUICK_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    onClick={() => applyTemplate(tpl)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${activeTemplate === tpl.id
                                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="text-base leading-none">{tpl.emoji}</span>
                                    <span className="leading-tight">{tpl.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                            Subject <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            maxLength={200}
                            placeholder="e.g. Rent Due Reminder for {{tenantName}}"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                        />
                        <p className="text-xs text-slate-400 mt-1.5 text-right">{subject.length}/200</p>
                    </div>

                    {/* Body */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Message Body <span className="text-red-400">*</span>
                            </label>
                            <span className="text-xs text-slate-400">{body.length}/10000</span>
                        </div>

                        {/* Placeholder chips */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {PLACEHOLDERS.map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => insertPlaceholder(p.key)}
                                    title={`Insert ${p.key}`}
                                    className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-mono transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                            <span className="text-xs text-slate-400 self-center ml-1">← click to insert at cursor</span>
                        </div>

                        <textarea
                            ref={el => setBodyRef(el)}
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            maxLength={10000}
                            rows={14}
                            placeholder="Write your message here. Use placeholders like {{tenantName}} for personalisation."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition font-mono resize-y"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPreview(true)}
                            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            Preview Recipients
                        </button>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!isValid}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Send Email
                        </button>
                    </div>
                </div>

                {/* ── Right column: Filters ── */}
                <div className="space-y-5">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-24">
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-800">Filter Recipients</p>
                        </div>

                        <div className="space-y-3">
                            {/* Property */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">Property</label>
                                <select
                                    value={selectedProperty}
                                    onChange={e => { setSelectedProperty(e.target.value); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit('') }}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                                >
                                    <option value="">All Properties</option>
                                    {(properties || []).map(p => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Block */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">Block</label>
                                <select
                                    value={selectedBlock}
                                    onChange={e => { setSelectedBlock(e.target.value); setSelectedInnerBlock('') }}
                                    disabled={!selectedProperty || blocks.length === 0}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white disabled:opacity-50"
                                >
                                    <option value="">All Blocks</option>
                                    {blocks.map(b => (
                                        <option key={b._id} value={b._id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Inner Block */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">Floor / Inner Block</label>
                                <select
                                    value={selectedInnerBlock}
                                    onChange={e => setSelectedInnerBlock(e.target.value)}
                                    disabled={!selectedBlock || innerBlocks.length === 0}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white disabled:opacity-50"
                                >
                                    <option value="">All Floors</option>
                                    {innerBlocks.map(ib => (
                                        <option key={ib._id} value={ib._id}>{ib.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Unit */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">Unit</label>
                                <select
                                    value={selectedUnit}
                                    onChange={e => setSelectedUnit(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                                >
                                    <option value="">All Units</option>
                                    {(units || []).map(u => (
                                        <option key={u._id} value={u._id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">Tenant Status</label>
                                <select
                                    value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>

                            {/* Active filters summary */}
                            {Object.keys(filters).length > 0 && (
                                <div className="pt-2 border-t border-slate-100">
                                    <p className="text-xs text-slate-500 mb-2">Active filters:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedProperty && <Badge color="blue" onRemove={() => { setSelectedProperty(''); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit('') }}>
                                            {properties?.find(p => p._id === selectedProperty)?.name}
                                        </Badge>}
                                        {selectedBlock && <Badge color="blue" onRemove={() => { setSelectedBlock(''); setSelectedInnerBlock('') }}>
                                            {blocks.find(b => b._id === selectedBlock)?.name}
                                        </Badge>}
                                        {selectedInnerBlock && <Badge color="blue" onRemove={() => setSelectedInnerBlock('')}>
                                            {innerBlocks.find(ib => ib._id === selectedInnerBlock)?.name}
                                        </Badge>}
                                        {selectedUnit && <Badge color="blue" onRemove={() => setSelectedUnit('')}>
                                            Unit: {units?.find(u => u._id === selectedUnit)?.name}
                                        </Badge>}
                                        {selectedStatus && <Badge color="green" onRemove={() => setSelectedStatus('')}>
                                            {selectedStatus}
                                        </Badge>}
                                    </div>
                                    <button
                                        onClick={() => { setSelectedProperty(''); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit(''); setSelectedStatus('') }}
                                        className="mt-2 text-xs text-red-500 hover:text-red-700 transition-colors"
                                    >
                                        Clear all filters
                                    </button>
                                </div>
                            )}

                            {Object.keys(filters).length === 0 && (
                                <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2.5 mt-1">
                                    No filters applied — email will be sent to <strong className="text-slate-600">all tenants</strong>.
                                </p>
                            )}

                            <button
                                onClick={() => setShowPreview(true)}
                                className="w-full mt-1 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            >
                                Preview who will receive this →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}