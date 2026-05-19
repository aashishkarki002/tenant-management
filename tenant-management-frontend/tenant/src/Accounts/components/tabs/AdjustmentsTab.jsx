import { useState, useCallback } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntity } from "../../../context/EntityContext";
import { useAdjustments } from "../../hooks/useAdjustments";
import { fmtRs } from "../../../utils/formatter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADJ_TYPES = [
    { value: "", label: "All Types" },
    { value: "DEBIT_NOTE", label: "Debit Note" },
    { value: "CREDIT_NOTE", label: "Credit Note" },
    { value: "MANUAL_JOURNAL", label: "Manual Journal" },
];

const TYPE_COLORS = {
    DEBIT_NOTE:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    CREDIT_NOTE:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    MANUAL_JOURNAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_COLORS = {
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    PENDING:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const REVENUE_ACCOUNTS = [
    { code: "4000", label: "Rent Income (4000)" },
    { code: "4050", label: "CAM Charges (4050)" },
    { code: "4100", label: "Late Fees (4100)" },
    { code: "4200", label: "Parking (4200)" },
    { code: "4300", label: "Utility Reimbursement (4300)" },
    { code: "4400", label: "Other Income (4400)" },
];

const EMPTY_DEBIT_CREDIT = {
    type: "DEBIT_NOTE",
    amountPaisa: "",
    revenueAccountCode: "4000",
    reason: "",
    description: "",
    tenantId: "",
    nepaliYear: "",
    nepaliMonth: "",
};

const EMPTY_MANUAL = {
    type: "MANUAL_JOURNAL",
    reason: "",
    description: "",
    nepaliYear: "",
    nepaliMonth: "",
    entries: [
        { accountCode: "", side: "DR", amountPaisa: "" },
        { accountCode: "", side: "CR", amountPaisa: "" },
    ],
};

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, children }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[var(--color-text-sub)] uppercase tracking-wide">
                {label}
                {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
            </Label>
            {children}
        </div>
    );
}

// ─── Manual journal entry row ─────────────────────────────────────────────────

function ManualEntryRow({ entry, idx, onChange, onRemove, canRemove }) {
    return (
        <div className="flex items-center gap-2">
            <Input
                placeholder="Account code"
                value={entry.accountCode}
                onChange={e => onChange(idx, "accountCode", e.target.value)}
                className="w-28 h-8 text-xs"
            />
            <Select value={entry.side} onValueChange={val => onChange(idx, "side", val)}>
                <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="DR">DR</SelectItem>
                    <SelectItem value="CR">CR</SelectItem>
                </SelectContent>
            </Select>
            <Input
                type="number"
                min="1"
                placeholder="Paisa"
                value={entry.amountPaisa}
                onChange={e => onChange(idx, "amountPaisa", e.target.value)}
                className="flex-1 h-8 text-xs"
            />
            {canRemove && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemove(idx)}
                    className="text-[var(--color-danger)] hover:text-red-700 hover:bg-red-50"
                >
                    ×
                </Button>
            )}
        </div>
    );
}

// ─── Post adjustment modal ────────────────────────────────────────────────────

