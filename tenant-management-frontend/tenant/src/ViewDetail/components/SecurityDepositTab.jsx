
import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import { useAuth } from "../../context/AuthContext";
import { ShieldCheck, ShieldOff, Clock, CheckCircle2, AlertCircle, ArrowRightLeft } from "lucide-react";
import SdRefundWizard from "./SdRefundWizard";
import SdRefundHistory from "./SdRefundHistory";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRs(paisa) {
    if (paisa == null) return "—";
    return `रू ${(paisa / 100).toLocaleString("en-IN")}`;
}

const SD_STATUS_META = {
    pending: {
        icon: Clock,
        label: "Pending Receipt",
        hint: "Security deposit has been agreed but not yet received.",
    },
    paid: {
        icon: CheckCircle2,
        label: "Held",
        hint: "Security deposit is being held. Ready for settlement on vacancy.",
    },
    held_as_bg: {
        icon: ShieldCheck,
        label: "Bank Guarantee",
        hint: "A bank guarantee is on file in lieu of cash deposit.",
    },
    partially_refunded: {
        icon: ArrowRightLeft,
        label: "Partially Settled",
        hint: "Some portion has been settled. Remaining balance is held.",
    },
    refunded: {
        icon: CheckCircle2,
        label: "Fully Settled",
        hint: "Security deposit has been fully settled.",
    },
    adjusted: {
        icon: CheckCircle2,
        label: "Adjusted",
        hint: "Security deposit has been fully adjusted against dues.",
    },
};

const MODE_LABELS = {
    cash: "Cash",
    cheque: "Cheque",
    bank_transfer: "Bank Transfer",
    bank_guarantee: "Bank Guarantee",
};

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE BAR
// ─────────────────────────────────────────────────────────────────────────────

