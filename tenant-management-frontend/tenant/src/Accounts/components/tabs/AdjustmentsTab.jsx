import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useEntity } from "../../../context/EntityContext";
import { useAdjustments } from "../../hooks/useAdjustments";
import { fmtRs} from "../../../utils/formatter";

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

// ─── Manual journal entry row ─────────────────────────────────────────────────

function ManualEntryRow({ entry, idx, onChange, onRemove, canRemove }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="text"
                placeholder="Account code"
                value={entry.accountCode}
                onChange={e => onChange(idx, "accountCode", e.target.value)}
                className="w-28 px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <select
                value={entry.side}
                onChange={e => onChange(idx, "side", e.target.value)}
                className="w-16 px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none"
            >
                <option value="DR">DR</option>
                <option value="CR">CR</option>
            </select>
            <input
                type="number"
                min="1"
                placeholder="Paisa"
                value={entry.amountPaisa}
                onChange={e => onChange(idx, "amountPaisa", e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {canRemove && (
                <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="text-[var(--color-danger)] hover:text-red-700 transition-colors text-lg leading-none"
                >
                    ×
                </button>
            )}
        </div>
    );
}

// ─── Post adjustment modal ────────────────────────────────────────────────────

function PostAdjustmentModal({ entityId, onClose, onPosted }) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                    <h2 className="text-base font-bold text-[var(--color-text-heading)]">Post Adjustment</h2>
                    <button onClick={onClose} className="text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] text-xl leading-none">×</button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Type selector */}
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1.5 uppercase tracking-wide">Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {ADJ_TYPES.slice(1).map(t => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => handleTypeChange(t.value)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                                        adjType === t.value
                                            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                                            : "border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-[var(--color-accent)]",
                                    )}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Debit / Credit Note fields */}
                    {!isManual && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Amount (Paisa)</label>
                                    <input
                                        type="number" min="1" required
                                        value={form.amountPaisa}
                                        onChange={e => setForm(f => ({ ...f, amountPaisa: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Revenue Account</label>
                                    <select
                                        value={form.revenueAccountCode}
                                        onChange={e => setForm(f => ({ ...f, revenueAccountCode: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none"
                                    >
                                        {REVENUE_ACCOUNTS.map(a => (
                                            <option key={a.code} value={a.code}>{a.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Tenant ID (optional)</label>
                                <input
                                    type="text"
                                    value={form.tenantId}
                                    onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                                    placeholder="Leave blank for entity-level adjustment"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none"
                                />
                            </div>
                        </>
                    )}

                    {/* Manual journal entries */}
                    {isManual && (
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-2">Journal Entries</label>
                            <div className="space-y-2">
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
                            </div>
                            <button
                                type="button"
                                onClick={addEntry}
                                className="mt-2 text-xs text-[var(--color-accent)] hover:underline font-semibold"
                            >
                                + Add line
                            </button>
                            <div className={cn(
                                "mt-2 text-xs font-semibold",
                                manualBalance.balanced ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                            )}>
                                DR {fmtPaisa(manualBalance.dr)} / CR {fmtPaisa(manualBalance.cr)}
                                {manualBalance.balanced ? " — Balanced" : " — Unbalanced"}
                            </div>
                        </div>
                    )}

                    {/* Period */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Nepali Year</label>
                            <input
                                type="number" min="2070" max="2090"
                                value={isManual ? manualForm.nepaliYear : form.nepaliYear}
                                onChange={e => isManual
                                    ? setManualForm(f => ({ ...f, nepaliYear: e.target.value }))
                                    : setForm(f => ({ ...f, nepaliYear: e.target.value }))}
                                placeholder="e.g. 2081"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Nepali Month</label>
                            <input
                                type="number" min="1" max="12"
                                value={isManual ? manualForm.nepaliMonth : form.nepaliMonth}
                                onChange={e => isManual
                                    ? setManualForm(f => ({ ...f, nepaliMonth: e.target.value }))
                                    : setForm(f => ({ ...f, nepaliMonth: e.target.value }))}
                                placeholder="1–12"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Reason + description */}
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Reason <span className="text-[var(--color-danger)]">*</span></label>
                        <input
                            type="text" required
                            value={isManual ? manualForm.reason : form.reason}
                            onChange={e => isManual
                                ? setManualForm(f => ({ ...f, reason: e.target.value }))
                                : setForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="Short reason (required)"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-sub)] mb-1">Description</label>
                        <textarea
                            rows={2}
                            value={isManual ? manualForm.description : form.description}
                            onChange={e => isManual
                                ? setManualForm(f => ({ ...f, description: e.target.value }))
                                : setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Optional longer note"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] focus:outline-none resize-none"
                        />
                    </div>

                    {err && (
                        <p className="text-sm text-[var(--color-danger)] font-semibold">{err}</p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {submitting ? "Posting…" : "Post Adjustment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Adjustments table row ────────────────────────────────────────────────────

function AdjRow({ item }) {
    const [open, setOpen] = useState(false);
    const hasEntries = item.manualEntries?.length > 0;

    return (
        <>
            <tr
                onClick={() => hasEntries && setOpen(o => !o)}
                className={cn(
                    "border-b border-[var(--color-border)] transition-colors",
                    hasEntries ? "cursor-pointer hover:bg-[var(--color-surface)]" : "",
                )}
            >
                <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600")}>
                        {item.type?.replace(/_/g, " ")}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-body)] font-semibold">
                    {item.amountPaisa != null ? fmtPaisa(item.amountPaisa) : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-sub)]">{item.reason ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-sub)]">
                    {item.nepaliYear && item.nepaliMonth ? `${item.nepaliYear}/${item.nepaliMonth}` : "—"}
                </td>
                <td className="px-4 py-3">
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-bold",
                        item.status === "APPROVED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : item.status === "REJECTED" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                    )}>
                        {item.status ?? "APPROVED"}
                    </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-sub)]">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                </td>
                {hasEntries && (
                    <td className="px-4 py-3 text-xs text-[var(--color-accent)]">
                        {open ? "▲ Hide" : "▼ Lines"}
                    </td>
                )}
                {!hasEntries && <td className="px-4 py-3" />}
            </tr>
            {open && hasEntries && (
                <tr className="bg-[var(--color-surface)]">
                    <td colSpan={7} className="px-6 py-3">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[var(--color-text-sub)] uppercase tracking-wide">
                                    <th className="text-left py-1 pr-4">Account</th>
                                    <th className="text-left py-1 pr-4">Side</th>
                                    <th className="text-right py-1">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.manualEntries.map((e, i) => (
                                    <tr key={i} className="border-t border-[var(--color-border)]">
                                        <td className="py-1 pr-4 font-mono">{e.accountCode}</td>
                                        <td className={cn("py-1 pr-4 font-bold", e.side === "DR" ? "text-orange-600" : "text-blue-600")}>{e.side}</td>
                                        <td className="py-1 text-right font-semibold">{fmtPaisa(e.amountPaisa)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </td>
                </tr>
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
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!resolvedEntityId}
                    className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    + Post Adjustment
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                {ADJ_TYPES.map(t => (
                    <button
                        key={t.value}
                        onClick={() => { setFilterType(t.value); setPage(1); }}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            filterType === t.value
                                ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                                : "border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-[var(--color-accent)]",
                        )}>
                        {t.label}
                    </button>
                ))}
                <span className="ml-auto text-xs text-[var(--color-text-sub)]">{total} record{total !== 1 ? "s" : ""}</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-[var(--color-text-sub)] text-sm">
                        Loading adjustments…
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-16 text-[var(--color-danger)] text-sm">{error}</div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="text-3xl mb-3">📋</div>
                        <p className="text-sm font-semibold text-[var(--color-text-body)]">No adjustments yet</p>
                        <p className="text-xs text-[var(--color-text-sub)] mt-1">Post a debit note, credit note, or manual journal above</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Type</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Amount</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Reason</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Period</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Status</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Date</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <AdjRow key={item._id} item={item} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-sub)] disabled:opacity-40 hover:text-[var(--color-text-body)] transition-colors"
                    >
                        ← Prev
                    </button>
                    <span className="text-xs text-[var(--color-text-sub)] font-semibold">
                        Page {page} of {pages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-sub)] disabled:opacity-40 hover:text-[var(--color-text-body)] transition-colors"
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <PostAdjustmentModal
                    entityId={resolvedEntityId}
                    onClose={() => setShowModal(false)}
                    onPosted={handlePosted}
                />
            )}
        </div>
    );
}
