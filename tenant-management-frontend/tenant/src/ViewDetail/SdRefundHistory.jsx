// ─────────────────────────────────────────────────────────────────────────────
// SdRefundHistory.jsx
// Shows all settlement records for a single SD — used in the tenant detail tab.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import api from "../../plugins/axios";

const TYPE_LABELS = {
    CASH_REFUND: "Cash Refund",
    MAINTENANCE_ADJUSTMENT: "Maintenance Deduction",
    MAINTENANCE_EXPENSE_OFFSET: "Expense Offset",
    RENT_ADJUSTMENT: "Rent Adjustment",
    CAM_ADJUSTMENT: "CAM Adjustment",
    ELECTRICITY_ADJUSTMENT: "Electricity Adjustment",
};

const TYPE_ICONS = {
    CASH_REFUND: "₹",
    MAINTENANCE_ADJUSTMENT: "🔧",
    MAINTENANCE_EXPENSE_OFFSET: "📋",
    RENT_ADJUSTMENT: "🏠",
    CAM_ADJUSTMENT: "🏢",
    ELECTRICITY_ADJUSTMENT: "⚡",
};

const STATUS_STYLES = {
    DRAFT: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8", label: "Draft" },
    CONFIRMED: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", label: "Confirmed" },
    POSTED: { bg: "rgba(16,185,129,0.15)", color: "#10b981", label: "Posted" },
    REVERSED: { bg: "rgba(239,68,68,0.12)", color: "#fca5a5", label: "Reversed" },
};

function formatRs(paisa) {
    if (!paisa && paisa !== 0) return "—";
    return `रू ${(paisa / 100).toLocaleString("en-IN")}`;
}

