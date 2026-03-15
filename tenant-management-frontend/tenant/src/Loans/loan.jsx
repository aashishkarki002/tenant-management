/**
 * LoansPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fully wired to real backend API:
 *
 *   GET  /api/loan?entityId=xxx            — list all loans
 *   POST /api/loan                          — create loan + disbursement journal
 *   GET  /api/loan/:id/schedule             — full amortization schedule
 *   POST /api/loan/:id/payment              — record EMI payment
 *
 * Backend model field mapping (different from the old mock):
 *   lender            (not lenderName)
 *   principalPaisa    (not totalPaisa)
 *   interestRateAnnual (not interestRatePct)
 *   status            ACTIVE | CLOSED | DEFAULTED | PENDING  (UPPERCASE)
 *   loanType          HOME_LOAN | MORTGAGE | PERSONAL | OVERDRAFT | BUSINESS
 *   completionPercent comes from backend as string "73.5"
 *   emiPaisa          pre-calculated on create
 *   installmentsPaid  count of paid EMIs
 *
 * entityId resolution:
 *   1. window.__entityCtx__.activeEntityId   (if EntityContext exposes it)
 *   2. window.__entityCtx__.defaultEntityId  (fallback)
 *   3. GET /api/settings/system → defaultEntityId
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import NepaliDate from "nepali-datetime";
import {
    Landmark, Plus, TrendingDown, ChevronRight, AlertCircle,
    CheckCircle2, Clock, Building2, CalendarDays, Percent,
    CreditCard, RefreshCw, X, Banknote,
} from "lucide-react";
import {
    Sheet, SheetContent,
} from "@/components/ui/sheet";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import api from "../../plugins/axios";

// ─── Nepali calendar ──────────────────────────────────────────────────────────
const BS_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan",
    "Bhadra", "Ashwin", "Kartik", "Mangsir",
    "Poush", "Magh", "Falgun", "Chaitra",
];
function toBSDate(v) {
    if (!v) return "—";
    try {
        const nd = new NepaliDate(new Date(v));
        return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
    } catch { return "—"; }
}
function getCurrentBSDate() {
    try { const nd = new NepaliDate(); return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`; }
    catch { return "—"; }
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
    bg: "var(--color-bg)",
    surface: "var(--color-surface-raised)",
    surfaceAlt: "var(--color-surface)",
    border: "var(--color-border)",
    text: "var(--color-text-strong)",
    textMid: "var(--color-text-body)",
    textMuted: "var(--color-text-sub)",
    accent: "var(--color-accent)",
    positive: "var(--color-success)",
    positiveBg: "var(--color-success-bg)",
    negative: "var(--color-danger)",
    negativeBg: "var(--color-danger-bg)",
    amber: "var(--color-warning)",
    amberBg: "var(--color-warning-bg)",
    info: "var(--color-info)",
    infoBg: "var(--color-info-bg)",
};

// ─── Formatting ────────────────────────────────────────────────────────────────
const fmtN = (n = 0) => Math.abs(Math.round(n)).toLocaleString("en-IN");
const fmtK = (rupees) => {
    const a = Math.abs(rupees ?? 0), s = rupees < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}रू ${(a / 10_000_000).toFixed(2)} Cr`;
    if (a >= 100_000) return `${s}रू ${(a / 100_000).toFixed(2)} L`;
    if (a >= 1_000) return `${s}रू ${(a / 1_000).toFixed(1)}K`;
    return `${s}रू ${a}`;
};
const fmtRupees = (paisa) => `रू ${fmtN((paisa ?? 0) / 100)}`;
const paisaToRupees = (paisa) => Math.round((paisa ?? 0) / 100);

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
    ACTIVE: { label: "Active", bg: C.infoBg, color: C.info },
    CLOSED: { label: "Closed", bg: C.positiveBg, color: C.positive },
    DEFAULTED: { label: "Defaulted", bg: C.negativeBg, color: C.negative },
    PENDING: { label: "Pending", bg: C.amberBg, color: C.amber },
};
const LOAN_TYPE_LABELS = {
    HOME_LOAN: "Home Loan", MORTGAGE: "Mortgage",
    PERSONAL: "Personal Loan", OVERDRAFT: "Overdraft", BUSINESS: "Business Loan",
};

// ─── entityId resolution ───────────────────────────────────────────────────────
const HARDCODED_ENTITY_ID = "69b11f16ce3a098bb6ba5424"; // TODO: remove when entity context is wired

async function resolveEntityId() {
    if (window.__entityCtx__?.activeEntityId) return window.__entityCtx__.activeEntityId;
    if (window.__entityCtx__?.defaultEntityId) return window.__entityCtx__.defaultEntityId;
    try {
        const res = await api.get("/api/settings/system");
        const cfg = res.data?.data ?? res.data;
        return cfg?.defaultEntityId ?? HARDCODED_ENTITY_ID;
    } catch { return HARDCODED_ENTITY_ID; }
}

// ─── Arc progress ─────────────────────────────────────────────────────────────
function ArcProgress({ pct = 0, size = 88, stroke = 7, color }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
            style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }} />
        </svg>
    );
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const s = STATUS[status] ?? STATUS.ACTIVE;
    return (
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: s.bg, color: s.color, letterSpacing: "0.04em" }}>
            {s.label}
        </span>
    );
}

// ─── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, delay = 0 }) {
    return (
        <div className="lp-card rounded-2xl border flex flex-col gap-2.5"
            style={{ background: C.surface, borderColor: C.border, padding: "16px 18px", animationDelay: `${delay * 0.07}s` }}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.textMuted }}>{label}</span>
                {Icon && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "22" }}>
                        <Icon size={14} color={color} />
                    </div>
                )}
            </div>
            <div className="text-[22px] font-bold font-mono leading-none" style={{ color: C.text }}>{value}</div>
            {sub && <div className="text-[11px]" style={{ color: C.textMuted }}>{sub}</div>}
        </div>
    );
}

// ─── Loan card ─────────────────────────────────────────────────────────────────
function LoanCard({ loan, onClick, delay = 0 }) {
    const paidPct = parseFloat(loan.completionPercent ?? "0");
    const isDefaulted = loan.status === "DEFAULTED";
    const isClosed = loan.status === "CLOSED";
    const arcColor = isDefaulted ? C.negative : isClosed ? C.positive : C.accent;
    const remaining = (loan.tenureMonths ?? 0) - (loan.installmentsPaid ?? 0);

    return (
        <div className="lp-card group rounded-2xl border cursor-pointer transition-all"
            style={{
                background: C.surface,
                borderColor: isDefaulted ? C.negative + "60" : C.border,
                padding: "18px 20px",
                animationDelay: `${delay * 0.06}s`,
            }}
            onClick={() => onClick(loan)}>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[13px] font-bold" style={{ color: C.text }}>{loan.lender}</span>
                        <StatusBadge status={loan.status} />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                        <Building2 size={10} />
                        <span>{LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}</span>
                        <span>·</span>
                        <Percent size={10} />
                        <span>{loan.interestRateAnnual}% p.a.</span>
                    </div>
                </div>
                {/* Arc progress */}
                <div className="relative flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
                    <ArcProgress pct={paidPct} size={52} stroke={5} color={arcColor} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold" style={{ color: arcColor }}>{Math.round(paidPct)}%</span>
                    </div>
                </div>
            </div>

            {/* Amount strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                    { l: "Principal", v: fmtRupees(loan.principalPaisa) },
                    { l: "Paid", v: fmtRupees((loan.principalPaisa ?? 0) - (loan.outstandingPaisa ?? 0)), c: C.positive },
                    { l: "Outstanding", v: fmtRupees(loan.outstandingPaisa), c: isDefaulted ? C.negative : C.amber },
                ].map(({ l, v, c }) => (
                    <div key={l} className="rounded-xl px-2.5 py-2" style={{ background: C.surfaceAlt }}>
                        <div className="text-[9px] uppercase tracking-[0.12em] mb-0.5" style={{ color: C.textMuted }}>{l}</div>
                        <div className="text-[12px] font-bold font-mono" style={{ color: c ?? C.text }}>{v}</div>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-3.5 overflow-hidden" style={{ background: C.surfaceAlt }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, paidPct)}%`, background: arcColor, transition: "width 0.8s ease" }} />
            </div>

            {/* EMI / status row */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{
                    background: isClosed ? C.positiveBg : isDefaulted ? C.negativeBg : C.infoBg,
                    border: `1px solid ${isClosed ? C.positive + "30" : isDefaulted ? C.negative + "30" : C.info + "30"}`,
                }}>
                <div className="flex items-center gap-2">
                    {isClosed
                        ? <CheckCircle2 size={13} color={C.positive} />
                        : isDefaulted ? <AlertCircle size={13} color={C.negative} />
                            : <CalendarDays size={13} color={C.info} />}
                    <span className="text-[12px] font-semibold"
                        style={{ color: isClosed ? C.positive : isDefaulted ? C.negative : C.info }}>
                        {isClosed ? "Loan closed" : `${remaining} EMI${remaining !== 1 ? "s" : ""} remaining`}
                    </span>
                </div>
                {!isClosed && (
                    <span className="text-[12px] font-bold font-mono" style={{ color: C.text }}>
                        {fmtRupees(loan.emiPaisa)}
                        <span className="text-[10px] font-normal" style={{ color: C.textMuted }}>/mo</span>
                    </span>
                )}
            </div>

            <div className="flex items-center justify-end mt-3 gap-1 text-[11px]" style={{ color: C.accent }}>
                <span className="font-semibold">View schedule</span>
                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
        </div>
    );
}

