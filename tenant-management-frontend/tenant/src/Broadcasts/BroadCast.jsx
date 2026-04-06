import React, { useState, useEffect, useCallback } from 'react'
import api from '../../plugins/axios'
import useProperty from '../hooks/use-property'
import { useUnits } from '../hooks/use-units'
import { toast } from 'sonner'
import {
    Mail,
    MessageCircle,
    MessageSquare,
    Send,
    Eye,
    X,
    Filter,
    ChevronDown,
    Receipt,
    Building2,
    Zap,
    Wrench,
    Droplets,
    PenLine,
    Users,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react'

// ─── Channel definitions ─────────────────────────────────────────────────────
const CHANNELS = [
    { id: 'email', label: 'Email', icon: Mail, available: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, available: false },
    { id: 'sms', label: 'SMS', icon: MessageSquare, available: false },
]

// ─── Quick-action draft templates ────────────────────────────────────────────
const QUICK_TEMPLATES = [
    {
        id: 'rent',
        label: 'Rent Reminder',
        icon: Receipt,
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
        label: 'CAM Charges',
        icon: Building2,
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
        icon: Zap,
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
        label: 'Maintenance',
        icon: Wrench,
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
        icon: Droplets,
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
        label: 'Custom',
        icon: PenLine,
        subject: '',
        body: '',
    },
]

const PLACEHOLDERS = [
    { key: '{{tenantName}}', label: 'Name' },
    { key: '{{property}}', label: 'Property' },
    { key: '{{block}}', label: 'Block' },
    { key: '{{units}}', label: 'Units' },
    { key: '{{totalRent}}', label: 'Total Rent' },
    { key: '{{phone}}', label: 'Phone' },
    { key: '{{email}}', label: 'Email' },
    { key: '{{securityDeposit}}', label: 'Security Deposit' },
]

// ─── CSS variable style helpers ───────────────────────────────────────────────
const card = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
}

const sectionLabel = {
    color: 'var(--color-text-weak)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    marginBottom: '10px',
    display: 'block',
}

const inputStyle = {
    width: '100%',
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    fontSize: '14px',
    color: 'var(--color-text-body)',
    outline: 'none',
    transition: 'border-color 0.15s',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterTag({ children, onRemove }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            backgroundColor: 'var(--color-accent-light)',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent-mid)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: 500,
        }}>
            {children}
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="cursor-pointer"
                    style={{ opacity: 0.6, lineHeight: 1, background: 'none', border: 'none', padding: 0, color: 'inherit' }}
                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                    onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    )
}