function PostAdjustmentModal({ entityId, open, onClose, onPosted }) {
    const [adjType, setAdjType] = useState("DEBIT_NOTE");
    const [form, setForm] = useState({ ...EMPTY_DEBIT_CREDIT });
    const [manualForm, setManualForm] = useState({ ...EMPTY_MANUAL });
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    const { postAdjustment } = useAdjustments({ entityId });

    const isManual = adjType === "MANUAL_JOURNAL";

    const handleTypeChange = (t) => {
        setAdjType(t);
        setErr(null);
        if (t === "MANUAL_JOURNAL") {
            setManualForm({ ...EMPTY_MANUAL, type: t });
        } else {
            setForm({ ...EMPTY_DEBIT_CREDIT, type: t });
        }
    };

    const updateEntry = useCallback((idx, field, val) => {
        setManualForm(prev => {
            const entries = prev.entries.map((e, i) => i === idx ? { ...e, [field]: val } : e);
            return { ...prev, entries };
        });
    }, []);

    const addEntry = () => setManualForm(prev => ({
        ...prev,
        entries: [...prev.entries, { accountCode: "", side: "DR", amountPaisa: "" }],
    }));

    const removeEntry = (idx) => setManualForm(prev => ({
        ...prev,
        entries: prev.entries.filter((_, i) => i !== idx),
    }));

    const manualBalance = (() => {
        const dr = manualForm.entries.filter(e => e.side === "DR").reduce((s, e) => s + (parseInt(e.amountPaisa) || 0), 0);
        const cr = manualForm.entries.filter(e => e.side === "CR").reduce((s, e) => s + (parseInt(e.amountPaisa) || 0), 0);
        return { dr, cr, balanced: dr === cr && dr > 0 };
    })();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr(null);
        setSubmitting(true);
        try {
            const payload = { entityId };
            if (isManual) {
                if (!manualBalance.balanced) throw new Error("Debit total must equal credit total");
                payload.type = "MANUAL_JOURNAL";
                payload.reason = manualForm.reason;
                payload.description = manualForm.description;
                if (manualForm.nepaliYear) payload.nepaliYear = parseInt(manualForm.nepaliYear);
                if (manualForm.nepaliMonth) payload.nepaliMonth = parseInt(manualForm.nepaliMonth);
                payload.entries = manualForm.entries.map(e => ({
                    accountCode: e.accountCode.trim(),
                    side: e.side,
                    amountPaisa: parseInt(e.amountPaisa),
                }));
            } else {
                if (!form.amountPaisa || parseInt(form.amountPaisa) < 1) throw new Error("Amount required");
                payload.type = form.type;
                payload.amountPaisa = parseInt(form.amountPaisa);
                payload.revenueAccountCode = form.revenueAccountCode;
                payload.reason = form.reason;
                payload.description = form.description;
                if (form.tenantId) payload.tenantId = form.tenantId;
                if (form.nepaliYear) payload.nepaliYear = parseInt(form.nepaliYear);
                if (form.nepaliMonth) payload.nepaliMonth = parseInt(form.nepaliMonth);
            }
            await postAdjustment(payload);
            onPosted();
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg bg-[var(--color-bg)] border-[var(--color-border)]">
                <DialogHeader>
                    <DialogTitle className="text-[var(--color-text-heading)]">Post Adjustment</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                    {/* Type selector */}
                    <Field label="Type">
                        <div className="flex gap-2 flex-wrap">
                            {ADJ_TYPES.slice(1).map(t => (
                                <Button
                                    key={t.value}
                                    type="button"
                                    size="sm"
                                    variant={adjType === t.value ? "default" : "outline"}
                                    onClick={() => handleTypeChange(t.value)}
                                    className={adjType === t.value
                                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                        : "border-[var(--color-border)] text-[var(--color-text-sub)]"
                                    }
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </Field>

                    {/* Debit / Credit Note fields */}
                    {!isManual && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Amount (Paisa)" required>
                                    <Input
                                        type="number"
                                        min="1"
                                        required
                                        value={form.amountPaisa}
                                        onChange={e => setForm(f => ({ ...f, amountPaisa: e.target.value }))}
                                        className="h-9 text-sm"
                                    />
                                </Field>
                                <Field label="Revenue Account">
                                    <Select
                                        value={form.revenueAccountCode}
                                        onValueChange={val => setForm(f => ({ ...f, revenueAccountCode: val }))}
                                    >
                                        <SelectTrigger className="h-9 w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REVENUE_ACCOUNTS.map(a => (
                                                <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <Field label="Tenant ID (optional)">
                                <Input
                                    value={form.tenantId}
                                    onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                                    placeholder="Leave blank for entity-level adjustment"
                                    className="h-9 text-sm"
                                />
                            </Field>
                        </>
                    )}

                    {/* Manual journal entries */}
                    {isManual && (
                        <Field label="Journal Entries">
                            <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                                {manualForm.entries.map((entry, idx) => (
                                    <ManualEntryRow
                                        key={idx}
                                        entry={entry}
                                        idx={idx}
                                        onChange={updateEntry}
                                        onRemove={removeEntry}
                                        canRemove={manualForm.entries.length > 2}
                                    />
                                ))}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={addEntry}
                                    className="text-[var(--color-accent)] hover:text-[var(--color-accent)] mt-1 gap-1"
                                >
                                    <PlusIcon className="size-3" />
                                    Add line
                                </Button>
                            </div>
                            <p className={cn(
                                "text-xs font-semibold mt-1.5",
                                manualBalance.balanced ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                            )}>
                                DR {fmtRs(manualBalance.dr)} / CR {fmtRs(manualBalance.cr)}
                                {manualBalance.balanced ? " — Balanced" : " — Unbalanced"}
                            </p>
                        </Field>
                    )}

                    {/* Period */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nepali Year">
                            <Input
                                type="number"
                                min="2070"
                                max="2090"
                                value={isManual ? manualForm.nepaliYear : form.nepaliYear}
                                onChange={e => isManual
                                    ? setManualForm(f => ({ ...f, nepaliYear: e.target.value }))
                                    : setForm(f => ({ ...f, nepaliYear: e.target.value }))}
                                placeholder="e.g. 2081"
                                className="h-9 text-sm"
                            />
                        </Field>
                        <Field label="Nepali Month">
                            <Input
                                type="number"
                                min="1"
                                max="12"
                                value={isManual ? manualForm.nepaliMonth : form.nepaliMonth}
                                onChange={e => isManual
                                    ? setManualForm(f => ({ ...f, nepaliMonth: e.target.value }))
                                    : setForm(f => ({ ...f, nepaliMonth: e.target.value }))}
                                placeholder="1–12"
                                className="h-9 text-sm"
                            />
                        </Field>
                    </div>

                    {/* Reason + description */}
                    <Field label="Reason" required>
                        <Input
                            required
                            value={isManual ? manualForm.reason : form.reason}
                            onChange={e => isManual
                                ? setManualForm(f => ({ ...f, reason: e.target.value }))
                                : setForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="Short reason (required)"
                            className="h-9 text-sm"
                        />
                    </Field>
                    <Field label="Description">
                        <Textarea
                            rows={2}
                            value={isManual ? manualForm.description : form.description}
                            onChange={e => isManual
                                ? setManualForm(f => ({ ...f, description: e.target.value }))
                                : setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Optional longer note"
                            className="text-sm resize-none min-h-0"
                        />
                    </Field>

                    {err && (
                        <p className="text-sm text-[var(--color-danger)] font-semibold rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                            {err}
                        </p>
                    )}
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} className="border-[var(--color-border)] text-[var(--color-text-sub)]">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="adj-form"
                        disabled={submitting}
                        onClick={handleSubmit}
                        className="bg-[var(--color-accent)] text-white hover:opacity-90"
                    >
                        {submitting && <Loader2Icon className="size-4 animate-spin" />}
                        {submitting ? "Posting…" : "Post Adjustment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Adjustments table row ────────────────────────────────────────────────────

function AdjRow({ item }) {
    const [open, setOpen] = useState(false);
    const hasEntries = item.manualEntries?.length > 0;

    const status = item.status ?? "APPROVED";

    return (
        <>
            <TableRow
                onClick={() => hasEntries && setOpen(o => !o)}
                className={cn(
                    "border-b border-[var(--color-border)] transition-colors",
                    hasEntries ? "cursor-pointer" : "",
                )}
            >
                <TableCell className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600")}>
                        {item.type?.replace(/_/g, " ")}
                    </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-[var(--color-text-body)] font-semibold tabular-nums">
                    {item.amountPaisa != null ? fmtRs(item.amountPaisa) : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-[var(--color-text-sub)] max-w-[200px] truncate">
                    {item.reason ?? "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-xs text-[var(--color-text-sub)] tabular-nums">
                    {item.nepaliYear && item.nepaliMonth ? `${item.nepaliYear}/${item.nepaliMonth}` : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", STATUS_COLORS[status] ?? STATUS_COLORS.PENDING)}>
                        {status}
                    </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-xs text-[var(--color-text-sub)] tabular-nums">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 w-16">
                    {hasEntries && (
                        <span className="flex items-center gap-1 text-xs text-[var(--color-accent)] font-semibold">
                            {open ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                            {open ? "Hide" : "Lines"}
                        </span>
                    )}
                </TableCell>
            </TableRow>

            {open && hasEntries && (
                <TableRow className="bg-[var(--color-surface)] hover:bg-[var(--color-surface)]">
                    <TableCell colSpan={7} className="px-6 py-3">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="h-7 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-sub)] px-2">Account</TableHead>
                                    <TableHead className="h-7 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-sub)] px-2">Side</TableHead>
                                    <TableHead className="h-7 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-sub)] px-2 text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {item.manualEntries.map((e, i) => (
                                    <TableRow key={i} className="border-t border-[var(--color-border)]">
                                        <TableCell className="py-1.5 px-2 font-mono text-xs">{e.accountCode}</TableCell>
                                        <TableCell className={cn("py-1.5 px-2 text-xs font-bold", e.side === "DR" ? "text-orange-600" : "text-blue-600")}>
                                            {e.side}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 text-xs font-semibold text-right tabular-nums">
                                            {fmtRs(e.amountPaisa)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function AdjustmentsTab({ entityId }) {
    const { activeEntityId } = useEntity();
    const resolvedEntityId = entityId ?? activeEntityId ?? null;

    const [filterType, setFilterType] = useState("");
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);

    const { items, total, pages, loading, error, fetchList } = useAdjustments({
        entityId: resolvedEntityId,
        type: filterType || undefined,
        page,
        limit: 20,
    });

    const handlePosted = useCallback(async () => {
        setShowModal(false);
        setPage(1);
        await fetchList();
    }, [fetchList]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text-heading)]">Adjustments</h2>
                    <p className="text-sm text-[var(--color-text-sub)] mt-0.5">
                        Debit notes, credit notes, and manual journal entries
                    </p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    disabled={!resolvedEntityId}
                    className="bg-[var(--color-accent)] text-white hover:opacity-90 gap-1.5"
                    size="sm"
                >
                    <PlusIcon className="size-4" />
                    Post Adjustment
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                {ADJ_TYPES.map(t => (
                    <Button
                        key={t.value}
                        size="xs"
                        variant={filterType === t.value ? "default" : "outline"}
                        onClick={() => { setFilterType(t.value); setPage(1); }}
                        className={filterType === t.value
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                            : "border-[var(--color-border)] text-[var(--color-text-sub)]"
                        }
                    >
                        {t.label}
                    </Button>
                ))}
                <span className="ml-auto text-xs text-[var(--color-text-sub)]">
                    {total} record{total !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-text-sub)] text-sm">
                        <Loader2Icon className="size-4 animate-spin" />
                        Loading adjustments…
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-16 text-[var(--color-danger)] text-sm">{error}</div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                        <div className="text-3xl">📋</div>
                        <p className="text-sm font-semibold text-[var(--color-text-body)]">No adjustments yet</p>
                        <p className="text-xs text-[var(--color-text-sub)]">Post a debit note, credit note, or manual journal above</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface)]">
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Type</TableHead>
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Amount</TableHead>
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Reason</TableHead>
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Period</TableHead>
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Status</TableHead>
                                <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Date</TableHead>
                                <TableHead className="px-4 py-3 w-16" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <AdjRow key={item._id} item={item} />
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="border-[var(--color-border)] text-[var(--color-text-sub)]"
                    >
                        ← Prev
                    </Button>
                    <span className="text-xs text-[var(--color-text-sub)] font-semibold px-2">
                        Page {page} of {pages}
                    </span>
                    <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="border-[var(--color-border)] text-[var(--color-text-sub)]"
                    >
                        Next →
                    </Button>
                </div>
            )}

            {/* Modal */}
            <PostAdjustmentModal
                entityId={resolvedEntityId}
                open={showModal}
                onClose={() => setShowModal(false)}
                onPosted={handlePosted}
            />
        </div>
    );
}
