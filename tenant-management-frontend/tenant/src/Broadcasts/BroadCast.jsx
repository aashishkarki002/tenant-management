import React, { useState, useEffect } from 'react'
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
    Receipt,
    Building2,
    Zap,
    Wrench,
    Droplets,
    PenLine,
    Users,
    CheckCircle2,
    AlertCircle,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

// ─── Channel definitions ─────────────────────────────────────────────────────
const CHANNELS = [
    { id: 'email', label: 'Email', icon: Mail, available: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, available: false },
    { id: 'sms', label: 'SMS', icon: MessageSquare, available: true },
]

// ─── Email quick-action templates ────────────────────────────────────────────
const EMAIL_TEMPLATES = [
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

// ─── SMS quick-action templates (short, ≤160 chars ideal) ────────────────────
const SMS_TEMPLATES = [
    {
        id: 'rent',
        label: 'Rent Reminder',
        icon: Receipt,
        body: 'Dear {{tenantName}}, your rent of Rs.{{totalRent}} for {{units}} at {{property}} is due. Please pay at the earliest to avoid late fees. - Management',
    },
    {
        id: 'cam',
        label: 'CAM Charges',
        icon: Building2,
        body: 'Dear {{tenantName}}, your CAM charges for {{units}} at {{property}} are due this month. Kindly settle at the earliest. - Management',
    },
    {
        id: 'maintenance',
        label: 'Maintenance',
        icon: Wrench,
        body: 'Dear {{tenantName}}, scheduled maintenance at {{property}} Block {{block}}. Please make necessary arrangements. We apologize for inconvenience. - Management',
    },
    {
        id: 'water',
        label: 'Water Disruption',
        icon: Droplets,
        body: 'Dear {{tenantName}}, water supply at {{property}} will be temporarily interrupted due to maintenance. We apologize for the inconvenience. - Management',
    },
    {
        id: 'custom',
        label: 'Custom',
        icon: PenLine,
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

// ─── Shared class helpers ─────────────────────────────────────────────────────
const cardCls = 'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)]'
const sectionLabelCls = 'text-[var(--color-text-weak)] text-[11px] font-semibold tracking-[0.07em] uppercase mb-2.5 block'

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterTag({ children, onRemove }) {
    return (
        <Badge
            className="gap-1 bg-[var(--color-accent-light)] text-[var(--color-accent)] border-[var(--color-accent-mid)] rounded-[var(--radius-sm)] px-2 py-0.5 font-medium"
        >
            {children}
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="opacity-60 hover:opacity-100 leading-none bg-transparent border-none p-0 text-inherit cursor-pointer"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </Badge>
    )
}

function FilterSelect({ label, value, onValueChange, disabled, placeholder, children }) {
    return (
        <div className="space-y-[5px]">
            <Label className="text-[var(--color-text-weak)] text-[11px] font-semibold tracking-[0.07em] uppercase">
                {label}
            </Label>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger className="w-full h-9 bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-body)] text-sm">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {children}
                </SelectContent>
            </Select>
        </div>
    )
}

function RecipientPreviewPanel({ filters, open, onClose, channel }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const isSms = channel === 'sms'
    const endpoint = isSms
        ? '/api/sms/preview-recipients'
        : '/api/broadcast/preview-recipients'

    useEffect(() => {
        if (!open) return
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await api.post(endpoint, { filters })
                setData(res.data)
            } catch {
                toast.error('Failed to preview recipients')
                onClose()
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [open])

    const withCount = isSms ? data?.withPhoneCount : data?.withEmailCount
    const withoutCount = isSms ? data?.withoutPhoneCount : data?.withoutEmailCount
    const withLabel = isSms ? 'With Phone' : 'With Email'
    const withoutLabel = isSms ? 'No Phone' : 'No Email'
    const missingList = isSms ? data?.tenantsWithoutPhone : data?.tenantsWithoutEmail
    const missingWarning = isSms
        ? "won't receive SMS — no phone on file."
        : "won't receive emails — no email on file."

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-[480px] p-0 gap-0 bg-[var(--color-surface)] border-[var(--color-border)]" showCloseButton={false}>
                <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-[var(--color-border)] space-y-0">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--color-accent)]" />
                        <DialogTitle className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                            Preview Recipients
                        </DialogTitle>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-[var(--color-text-weak)]">
                        <X className="w-4 h-4" />
                    </Button>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-5 py-4">
                        {loading ? (
                            <div className="flex items-center justify-center h-[120px] gap-2.5 text-[var(--color-text-sub)]">
                                <div className="w-[18px] h-[18px] border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
                                <span className="text-sm">Loading recipients…</span>
                            </div>
                        ) : data ? (
                            <>
                                <div className="grid grid-cols-3 gap-2.5 mb-4">
                                    {[
                                        { label: 'Total', val: data.totalCount, valCls: 'text-[var(--color-text-strong)]', bgCls: 'bg-[var(--color-bg)]' },
                                        { label: withLabel, val: withCount, valCls: 'text-[var(--color-success)]', bgCls: 'bg-[var(--color-success-bg)]' },
                                        { label: withoutLabel, val: withoutCount, valCls: 'text-[var(--color-danger)]', bgCls: 'bg-[var(--color-danger-bg)]' },
                                    ].map(({ label, val, valCls, bgCls }) => (
                                        <div key={label} className={`${bgCls} border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-center`}>
                                            <div className={`text-[22px] font-bold ${valCls}`}>{val ?? 0}</div>
                                            <div className="text-[11px] text-[var(--color-text-sub)] mt-0.5">{label}</div>
                                        </div>
                                    ))}
                                </div>

                                {missingList?.length > 0 && (
                                    <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[var(--radius-md)] px-3 py-[10px] mb-3 flex gap-2 items-start">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
                                        <span className="text-[13px] text-[var(--color-warning)] leading-[1.4]">
                                            {missingList.length} tenant(s) {missingWarning}
                                        </span>
                                    </div>
                                )}

                                <div className="flex flex-col">
                                    {data.tenants?.slice(0, 20).map((t) => {
                                        const contactVal = isSms ? t.phone : t.email
                                        const hasContact = Boolean(contactVal)
                                        return (
                                            <div key={t.id} className="flex items-center justify-between py-[10px] border-b border-[var(--color-border)]">
                                                <div>
                                                    <p className="text-[13px] font-medium text-[var(--color-text-body)] m-0">{t.name}</p>
                                                    <p className="text-[11px] text-[var(--color-text-weak)] mt-0.5 m-0">
                                                        {[t.units, t.block].filter(Boolean).join(' · ') || 'No unit'}
                                                    </p>
                                                </div>
                                                <span className={`text-[11px] font-medium ${hasContact ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                                                    {hasContact ? (
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {isSms ? t.phone : 'Has email'}
                                                        </span>
                                                    ) : (isSms ? 'No phone' : 'No email')}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {data.tenants?.length > 20 && (
                                        <p className="text-xs text-[var(--color-text-weak)] text-center pt-[10px]">
                                            +{data.tenants.length - 20} more tenants
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

function ConfirmModal({ summary, onConfirm, onCancel, loading, open, channel }) {
    const isSms = channel === 'sms'

    return (
  <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
  <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">

    {/* Header */}
    <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border)] flex gap-3 items-start">
      
      {/* Icon (reduced emphasis) */}
      <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center shrink-0">
        {isSms
          ? <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
          : <Send className="w-4 h-4 text-[var(--color-accent)]" />
        }
      </div>

      {/* Title + Description */}
      <div>
        <DialogTitle className="text-sm font-semibold text-[var(--color-text-strong)]">
          {isSms ? 'Send Broadcast SMS' : 'Send Broadcast Email'}
        </DialogTitle>

        <DialogDescription className="text-xs text-[var(--color-text-sub)] mt-1 leading-relaxed">
          {isSms
            ? 'This will send an SMS to all matching tenants with a phone number.'
            : 'This will send emails to all matching tenants.'}
        </DialogDescription>
      </div>
    </div>

    {/* Summary */}
    <div className="px-5 py-4 space-y-3">

      {/* Highlight primary field */}
      {isSms ? (
        <div>
          <p className="text-xs text-[var(--color-text-weak)] mb-1">Message</p>
          <div className="text-sm text-[var(--color-text-body)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 line-clamp-3">
            {summary.message}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-[var(--color-text-weak)] mb-1">Subject</p>
          <p className="text-sm font-medium text-[var(--color-text-body)]">
            {summary.subject}
          </p>
        </div>
      )}

      {/* Metadata grid (cleaner than rows) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {summary.property && (
          <>
            <span className="text-[var(--color-text-weak)]">Property</span>
            <span className="text-right text-[var(--color-text-body)] font-medium">
              {summary.property}
            </span>
          </>
        )}

        {summary.block && (
          <>
            <span className="text-[var(--color-text-weak)]">Block</span>
            <span className="text-right text-[var(--color-text-body)] font-medium">
              {summary.block}
            </span>
          </>
        )}

        {summary.status && (
          <>
            <span className="text-[var(--color-text-weak)]">Status</span>
            <span className="text-right text-[var(--color-text-body)] font-medium capitalize">
              {summary.status}
            </span>
          </>
        )}
      </div>
    </div>

    {/* Footer */}
    <div className="px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
      
      <Button
        variant="ghost"
        onClick={onCancel}
        className="flex-1"
      >
        Cancel
      </Button>

      <Button
        onClick={onConfirm}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {loading ? 'Sending…' : 'Confirm & Send'}
      </Button>
    </div>

  </DialogContent>
</Dialog>
    )
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadCast() {
    const [activeChannel, setActiveChannel] = useState('email')
    const [selectedProperty, setSelectedProperty] = useState('')
    const [selectedBlock, setSelectedBlock] = useState('')
    const [selectedInnerBlock, setSelectedInnerBlock] = useState('')
    const [selectedUnit, setSelectedUnit] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')

    // Email content
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [activeEmailTemplate, setActiveEmailTemplate] = useState(null)
    const [bodyRef, setBodyRef] = useState(null)

    // SMS content
    const [smsMessage, setSmsMessage] = useState('')
    const [activeSmsTemplate, setActiveSmsTemplate] = useState(null)
    const [smsMsgRef, setSmsMsgRef] = useState(null)

    // UI state
    const [showPreview, setShowPreview] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [balance, setBalance] = useState(null)

    useEffect(() => {
        const controller = new AbortController()
        api.get('/api/sms/balance', { signal: controller.signal })
            .then(res => setBalance(res.data.messagesRemaining))
            .catch(() => {})
        return () => controller.abort()
    }, [])

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

    const applyEmailTemplate = (tpl) => {
        setActiveEmailTemplate(tpl.id)
        setSubject(tpl.subject)
        setBody(tpl.body)
    }

    const applySmsTemplate = (tpl) => {
        setActiveSmsTemplate(tpl.id)
        setSmsMessage(tpl.body)
    }

    const insertPlaceholder = (placeholder, isEmailChannel) => {
        const ref = isEmailChannel ? bodyRef : smsMsgRef
        const setter = isEmailChannel ? setBody : setSmsMessage
        const current = isEmailChannel ? body : smsMessage
        if (!ref) return
        const start = ref.selectionStart
        const end = ref.selectionEnd
        setter(current.slice(0, start) + placeholder + current.slice(end))
        setTimeout(() => {
            ref.focus()
            ref.setSelectionRange(start + placeholder.length, start + placeholder.length)
        }, 0)
    }

    const handleSend = async () => {
        setIsSending(true)
        try {
            if (activeChannel === 'email') {
                const res = await api.post('/api/broadcast/send-email', { filters, subject, body })
                if (res.data.success) {
                    toast.success(`Sent to ${res.data.sentCount} tenant(s)${res.data.failedCount ? ` · ${res.data.failedCount} failed` : ''}`)
                    setSubject('')
                    setBody('')
                    setActiveEmailTemplate(null)
                } else {
                    toast.error(res.data.message || 'Failed to send')
                }
            } else {
                const res = await api.post('/api/sms/send-broadcast', { filters, message: smsMessage })
                if (res.data.success) {
                    toast.success(`SMS sent to ${res.data.sentCount} tenant(s)${res.data.failedCount ? ` · ${res.data.failedCount} failed` : ''}`)
                    setSmsMessage('')
                    setActiveSmsTemplate(null)
                } else {
                    toast.error(res.data.message || 'Failed to send SMS')
                }
            }
            setShowConfirm(false)
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Something went wrong')
        } finally {
            setIsSending(false)
        }
    }

    const isEmail = activeChannel === 'email'
    const isValid = isEmail
        ? subject.trim().length > 0 && body.trim().length > 0
        : smsMessage.trim().length > 0

    const activeFilterCount = Object.keys(filters).length

    const confirmSummary = {
        subject,
        message: smsMessage,
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
        <div className="min-h-screen bg-[var(--color-bg)]">
            {/* Modals */}
            <RecipientPreviewPanel
                filters={filters}
                open={showPreview}
                onClose={() => setShowPreview(false)}
                channel={activeChannel}
            />
            <ConfirmModal
                summary={confirmSummary}
                open={showConfirm}
                onConfirm={handleSend}
                onCancel={() => setShowConfirm(false)}
                loading={isSending}
                channel={activeChannel}
            />

            {/* ── Page Header ────────────────────────────────────────────────── */}
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-30">
                <div className=" mx-auto px-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 py-3">
                        {/* Title */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-[var(--color-accent-light)] rounded-[var(--radius-md)] flex items-center justify-center">
                                <Send className="w-4 h-4 text-[var(--color-accent)]" />
                            </div>
                            <div>
                                <h1 className="text-[15px] font-bold text-[var(--color-text-strong)] m-0 leading-[1.2]">
                                    Broadcast Message
                                </h1>
                                <p className="text-xs text-[var(--color-text-weak)] m-0">
                                    Send personalised messages to filtered tenants
                                </p>
                            </div>
                        </div>

                        {/* Channel selector tabs */}
                        <div className="flex gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-[3px]">
                            {CHANNELS.map(({ id, label, icon: Icon, available }) => {
                                const isActive = activeChannel === id
                                return (
                                    <button
                                        key={id}
                                        onClick={() => available && setActiveChannel(id)}
                                        title={!available ? `${label} – coming soon` : label}
                                        className={`flex items-center gap-1.5 px-3 py-[6px] rounded-[calc(var(--radius-md)-2px)] border-none text-[13px] relative transition-all duration-150 ${
                                            isActive
                                                ? 'bg-[var(--color-accent)] text-white font-semibold cursor-pointer'
                                                : available
                                                    ? 'bg-transparent text-[var(--color-text-sub)] font-normal cursor-pointer hover:bg-[var(--color-accent-light)]'
                                                    : 'bg-transparent text-[var(--color-text-weak)] font-normal cursor-not-allowed opacity-[0.55]'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{label}</span>
                                        {!available && (
                                            <span className="text-[9px] font-bold bg-[var(--color-border)] text-[var(--color-text-weak)] rounded-[4px] px-1 py-px tracking-[0.04em] uppercase">
                                                Soon
                                            </span>
                                        )}
                                        {id === 'sms' && balance !== null && (
                                            <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-[4px] px-1.5 py-px">
                                                <Wallet className="w-2.5 h-2.5" />
                                                {balance}
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
            <div className=" mx-auto px-4 py-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5">

                    {/* ── Left column: Compose ─────────────────────────────── */}
                    <div className="flex flex-col gap-[14px]">

                        {/* ── EMAIL compose ── */}
                        {isEmail && (
                            <>
                                {/* Quick Templates */}
                                <div className={`${cardCls} px-[18px] py-4`}>
                                    <span className={sectionLabelCls}>Quick Templates</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {EMAIL_TEMPLATES.map((tpl) => {
                                            const Icon = tpl.icon
                                            const isActiveT = activeEmailTemplate === tpl.id
                                            return (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => applyEmailTemplate(tpl)}
                                                    className={`flex items-center gap-2 px-3 py-[9px] rounded-[var(--radius-md)] border text-[13px] cursor-pointer text-left transition-all duration-150 ${
                                                        isActiveT
                                                            ? 'border-[var(--color-accent-mid)] bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold'
                                                            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)] font-normal hover:border-[var(--color-accent-mid)]'
                                                    }`}
                                                >
                                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActiveT ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-sub)]'}`} />
                                                    <span className="leading-[1.3]">{tpl.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Subject */}
                                <div className={`${cardCls} px-[18px] py-4`}>
                                    <Label className="text-[var(--color-text-weak)] text-[11px] font-semibold tracking-[0.07em] uppercase mb-2.5 block">
                                        Subject <span className="text-[var(--color-danger)] font-normal normal-case tracking-normal">*</span>
                                    </Label>
                                    <Input
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        maxLength={200}
                                        placeholder="e.g. Rent Due Reminder for {{tenantName}}"
                                        className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-body)] focus-visible:border-[var(--color-accent)]"
                                    />
                                    <p className="text-[11px] text-[var(--color-text-weak)] mt-[5px] text-right">
                                        {subject.length}/200
                                    </p>
                                </div>

                                {/* Message Body */}
                                <div className={`${cardCls} px-[18px] py-4`}>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <Label className="text-[var(--color-text-weak)] text-[11px] font-semibold tracking-[0.07em] uppercase">
                                            Message Body <span className="text-[var(--color-danger)] font-normal normal-case tracking-normal">*</span>
                                        </Label>
                                        <span className="text-[11px] text-[var(--color-text-weak)]">
                                            {body.length}/10,000
                                        </span>
                                    </div>

                                    <div className="mb-2.5">
                                        <p className="text-[11px] text-[var(--color-text-weak)] mb-1.5">
                                            Insert placeholder at cursor:
                                        </p>
                                        <div className="flex flex-wrap gap-[5px]">
                                            {PLACEHOLDERS.map(p => (
                                                <button
                                                    key={p.key}
                                                    onClick={() => insertPlaceholder(p.key, true)}
                                                    title={`Insert ${p.key}`}
                                                    className="cursor-pointer px-[9px] py-[3px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--color-text-sub)] transition-all duration-150 font-mono hover:bg-[var(--color-accent-light)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-accent)]"
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Textarea
                                        ref={el => setBodyRef(el)}
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        maxLength={10000}
                                        rows={14}
                                        placeholder="Write your message here. Use placeholders like {{tenantName}} for personalisation."
                                        className="resize-y font-mono text-[13px] leading-relaxed bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-body)] focus-visible:border-[var(--color-accent)] field-sizing-fixed"
                                    />
                                </div>
                            </>
                        )}

                        {/* ── SMS compose ── */}
                        {!isEmail && (
                            <>
                                {/* SMS Quick Templates */}
                                <div className={`${cardCls} px-[18px] py-4`}>
                                    <span className={sectionLabelCls}>Quick Templates</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {SMS_TEMPLATES.map((tpl) => {
                                            const Icon = tpl.icon
                                            const isActiveT = activeSmsTemplate === tpl.id
                                            return (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => applySmsTemplate(tpl)}
                                                    className={`flex items-center gap-2 px-3 py-[9px] rounded-[var(--radius-md)] border text-[13px] cursor-pointer text-left transition-all duration-150 ${
                                                        isActiveT
                                                            ? 'border-[var(--color-accent-mid)] bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold'
                                                            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)] font-normal hover:border-[var(--color-accent-mid)]'
                                                    }`}
                                                >
                                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActiveT ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-sub)]'}`} />
                                                    <span className="leading-[1.3]">{tpl.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* SMS Message */}
                                <div className={`${cardCls} px-[18px] py-4`}>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <Label className="text-[var(--color-text-weak)] text-[11px] font-semibold tracking-[0.07em] uppercase">
                                            Message <span className="text-[var(--color-danger)] font-normal normal-case tracking-normal">*</span>
                                        </Label>
                                        <span className={`text-[11px] font-medium ${smsMessage.length > 640 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-weak)]'}`}>
                                            {smsMessage.length}/720
                                            {smsMessage.length > 0 && (
                                                <span className="ml-1.5 text-[var(--color-text-weak)] font-normal">
                                                    · {Math.ceil(smsMessage.length / 160)} SMS part{Math.ceil(smsMessage.length / 160) !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="mb-2.5">
                                        <p className="text-[11px] text-[var(--color-text-weak)] mb-1.5">
                                            Insert placeholder at cursor:
                                        </p>
                                        <div className="flex flex-wrap gap-[5px]">
                                            {PLACEHOLDERS.filter(p => p.key !== '{{email}}').map(p => (
                                                <button
                                                    key={p.key}
                                                    onClick={() => insertPlaceholder(p.key, false)}
                                                    title={`Insert ${p.key}`}
                                                    className="cursor-pointer px-[9px] py-[3px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--color-text-sub)] transition-all duration-150 font-mono hover:bg-[var(--color-accent-light)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-accent)]"
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Textarea
                                        ref={el => setSmsMsgRef(el)}
                                        value={smsMessage}
                                        onChange={e => setSmsMessage(e.target.value)}
                                        maxLength={720}
                                        rows={8}
                                        placeholder="Write your SMS here. Use placeholders like {{tenantName}} for personalisation."
                                        className="resize-y font-mono text-[13px] leading-relaxed bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-body)] focus-visible:border-[var(--color-accent)] field-sizing-fixed"
                                    />

                                    <p className="text-[11px] text-[var(--color-text-sub)] mt-[7px] leading-[1.5]">
                                        Each tenant receives a personalised copy. Placeholders are replaced before sending.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Action bar */}
                        <div className="flex gap-2.5">
                            <Button
                                variant="outline"
                                onClick={() => setShowPreview(true)}
                                className="flex-1 h-11 border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-bg)]"
                            >
                                <Eye className="w-4 h-4" />
                                Preview Recipients
                            </Button>
                            <Button
                                onClick={() => setShowConfirm(true)}
                                disabled={!isValid}
                                className="flex-1 h-11 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-weak)]"
                            >
                                <Send className="w-4 h-4" />
                                {isEmail ? 'Send Broadcast' : 'Send SMS'}
                            </Button>
                        </div>
                    </div>

                    {/* ── Right column: Filter Recipients ──────────────────── */}
                    <div>
                        <div className={`${cardCls} px-[18px] py-4 sticky top-[72px]`}>
                            <div className="flex items-center justify-between mb-[14px]">
                                <div className="flex items-center gap-[7px]">
                                    <Filter className="w-4 h-4 text-[var(--color-text-sub)]" />
                                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">
                                        Filter Recipients
                                    </span>
                                </div>
                                {activeFilterCount > 0 && (
                                    <Badge className="bg-[var(--color-accent-light)] text-[var(--color-accent)] border-[var(--color-accent-mid)] rounded-[var(--radius-sm)] text-[11px] font-semibold px-[7px] py-px">
                                        {activeFilterCount} active
                                    </Badge>
                                )}
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <FilterSelect
                                    label="Property"
                                    value={selectedProperty}
                                    onValueChange={(v) => { setSelectedProperty(v === '__all__' ? '' : v); setSelectedBlock(''); setSelectedInnerBlock(''); setSelectedUnit('') }}
                                    placeholder="All Properties"
                                >
                                    <SelectItem value="__all__">All Properties</SelectItem>
                                    {(properties || []).map(p => (
                                        <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                                    ))}
                                </FilterSelect>

                                <FilterSelect
                                    label="Block"
                                    value={selectedBlock}
                                    onValueChange={(v) => { setSelectedBlock(v === '__all__' ? '' : v); setSelectedInnerBlock('') }}
                                    disabled={!selectedProperty || blocks.length === 0}
                                    placeholder="All Blocks"
                                >
                                    <SelectItem value="__all__">All Blocks</SelectItem>
                                    {blocks.map(b => (
                                        <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                                    ))}
                                </FilterSelect>

                                <FilterSelect
                                    label="Floor / Inner Block"
                                    value={selectedInnerBlock}
                                    onValueChange={(v) => setSelectedInnerBlock(v === '__all__' ? '' : v)}
                                    disabled={!selectedBlock || innerBlocks.length === 0}
                                    placeholder="All Floors"
                                >
                                    <SelectItem value="__all__">All Floors</SelectItem>
                                    {innerBlocks.map(ib => (
                                        <SelectItem key={ib._id} value={ib._id}>{ib.name}</SelectItem>
                                    ))}
                                </FilterSelect>

                                <FilterSelect
                                    label="Unit"
                                    value={selectedUnit}
                                    onValueChange={(v) => setSelectedUnit(v === '__all__' ? '' : v)}
                                    placeholder="All Units"
                                >
                                    <SelectItem value="__all__">All Units</SelectItem>
                                    {(units || []).map(u => (
                                        <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                                    ))}
                                </FilterSelect>

                                <FilterSelect
                                    label="Tenant Status"
                                    value={selectedStatus}
                                    onValueChange={(v) => setSelectedStatus(v === '__all__' ? '' : v)}
                                    placeholder="All Statuses"
                                >
                                    <SelectItem value="__all__">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                </FilterSelect>

                                {/* Active filter tags */}
                                {activeFilterCount > 0 && (
                                    <div className="pt-1.5 border-t border-[var(--color-border)]">
                                        <p className="text-[11px] text-[var(--color-text-weak)] mb-[7px]">
                                            Active filters:
                                        </p>
                                        <div className="flex flex-wrap gap-[5px] mb-2">
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
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={clearAllFilters}
                                            className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] px-0 h-auto"
                                        >
                                            Clear all filters
                                        </Button>
                                    </div>
                                )}

                                {activeFilterCount === 0 && (
                                    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-[10px] text-xs text-[var(--color-text-sub)] leading-[1.5]">
                                        No filters — message will go to{' '}
                                        <strong className="text-[var(--color-text-body)]">all tenants</strong>.
                                    </div>
                                )}

                                {/* Preview shortcut */}
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPreview(true)}
                                    className="w-full border-dashed border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]"
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Preview who will receive this
                                </Button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