function SelectInput({ label, value, onChange, disabled, children }) {
    return (
        <div>
            <label style={{ ...sectionLabel, marginBottom: '5px', fontSize: '11px' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <select
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    style={{
                        ...inputStyle,
                        paddingRight: '32px',
                        appearance: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                >
                    {children}
                </select>
                <ChevronDown
                    className="w-3.5 h-3.5"
                    style={{
                        position: 'absolute', right: '10px', top: '50%',
                        transform: 'translateY(-50%)', pointerEvents: 'none',
                        color: 'var(--color-text-weak)',
                    }}
                />
            </div>
        </div>
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
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: '16px',
        }}>
            <div style={{
                ...card,
                boxShadow: 'var(--shadow-modal)',
                borderRadius: 'var(--radius-xl)',
                width: '100%', maxWidth: '480px',
                maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-strong)', margin: 0 }}>
                            Preview Recipients
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer"
                        style={{
                            padding: '6px', background: 'none', border: 'none',
                            borderRadius: 'var(--radius-sm)', color: 'var(--color-text-weak)',
                            cursor: 'pointer',
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg)'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', gap: '10px', color: 'var(--color-text-sub)' }}>
                            <div style={{ width: '18px', height: '18px', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="animate-spin" />
                            <span style={{ fontSize: '14px' }}>Loading recipients…</span>
                        </div>
                    ) : data ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                {[
                                    { label: 'Total', val: data.totalCount, color: 'var(--color-text-strong)', bg: 'var(--color-bg)' },
                                    { label: 'With Email', val: data.withEmailCount, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                                    { label: 'No Email', val: data.withoutEmailCount, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
                                ].map(({ label, val, color, bg }) => (
                                    <div key={label} style={{
                                        backgroundColor: bg,
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '12px',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '22px', fontWeight: 700, color }}>{val ?? 0}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-sub)', marginTop: '2px' }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {data.tenantsWithoutEmail?.length > 0 && (
                                <div style={{
                                    backgroundColor: 'var(--color-warning-bg)',
                                    border: '1px solid var(--color-warning-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '10px 12px',
                                    marginBottom: '12px',
                                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                                }}>
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                                    <span style={{ fontSize: '13px', color: 'var(--color-warning)', lineHeight: 1.4 }}>
                                        {data.tenantsWithoutEmail.length} tenant(s) won't receive emails — no email on file.
                                    </span>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {data.tenants?.slice(0, 20).map((t) => (
                                    <div key={t.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 0',
                                        borderBottom: '1px solid var(--color-border)',
                                    }}>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-body)', margin: 0 }}>{t.name}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--color-text-weak)', margin: '2px 0 0' }}>
                                                {[t.units, t.block].filter(Boolean).join(' · ') || 'No unit'}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontSize: '11px',
                                            color: t.email ? 'var(--color-success)' : 'var(--color-danger)',
                                            fontWeight: 500,
                                        }}>
                                            {t.email ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Has email
                                                </span>
                                            ) : 'No email'}
                                        </span>
                                    </div>
                                ))}
                                {data.tenants?.length > 20 && (
                                    <p style={{ fontSize: '12px', color: 'var(--color-text-weak)', textAlign: 'center', paddingTop: '10px' }}>
                                        +{data.tenants.length - 20} more tenants
                                    </p>
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
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: '16px',
        }}>
            <div style={{
                ...card,
                boxShadow: 'var(--shadow-modal)',
                borderRadius: 'var(--radius-xl)',
                width: '100%', maxWidth: '420px',
                padding: '24px',
            }}>
                <div style={{
                    width: '44px', height: '44px',
                    backgroundColor: 'var(--color-accent-light)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
                }}>
                    <Send className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-strong)', margin: '0 0 4px' }}>
                    Send Broadcast Email
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-sub)', margin: '0 0 20px' }}>
                    This will send emails to all matching tenants. Review the details below.
                </p>

                <div style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    marginBottom: '20px',
                }}>
                    {[
                        { label: 'Subject', value: summary.subject },
                        summary.property && { label: 'Property', value: summary.property },
                        summary.block && { label: 'Block', value: summary.block },
                        summary.status && { label: 'Status', value: summary.status },
                    ].filter(Boolean).map(({ label, value }) => (
                        <div key={label} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 0',
                            borderBottom: '1px solid var(--color-border)',
                        }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-weak)' }}>{label}</span>
                            <span style={{
                                fontSize: '13px', fontWeight: 500, color: 'var(--color-text-body)',
                                maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textTransform: label === 'Status' ? 'capitalize' : 'none',
                            }}>{value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        className="cursor-pointer"
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-body)',
                            fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                            transition: 'background-color 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg)'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="cursor-pointer"
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: loading ? 'var(--color-accent-mid)' : 'var(--color-accent)',
                            color: '#fff',
                            fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'background-color 0.15s',
                            opacity: loading ? 0.8 : 1,
                        }}
                        onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
                        onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
                    >
                        {loading && <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" />}
                        {loading ? 'Sending…' : 'Send Now'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadCast() {
    const [activeChannel, setActiveChannel] = useState('email')

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

    const { property: properties } = useProperty()
    const selectedPropertyObj = properties?.find(p => p._id === selectedProperty)
    const blocks = selectedPropertyObj?.blocks || []
    const selectedBlockObj = blocks.find(b => b._id === selectedBlock)
    const innerBlocks = selectedBlockObj?.innerBlocks || []
    const { units } = useUnits({
        propertyId: selectedProperty || undefined,
        blockId: selectedBlock || undefined,
    })

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
            const res = await api.post('/api/broadcast/send-email', { filters, subject, body })
            if (res.data.success) {
                toast.success(`Sent to ${res.data.sentCount} tenant(s)${res.data.failedCount ? ` · ${res.data.failedCount} failed` : ''}`)
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
    const activeFilterCount = Object.keys(filters).length

    const confirmSummary = {
        subject,
        property: properties?.find(p => p._id === selectedProperty)?.name,
        block: blocks.find(b => b._id === selectedBlock)?.name,
        status: selectedStatus,
    }

    const clearAllFilters = () => {
        setSelectedProperty('')
        setSelectedBlock('')
        setSelectedInnerBlock('')
        setSelectedUnit('')
        setSelectedStatus('')
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', fontFamily: 'inherit' }}>
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

            {/* ── Page Header ────────────────────────────────────────────────── */}
            <div style={{
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                position: 'sticky', top: 0, zIndex: 30,
            }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '12px 0' }}>
                        {/* Title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '36px', height: '36px',
                                backgroundColor: 'var(--color-accent-light)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Send className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-strong)', margin: 0, lineHeight: 1.2 }}>
                                    Broadcast Message
                                </h1>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-weak)', margin: 0 }}>
                                    Send personalised messages to filtered tenants
                                </p>
                            </div>
                        </div>

                        {/* Channel selector tabs */}
                        <div style={{
                            display: 'flex', gap: '4px',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '3px',
                        }}>
                            {CHANNELS.map(({ id, label, icon: Icon, available }) => {
                                const isActive = activeChannel === id
                                return (
                                    <button
                                        key={id}
                                        onClick={() => available && setActiveChannel(id)}
                                        title={!available ? `${label} – coming soon` : label}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: 'calc(var(--radius-md) - 2px)',
                                            border: 'none',
                                            fontSize: '13px', fontWeight: isActive ? 600 : 400,
                                            cursor: available ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.15s',
                                            backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
                                            color: isActive ? '#fff' : available ? 'var(--color-text-sub)' : 'var(--color-text-weak)',
                                            opacity: !available && !isActive ? 0.55 : 1,
                                            position: 'relative',
                                        }}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{label}</span>
                                        {!available && (
                                            <span style={{
                                                fontSize: '9px', fontWeight: 700,
                                                backgroundColor: 'var(--color-border)',
                                                color: 'var(--color-text-weak)',
                                                borderRadius: '4px',
                                                padding: '1px 4px',
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                            }}>
                                                Soon
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Page Body ──────────────────────────────────────────────────── */}
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px' }}>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5">

                    {/* ── Left column: Compose ─────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Quick Templates */}
                        <div style={{ ...card, padding: '16px 18px' }}>
                            <span style={sectionLabel}>Quick Templates</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {QUICK_TEMPLATES.map((tpl) => {
                                    const Icon = tpl.icon
                                    const isActive = activeTemplate === tpl.id
                                    return (
                                        <button
                                            key={tpl.id}
                                            onClick={() => applyTemplate(tpl)}
                                            className="cursor-pointer"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '9px 12px',
                                                borderRadius: 'var(--radius-md)',
                                                border: `1px solid ${isActive ? 'var(--color-accent-mid)' : 'var(--color-border)'}`,
                                                backgroundColor: isActive ? 'var(--color-accent-light)' : 'var(--color-bg)',
                                                color: isActive ? 'var(--color-accent)' : 'var(--color-text-body)',
                                                fontSize: '13px', fontWeight: isActive ? 600 : 400,
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseOver={e => !isActive && (e.currentTarget.style.borderColor = 'var(--color-accent-mid)')}
                                            onMouseOut={e => !isActive && (e.currentTarget.style.borderColor = 'var(--color-border)')}
                                        >
                                            <Icon
                                                className="w-3.5 h-3.5 shrink-0"
                                                style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-sub)' }}
                                            />
                                            <span style={{ lineHeight: 1.3 }}>{tpl.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Subject (email only) */}
                        <div style={{ ...card, padding: '16px 18px' }}>
                            <label style={sectionLabel}>
                                Subject <span style={{ color: 'var(--color-danger)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                maxLength={200}
                                placeholder="e.g. Rent Due Reminder for {{tenantName}}"
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--color-text-weak)', marginTop: '5px', textAlign: 'right' }}>
                                {subject.length}/200
                            </p>
                        </div>

                        {/* Message Body */}
                        <div style={{ ...card, padding: '16px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={sectionLabel}>
                                    Message Body <span style={{ color: 'var(--color-danger)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>*</span>
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-weak)', marginBottom: '10px' }}>
                                    {body.length}/10,000
                                </span>
                            </div>

                            {/* Placeholder chips */}
                            <div style={{ marginBottom: '10px' }}>
                                <p style={{ fontSize: '11px', color: 'var(--color-text-weak)', marginBottom: '6px' }}>
                                    Insert placeholder at cursor:
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {PLACEHOLDERS.map(p => (
                                        <button
                                            key={p.key}
                                            onClick={() => insertPlaceholder(p.key)}
                                            title={`Insert ${p.key}`}
                                            className="cursor-pointer"
                                            style={{
                                                padding: '3px 9px',
                                                backgroundColor: 'var(--color-bg)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '11px', fontWeight: 500,
                                                color: 'var(--color-text-sub)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                fontFamily: 'monospace',
                                            }}
                                            onMouseOver={e => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-accent-light)'
                                                e.currentTarget.style.borderColor = 'var(--color-accent-mid)'
                                                e.currentTarget.style.color = 'var(--color-accent)'
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg)'
                                                e.currentTarget.style.borderColor = 'var(--color-border)'
                                                e.currentTarget.style.color = 'var(--color-text-sub)'
                                            }}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea
                                ref={el => setBodyRef(el)}
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                maxLength={10000}
                                rows={14}
                                placeholder="Write your message here. Use placeholders like {{tenantName}} for personalisation."
                                style={{
                                    ...inputStyle,
                                    resize: 'vertical',
                                    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
                                    fontSize: '13px',
                                    lineHeight: 1.6,
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                            />
                        </div>

                        {/* Action bar */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowPreview(true)}
                                className="cursor-pointer"
                                style={{
                                    flex: 1, padding: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-surface)',
                                    color: 'var(--color-text-body)',
                                    fontSize: '14px', fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                    transition: 'background-color 0.15s',
                                }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg)'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                            >
                                <Eye className="w-4 h-4" />
                                Preview Recipients
                            </button>
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={!isValid}
                                className="cursor-pointer"
                                style={{
                                    flex: 1, padding: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    backgroundColor: isValid ? 'var(--color-accent)' : 'var(--color-border)',
                                    color: isValid ? '#fff' : 'var(--color-text-weak)',
                                    fontSize: '14px', fontWeight: 600,
                                    cursor: isValid ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                    transition: 'background-color 0.15s',
                                }}
                                onMouseOver={e => isValid && (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
                                onMouseOut={e => isValid && (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
                            >
                                <Send className="w-4 h-4" />
                                Send Email
                            </button>
                        </div>
                    </div>

                    {/* ── Right column: Filter Recipients ──────────────────── */}
                    <div>
                        <div style={{ ...card, padding: '16px 18px', position: 'sticky', top: '72px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-sub)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-strong)' }}>
                                        Filter Recipients
                                    </span>
                                </div>
                                {activeFilterCount > 0 && (
                                    <span style={{
                                        backgroundColor: 'var(--color-accent-light)',
                                        color: 'var(--color-accent)',
                                        border: '1px solid var(--color-accent-mid)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '11px', fontWeight: 600,
                                        padding: '1px 7px',
                                    }}>
                                        {activeFilterCount} active
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <SelectInput
                                    label="Property"
                                    value={selectedProperty}
                                    onChange={e => { setSelectedProperty(e.target.value); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit('') }}
                                >
                                    <option value="">All Properties</option>
                                    {(properties || []).map(p => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </SelectInput>

                                <SelectInput
                                    label="Block"
                                    value={selectedBlock}
                                    onChange={e => { setSelectedBlock(e.target.value); setSelectedInnerBlock('') }}
                                    disabled={!selectedProperty || blocks.length === 0}
                                >
                                    <option value="">All Blocks</option>
                                    {blocks.map(b => (
                                        <option key={b._id} value={b._id}>{b.name}</option>
                                    ))}
                                </SelectInput>

                                <SelectInput
                                    label="Floor / Inner Block"
                                    value={selectedInnerBlock}
                                    onChange={e => setSelectedInnerBlock(e.target.value)}
                                    disabled={!selectedBlock || innerBlocks.length === 0}
                                >
                                    <option value="">All Floors</option>
                                    {innerBlocks.map(ib => (
                                        <option key={ib._id} value={ib._id}>{ib.name}</option>
                                    ))}
                                </SelectInput>

                                <SelectInput
                                    label="Unit"
                                    value={selectedUnit}
                                    onChange={e => setSelectedUnit(e.target.value)}
                                >
                                    <option value="">All Units</option>
                                    {(units || []).map(u => (
                                        <option key={u._id} value={u._id}>{u.name}</option>
                                    ))}
                                </SelectInput>

                                <SelectInput
                                    label="Tenant Status"
                                    value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="pending">Pending</option>
                                </SelectInput>

                                {/* Active filter tags */}
                                {activeFilterCount > 0 && (
                                    <div style={{ paddingTop: '6px', borderTop: '1px solid var(--color-border)' }}>
                                        <p style={{ fontSize: '11px', color: 'var(--color-text-weak)', marginBottom: '7px' }}>
                                            Active filters:
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                            {selectedProperty && (
                                                <FilterTag onRemove={() => { setSelectedProperty(''); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit('') }}>
                                                    {properties?.find(p => p._id === selectedProperty)?.name}
                                                </FilterTag>
                                            )}
                                            {selectedBlock && (
                                                <FilterTag onRemove={() => { setSelectedBlock(''); setSelectedInnerBlock('') }}>
                                                    {blocks.find(b => b._id === selectedBlock)?.name}
                                                </FilterTag>
                                            )}
                                            {selectedInnerBlock && (
                                                <FilterTag onRemove={() => setSelectedInnerBlock('')}>
                                                    {innerBlocks.find(ib => ib._id === selectedInnerBlock)?.name}
                                                </FilterTag>
                                            )}
                                            {selectedUnit && (
                                                <FilterTag onRemove={() => setSelectedUnit('')}>
                                                    Unit: {units?.find(u => u._id === selectedUnit)?.name}
                                                </FilterTag>
                                            )}
                                            {selectedStatus && (
                                                <FilterTag onRemove={() => setSelectedStatus('')}>
                                                    {selectedStatus}
                                                </FilterTag>
                                            )}
                                        </div>
                                        <button
                                            onClick={clearAllFilters}
                                            className="cursor-pointer"
                                            style={{
                                                fontSize: '12px', color: 'var(--color-danger)',
                                                background: 'none', border: 'none', padding: 0,
                                                cursor: 'pointer', fontWeight: 500,
                                                transition: 'opacity 0.15s',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = '0.7'}
                                            onMouseOut={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                )}

                                {activeFilterCount === 0 && (
                                    <div style={{
                                        backgroundColor: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '10px 12px',
                                        fontSize: '12px',
                                        color: 'var(--color-text-sub)',
                                        lineHeight: 1.5,
                                    }}>
                                        No filters — message will go to{' '}
                                        <strong style={{ color: 'var(--color-text-body)' }}>all tenants</strong>.
                                    </div>
                                )}

                                {/* Preview shortcut */}
                                <button
                                    onClick={() => setShowPreview(true)}
                                    className="cursor-pointer"
                                    style={{
                                        width: '100%', padding: '9px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px dashed var(--color-border)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--color-text-sub)',
                                        fontSize: '12px', fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.borderColor = 'var(--color-accent-mid)'
                                        e.currentTarget.style.color = 'var(--color-accent)'
                                        e.currentTarget.style.backgroundColor = 'var(--color-accent-light)'
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.borderColor = 'var(--color-border)'
                                        e.currentTarget.style.color = 'var(--color-text-sub)'
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Preview who will receive this
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
