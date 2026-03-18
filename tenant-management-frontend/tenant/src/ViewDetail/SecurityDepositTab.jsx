/**
 * SecurityDepositTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The Security Deposit tab inside ViewDetail.
 *
 * RESPONSIBILITIES:
 *   1. Fetch the tenant's SD via GET /api/sd/by-tenant/:tenantId
 *   2. Show a rich status card (balance bar, mode, status)
 *   3. Show full settlement history (SdRefundHistory)
 *   4. Gate the "Settle SD" button by SD status and user role
 *   5. Open SdRefundWizard as a portal overlay when triggered
 *
 * ROLE GATING:
 *   - staff:       read-only (no settle button)
 *   - admin:       can settle
 *   - super_admin: can settle + can reverse within 24h (handled inside wizard)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
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
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.1)",
        border: "rgba(245,158,11,0.25)",
        hint: "Security deposit has been agreed but not yet received.",
    },
    paid: {
        icon: CheckCircle2,
        label: "Held",
        color: "#10b981",
        bg: "rgba(16,185,129,0.08)",
        border: "rgba(16,185,129,0.25)",
        hint: "Security deposit is being held. Ready for settlement on vacancy.",
    },
    held_as_bg: {
        icon: ShieldCheck,
        label: "Bank Guarantee",
        color: "#3b82f6",
        bg: "rgba(59,130,246,0.08)",
        border: "rgba(59,130,246,0.25)",
        hint: "A bank guarantee is on file in lieu of cash deposit.",
    },
    partially_refunded: {
        icon: ArrowRightLeft,
        label: "Partially Settled",
        color: "#8b5cf6",
        bg: "rgba(139,92,246,0.08)",
        border: "rgba(139,92,246,0.25)",
        hint: "Some portion has been settled. Remaining balance is held.",
    },
    refunded: {
        icon: CheckCircle2,
        label: "Fully Settled",
        color: "#64748b",
        bg: "rgba(100,116,139,0.08)",
        border: "rgba(100,116,139,0.2)",
        hint: "Security deposit has been fully settled.",
    },
    adjusted: {
        icon: CheckCircle2,
        label: "Adjusted",
        color: "#64748b",
        bg: "rgba(100,116,139,0.08)",
        border: "rgba(100,116,139,0.2)",
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
    const StatusIcon = statusMeta?.icon ?? ShieldCheck;

    // ── SD is fully settled — disable button ─────────────────────────────────
    const isFullySettled = sd?.status === "refunded" || sd?.status === "adjusted";

    // ── Remaining paisa ───────────────────────────────────────────────────────
    // The SD document has a virtual `remainingAmountPaisa` — if not present,
    // fall back to amountPaisa (nothing settled yet)
    const remainingPaisa = sd?.remainingAmountPaisa ?? sd?.amountPaisa ?? 0;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{sdTabCSS}</style>

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
                    <div
                        className="sd-status-card"
                        style={{ "--s-color": statusMeta?.color, "--s-bg": statusMeta?.bg, "--s-border": statusMeta?.border }}
                    >
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
                            <span className="sd-settled-badge">✓ Fully Settled</span>
                        )}
                    </div>

                    {/* AMOUNTS GRID */}
                    <div className="sd-amounts">
                        <div className="sd-amount-card">
                            <span className="sd-amount-label">Total Deposit</span>
                            <span className="sd-amount-value">{formatRs(sd.amountPaisa)}</span>
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
                    <SdBalanceBar totalPaisa={sd.amountPaisa} remainingPaisa={remainingPaisa} />

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

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — scoped to this component, uses existing project CSS variables
// so light/dark mode is respected automatically.
// ─────────────────────────────────────────────────────────────────────────────