// ─── Amortization row ──────────────────────────────────────────────────────────
function AmortizationRow({ row, isNext }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3"
            style={{
                borderBottom: `1px solid ${C.border}`,
                background: isNext ? C.infoBg : "transparent",
            }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={{
                    background: row.paid ? C.positiveBg : isNext ? C.info + "22" : C.surfaceAlt,
                    color: row.paid ? C.positive : isNext ? C.info : C.textMuted,
                }}>
                {row.paid ? <CheckCircle2 size={14} color={C.positive} /> : row.installment}
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: C.text }}>
                    {isNext && <span className="text-[10px] font-bold mr-1" style={{ color: C.info }}>NEXT · </span>}
                    Installment {row.installment}
                </div>
                {row.paymentDate && (
                    <div className="text-[10px]" style={{ color: C.textMuted }}>Paid {toBSDate(row.paymentDate)}</div>
                )}
            </div>

            <div className="hidden sm:flex gap-4 text-right">
                <div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textMuted }}>Principal</div>
                    <div className="text-[12px] font-mono" style={{ color: C.text }}>{fmtRupees(row.principalPaisa)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textMuted }}>Interest</div>
                    <div className="text-[12px] font-mono" style={{ color: C.amber }}>{fmtRupees(row.interestPaisa)}</div>
                </div>
            </div>

            <div className="text-right min-w-[80px]">
                <div className="text-[12px] font-bold font-mono" style={{ color: C.text }}>{fmtRupees(row.totalPaisa)}</div>
                <div className="text-[10px]" style={{ color: C.textMuted }}>bal: {fmtRupees(row.outstandingAfterPaisa)}</div>
            </div>
        </div>
    );
}

