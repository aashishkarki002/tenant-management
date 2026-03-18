import { useState, useEffect, useCallback } from "react";
import api from "../../plugins/axios";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPES = [
    {
        type: "CASH_REFUND",
        label: "Cash / Bank Refund",
        icon: "₹",
        color: "#10b981",
        description: "Return funds to tenant via cash or bank transfer",
        needsPayment: true,
    },
    {
        type: "MAINTENANCE_ADJUSTMENT",
        label: "Maintenance Deduction",
        icon: "🔧",
        color: "#f59e0b",
        description: "Withhold for repairs — recognised as maintenance revenue",
        needsPayment: false,
    },
    {
        type: "MAINTENANCE_EXPENSE_OFFSET",
        label: "Contractor Expense Offset",
        icon: "📋",
        color: "#8b5cf6",
        description: "Withhold to pay a contractor — offsets existing expense",
        needsPayment: false,
    },
    {
        type: "RENT_ADJUSTMENT",
        label: "Apply to Rent Arrears",
        icon: "🏠",
        color: "#ef4444",
        description: "Clear outstanding rent dues from SD balance",
        needsPayment: false,
    },
    {
        type: "CAM_ADJUSTMENT",
        label: "Apply to CAM Dues",
        icon: "🏢",
        color: "#3b82f6",
        description: "Clear outstanding CAM dues from SD balance",
        needsPayment: false,
    },
    {
        type: "ELECTRICITY_ADJUSTMENT",
        label: "Apply to Electricity Dues",
        icon: "⚡",
        color: "#06b6d4",
        description: "Clear outstanding electricity dues from SD balance",
        needsPayment: false,
    },
];

const PAYMENT_METHODS = [
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
];

function formatRs(paisa) {
    if (!paisa) return "रू 0";
    const rupees = paisa / 100;
    return `रू ${rupees.toLocaleString("en-IN")}`;
}