const sdTabCSS = `
  /* Loading */
  .sd-loading {
    display: flex; align-items: center; gap: 10px;
    padding: 2.5rem; color: var(--color-text-sub, #94a3b8);
    font-size: 0.875rem; justify-content: center;
  }
  .sd-spinner {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--color-border, rgba(255,255,255,0.1));
    border-top-color: var(--color-accent, #1a5276);
    animation: sd-spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes sd-spin { to { transform: rotate(360deg); } }

  /* Error */
  .sd-error {
    display: flex; align-items: center; gap: 8px;
    background: var(--color-danger-bg, rgba(239,68,68,0.08));
    border: 1px solid var(--color-danger-border, rgba(239,68,68,0.25));
    color: var(--color-danger, #ef4444);
    border-radius: 10px; padding: 0.875rem 1rem; font-size: 0.875rem;
  }

  /* Empty */
  .sd-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 3.5rem 1rem; gap: 0.75rem;
    text-align: center;
  }
  .sd-empty-icon {
    width: 3rem; height: 3rem;
    color: var(--color-text-sub, #94a3b8); opacity: 0.4;
  }
  .sd-empty-title {
    font-size: 1rem; font-weight: 600;
    color: var(--color-foreground, #f1f5f9); margin: 0;
  }
  .sd-empty-sub {
    font-size: 0.82rem; color: var(--color-text-sub, #94a3b8);
    max-width: 340px; margin: 0; line-height: 1.6;
  }

  /* Wrap */
  .sd-wrap {
    display: flex; flex-direction: column; gap: 1rem;
  }

  /* Status card */
  .sd-status-card {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
    background: var(--s-bg); border: 1px solid var(--s-border);
    border-radius: 14px; padding: 1rem 1.25rem;
  }
  .sd-status-left { display: flex; align-items: center; gap: 0.875rem; }
  .sd-status-icon-wrap {
    width: 40px; height: 40px; border-radius: 10px;
    background: color-mix(in srgb, var(--s-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--s-color) 30%, transparent);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sd-status-icon { width: 1.1rem; height: 1.1rem; color: var(--s-color); }
  .sd-status-label {
    font-size: 0.9rem; font-weight: 600;
    color: var(--color-foreground, #f1f5f9); margin: 0 0 3px;
  }
  .sd-status-hint {
    font-size: 0.75rem; color: var(--color-text-sub, #94a3b8); margin: 0;
    max-width: 380px; line-height: 1.5;
  }

  /* Settle CTA */
  .sd-settle-btn {
    background: var(--color-accent, #1a5276);
    color: #fff; border: none; border-radius: 8px;
    padding: 0.5rem 1.125rem; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    transition: background 0.15s, transform 0.1s;
    flex-shrink: 0;
  }
  .sd-settle-btn:hover { background: #2980b9; transform: translateY(-1px); }
  .sd-settled-badge {
    font-size: 0.78rem; font-weight: 600;
    color: var(--color-success, #10b981);
    background: var(--color-success-bg, rgba(16,185,129,0.1));
    border: 1px solid var(--color-success-border, rgba(16,185,129,0.25));
    border-radius: 6px; padding: 4px 10px; white-space: nowrap;
  }

  /* Amounts grid */
  .sd-amounts {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.625rem;
  }
  @media (min-width: 480px) {
    .sd-amounts { grid-template-columns: repeat(4, 1fr); }
  }
  .sd-amount-card {
    background: var(--color-surface, rgba(255,255,255,0.03));
    border: 1px solid var(--color-border, rgba(255,255,255,0.08));
    border-radius: 10px; padding: 0.75rem 0.875rem;
    display: flex; flex-direction: column; gap: 5px;
  }
  .sd-amount-card.highlight {
    background: rgba(26, 82, 118, 0.15);
    border-color: rgba(41, 128, 185, 0.35);
  }
  .sd-amount-label {
    font-size: 0.68rem; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--color-text-sub, #94a3b8);
  }
  .sd-amount-value {
    font-size: 1rem; font-weight: 700;
    color: var(--color-foreground, #f1f5f9);
  }
  .sd-amount-card.highlight .sd-amount-value { color: #60a5fa; }
  .sd-amount-value.mode, .sd-amount-value.date {
    font-size: 0.875rem; font-weight: 500;
  }

  /* Balance bar */
  .sd-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
  .sd-bar {
    height: 7px; border-radius: 99px; overflow: hidden; display: flex;
    background: var(--color-border, rgba(255,255,255,0.06));
  }
  .sd-bar-seg { height: 100%; transition: width 0.4s ease; }
  .sd-bar-seg.settled { background: #10b981; }
  .sd-bar-seg.remaining { background: #1a5276; flex: 1; }
  .sd-bar-labels {
    display: flex; gap: 1.25rem; flex-wrap: wrap;
    font-size: 0.72rem; color: var(--color-text-sub, #94a3b8);
    align-items: center;
  }
  .sd-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }
  .sd-dot.settled { background: #10b981; }
  .sd-dot.remaining { background: #1a5276; }

  /* Detail row (cheque / BG) */
  .sd-detail-row {
    display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap;
    background: var(--color-surface, rgba(255,255,255,0.03));
    border: 1px solid var(--color-border, rgba(255,255,255,0.07));
    border-radius: 8px; padding: 0.625rem 0.875rem;
  }
  .sd-detail-label {
    font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--color-text-sub, #94a3b8);
    white-space: nowrap;
  }
  .sd-detail-value {
    font-size: 0.85rem; color: var(--color-foreground, #e2e8f0);
  }

  /* Section divider */
  .sd-section-divider {
    height: 1px; background: var(--color-border, rgba(255,255,255,0.07));
    margin: 0.25rem 0;
  }
`;