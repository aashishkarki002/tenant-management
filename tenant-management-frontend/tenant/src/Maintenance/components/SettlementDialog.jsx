/**
 * SettlementDialog.jsx
 *
 * Replaces CompletionDialog. This is the admin-only payment settlement screen.
 *
 * Backend contract:
 *   - Task MUST be in PENDING_SETTLEMENT status
 *   - Endpoint: PATCH /api/maintenance/:id/settle
 *   - Required: paidAmount > 0
 *   - Optional: paymentMethod, bankAccountId, contractor, nepaliDate/Month/Year,
 *               completionNotes, allowOverpayment
 *   - On success → task moves to COMPLETED and an Expense record is created
 *   - On 409 isOverpayment → show confirmation step
 */

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertTriangle,
    Landmark,
    Wallet,
    Banknote,
    CreditCard,
    ChevronDown,
    ChevronUp,
    Wrench,
    BadgeIndianRupee,
    CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import BankAccountSelect from '@/components/BankAccountSelect.jsx';
import DualCalendarTailwind from '@/components/dualDate';
import { parseNepaliFields } from '@/hooks/useNepaliDate';
import {
    PAYMENT_METHODS,
    paymentMethodRequiresBankAccount,
} from '@/constants/paymentMethods.js';
import { CONTRACTOR_TYPE_OPTIONS, getStatusStyle } from '../constants/maintenance.constants';
import { formatStatus } from '../utils/maintenance.utils';

// ── Payment method config ─────────────────────────────────────────────────────
const PAYMENT_METHOD_CONFIG = {
    [PAYMENT_METHODS.CASH]: {
        label: 'Cash',
        icon: Banknote,
    },
    [PAYMENT_METHODS.BANK_TRANSFER]: {
        label: 'Bank Transfer',
        icon: Landmark,
    },
    [PAYMENT_METHODS.CHEQUE]: {
        label: 'Cheque',
        icon: CreditCard,
    },
    [PAYMENT_METHODS.MOBILE_WALLET]: {
        label: 'Mobile Wallet',
        icon: Wallet,
    },
};

// ── Scope display helper ──────────────────────────────────────────────────────
const SCOPE_LABELS = {
    UNIT: 'Unit',
    BLOCK: 'Block',
    PROPERTY: 'Property',
    COMMON_AREA: 'Common Area',
};

// ── Sub-component: info row ───────────────────────────────────────────────────
function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <span className="shrink-0 text-text-sub">{label}</span>
            <span className="text-right font-medium text-text-strong">{value}</span>
        </div>
    );
}