function formatPct(part, total) {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function BalanceBar({ totalPaisa, settledPaisa, pendingPaisa }) {
    const settledPct = totalPaisa ? (settledPaisa / totalPaisa) * 100 : 0;
    const pendingPct = totalPaisa ? (pendingPaisa / totalPaisa) * 100 : 0;

    return (
        <div className="balance-bar-wrap">
            <div className="balance-bar">
                <div
                    className="balance-bar-segment settled"
                    style={{ width: `${settledPct}%` }}
                />
                <div
                    className="balance-bar-segment pending"
                    style={{ width: `${pendingPct}%` }}
                />
                <div className="balance-bar-segment remaining" style={{ flex: 1 }} />
            </div>
            <div className="balance-bar-legend">
                <span className="legend-dot settled" /> Already settled ({formatPct(settledPaisa, totalPaisa)})
                <span className="legend-dot pending" /> This refund ({formatPct(pendingPaisa, totalPaisa)})
                <span className="legend-dot remaining" /> Remaining
            </div>
        </div>
    );
}

function AdjustmentTypeCard({ item, isSelected, onClick }) {
    return (
        <button
            type="button"
            className={`type-card${isSelected ? " selected" : ""}`}
            style={{ "--card-color": item.color }}
            onClick={onClick}
        >
            <span className="type-card-icon">{item.icon}</span>
            <span className="type-card-label">{item.label}</span>
            <span className="type-card-desc">{item.description}</span>
            {isSelected && <span className="type-card-check">✓</span>}
        </button>
    );
}

function LineItemRow({ item, index, remainingPaisa, onUpdate, onRemove, bankAccounts }) {
    const typeMeta = ADJUSTMENT_TYPES.find((t) => t.type === item.type);

    const handleAmountChange = (e) => {
        const paisa = Math.round(parseFloat(e.target.value || 0) * 100);
        onUpdate(index, { amountPaisa: paisa });
    };

    return (
        <div className="line-item-row" style={{ "--item-color": typeMeta?.color ?? "#6b7280" }}>
            <div className="line-item-header">
                <span className="line-item-icon">{typeMeta?.icon}</span>
                <span className="line-item-type">{typeMeta?.label ?? item.type}</span>
                <button className="line-item-remove" onClick={() => onRemove(index)}>✕</button>
            </div>

            <div className="line-item-body">
                <div className="field-group">
                    <label>Amount (रू)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.amountPaisa ? (item.amountPaisa / 100).toFixed(2) : ""}
                        onChange={handleAmountChange}
                        className="field-input"
                    />
                    <span className="field-hint">
                        Max available: {formatRs(remainingPaisa)}
                    </span>
                </div>

                {typeMeta?.needsPayment && (
                    <>
                        <div className="field-group">
                            <label>Payment Method</label>
                            <select
                                className="field-input"
                                value={item.paymentMethod ?? "bank_transfer"}
                                onChange={(e) => onUpdate(index, { paymentMethod: e.target.value })}
                            >
                                {PAYMENT_METHODS.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        {(item.paymentMethod === "bank_transfer" || item.paymentMethod === "cheque") && (
                            <div className="field-group">
                                <label>Bank Account</label>
                                <select
                                    className="field-input"
                                    value={item.bankAccountCode ?? ""}
                                    onChange={(e) => onUpdate(index, { bankAccountCode: e.target.value })}
                                >
                                    <option value="">— Select bank —</option>
                                    {bankAccounts.map((b) => (
                                        <option key={b.accountCode} value={b.accountCode}>
                                            {b.bankName} — {b.accountName} ({b.accountCode})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}

                <div className="field-group">
                    <label>Note <span className="optional">(optional)</span></label>
                    <input
                        type="text"
                        className="field-input"
                        placeholder="e.g. Broken window repair — Invoice #INV-2082"
                        value={item.note ?? ""}
                        onChange={(e) => onUpdate(index, { note: e.target.value })}
                    />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEPS
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ["Overview", "Breakdown", "Review", "Confirm"];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIZARD
// ─────────────────────────────────────────────────────────────────────────────

export default function SdRefundWizard({ sdId, blockId, onSuccess, onClose }) {
    const [step, setStep] = useState(0);
    const [preflight, setPreflight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Wizard state
    const [lineItems, setLineItems] = useState([]);
    const [refundDate, setRefundDate] = useState(
        new Date().toISOString().split("T")[0],
    );
    const [internalNotes, setInternalNotes] = useState("");
    const [bankAccounts, setBankAccounts] = useState([]);
    const [draftId, setDraftId] = useState(null);

    // ── Load preflight data ─────────────────────────────────────────────────
    useEffect(() => {
        if (!sdId) return;
        setLoading(true);
        Promise.all([
            api.get(`/api/sd-refund/preflight/${sdId}`),
            api.get("/api/bank/get-bank-accounts"),
        ])
            .then(([preflightRes, banksRes]) => {
                setPreflight(preflightRes.data.data);
                setBankAccounts(banksRes.data.data ?? []);
            })
            .catch((e) => setError(e.response?.data?.message ?? e.message))
            .finally(() => setLoading(false));
    }, [sdId]);

    // ── Line item helpers ───────────────────────────────────────────────────
    const addLineItem = useCallback((type) => {
        setLineItems((prev) => [
            ...prev,
            { type, amountPaisa: 0, note: "", paymentMethod: "bank_transfer", bankAccountCode: null },
        ]);
    }, []);

    const updateLineItem = useCallback((index, patch) => {
        setLineItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );
    }, []);

    const removeLineItem = useCallback((index) => {
        setLineItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const totalRequestedPaisa = lineItems.reduce(
        (s, l) => s + (l.amountPaisa ?? 0),
        0,
    );

    const remainingAfter = preflight
        ? preflight.remainingPaisa - totalRequestedPaisa
        : 0;

    // ── Validation per step ─────────────────────────────────────────────────
    const canProceed = useCallback(() => {
        if (step === 0) return preflight?.canRefund;
        if (step === 1) {
            if (!lineItems.length) return false;
            if (totalRequestedPaisa <= 0) return false;
            if (totalRequestedPaisa > (preflight?.remainingPaisa ?? 0)) return false;
            // All CASH_REFUND items must have bankAccountCode (if bank method)
            for (const l of lineItems) {
                if (l.type === "CASH_REFUND") {
                    if (!l.amountPaisa) return false;
                    if (
                        (l.paymentMethod === "bank_transfer" || l.paymentMethod === "cheque") &&
                        !l.bankAccountCode
                    )
                        return false;
                }
                if (!l.amountPaisa) return false;
            }
            return true;
        }
        return true;
    }, [step, preflight, lineItems, totalRequestedPaisa]);

    // ── Submit: create draft ────────────────────────────────────────────────
    async function handleCreateDraft() {
        setPosting(true);
        setError(null);
        try {
            const res = await api.post("/api/sd-refund/draft", {
                sdId,
                blockId,
                refundDate,
                lineItems,
                internalNotes,
            });
            setDraftId(res.data.data._id);
            setStep(3);
        } catch (e) {
            setError(e.response?.data?.message ?? e.message);
        } finally {
            setPosting(false);
        }
    }

    // ── Submit: confirm + post ──────────────────────────────────────────────
    async function handleConfirm() {
        if (!draftId) return;
        setPosting(true);
        setError(null);
        try {
            await api.post(`/api/sd-refund/${draftId}/confirm`, { blockId });
            setSuccess(true);
            onSuccess?.();
        } catch (e) {
            setError(e.response?.data?.message ?? e.message);
        } finally {
            setPosting(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{wizardCSS}</style>
            <div className="sdwiz-overlay" onClick={onClose}>
                <div className="sdwiz" onClick={(e) => e.stopPropagation()}>

                    {/* ── Header ── */}
                    <div className="sdwiz-header">
                        <div className="sdwiz-title-block">
                            <span className="sdwiz-eyebrow">Security Deposit</span>
                            <h2 className="sdwiz-title">Settlement Wizard</h2>
                        </div>
                        <button className="sdwiz-close" onClick={onClose}>✕</button>
                    </div>

                    {/* ── Step track ── */}
                    <div className="step-track">
                        {STEPS.map((s, i) => (
                            <div key={s} className={`step-pip${i <= step ? " done" : ""}${i === step ? " active" : ""}`}>
                                <span className="step-num">{i + 1}</span>
                                <span className="step-name">{s}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Body ── */}
                    <div className="sdwiz-body">

                        {loading && (
                            <div className="sdwiz-loading">
                                <div className="spinner" />
                                <p>Loading security deposit details…</p>
                            </div>
                        )}

                        {!loading && success && (
                            <div className="sdwiz-success">
                                <div className="success-icon">✓</div>
                                <h3>Settlement Posted</h3>
                                <p>The security deposit settlement has been recorded and the ledger has been updated.</p>
                                <button className="btn-primary" onClick={onClose}>Close</button>
                            </div>
                        )}

                        {!loading && !success && error && step < 3 && (
                            <div className="sdwiz-error">{error}</div>
                        )}

                        {/* ── STEP 0: Overview ── */}
                        {!loading && !success && step === 0 && preflight && (
                            <div className="step-content">
                                <div className="tenant-card">
                                    <div className="tenant-card-avatar">
                                        {preflight.sd?.tenant?.name?.[0] ?? "T"}
                                    </div>
                                    <div>
                                        <p className="tenant-name">{preflight.sd?.tenant?.name ?? "Tenant"}</p>
                                        <p className="tenant-phone">{preflight.sd?.tenant?.phone ?? ""}</p>
                                        <p className="tenant-block">Block: {preflight.sd?.block?.name ?? "—"}</p>
                                    </div>
                                    <div className="sd-mode-badge">{preflight.sd?.mode?.replace("_", " ")}</div>
                                </div>

                                <div className="amount-strip">
                                    <div className="amount-card">
                                        <span className="amount-label">Total SD</span>
                                        <span className="amount-value">{formatRs(preflight.sd?.amountPaisa)}</span>
                                    </div>
                                    <div className="amount-card highlight">
                                        <span className="amount-label">Remaining</span>
                                        <span className="amount-value">{formatRs(preflight.remainingPaisa)}</span>
                                    </div>
                                    <div className="amount-card">
                                        <span className="amount-label">Already Settled</span>
                                        <span className="amount-value">{formatRs(preflight.settledPaisa)}</span>
                                    </div>
                                </div>

                                <BalanceBar
                                    totalPaisa={preflight.sd?.amountPaisa ?? 0}
                                    settledPaisa={preflight.settledPaisa ?? 0}
                                    pendingPaisa={0}
                                />

                                {(preflight.openDues?.rentPaisa > 0 ||
                                    preflight.openDues?.camPaisa > 0 ||
                                    preflight.openDues?.electricityPaisa > 0) && (
                                        <div className="dues-alert">
                                            <span className="dues-alert-icon">⚠</span>
                                            <div>
                                                <strong>Tenant has open dues</strong>
                                                <ul className="dues-list">
                                                    {preflight.openDues.rentPaisa > 0 && (
                                                        <li>Rent: {formatRs(preflight.openDues.rentPaisa)}</li>
                                                    )}
                                                    {preflight.openDues.camPaisa > 0 && (
                                                        <li>CAM: {formatRs(preflight.openDues.camPaisa)}</li>
                                                    )}
                                                    {preflight.openDues.electricityPaisa > 0 && (
                                                        <li>Electricity: {formatRs(preflight.openDues.electricityPaisa)}</li>
                                                    )}
                                                </ul>
                                                <p className="dues-hint">You may apply the SD to clear these dues in the next step.</p>
                                            </div>
                                        </div>
                                    )}

                                {preflight.warnings?.map((w, i) => (
                                    <div key={i} className="warning-pill">{w}</div>
                                ))}

                                {!preflight.canRefund && (
                                    <div className="no-refund-block">
                                        No remaining balance — settlement is not possible.
                                    </div>
                                )}

                                {/* Refund date */}
                                {preflight.canRefund && (
                                    <div className="field-group mt-4">
                                        <label>Settlement Date</label>
                                        <input
                                            type="date"
                                            className="field-input"
                                            value={refundDate}
                                            onChange={(e) => setRefundDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 1: Breakdown ── */}
                        {!loading && !success && step === 1 && preflight && (
                            <div className="step-content">
                                <div className="breakdown-header">
                                    <div>
                                        <h3 className="breakdown-title">Settlement Breakdown</h3>
                                        <p className="breakdown-sub">
                                            Add one or more adjustment types. Total must not exceed{" "}
                                            <strong>{formatRs(preflight.remainingPaisa)}</strong>.
                                        </p>
                                    </div>
                                    <div className="total-badge">
                                        <span className="total-badge-label">This refund</span>
                                        <span className={`total-badge-amount${totalRequestedPaisa > preflight.remainingPaisa ? " over" : ""}`}>
                                            {formatRs(totalRequestedPaisa)}
                                        </span>
                                    </div>
                                </div>

                                {/* Live bar */}
                                <BalanceBar
                                    totalPaisa={preflight.sd?.amountPaisa ?? 0}
                                    settledPaisa={preflight.settledPaisa ?? 0}
                                    pendingPaisa={totalRequestedPaisa}
                                />

                                {/* Line items */}
                                {lineItems.length > 0 && (
                                    <div className="line-items-list">
                                        {lineItems.map((item, i) => (
                                            <LineItemRow
                                                key={i}
                                                item={item}
                                                index={i}
                                                remainingPaisa={preflight.remainingPaisa - lineItems
                                                    .filter((_, j) => j !== i)
                                                    .reduce((s, l) => s + l.amountPaisa, 0)}
                                                onUpdate={updateLineItem}
                                                onRemove={removeLineItem}
                                                bankAccounts={bankAccounts}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Add type */}
                                <p className="add-type-label">+ Add adjustment type</p>
                                <div className="type-grid">
                                    {ADJUSTMENT_TYPES.map((t) => (
                                        <AdjustmentTypeCard
                                            key={t.type}
                                            item={t}
                                            isSelected={lineItems.some((l) => l.type === t.type)}
                                            onClick={() => addLineItem(t.type)}
                                        />
                                    ))}
                                </div>

                                {totalRequestedPaisa > (preflight?.remainingPaisa ?? 0) && (
                                    <div className="sdwiz-error">
                                        Total ({formatRs(totalRequestedPaisa)}) exceeds remaining balance ({formatRs(preflight.remainingPaisa)}).
                                    </div>
                                )}

                                {/* Internal notes */}
                                <div className="field-group mt-4">
                                    <label>Internal Notes <span className="optional">(admin-only)</span></label>
                                    <textarea
                                        className="field-input"
                                        rows={2}
                                        placeholder="e.g. Tenant vacated on 2082-03-15, keys returned"
                                        value={internalNotes}
                                        onChange={(e) => setInternalNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── STEP 2: Review ── */}
                        {!loading && !success && step === 2 && preflight && (
                            <div className="step-content">
                                <h3 className="review-title">Review Settlement</h3>
                                <p className="review-sub">Confirm the details below before posting to the ledger.</p>

                                <div className="review-card">
                                    <div className="review-row">
                                        <span>Tenant</span>
                                        <strong>{preflight.sd?.tenant?.name}</strong>
                                    </div>
                                    <div className="review-row">
                                        <span>Settlement Date</span>
                                        <strong>{refundDate}</strong>
                                    </div>
                                    <div className="review-row">
                                        <span>SD Original Amount</span>
                                        <strong>{formatRs(preflight.sd?.amountPaisa)}</strong>
                                    </div>
                                    <div className="review-row">
                                        <span>Previously Settled</span>
                                        <strong>{formatRs(preflight.settledPaisa)}</strong>
                                    </div>
                                    <div className="review-divider" />
                                    {lineItems.map((item, i) => {
                                        const meta = ADJUSTMENT_TYPES.find((t) => t.type === item.type);
                                        return (
                                            <div key={i} className="review-row line">
                                                <span style={{ color: meta?.color }}>
                                                    {meta?.icon} {meta?.label}
                                                    {item.note ? ` — ${item.note}` : ""}
                                                </span>
                                                <strong>{formatRs(item.amountPaisa)}</strong>
                                            </div>
                                        );
                                    })}
                                    <div className="review-divider" />
                                    <div className="review-row total">
                                        <span>Total This Settlement</span>
                                        <strong>{formatRs(totalRequestedPaisa)}</strong>
                                    </div>
                                    <div className="review-row remaining">
                                        <span>Remaining After</span>
                                        <strong>{formatRs(remainingAfter)}</strong>
                                    </div>
                                </div>

                                {internalNotes && (
                                    <div className="review-notes">
                                        <span>Notes:</span> {internalNotes}
                                    </div>
                                )}

                                <div className="ledger-preview">
                                    <p className="ledger-preview-title">Ledger entries that will be posted:</p>
                                    {lineItems.map((item, i) => {
                                        const meta = ADJUSTMENT_TYPES.find((t) => t.type === item.type);
                                        return (
                                            <div key={i} className="ledger-line">
                                                <span>DR Security Deposit Liability (2100)</span>
                                                <span className="ledger-amount">{formatRs(item.amountPaisa)}</span>
                                                <br />
                                                <span className="ledger-cr">
                                                    CR{" "}
                                                    {item.type === "CASH_REFUND"
                                                        ? item.bankAccountCode ?? "Cash (1000)"
                                                        : item.type === "RENT_ADJUSTMENT" || item.type === "CAM_ADJUSTMENT" || item.type === "ELECTRICITY_ADJUSTMENT"
                                                            ? "Accounts Receivable (1200)"
                                                            : item.type === "MAINTENANCE_ADJUSTMENT"
                                                                ? "Maintenance Revenue (4300)"
                                                                : "General Expense (5000)"}
                                                </span>
                                                <span className="ledger-amount">{formatRs(item.amountPaisa)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── STEP 3: Confirm ── */}
                        {!loading && !success && step === 3 && (
                            <div className="step-content">
                                <div className="confirm-block">
                                    <div className="confirm-icon">📋</div>
                                    <h3>Ready to Post</h3>
                                    <p>
                                        A draft has been created. Click <strong>Post to Ledger</strong> to
                                        finalise the settlement. This action will write a double-entry
                                        journal to the ledger and update the security deposit record.
                                    </p>
                                    <p className="confirm-amount">{formatRs(totalRequestedPaisa)}</p>
                                    <p className="confirm-sub">will be settled from the security deposit.</p>

                                    {error && <div className="sdwiz-error">{error}</div>}

                                    <button
                                        className="btn-primary btn-large"
                                        onClick={handleConfirm}
                                        disabled={posting}
                                    >
                                        {posting ? "Posting…" : "✓ Post to Ledger"}
                                    </button>
                                    <button
                                        className="btn-ghost"
                                        onClick={() => { setDraftId(null); setStep(2); }}
                                        disabled={posting}
                                    >
                                        ← Back to Review
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer nav ── */}
                    {!loading && !success && (
                        <div className="sdwiz-footer">
                            <button
                                className="btn-ghost"
                                onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
                                disabled={posting}
                            >
                                {step === 0 ? "Cancel" : "← Back"}
                            </button>

                            {step < 2 && (
                                <button
                                    className="btn-primary"
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={!canProceed() || posting}
                                >
                                    Next →
                                </button>
                            )}

                            {step === 2 && (
                                <button
                                    className="btn-primary"
                                    onClick={handleCreateDraft}
                                    disabled={!canProceed() || posting}
                                >
                                    {posting ? "Saving…" : "Save Draft →"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const wizardCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');

  .sdwiz-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(10, 15, 28, 0.72);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }

  .sdwiz {
    font-family: 'DM Sans', sans-serif;
    background: #0f1623;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    width: 100%; max-width: 640px;
    max-height: 92vh;
    display: flex; flex-direction: column;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
    overflow: hidden;
    color: #e2e8f0;
  }

  /* Header */
  .sdwiz-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 1.5rem 1.75rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .sdwiz-eyebrow {
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;
  }
  .sdwiz-title {
    font-family: 'DM Serif Display', serif;
    font-size: 1.5rem; font-weight: 400; margin: 0;
    color: #f1f5f9;
  }
  .sdwiz-close {
    background: none; border: none; color: #475569; cursor: pointer;
    font-size: 1.1rem; padding: 4px 8px; border-radius: 6px;
    transition: color 0.15s, background 0.15s;
  }
  .sdwiz-close:hover { color: #f1f5f9; background: rgba(255,255,255,0.08); }

  /* Step track */
  .step-track {
    display: flex; align-items: center; gap: 0;
    padding: 0.875rem 1.75rem;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .step-pip {
    display: flex; align-items: center; gap: 8px;
    opacity: 0.35; transition: opacity 0.2s;
  }
  .step-pip.done { opacity: 0.6; }
  .step-pip.active { opacity: 1; }
  .step-pip:not(:last-child)::after {
    content: "→"; color: #334155; margin: 0 10px; font-size: 0.8rem;
  }
  .step-num {
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 600; color: #94a3b8;
  }
  .step-pip.active .step-num {
    background: #1a5276; border-color: #2980b9; color: #fff;
  }
  .step-pip.done .step-num {
    background: rgba(16,185,129,0.2); border-color: #10b981; color: #10b981;
  }
  .step-name { font-size: 0.8rem; font-weight: 500; color: #94a3b8; }
  .step-pip.active .step-name { color: #e2e8f0; }

  /* Body */
  .sdwiz-body {
    flex: 1; overflow-y: auto; padding: 1.5rem 1.75rem;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .step-content { display: flex; flex-direction: column; gap: 1rem; }

  /* Loading */
  .sdwiz-loading {
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
    padding: 3rem; color: #64748b;
  }
  .spinner {
    width: 32px; height: 32px; border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: #1a5276;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Success */
  .sdwiz-success {
    display: flex; flex-direction: column; align-items: center;
    gap: 1rem; padding: 3rem 1rem; text-align: center;
  }
  .success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(16,185,129,0.15); border: 2px solid #10b981;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.8rem; color: #10b981;
  }
  .sdwiz-success h3 { font-size: 1.25rem; color: #f1f5f9; margin: 0; }
  .sdwiz-success p { color: #64748b; margin: 0; }

  /* Error */
  .sdwiz-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    color: #fca5a5; border-radius: 10px; padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  /* Tenant card */
  .tenant-card {
    display: flex; align-items: center; gap: 1rem;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 1rem 1.25rem;
  }
  .tenant-card-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #1a5276, #2980b9);
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Serif Display', serif; font-size: 1.2rem; color: #fff;
    flex-shrink: 0;
  }
  .tenant-name { font-size: 1rem; font-weight: 600; color: #f1f5f9; margin: 0 0 2px; }
  .tenant-phone { font-size: 0.8rem; color: #64748b; margin: 0 0 2px; }
  .tenant-block { font-size: 0.78rem; color: #475569; margin: 0; }
  .sd-mode-badge {
    margin-left: auto; background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
    padding: 4px 10px; font-size: 0.72rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8;
    white-space: nowrap;
  }

  /* Amount strip */
  .amount-strip {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;
  }
  .amount-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 0.875rem 1rem;
    display: flex; flex-direction: column; gap: 4px;
  }
  .amount-card.highlight {
    background: rgba(26, 82, 118, 0.2); border-color: rgba(41, 128, 185, 0.4);
  }
  .amount-label { font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .amount-value { font-family: 'DM Serif Display', serif; font-size: 1.1rem; color: #f1f5f9; }
  .amount-card.highlight .amount-value { color: #60a5fa; }

  /* Balance bar */
  .balance-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
  .balance-bar {
    height: 8px; border-radius: 99px; display: flex; overflow: hidden;
    background: rgba(255,255,255,0.05);
  }
  .balance-bar-segment { height: 100%; transition: width 0.4s ease; }
  .balance-bar-segment.settled { background: #10b981; }
  .balance-bar-segment.pending { background: #f59e0b; }
  .balance-bar-segment.remaining { background: rgba(255,255,255,0.08); }
  .balance-bar-legend {
    display: flex; gap: 1rem; font-size: 0.72rem; color: #64748b;
    flex-wrap: wrap; align-items: center;
  }
  .legend-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 4px;
  }
  .legend-dot.settled { background: #10b981; }
  .legend-dot.pending { background: #f59e0b; }
  .legend-dot.remaining { background: rgba(255,255,255,0.15); }

  /* Dues alert */
  .dues-alert {
    display: flex; gap: 0.875rem;
    background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25);
    border-radius: 10px; padding: 1rem 1.125rem;
  }
  .dues-alert-icon { font-size: 1.1rem; flex-shrink: 0; line-height: 1.4; }
  .dues-alert strong { font-size: 0.875rem; color: #fcd34d; }
  .dues-list { margin: 4px 0 6px; padding-left: 1rem; font-size: 0.8rem; color: #94a3b8; }
  .dues-hint { font-size: 0.78rem; color: #64748b; margin: 0; }

  /* Warning pill */
  .warning-pill {
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5; border-radius: 8px; padding: 0.625rem 0.875rem;
    font-size: 0.82rem;
  }

  .no-refund-block {
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5; border-radius: 10px; padding: 1rem 1.25rem;
    text-align: center; font-size: 0.9rem;
  }

  /* Fields */
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 0.78rem; font-weight: 600; color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase; }
  .field-input {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #f1f5f9; border-radius: 8px; padding: 0.625rem 0.875rem;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .field-input:focus { outline: none; border-color: #2980b9; }
  .field-hint { font-size: 0.72rem; color: #475569; }
  .optional { color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }
  .mt-4 { margin-top: 1rem; }

  /* Breakdown */
  .breakdown-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
  }
  .breakdown-title { font-family: 'DM Serif Display', serif; font-size: 1.2rem; color: #f1f5f9; margin: 0 0 4px; }
  .breakdown-sub { font-size: 0.82rem; color: #64748b; margin: 0; }
  .total-badge {
    display: flex; flex-direction: column; align-items: flex-end;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 0.625rem 0.875rem; flex-shrink: 0;
  }
  .total-badge-label { font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .total-badge-amount { font-family: 'DM Serif Display', serif; font-size: 1.1rem; color: #60a5fa; }
  .total-badge-amount.over { color: #ef4444; }

  /* Type grid */
  .add-type-label { font-size: 0.8rem; font-weight: 600; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
  .type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.625rem; }
  .type-card {
    position: relative; display: flex; flex-direction: column; gap: 4px;
    text-align: left; background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07); border-radius: 10px;
    padding: 0.875rem 1rem; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }
  .type-card:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }
  .type-card.selected {
    background: rgba(var(--card-color-rgb, 26,82,118), 0.1);
    border-color: var(--card-color, #2980b9);
  }
  .type-card-icon { font-size: 1.2rem; }
  .type-card-label { font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
  .type-card-desc { font-size: 0.72rem; color: #64748b; line-height: 1.4; }
  .type-card-check {
    position: absolute; top: 8px; right: 8px;
    color: var(--card-color); font-size: 0.85rem;
  }

  /* Line items */
  .line-items-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .line-item-row {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--item-color, rgba(255,255,255,0.08));
    border-radius: 12px; overflow: hidden;
    border-left-width: 3px;
  }
  .line-item-header {
    display: flex; align-items: center; gap: 8px;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .line-item-icon { font-size: 1rem; }
  .line-item-type { font-size: 0.85rem; font-weight: 600; color: var(--item-color); flex: 1; }
  .line-item-remove {
    background: none; border: none; color: #475569; cursor: pointer;
    font-size: 0.9rem; padding: 2px 6px; border-radius: 4px;
    transition: color 0.15s;
  }
  .line-item-remove:hover { color: #ef4444; }
  .line-item-body {
    padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem;
  }

  /* Review */
  .review-title { font-family: 'DM Serif Display', serif; font-size: 1.2rem; color: #f1f5f9; margin: 0; }
  .review-sub { font-size: 0.82rem; color: #64748b; margin: 0; }
  .review-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; overflow: hidden;
  }
  .review-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.625rem 1rem; font-size: 0.875rem;
  }
  .review-row span { color: #94a3b8; }
  .review-row strong { color: #f1f5f9; }
  .review-row:nth-child(even) { background: rgba(255,255,255,0.02); }
  .review-row.total { background: rgba(26,82,118,0.15); }
  .review-row.total span { color: #93c5fd; }
  .review-row.total strong { color: #60a5fa; font-size: 1rem; }
  .review-row.remaining span { color: #6ee7b7; }
  .review-row.remaining strong { color: #10b981; }
  .review-divider { height: 1px; background: rgba(255,255,255,0.07); }
  .review-notes {
    font-size: 0.8rem; color: #64748b;
    background: rgba(255,255,255,0.02); border-radius: 8px; padding: 0.625rem 0.875rem;
  }
  .review-notes span { font-weight: 600; color: #94a3b8; }

  /* Ledger preview */
  .ledger-preview {
    background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 1rem;
    font-family: monospace; font-size: 0.78rem; color: #64748b;
  }
  .ledger-preview-title { font-family: 'DM Sans', sans-serif; font-weight: 600; color: #94a3b8; margin: 0 0 0.75rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .ledger-line { margin-bottom: 0.875rem; display: grid; grid-template-columns: 1fr auto; gap: 4px; align-items: center; }
  .ledger-line:last-child { margin-bottom: 0; }
  .ledger-cr { padding-left: 1.5rem; color: #475569; }
  .ledger-amount { font-weight: 600; color: #94a3b8; white-space: nowrap; }

  /* Confirm */
  .confirm-block {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.875rem; padding: 2rem 1rem; text-align: center;
  }
  .confirm-icon { font-size: 2.5rem; }
  .confirm-block h3 { font-family: 'DM Serif Display', serif; font-size: 1.4rem; color: #f1f5f9; margin: 0; }
  .confirm-block p { color: #94a3b8; font-size: 0.875rem; max-width: 380px; margin: 0; line-height: 1.6; }
  .confirm-amount { font-family: 'DM Serif Display', serif; font-size: 2rem; color: #10b981; margin: 0; }
  .confirm-sub { font-size: 0.8rem; color: #64748b; margin: 0; }

  /* Footer */
  .sdwiz-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.75rem;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  /* Buttons */
  .btn-primary {
    background: #1a5276; color: #fff; border: none; border-radius: 8px;
    padding: 0.625rem 1.5rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .btn-primary:hover:not(:disabled) { background: #2980b9; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary.btn-large { padding: 0.875rem 2rem; font-size: 1rem; width: 100%; }
  .btn-ghost {
    background: none; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8;
    border-radius: 8px; padding: 0.625rem 1.25rem;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem; cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .btn-ghost:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: #f1f5f9; }
  .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  /* select styling */
  select.field-input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    padding-right: 32px;
  }
  textarea.field-input { resize: vertical; min-height: 64px; }
`;