function SdBalanceBar({ totalPaisa, remainingPaisa }) {
    const settledPaisa = totalPaisa - remainingPaisa;
    const settledPct = totalPaisa ? Math.round((settledPaisa / totalPaisa) * 100) : 0;
    const remainingPct = 100 - settledPct;

    return (
        <div className="sd-bar-wrap">
            <div className="sd-bar">
                <div className="sd-bar-seg settled" style={{ width: `${settledPct}%` }} />
                <div className="sd-bar-seg remaining" style={{ width: `${remainingPct}%` }} />
            </div>
            <div className="sd-bar-labels">
                <span>
                    <span className="sd-dot settled" />
                    Settled — {formatRs(settledPaisa)} ({settledPct}%)
                </span>
                <span>
                    <span className="sd-dot remaining" />
                    Held — {formatRs(remainingPaisa)} ({remainingPct}%)
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function SdEmptyState() {
    return (
        <div className="sd-empty">
            <ShieldOff className="sd-empty-icon" />
            <p className="sd-empty-title">No security deposit on record</p>
            <p className="sd-empty-sub">
                A security deposit record will appear here once it has been collected
                for this tenant.
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SecurityDepositTab({ tenantId, blockId, sdId: sdIdProp }) {
    const { user } = useAuth();
    const role = user?.role ?? "staff";

    const [sd, setSd] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wizardOpen, setWizardOpen] = useState(false);

    const canSettle = role === "admin" || role === "super_admin";

    // ── Fetch SD ──────────────────────────────────────────────────────────────
    const fetchSd = async () => {
        try {
            setLoading(true);
            setError(null);
            // Try sdId prop first (pre-loaded from tenant), else fetch by tenantId
            const url = sdIdProp
                ? `/api/sd/get-sd/${sdIdProp}`
                : `/api/sd/by-tenant/${tenantId}`;
            const res = await api.get(url);
            setSd(res.data?.data ?? res.data?.sd ?? null);
        } catch (e) {
            // 404 = no SD yet — not an error, just empty
            if (e.response?.status === 404) {
                setSd(null);
            } else {
                setError(e.response?.data?.message ?? e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tenantId) fetchSd();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId, sdIdProp]);

    const statusMeta = sd ? (SD_STATUS_META[sd.status] ?? SD_STATUS_META.paid) : null;
    const sdStatusKey =
        sd && sd.status in SD_STATUS_META ? sd.status : "paid";
    const StatusIcon = statusMeta?.icon ?? ShieldCheck;

    // ── SD is fully settled — disable button ─────────────────────────────────
    const isFullySettled = sd?.status === "refunded" || sd?.status === "adjusted";

    // ── Backend-provided financials (UI stays dumb) ─────────────────────────
    const totalPaisa = sd?.amountPaisa ?? 0;
    const remainingPaisa = sd?.remainingAmountPaisa ?? 0;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Loading ── */}
            {loading && (
                <div className="sd-loading">
                    <div className="sd-spinner" />
                    <span>Loading security deposit…</span>
                </div>
            )}

            {/* ── Error ── */}
            {!loading && error && (
                <div className="sd-error">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* ── No SD ── */}
            {!loading && !error && !sd && <SdEmptyState />}

            {/* ── SD found ── */}
            {!loading && !error && sd && (
                <div className="sd-wrap">

                    {/* STATUS CARD */}
                    <div className="sd-status-card" data-sd-status={sdStatusKey}>
                        {/* Left: icon + label */}
                        <div className="sd-status-left">
                            <div className="sd-status-icon-wrap">
                                <StatusIcon className="sd-status-icon" />
                            </div>
                            <div>
                                <p className="sd-status-label">{statusMeta?.label}</p>
                                <p className="sd-status-hint">{statusMeta?.hint}</p>
                            </div>
                        </div>

                        {/* Right: CTA */}
                        {canSettle && !isFullySettled && (
                            <button
                                className="sd-settle-btn"
                                onClick={() => setWizardOpen(true)}
                            >
                                Settle Deposit
                            </button>
                        )}
                        {isFullySettled && (
                            <span className="sd-settled-badge"> Fully Settled</span>
                        )}
                    </div>

                    {/* AMOUNTS GRID */}
                    <div className="sd-amounts">
                        <div className="sd-amount-card">
                            <span className="sd-amount-label">Total Deposit</span>
                            <span className="sd-amount-value">{formatRs(totalPaisa)}</span>
                        </div>
                        <div className="sd-amount-card highlight">
                            <span className="sd-amount-label">Remaining Balance</span>
                            <span className="sd-amount-value">{formatRs(remainingPaisa)}</span>
                        </div>
                        <div className="sd-amount-card">
                            <span className="sd-amount-label">Mode</span>
                            <span className="sd-amount-value mode">{MODE_LABELS[sd.mode] ?? sd.mode}</span>
                        </div>
                        <div className="sd-amount-card">
                            <span className="sd-amount-label">Received</span>
                            <span className="sd-amount-value date">
                                {sd.nepaliDate ? `${sd.nepaliDate} BS` : "—"}
                            </span>
                        </div>
                    </div>

                    {/* BALANCE BAR */}
                    <SdBalanceBar totalPaisa={totalPaisa} remainingPaisa={remainingPaisa} />

                    {/* CHEQUE / BG DETAILS */}
                    {sd.mode === "cheque" && sd.chequeDetails?.chequeNumber && (
                        <div className="sd-detail-row">
                            <span className="sd-detail-label">Cheque</span>
                            <span className="sd-detail-value">
                                #{sd.chequeDetails.chequeNumber} — {sd.chequeDetails.bankName ?? ""}
                                {sd.chequeDetails.chequeDate
                                    ? ` (${new Date(sd.chequeDetails.chequeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`
                                    : ""}
                            </span>
                        </div>
                    )}
                    {sd.mode === "bank_guarantee" && sd.bankGuaranteeDetails?.bgNumber && (
                        <div className="sd-detail-row">
                            <span className="sd-detail-label">Bank Guarantee</span>
                            <span className="sd-detail-value">
                                #{sd.bankGuaranteeDetails.bgNumber} — {sd.bankGuaranteeDetails.bankName ?? ""}
                                {sd.bankGuaranteeDetails.expiryDate
                                    ? ` · Expires ${new Date(sd.bankGuaranteeDetails.expiryDate).toLocaleDateString()}`
                                    : ""}
                            </span>
                        </div>
                    )}

                    {/* DIVIDER */}
                    <div className="sd-section-divider" />

                    {/* SETTLEMENT HISTORY */}
                    <SdRefundHistory
                        sdId={sd._id}
                        onInitiateRefund={canSettle && !isFullySettled ? () => setWizardOpen(true) : undefined}
                    />
                </div>
            )}

            {/* WIZARD PORTAL */}
            {wizardOpen && sd && (
                <SdRefundWizard
                    sdId={sd._id}
                    blockId={blockId}
                    onSuccess={() => {
                        setWizardOpen(false);
                        fetchSd(); // refresh SD status after settlement
                    }}
                    onClose={() => setWizardOpen(false)}
                />
            )}
        </>
    );
}