// ─── Record payment dialog ─────────────────────────────────────────────────────
function RecordPaymentDialog({ loan, open, onOpenChange, onSuccess }) {
    const [banks, setBanks] = useState([]);
    const [form, setForm] = useState({
        bankAccountCode: "",
        paymentMethod: "bank_transfer",
        paymentDate: new Date().toISOString().split("T")[0],
        notes: "",
        customAmount: false,
        customPrincipalRupees: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        api.get("/api/bank/get-bank-accounts").then(r => {
            const accs = r.data?.bankAccounts ?? [];
            setBanks(accs);
            if (accs.length > 0 && !form.bankAccountCode) {
                setForm(f => ({ ...f, bankAccountCode: accs[0].accountCode }));
            }
        }).catch(() => { });
    }, [open]);

    const handleSubmit = async () => {
        if (!form.bankAccountCode) { toast.error("Select a bank account"); return; }
        try {
            setSaving(true);
            const entityId = await resolveEntityId();
            const payload = {
                entityId,
                paymentDate: form.paymentDate,
                bankAccountCode: form.bankAccountCode,
                paymentMethod: form.paymentMethod,
                notes: form.notes || null,
            };
            if (form.customAmount && form.customPrincipalRupees) {
                payload.customPrincipalPaisa = Math.round(Number(form.customPrincipalRupees) * 100);
            }
            const res = await api.post(`/api/loan/${loan._id}/payment`, payload);
            const s = res.data?.data?.summary ?? {};
            toast.success(s.loanClosed
                ? "Loan fully paid off!"
                : `EMI #${s.installmentNumber} recorded — ${fmtRupees(s.outstandingAfterPaisa)} remaining`);
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            toast.error(err.response?.data?.message ?? "Failed to record payment");
        } finally {
            setSaving(false);
        }
    };

    if (!loan) return null;
    const r = loan.interestRateAnnual / 12 / 100;
    const estI = Math.round((loan.outstandingPaisa ?? 0) * r);
    const estP = (loan.emiPaisa ?? 0) - estI;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent style={{ background: C.surface, maxWidth: 460 }}>
                <DialogHeader>
                    <DialogTitle style={{ color: C.text }}>Record EMI payment</DialogTitle>
                    <p className="text-[12px]" style={{ color: C.textMuted }}>
                        {loan.lender} · EMI #{(loan.installmentsPaid ?? 0) + 1}
                    </p>
                </DialogHeader>

                {/* Preview */}
                <div className="grid grid-cols-3 gap-2 my-1">
                    {[
                        { l: "Total EMI", v: fmtRupees(loan.emiPaisa), c: C.text },
                        { l: "≈ Principal", v: fmtRupees(estP), c: C.accent },
                        { l: "≈ Interest", v: fmtRupees(estI), c: C.amber },
                    ].map(({ l, v, c }) => (
                        <div key={l} className="rounded-xl px-3 py-2 text-center" style={{ background: C.surfaceAlt }}>
                            <div className="text-[10px] mb-0.5" style={{ color: C.textMuted }}>{l}</div>
                            <div className="text-[12px] font-bold font-mono" style={{ color: c }}>{v}</div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 mt-1">
                    {[
                        {
                            key: "bankAccountCode", label: "Bank account", type: "select",
                            options: banks.map(b => ({ value: b.accountCode, label: `${b.bankName} — ${b.accountCode}` })),
                            placeholder: "Select bank…"
                        },
                        {
                            key: "paymentMethod", label: "Payment method", type: "select",
                            options: [
                                { value: "bank_transfer", label: "Bank Transfer" },
                                { value: "cheque", label: "Cheque" },
                                { value: "cash", label: "Cash" },
                                { value: "mobile_wallet", label: "Mobile Wallet" },
                            ]
                        },
                        { key: "paymentDate", label: "Payment date", type: "date" },
                    ].map(f => (
                        <div key={f.key} className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                                style={{ color: C.textMuted }}>{f.label}</label>
                            {f.type === "select" ? (
                                <select value={form[f.key]}
                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                                    style={{ borderColor: C.border, color: C.text }}>
                                    {f.placeholder && <option value="">{f.placeholder}</option>}
                                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            ) : (
                                <input type={f.type} value={form[f.key]}
                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                                    style={{ borderColor: C.border, color: C.text }} />
                            )}
                        </div>
                    ))}

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={form.customAmount}
                            onChange={e => setForm(p => ({ ...p, customAmount: e.target.checked }))} />
                        <span className="text-[12px]" style={{ color: C.textMid }}>Prepayment / custom principal</span>
                    </label>
                    {form.customAmount && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                                style={{ color: C.textMuted }}>Custom principal (रू)</label>
                            <input type="number" value={form.customPrincipalRupees}
                                onChange={e => setForm(p => ({ ...p, customPrincipalRupees: e.target.value }))}
                                placeholder="e.g. 50000"
                                className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                                style={{ borderColor: C.border, color: C.text }} />
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                            style={{ color: C.textMuted }}>Notes (optional)</label>
                        <input type="text" value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Cheque no., remarks…"
                            className="h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none"
                            style={{ borderColor: C.border, color: C.text }} />
                    </div>
                </div>

                <DialogFooter className="mt-3 flex gap-2">
                    <button onClick={() => onOpenChange(false)}
                        className="flex-1 h-9 rounded-lg border text-[13px] font-semibold"
                        style={{ borderColor: C.border, color: C.textMid }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
                        style={{ background: C.accent, opacity: saving ? 0.7 : 1 }}>
                        <Banknote size={13} />
                        {saving ? "Recording…" : "Record payment"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Loan detail sheet ─────────────────────────────────────────────────────────
function LoanDetailSheet({ loan, open, onClose, onPaymentSuccess }) {
    const [scheduleData, setScheduleData] = useState(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);

    // Fetch schedule when sheet opens (or loan changes)
    useEffect(() => {
        if (!open || !loan?._id) return;
        setScheduleData(null);
        setLoadingSchedule(true);
        api.get(`/api/loan/${loan._id}/schedule`)
            .then(r => setScheduleData(r.data?.data ?? null))
            .catch(() => setScheduleData(null))
            .finally(() => setLoadingSchedule(false));
    }, [open, loan?._id]);

    if (!loan) return null;

    const paidPct = parseFloat(loan.completionPercent ?? "0");
    const isDefaulted = loan.status === "DEFAULTED";
    const isClosed = loan.status === "CLOSED";
    const arcColor = isDefaulted ? C.negative : isClosed ? C.positive : C.accent;
    const canPay = loan.status === "ACTIVE" && (loan.outstandingPaisa ?? 0) > 0;

    const schedule = scheduleData?.schedule ?? [];
    const summary = scheduleData?.summary ?? {};
    const firstUnpaid = schedule.findIndex(r => !r.paid);

    return (
        <>
            <Sheet open={open} onOpenChange={v => !v && onClose()}>
                <SheetContent side="right" className="overflow-y-auto p-0"
                    style={{ maxWidth: 540, width: "100%", background: C.bg }}>

                    {/* Sticky header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
                        style={{ borderColor: C.border, background: C.surface }}>
                        <div>
                            <div className="text-[15px] font-bold" style={{ color: C.text }}>{loan.lender}</div>
                            <div className="text-[11px]" style={{ color: C.textMuted }}>
                                {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
                                {loan.loanAccountNumber ? ` · ${loan.loanAccountNumber}` : ""}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {canPay && (
                                <button onClick={() => setPaymentOpen(true)}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold text-white"
                                    style={{ background: C.accent }}>
                                    <Banknote size={12} /> Pay EMI
                                </button>
                            )}
                            <StatusBadge status={loan.status} />
                            <button onClick={onClose}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: C.surfaceAlt }}>
                                <X size={14} color={C.textMuted} />
                            </button>
                        </div>
                    </div>

                    <div className="p-5 flex flex-col gap-5">

                        {/* Summary panel */}
                        <div className="rounded-2xl border flex items-center gap-5 px-5 py-4"
                            style={{ background: C.surface, borderColor: isDefaulted ? C.negative + "50" : C.border }}>
                            <div className="relative flex items-center justify-center shrink-0">
                                <ArcProgress pct={paidPct} size={88} stroke={7} color={arcColor} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[18px] font-bold" style={{ color: arcColor }}>{Math.round(paidPct)}%</span>
                                    <span className="text-[9px]" style={{ color: C.textMuted }}>repaid</span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                {[
                                    { l: "Principal", v: fmtRupees(loan.principalPaisa) },
                                    { l: "Paid", v: fmtRupees((loan.principalPaisa ?? 0) - (loan.outstandingPaisa ?? 0)), c: C.positive },
                                    { l: "Outstanding", v: fmtRupees(loan.outstandingPaisa), c: isDefaulted ? C.negative : C.amber },
                                    { l: "Monthly EMI", v: fmtRupees(loan.emiPaisa) },
                                    { l: "EMIs paid", v: `${loan.installmentsPaid ?? 0} of ${loan.tenureMonths}` },
                                ].map(({ l, v, c }) => (
                                    <div key={l} className="flex items-center justify-between">
                                        <span className="text-[11px]" style={{ color: C.textMuted }}>{l}</span>
                                        <span className="text-[12px] font-bold font-mono" style={{ color: c ?? C.text }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Loan details */}
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: C.textMuted }}>
                                Loan details
                            </div>
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border }}>
                                {[
                                    { l: "Lender", v: loan.lender },
                                    { l: "Loan type", v: LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType },
                                    { l: "Interest rate", v: `${loan.interestRateAnnual}% per annum` },
                                    { l: "Tenure", v: `${loan.tenureMonths} months` },
                                    { l: "Disbursed date", v: toBSDate(loan.disbursedDate) },
                                    { l: "First EMI date", v: toBSDate(loan.firstEmiDate) },
                                    { l: "Bank acct. code", v: loan.bankAccountCode },
                                    { l: "Loan acct. no.", v: loan.loanAccountNumber || "—" },
                                    { l: "Notes", v: loan.notes || "—" },
                                ].map(({ l, v }, i, arr) => (
                                    <div key={l} className="flex items-center justify-between px-4 py-2.5"
                                        style={{
                                            borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : undefined,
                                            background: i % 2 === 0 ? C.surface : C.surfaceAlt,
                                        }}>
                                        <span className="text-[11px]" style={{ color: C.textMuted }}>{l}</span>
                                        <span className="text-[12px] font-medium max-w-[220px] truncate text-right"
                                            style={{ color: C.text }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Amortization schedule */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: C.textMuted }}>
                                    Amortization schedule
                                </span>
                                {(summary.remaining ?? 0) > 0 && (
                                    <span className="text-[11px] font-semibold" style={{ color: C.accent }}>
                                        {summary.remaining} remaining
                                    </span>
                                )}
                            </div>
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
                                {loadingSchedule ? (
                                    <div className="py-10 flex flex-col items-center gap-2">
                                        <div className="w-5 h-5 rounded-full border-2 animate-spin"
                                            style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
                                        <span className="text-[12px]" style={{ color: C.textMuted }}>Loading schedule…</span>
                                    </div>
                                ) : schedule.length === 0 ? (
                                    <div className="py-8 text-center text-[12px]" style={{ color: C.textMuted }}>
                                        Schedule not available
                                    </div>
                                ) : (
                                    schedule.map((row, idx) => (
                                        <AmortizationRow
                                            key={row.installment}
                                            row={row}
                                            isNext={firstUnpaid >= 0 && idx === firstUnpaid}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <RecordPaymentDialog
                loan={loan}
                open={paymentOpen}
                onOpenChange={setPaymentOpen}
                onSuccess={() => {
                    setPaymentOpen(false);
                    onPaymentSuccess?.();
                    onClose(); // refresh on next open
                }}
            />
        </>
    );
}

// ─── Add loan dialog ───────────────────────────────────────────────────────────
function AddLoanDialog({ open, onOpenChange, onAdded }) {
    const [banks, setBanks] = useState([]);
    const [form, setForm] = useState({
        lender: "", loanAccountNumber: "", loanType: "MORTGAGE",
        principalRupees: "", interestRateAnnual: "", tenureMonths: "",
        disbursedDate: new Date().toISOString().split("T")[0],
        firstEmiDate: "", bankAccountCode: "", notes: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        api.get("/api/bank/get-bank-accounts").then(r => {
            const accs = r.data?.bankAccounts ?? [];
            setBanks(accs);
            if (accs.length > 0 && !form.bankAccountCode)
                setForm(f => ({ ...f, bankAccountCode: accs[0].accountCode }));
        }).catch(() => { });
    }, [open]);

    // Live EMI preview
    const previewEmi = useMemo(() => {
        try {
            const p = Number(form.principalRupees) * 100;
            const r = Number(form.interestRateAnnual) / 12 / 100;
            const n = Number(form.tenureMonths);
            if (!p || !n) return null;
            if (r === 0) return fmtRupees(Math.round(p / n));
            const factor = Math.pow(1 + r, n);
            return fmtRupees(Math.round((p * r * factor) / (factor - 1)));
        } catch { return null; }
    }, [form.principalRupees, form.interestRateAnnual, form.tenureMonths]);

    const handleSubmit = async () => {
        if (!form.lender.trim()) { toast.error("Lender name required"); return; }
        if (!form.principalRupees) { toast.error("Principal required"); return; }
        if (!form.interestRateAnnual) { toast.error("Interest rate required"); return; }
        if (!form.tenureMonths) { toast.error("Tenure required"); return; }
        if (!form.bankAccountCode) { toast.error("Select receiving bank account"); return; }
        try {
            setSaving(true);
            const entityId = await resolveEntityId();
            if (!entityId) { toast.error("Could not resolve entity"); return; }
            await api.post("/api/loan", {
                entityId,
                lender: form.lender.trim(),
                loanAccountNumber: form.loanAccountNumber.trim() || null,
                loanType: form.loanType,
                principalPaisa: Math.round(Number(form.principalRupees) * 100),
                interestRateAnnual: Number(form.interestRateAnnual),
                tenureMonths: Number(form.tenureMonths),
                disbursedDate: form.disbursedDate,
                firstEmiDate: form.firstEmiDate || null,
                bankAccountCode: form.bankAccountCode,
                notes: form.notes.trim() || null,
            });
            toast.success("Loan recorded. Disbursement journal posted.");
            onOpenChange(false);
            onAdded?.();
            setForm(f => ({
                ...f, lender: "", loanAccountNumber: "", principalRupees: "",
                interestRateAnnual: "", tenureMonths: "", firstEmiDate: "", notes: "",
            }));
        } catch (err) {
            toast.error(err.response?.data?.message ?? "Failed to create loan");
        } finally { setSaving(false); }
    };

    const cls = "h-9 rounded-lg border px-3 text-[13px] bg-transparent outline-none w-full";
    const sty = { borderColor: C.border, color: C.text };
    const lbl = (t) => (
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: C.textMuted }}>{t}</label>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent style={{ background: C.surface, maxWidth: 520 }}>
                <DialogHeader>
                    <DialogTitle style={{ color: C.text }}>Record new loan</DialogTitle>
                    <p className="text-[12px]" style={{ color: C.textMuted }}>
                        A double-entry disbursement journal (DR Bank / CR Loan Liability) will be posted automatically.
                    </p>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="col-span-2 flex flex-col gap-1.5">
                        {lbl("Lender / Bank name *")}
                        <input type="text" value={form.lender} placeholder="e.g. Nepal SBI Bank"
                            onChange={e => setForm(f => ({ ...f, lender: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Loan type *")}
                        <select value={form.loanType}
                            onChange={e => setForm(f => ({ ...f, loanType: e.target.value }))}
                            className={cls} style={sty}>
                            {Object.entries(LOAN_TYPE_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Loan account no.")}
                        <input type="text" value={form.loanAccountNumber} placeholder="Optional"
                            onChange={e => setForm(f => ({ ...f, loanAccountNumber: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Principal amount (रू) *")}
                        <input type="number" value={form.principalRupees} placeholder="e.g. 2500000"
                            onChange={e => setForm(f => ({ ...f, principalRupees: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Interest rate (% p.a.) *")}
                        <input type="number" step="0.1" value={form.interestRateAnnual} placeholder="e.g. 11.5"
                            onChange={e => setForm(f => ({ ...f, interestRateAnnual: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Tenure (months) *")}
                        <input type="number" value={form.tenureMonths} placeholder="e.g. 120"
                            onChange={e => setForm(f => ({ ...f, tenureMonths: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Receiving bank account *")}
                        <select value={form.bankAccountCode}
                            onChange={e => setForm(f => ({ ...f, bankAccountCode: e.target.value }))}
                            className={cls} style={sty}>
                            <option value="">Select…</option>
                            {banks.map(b => (
                                <option key={b.accountCode} value={b.accountCode}>
                                    {b.bankName} — {b.accountCode}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("Disbursed date *")}
                        <input type="date" value={form.disbursedDate}
                            onChange={e => setForm(f => ({ ...f, disbursedDate: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {lbl("First EMI date")}
                        <input type="date" value={form.firstEmiDate}
                            onChange={e => setForm(f => ({ ...f, firstEmiDate: e.target.value }))}
                            className={cls} style={sty} />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1.5">
                        {lbl("Notes")}
                        <input type="text" value={form.notes} placeholder="Purpose, remarks…"
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            className={cls} style={sty} />
                    </div>
                </div>

                {/* Live EMI preview */}
                {previewEmi && (
                    <div className="mt-1 rounded-xl px-4 py-3 flex items-center justify-between"
                        style={{ background: C.infoBg, border: `1px solid ${C.info}30` }}>
                        <span className="text-[11px]" style={{ color: C.info }}>Estimated monthly EMI</span>
                        <span className="text-[13px] font-bold font-mono" style={{ color: C.info }}>{previewEmi}</span>
                    </div>
                )}

                <DialogFooter className="mt-3 flex gap-2">
                    <button onClick={() => onOpenChange(false)}
                        className="flex-1 h-9 rounded-lg border text-[13px] font-semibold"
                        style={{ borderColor: C.border, color: C.textMid }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 h-9 rounded-lg text-[13px] font-bold text-white"
                        style={{ background: C.accent, opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Saving…" : "Record loan"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── useLoans hook ─────────────────────────────────────────────────────────────
function useLoans() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [entityId, setEntityId] = useState(null);

    useEffect(() => {
        resolveEntityId().then(id => {
            if (id) setEntityId(id);
            else setError("No entity found — check EntityContext or SystemConfig.defaultEntityId");
        });
    }, []);

    const fetch = useCallback(async () => {
        if (!entityId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/loan", { params: { entityId } });
            setLoans(res.data?.data ?? []);
        } catch (err) {
            const msg = err.response?.data?.message ?? "Failed to load loans";
            setError(msg);
            toast.error(msg);
            setLoans([]);
        } finally {
            setLoading(false);
        }
    }, [entityId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { loans, loading, error, refetch: fetch };
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LoansPage() {
    const { loans, loading, error, refetch } = useLoans();
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("ALL");

    // KPIs from real data
    const kpis = useMemo(() => {
        const active = loans.filter(l => l.status === "ACTIVE");
        return {
            totalOutstandingPaisa: active.reduce((s, l) => s + (l.outstandingPaisa ?? 0), 0),
            totalPrincipalPaisa: loans.reduce((s, l) => s + (l.principalPaisa ?? 0), 0),
            defaultedCount: loans.filter(l => l.status === "DEFAULTED").length,
            activeCount: active.length,
            nextEmiLoan: active.filter(l => l.outstandingPaisa > 0)
                .sort((a, b) => a.outstandingPaisa - b.outstandingPaisa)[0],
        };
    }, [loans]);

    const FILTERS = [
        { value: "ALL", label: "All" },
        { value: "ACTIVE", label: "Active" },
        { value: "CLOSED", label: "Closed" },
        { value: "DEFAULTED", label: "Defaulted" },
        { value: "PENDING", label: "Pending" },
    ];
    const visible = useMemo(() =>
        statusFilter === "ALL" ? loans : loans.filter(l => l.status === statusFilter),
        [loans, statusFilter]);

    // Header slot (useHeaderSlot takes factory + deps; clears on unmount)
    useHeaderSlot(
        () => (
            <div className="flex items-center gap-2">
                <button onClick={refetch}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center"
                    style={{ borderColor: C.border }} title="Refresh">
                    <RefreshCw size={13} color={C.textMuted} />
                </button>
                <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-bold text-white"
                    style={{ background: C.accent }}>
                    <Plus size={12} />
                    <span className="hidden sm:inline">Add loan</span>
                </button>
            </div>
        ),
        [refetch]
    );

    return (
        <>
            <style>{`
                @keyframes lp-fade-up {
                    from { opacity:0; transform:translateY(10px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                .lp-card { animation: lp-fade-up 0.35s ease both; }
            `}</style>

            <div style={{ padding: "20px 20px 48px", maxWidth: 900, margin: "0 auto" }}>

                {/* Page header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Landmark size={16} color={C.accent} />
                        <h1 className="text-[18px] font-bold" style={{ color: C.text }}>Loans & Liabilities</h1>
                    </div>
                    <p className="text-[12px]" style={{ color: C.textMuted }}>
                        Today {getCurrentBSDate()} · Borrowed capital, EMI schedules, outstanding obligations
                    </p>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mb-5 flex items-start gap-2 rounded-xl border px-4 py-3"
                        style={{ background: C.negativeBg, borderColor: C.negative + "40" }}>
                        <AlertCircle size={13} color={C.negative} className="mt-0.5 shrink-0" />
                        <p className="text-[12px]" style={{ color: C.negative }}>{error}</p>
                    </div>
                )}

                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <KpiCard label="Total outstanding" delay={0}
                        value={fmtK(paisaToRupees(kpis.totalOutstandingPaisa))}
                        sub={`across ${kpis.activeCount} active loan${kpis.activeCount !== 1 ? "s" : ""}`}
                        icon={TrendingDown} color={C.amber} />
                    <KpiCard label="Total principal" delay={1}
                        value={fmtK(paisaToRupees(kpis.totalPrincipalPaisa))}
                        sub={`${loans.length} loan${loans.length !== 1 ? "s" : ""} total`}
                        icon={Landmark} color={C.accent} />
                    <KpiCard label="Defaulted" delay={2}
                        value={kpis.defaultedCount}
                        sub={kpis.defaultedCount > 0 ? "Requires attention" : "All accounts current"}
                        icon={AlertCircle} color={kpis.defaultedCount > 0 ? C.negative : C.positive} />
                    <KpiCard label="Next EMI" delay={3}
                        value={kpis.nextEmiLoan ? fmtRupees(kpis.nextEmiLoan.emiPaisa) : "—"}
                        sub={kpis.nextEmiLoan ? `${kpis.nextEmiLoan.lender} · open to see date` : "No active loans"}
                        icon={CreditCard} color={C.info} />
                </div>

                {/* Liability breakdown */}
                {loans.filter(l => l.status === "ACTIVE").length > 0 && (
                    <div className="lp-card rounded-2xl border mb-5 px-5 py-4"
                        style={{ background: C.surface, borderColor: C.border, animationDelay: "0.18s" }}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3.5" style={{ color: C.textMuted }}>
                            Liability breakdown — active loans
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {loans.filter(l => l.status === "ACTIVE").map(l => {
                                const pct = kpis.totalOutstandingPaisa > 0
                                    ? (l.outstandingPaisa / kpis.totalOutstandingPaisa) * 100 : 0;
                                return (
                                    <div key={l._id} className="flex items-center gap-3 cursor-pointer"
                                        onClick={() => setSelectedLoan(l)}>
                                        <div className="text-[11px] font-medium min-w-[110px] truncate" style={{ color: C.textMid }}>
                                            {l.lender}
                                        </div>
                                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.surfaceAlt }}>
                                            <div className="h-full rounded-full"
                                                style={{ width: `${pct}%`, background: C.accent, opacity: 0.8, transition: "width 0.9s ease" }} />
                                        </div>
                                        <div className="text-[11px] font-mono font-bold min-w-[80px] text-right" style={{ color: C.text }}>
                                            {fmtRupees(l.outstandingPaisa)}
                                        </div>
                                        <div className="text-[10px] min-w-[34px] text-right" style={{ color: C.textMuted }}>
                                            {pct.toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Filter tabs */}
                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    {FILTERS.map(f => {
                        const count = f.value === "ALL" ? loans.length : loans.filter(l => l.status === f.value).length;
                        return (
                            <button key={f.value} onClick={() => setStatusFilter(f.value)}
                                className="h-7 px-3.5 rounded-full text-[11px] font-semibold transition-colors"
                                style={{
                                    background: statusFilter === f.value ? C.accent : C.surfaceAlt,
                                    color: statusFilter === f.value ? "#fff" : C.textMuted,
                                    border: `1px solid ${statusFilter === f.value ? "transparent" : C.border}`,
                                }}>
                                {f.label}
                                {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Loan cards */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="rounded-2xl border animate-pulse h-56"
                                style={{ background: C.surfaceAlt, borderColor: C.border }} />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <div className="rounded-2xl border py-16 text-center"
                        style={{ background: C.surface, borderColor: C.border }}>
                        <Landmark size={28} color={C.border} className="mx-auto mb-3" />
                        <div className="text-[14px] font-semibold mb-1" style={{ color: C.textMid }}>
                            {statusFilter === "ALL" ? "No loans recorded yet" : `No ${statusFilter.toLowerCase()} loans`}
                        </div>
                        <div className="text-[12px]" style={{ color: C.textMuted }}>
                            {statusFilter === "ALL"
                                ? 'Click "Add loan" to record your first liability'
                                : "Try a different filter"}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {visible.map((loan, i) => (
                            <LoanCard key={loan._id} loan={loan} onClick={setSelectedLoan} delay={i} />
                        ))}
                    </div>
                )}
            </div>

            <LoanDetailSheet
                loan={selectedLoan}
                open={!!selectedLoan}
                onClose={() => setSelectedLoan(null)}
                onPaymentSuccess={refetch}
            />
            <AddLoanDialog open={addOpen} onOpenChange={setAddOpen} onAdded={refetch} />
        </>
    );
}