// ── Sub-component: section toggle ─────────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, open, onToggle, children }) {
    return (
        <div className="rounded-lg border border-muted-fill overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-strong hover:bg-muted-fill/50 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-text-sub" />
                    {title}
                </span>
                {open
                    ? <ChevronUp className="h-4 w-4 text-text-sub" />
                    : <ChevronDown className="h-4 w-4 text-text-sub" />}
            </button>
            {open && (
                <div className="border-t border-muted-fill px-4 pb-4 pt-3 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettlementDialog({
    item,
    bankAccounts = [],
    open,
    onOpenChange,
    onComplete,
}) {
    const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS.CASH);
    const [selectedBank, setSelectedBank] = useState('');
    const [overpaymentMeta, setOverpaymentMeta] = useState(null);
    const [contractorOpen, setContractorOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        paymentStatus: 'paid',
        paidAmount: '',
        completionNotes: '',
        settlementDate: '',
        // contractor
        contractorName: '',
        contractorPhone: '',
        contractorType: 'CONTRACTOR',
    });

    // Seed form from task on open
    useEffect(() => {
        if (item) {
            setFormData({
                paymentStatus: item.paymentStatus === 'pending' ? 'paid' : (item.paymentStatus || 'paid'),
                paidAmount: item.amount > 0 ? String(item.amount) : '',
                completionNotes: item.completionNotes || '',
                settlementDate: '',
                contractorName: item.contractor?.name || '',
                contractorPhone: item.contractor?.phone || '',
                contractorType: item.contractor?.type || 'CONTRACTOR',
            });
            setSelectedMethod(PAYMENT_METHODS.CASH);
            setSelectedBank('');
            setOverpaymentMeta(null);
            setContractorOpen(Boolean(item.contractor?.name));
        }
    }, [item]);

    const estimatedAmount = item?.amount || 0;
    const paidAmount = Number(formData.paidAmount) || 0;
    const isOverpaying = paidAmount > estimatedAmount && estimatedAmount > 0;

    const update = (field, value) => {
        if (field === 'paidAmount') setOverpaymentMeta(null);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const showBankSelection = paymentMethodRequiresBankAccount(selectedMethod);

    const buildPayload = (allowOverpayment = false) => {
        const payload = {
            paidAmount: paidAmount,
            paymentStatus: formData.paymentStatus,
            paymentMethod: selectedMethod,
            ...(allowOverpayment && { allowOverpayment: true }),
            ...(formData.completionNotes && { completionNotes: formData.completionNotes }),
        };

        if (showBankSelection && selectedBank) {
            payload.bankAccountId = selectedBank;
        }

        // Contractor
        if (formData.contractorName) {
            payload.contractor = {
                name: formData.contractorName,
                phone: formData.contractorPhone || undefined,
                type: formData.contractorType,
            };
        }

        // Nepali date
        if (formData.settlementDate) {
            const { nepaliMonth, nepaliYear } = parseNepaliFields(formData.settlementDate);
            payload.nepaliDate = formData.settlementDate;
            payload.nepaliMonth = nepaliMonth;
            payload.nepaliYear = nepaliYear;
        }

        return payload;
    };

    const handleSubmit = async (allowOverpayment = false) => {
        if (!item) return;

        if (!paidAmount || paidAmount <= 0) {
            toast.error('Paid amount must be greater than zero');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.patch(`/api/maintenance/${item._id}/settle`, buildPayload(allowOverpayment));

            toast.success(
                allowOverpayment
                    ? 'Payment settled — overpayment recorded in ledger'
                    : 'Payment settled — maintenance task completed',
            );
            onOpenChange(false);
            onComplete?.();
        } catch (err) {
            const data = err?.response?.data;

            if (err?.response?.status === 409 && data?.isOverpayment) {
                setOverpaymentMeta({
                    message: data.message,
                    diffRupees: data.overpaymentDiffRupees,
                });
                return;
            }

            toast.error(data?.message || 'Failed to settle payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    const scopeLabel = SCOPE_LABELS[item.scope] ?? item.scope ?? 'Unit';
    const statusStyle = getStatusStyle(item.status);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="
          sm:max-w-2xl p-0 bg-white
          max-h-[92vh] flex flex-col
          overflow-hidden
        "
            >
                {/* ── Header ───────────────────────────────────────────────────────── */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-muted-fill">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle className="text-lg font-semibold leading-tight">
                                Settle Payment
                            </DialogTitle>
                            <p className="mt-0.5 text-sm text-text-sub truncate">
                                {item.title}
                            </p>
                        </div>
                        <span
                            className={cn(
                                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                                statusStyle,
                            )}
                        >
                            {formatStatus(item.status)}
                        </span>
                    </div>
                </DialogHeader>

                {/* ── Body ─────────────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-muted-fill">

                        {/* ── Left: Task summary ─────────────────────────────────────── */}
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sub">
                                Work Order Summary
                            </p>

                            {/* Estimated cost highlight */}
                            <div className="rounded-xl bg-muted-fill/60 px-4 py-3 flex items-center justify-between">
                                <span className="text-sm text-text-sub">Estimated Cost</span>
                                <span className="text-xl font-bold text-text-strong tabular-nums">
                                    ₹{estimatedAmount.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <InfoRow label="Scope" value={scopeLabel} />
                                <InfoRow label="Unit" value={item.unit?.name} />
                                <InfoRow label="Block" value={item.block?.name} />
                                <InfoRow label="Tenant" value={item.tenant?.name} />
                                <InfoRow label="Assigned" value={item.assignedTo?.name} />
                                <InfoRow
                                    label="Scheduled"
                                    value={item.scheduledDate
                                        ? new Date(item.scheduledDate).toLocaleDateString('en-NP', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })
                                        : null}
                                />
                            </div>

                            {/* Existing contractor info (read-only preview) */}
                            {item.contractor?.name && (
                                <div className="rounded-lg bg-muted-fill/60 p-3 text-sm space-y-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sub mb-2">
                                        Contractor on Record
                                    </p>
                                    <InfoRow label="Name" value={item.contractor.name} />
                                    <InfoRow label="Phone" value={item.contractor.phone} />
                                    <InfoRow label="Type" value={item.contractor.type} />
                                </div>
                            )}
                        </div>

                        {/* ── Right: Payment form ────────────────────────────────────── */}
                        <div className="px-6 py-5 space-y-5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sub">
                                Payment Details
                            </p>

                            {/* Payment Status */}
                            <div className="space-y-2">
                                <Label className="text-sm">Payment Status</Label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {['paid', 'partially_paid', 'pending'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => update('paymentStatus', s)}
                                            className={cn(
                                                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                                                formData.paymentStatus === s
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-muted-fill hover:border-slate-300 text-text-body',
                                            )}
                                        >
                                            {s.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Paid Amount */}
                            <div className="space-y-1.5">
                                <Label className="text-sm">Paid Amount</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub text-sm">₹</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={formData.paidAmount}
                                        onChange={(e) => update('paidAmount', e.target.value)}
                                        className="pl-7 h-10"
                                    />
                                </div>
                                {isOverpaying && !overpaymentMeta && (
                                    <p className="flex items-center gap-1 text-xs text-amber-600">
                                        <AlertTriangle className="h-3 w-3" />
                                        Exceeds estimated cost — you'll be asked to confirm.
                                    </p>
                                )}
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-2">
                                <Label className="text-sm">Payment Method</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(PAYMENT_METHOD_CONFIG).map(([value, config]) => {
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setSelectedMethod(value)}
                                                className={cn(
                                                    'flex items-center gap-2.5 rounded-lg border p-2.5 text-sm transition-colors',
                                                    selectedMethod === value
                                                        ? 'border-slate-900 bg-slate-50'
                                                        : 'border-muted-fill hover:border-slate-300',
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                {config.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bank Account */}
                            {showBankSelection && (
                                <div className="space-y-2">
                                    <Label className="text-sm">Deposit To</Label>
                                    <BankAccountSelect
                                        bankAccounts={bankAccounts}
                                        value={selectedBank || ''}
                                        onValueChange={setSelectedBank}
                                        triggerClassName="w-full"
                                    />
                                </div>
                            )}

                            {/* Settlement Date */}
                            <div className="space-y-1.5">
                                <Label className="text-sm flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 text-text-sub" />
                                    Settlement Date
                                </Label>
                                <DualCalendarTailwind
                                    value={formData.settlementDate}
                                    onChange={(eng) => update('settlementDate', eng)}
                                />
                            </div>

                            {/* Contractor — collapsible */}
                            <CollapsibleSection
                                title="Contractor / Payee"
                                icon={Wrench}
                                open={contractorOpen}
                                onToggle={() => setContractorOpen((v) => !v)}
                            >
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-text-sub">Name</Label>
                                        <Input
                                            placeholder="Contractor or vendor name"
                                            value={formData.contractorName}
                                            onChange={(e) => update('contractorName', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-text-sub">Phone</Label>
                                        <Input
                                            placeholder="98XXXXXXXX"
                                            value={formData.contractorPhone}
                                            onChange={(e) => update('contractorPhone', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-text-sub">Type</Label>
                                        <Select
                                            value={formData.contractorType}
                                            onValueChange={(v) => update('contractorType', v)}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CONTRACTOR_TYPE_OPTIONS.map((t) => (
                                                    <SelectItem key={t.value} value={t.value}>
                                                        {t.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CollapsibleSection>

                            {/* Completion Notes */}
                            <div className="space-y-1.5">
                                <Label className="text-sm">Completion Notes</Label>
                                <Textarea
                                    placeholder="Any notes about the completed work…"
                                    value={formData.completionNotes}
                                    onChange={(e) => update('completionNotes', e.target.value)}
                                    rows={2}
                                    className="resize-none text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Overpayment confirmation ──────────────────────────────────── */}
                    {overpaymentMeta && (
                        <div className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                            <div className="flex gap-3">
                                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-amber-800">
                                        Overpayment Detected
                                    </p>
                                    <p className="text-xs text-amber-700">{overpaymentMeta.message}</p>
                                    <p className="text-xs text-amber-700 font-medium">
                                        Excess amount: ₹{overpaymentMeta.diffRupees?.toLocaleString('en-IN')}
                                    </p>
                                    <p className="text-xs text-amber-600">
                                        If you confirm, the overpayment will be recorded in the ledger.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs"
                                    onClick={() => setOverpaymentMeta(null)}
                                >
                                    Edit Amount
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                                    onClick={() => handleSubmit(true)}
                                    disabled={isSubmitting}
                                >
                                    Confirm Overpayment
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────────────────── */}
                {!overpaymentMeta && (
                    <DialogFooter className="px-6 py-4 border-t border-muted-fill flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 hidden sm:flex items-center text-xs text-text-sub gap-1.5">
                            <BadgeIndianRupee className="h-3.5 w-3.5" />
                            An expense record will be created in the ledger on settlement.
                        </div>
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white"
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting || !paidAmount || paidAmount <= 0}
                        >
                            {isSubmitting ? 'Settling…' : 'Settle & Complete'}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}