export default function SdRefundHistory({ sdId, onInitiateRefund }) {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        if (!sdId) return;
        api
            .get(`/sd-refund/by-sd/${sdId}`)
            .then((r) => setRefunds(r.data.data ?? []))
            .finally(() => setLoading(false));
    }, [sdId]);

    if (loading) {
        return <div style={{ color: "#64748b", padding: "1rem", fontSize: "0.85rem" }}>Loading settlement history…</div>;
    }

    return (
        <>
            <style>{historyCSS}</style>
            <div className="sdrh-wrap">
                <div className="sdrh-header">
                    <h4 className="sdrh-title">Settlement History</h4>
                    {onInitiateRefund && (
                        <button className="sdrh-action-btn" onClick={onInitiateRefund}>
                            + New Settlement
                        </button>
                    )}
                </div>

                {refunds.length === 0 ? (
                    <div className="sdrh-empty">No settlements recorded yet.</div>
                ) : (
                    <div className="sdrh-list">
                        {refunds.map((r) => {
                            const status = STATUS_STYLES[r.status] ?? STATUS_STYLES.DRAFT;
                            const isExpanded = expanded === r._id;
                            return (
                                <div
                                    key={r._id}
                                    className={`sdrh-row${isExpanded ? " open" : ""}`}
                                    onClick={() => setExpanded(isExpanded ? null : r._id)}
                                >
                                    <div className="sdrh-row-main">
                                        <div className="sdrh-row-left">
                                            <span
                                                className="sdrh-status"
                                                style={{ background: status.bg, color: status.color }}
                                            >
                                                {status.label}
                                            </span>
                                            <div>
                                                <p className="sdrh-date">{r.nepaliDate} (BS)</p>
                                                <p className="sdrh-by">by {r.processedBy?.name ?? "Admin"}</p>
                                            </div>
                                        </div>
                                        <div className="sdrh-row-right">
                                            <span className="sdrh-total">{formatRs(r.totalAmountPaisa)}</span>
                                            <span className="sdrh-chevron">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="sdrh-detail">
                                            {r.lineItems?.map((item, i) => (
                                                <div key={i} className="sdrh-line-item">
                                                    <span className="sdrh-li-icon">{TYPE_ICONS[item.type] ?? "•"}</span>
                                                    <span className="sdrh-li-label">
                                                        {TYPE_LABELS[item.type] ?? item.type}
                                                        {item.note ? ` — ${item.note}` : ""}
                                                    </span>
                                                    <span className="sdrh-li-amount">{formatRs(item.amountPaisa)}</span>
                                                </div>
                                            ))}
                                            {r.internalNotes && (
                                                <p className="sdrh-notes">📝 {r.internalNotes}</p>
                                            )}
                                            {r.status === "REVERSED" && (
                                                <div className="sdrh-reversed-note">
                                                    Reversed on {r.reversedAt ? new Date(r.reversedAt).toLocaleDateString() : "—"}
                                                    {r.reversalReason ? ` — ${r.reversalReason}` : ""}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

const historyCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

  .sdrh-wrap { font-family: 'DM Sans', sans-serif; }
  .sdrh-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 0.875rem;
  }
  .sdrh-title { font-size: 0.9rem; font-weight: 600; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
  .sdrh-action-btn {
    background: rgba(26,82,118,0.3); border: 1px solid rgba(41,128,185,0.4);
    color: #60a5fa; border-radius: 6px; padding: 5px 12px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s;
  }
  .sdrh-action-btn:hover { background: rgba(26,82,118,0.5); }
  .sdrh-empty { color: #475569; font-size: 0.85rem; padding: 0.5rem 0; }
  .sdrh-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .sdrh-row {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; overflow: hidden; cursor: pointer;
    transition: border-color 0.15s;
  }
  .sdrh-row:hover { border-color: rgba(255,255,255,0.12); }
  .sdrh-row.open { border-color: rgba(41,128,185,0.3); }
  .sdrh-row-main {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem;
  }
  .sdrh-row-left { display: flex; align-items: center; gap: 0.75rem; }
  .sdrh-status {
    padding: 3px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap;
  }
  .sdrh-date { font-size: 0.85rem; color: #e2e8f0; margin: 0 0 2px; font-weight: 500; }
  .sdrh-by { font-size: 0.75rem; color: #64748b; margin: 0; }
  .sdrh-row-right { display: flex; align-items: center; gap: 0.875rem; }
  .sdrh-total { font-weight: 600; color: #f1f5f9; font-size: 0.95rem; }
  .sdrh-chevron { color: #475569; font-size: 0.65rem; }
  .sdrh-detail {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem;
  }
  .sdrh-line-item {
    display: flex; align-items: center; gap: 0.625rem;
    font-size: 0.82rem;
  }
  .sdrh-li-icon { flex-shrink: 0; }
  .sdrh-li-label { color: #94a3b8; flex: 1; }
  .sdrh-li-amount { font-weight: 600; color: #e2e8f0; white-space: nowrap; }
  .sdrh-notes { font-size: 0.78rem; color: #64748b; margin: 0; font-style: italic; }
  .sdrh-reversed-note {
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.78rem;
  }
`;


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS.JS ADDITION
// Add this to your existing ACCOUNT_CODES object in accounts.js:
// ─────────────────────────────────────────────────────────────────────────────

/*
  // ── Maintenance Revenue (new — must be seeded) ─────────────────────────────
  //
  // Credited when SD is withheld for repairs/maintenance.
  // Distinct from REVENUE ("4000") so maintenance deductions appear
  // separately in the P&L statement and can be filtered independently.
  //
  // Add Account "4300" to your seed script (seedLoanAccounts.js or a new
  // seedMiscAccounts.js) for every OwnershipEntity:
  //
  //   { code: "4300", name: "Maintenance Revenue", type: "REVENUE", entityId: X }
  //
  MAINTENANCE_REVENUE: "4300",
*/


// ─────────────────────────────────────────────────────────────────────────────
// MODULE README
// ─────────────────────────────────────────────────────────────────────────────

/*
╔══════════════════════════════════════════════════════════════════════════════╗
║          SD REFUND MODULE — SENIOR ARCHITECT REFERENCE                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

  FILES TO CREATE:
  ─────────────────────────────────────────────────────────────────────────────
  backend/
    src/modules/sdRefund/
      SdRefund.Model.js          ← Mongoose model (lineItems, status lifecycle)
      sdRefund.service.js        ← Business logic (preflight, draft, post, reverse)
      sdRefund.controller.js     ← Thin HTTP layer + inline routes

    src/modules/ledger/journal-builders/
      sdRefund.builder.js        ← Produces the canonical journal payload

  frontend/
    src/ViewDetail/components/
      SdRefundWizard.jsx          ← 4-step settlement wizard
      SdRefundHistory.jsx         ← Audit history for the tenant detail tab

  ─────────────────────────────────────────────────────────────────────────────
  REGISTRATION (app.js):
  ─────────────────────────────────────────────────────────────────────────────
    import sdRefundRoutes from "./modules/sdRefund/sdRefund.controller.js";
    app.use("/api/sd-refund", sdRefundRoutes);

  ─────────────────────────────────────────────────────────────────────────────
  DB CHANGES (none destructive):
  ─────────────────────────────────────────────────────────────────────────────
    1. New collection: sdrefunds
    2. Add "SdRefund" to Transaction.referenceType enum (if strict enum)
    3. Seed Account "4300" (Maintenance Revenue) for every OwnershipEntity

  ─────────────────────────────────────────────────────────────────────────────
  ADJUSTMENT TYPES + DOUBLE ENTRY:
  ─────────────────────────────────────────────────────────────────────────────

    CASH_REFUND
      DR  2100  Security Deposit Liability
      CR  1010* Bank / Cash sub-account          (* resolved by bankAccountCode)

    MAINTENANCE_ADJUSTMENT (deduct → revenue)
      DR  2100  Security Deposit Liability
      CR  4300  Maintenance Revenue

    MAINTENANCE_EXPENSE_OFFSET (deduct → contra expense)
      DR  2100  Security Deposit Liability
      CR  5000  General Expense                  (reduces expense balance)

    RENT_ADJUSTMENT | CAM_ADJUSTMENT | ELECTRICITY_ADJUSTMENT
      DR  2100  Security Deposit Liability
      CR  1200  Accounts Receivable              (clears tenant's open debt)

    COMPOUND: any combination above — one DR per line, balanced journal.

  ─────────────────────────────────────────────────────────────────────────────
  STATUS LIFECYCLE:
  ─────────────────────────────────────────────────────────────────────────────
    DRAFT ──► CONFIRMED ──► POSTED ──► (REVERSED within 24h, super_admin only)

    - DRAFT:    created by wizard step 2 (before user confirms)
    - POSTED:   confirmAndPost() writes atomic journal + updates SD
    - REVERSED: reverseJournalEntry() + rollback SD.refundHistory

  ─────────────────────────────────────────────────────────────────────────────
  API ROUTES:
  ─────────────────────────────────────────────────────────────────────────────
    GET  /api/sd-refund/preflight/:sdId          → balance check + open dues
    GET  /api/sd-refund/by-sd/:sdId              → list all settlements for SD
    GET  /api/sd-refund/:refundId                → single settlement detail
    POST /api/sd-refund/draft                    → create DRAFT
    POST /api/sd-refund/:refundId/confirm        → DRAFT → POSTED (ledger write)
    POST /api/sd-refund/:refundId/reverse        → POSTED → REVERSED (super_admin)

  ─────────────────────────────────────────────────────────────────────────────
  INVARIANTS (enforced in service):
  ─────────────────────────────────────────────────────────────────────────────
    1. Sum(non-REVERSED SdRefund.totalAmountPaisa) ≤ Sd.amountPaisa
    2. POSTED SdRefund.transactionId always set
    3. Every write uses MongoDB session (atomic across Sd + SdRefund + LedgerEntry)
    4. postJournalEntry idempotency guard: duplicate referenceId → no-op (safe retry)
    5. All amounts in paisa (integers). Zero and negative amounts rejected.
    6. MAINTENANCE_REVENUE "4300" must be seeded before first maintenance adjustment.

  ─────────────────────────────────────────────────────────────────────────────
  FRONTEND USAGE:
  ─────────────────────────────────────────────────────────────────────────────
    // In tenant detail page (ViewDetail SecurityDepositsTab):
    import SdRefundWizard from "./SdRefundWizard.jsx";
    import SdRefundHistory from "./SdRefundHistory.jsx";

    <SdRefundHistory sdId={sd._id} onInitiateRefund={() => setWizardOpen(true)} />
    {wizardOpen && (
      <SdRefundWizard
        sdId={sd._id}
        blockId={tenant.block}
        onSuccess={() => { setWizardOpen(false); refetchSd(); }}
        onClose={() => setWizardOpen(false)}
      />
    )}
*/