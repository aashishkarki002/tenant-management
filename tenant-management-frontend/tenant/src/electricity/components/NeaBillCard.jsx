import React, { useState } from "react";
import {
  Zap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  ExternalLink,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

const fmtRs = (n) =>
  `Rs\u00a0${Number(n ?? 0).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
const fmtKwh = (n) =>
  `${Number(n ?? 0).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;

const STATUS_CONFIG = {
  finalized: { label: "Finalized", color: "var(--color-accent)",  bg: "var(--color-accent-light)" },
  paid:      { label: "Paid",      color: "var(--color-success)", bg: "var(--color-success-bg)"   },
  draft:     { label: "Draft",     color: "var(--color-warning)", bg: "var(--color-warning-bg)"   },
};

/* ─── Pay Dialog ────────────────────────────────────────────────────────────── */

function PayDialog({ bill, onPay, paying, onClose }) {
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onPay(bill._id, { paymentMethod: method, paymentDate: date });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          width: "100%",
          maxWidth: "380px",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-strong)", marginBottom: "4px" }}>
          Pay NEA Bill
        </p>
        <p style={{ fontSize: "12px", color: "var(--color-text-sub)", marginBottom: "20px" }}>
          Records{" "}
          <strong style={{ color: "var(--color-text-strong)" }}>
            {fmtRs(bill.reconciliation?.neaBillTotal ?? bill.totalAmount)}
          </strong>{" "}
          as paid — DR NEA Payable / CR Cash/Bank
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Payment method */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-sub)", display: "block", marginBottom: "6px" }}>
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-strong)",
                fontSize: "13px",
              }}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          {/* Payment date */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-sub)", display: "block", marginBottom: "6px" }}>
              Payment Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-strong)",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                backgroundColor: "transparent",
                color: "var(--color-text-body)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paying}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: "var(--color-accent)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: paying ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                opacity: paying ? 0.7 : 1,
              }}
            >
              {paying && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
              {paying ? "Recording…" : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Bill Document (full card) ─────────────────────────────────────────────── */

function BillDocument({ bill, onPay, paying }) {
  const [showPay, setShowPay] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);

  const recon   = bill.reconciliation ?? {};
  const status  = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.finalized;
  const month   = NEPALI_MONTH_NAMES[(bill.nepaliMonth ?? 1) - 1] ?? "";
  const period  = `${month} ${bill.nepaliYear}`;
  const hasPdf  = Boolean(bill.ftpPath);
  const isPaid  = bill.status === "paid";

  const totalPaisa   = recon.neaBillTotal  ?? bill.totalAmount ?? 0;
  // energyChargeAmount / demandCharge are rupee virtuals serialised by the API
  const energyCharge = bill.energyChargeAmount ?? null;
  const demandCharge = bill.demandCharge ?? recon.demandCharge ?? null;
  const hasRecon     = recon.systemNeaCost != null;

  const diff      = recon.costDifference ?? 0;
  const isShort   = recon.shortfall;
  const isSurplus = recon.surplus;

  const handlePay = async (billId, paymentData) => {
    await onPay(billId, paymentData);
    setShowPay(false);
  };

  return (
    <>
      {/* Bill document card */}
      <div
        style={{
          backgroundColor: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* ── Bill header ── */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 80%, #000) 100%)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                Nepal Electricity Authority
              </p>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                {period}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {hasPdf && (
              <a
                href={bill.ftpPath}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <FileText size={11} />
                PDF
              </a>
            )}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "99px",
                color: isPaid ? "var(--color-success)" : "var(--color-warning)",
                backgroundColor: isPaid ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                border: `1px solid ${isPaid ? "var(--color-success)" : "var(--color-warning)"}`,
              }}
            >
              {status.label}
            </span>
          </div>
        </div>

        {/* ── Bill body ── */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "0" }}>

          {/* Bill date */}
          {bill.billDate && (
            <p style={{ fontSize: "11px", color: "var(--color-text-sub)", marginBottom: "14px" }}>
              Bill Date: {new Date(bill.billDate).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          )}

          {/* Charge breakdown table */}
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              marginBottom: "14px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "12px",
                padding: "7px 14px",
                backgroundColor: "var(--color-muted)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)" }}>Description</span>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)", textAlign: "right" }}>Units</span>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)", textAlign: "right", minWidth: "100px" }}>Amount</span>
            </div>

            {/* Energy charge row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "12px",
                padding: "10px 14px",
                borderBottom: (demandCharge != null) ? "1px solid var(--color-border)" : "none",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>Energy Charge</p>
                <p style={{ fontSize: "11px", color: "var(--color-text-sub)", margin: 0 }}>Variable — per unit consumed</p>
              </div>
              <span style={{ fontSize: "13px", color: "var(--color-text-body)", fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" }}>
                {bill.totalUnits != null ? fmtKwh(bill.totalUnits) : "—"}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "100px" }}>
                {energyCharge != null ? fmtRs(energyCharge) : "—"}
              </span>
            </div>

            {/* Demand charge row */}
            {demandCharge != null && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "12px",
                  padding: "10px 14px",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>Demand Charge</p>
                  <p style={{ fontSize: "11px", color: "var(--color-text-sub)", margin: 0 }}>Fixed monthly — regardless of usage</p>
                </div>
                <span style={{ fontSize: "13px", color: "var(--color-text-sub)", textAlign: "right" }}>—</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "100px" }}>
                  {fmtRs(demandCharge)}
                </span>
              </div>
            )}

            {/* Total row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "12px",
                padding: "10px 14px",
                backgroundColor: "var(--color-muted)",
                borderTop: "2px solid var(--color-border)",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--color-text-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Payable</span>
              <span />
              <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--color-accent)", fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "100px" }}>
                {fmtRs(totalPaisa)}
              </span>
            </div>
          </div>

          {/* Pay button (if not paid) */}
          {!isPaid && (
            <button
              onClick={() => setShowPay(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                padding: "10px 16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-accent)",
                backgroundColor: "var(--color-accent-light)",
                color: "var(--color-accent)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
                marginBottom: "14px",
              }}
            >
              <CreditCard size={14} />
              Record NEA Payment
            </button>
          )}

          {/* Reconciliation toggle */}
          {hasRecon && (
            <>
              <button
                type="button"
                onClick={() => setReconOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 0",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid var(--color-border)",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)", flex: 1 }}>
                  Reconciliation
                </span>
                {/* Cost diff indicator */}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: isShort ? "var(--color-danger)" : isSurplus ? "var(--color-success)" : "var(--color-text-sub)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isShort ? "▲" : isSurplus ? "▼" : "="} {fmtRs(Math.abs(diff))} {isShort ? "shortfall" : isSurplus ? "surplus" : "balanced"}
                </span>
                {reconOpen ? <ChevronUp size={13} color="var(--color-text-sub)" /> : <ChevronDown size={13} color="var(--color-text-sub)" />}
              </button>

              {reconOpen && (
                <div style={{ paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Cost reconciliation */}
                  <div
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "7px 12px", backgroundColor: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)" }}>Cost Breakdown</span>
                    </div>
                    <ReconRow label="NEA Bill Total" value={fmtRs(recon.neaBillTotal)} />
                    <ReconRow label="System NEA Cost (readings)" value={fmtRs(recon.systemNeaCost)} />
                    <ReconRow
                      label="Difference"
                      value={fmtRs(Math.abs(diff))}
                      note={isShort ? "NEA charged more than system recorded" : isSurplus ? "System recorded more than NEA charged" : "Balanced"}
                      valueColor={isShort ? "var(--color-danger)" : isSurplus ? "var(--color-success)" : undefined}
                      last
                    />
                  </div>

                  {/* Unit reconciliation */}
                  {recon.purchasedUnits != null && recon.meteredUnitUnits != null && (
                    <div
                      style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: "7px 12px", backgroundColor: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)" }}>Unit Balance</span>
                      </div>
                      <ReconRow label="Purchased from NEA" value={fmtKwh(recon.purchasedUnits)} />
                      <ReconRow label="Metered to tenants" value={fmtKwh(recon.meteredUnitUnits)} />
                      {recon.unitLoss != null && (
                        <ReconRow
                          label={recon.unitLoss >= 0 ? "Unaccounted (loss)" : "Surplus metered"}
                          value={`${fmtKwh(Math.abs(recon.unitLoss))}${recon.lossPercent != null ? ` · ${recon.lossPercent}%` : ""}`}
                          note={recon.unitLoss > 0 ? "Common area + transformer loss" : "Meter over-reporting"}
                          valueColor={recon.unitLoss > 0 ? "var(--color-warning)" : "var(--color-success)"}
                          icon={recon.unitLoss > 0 ? TrendingDown : CheckCircle2}
                          last
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {bill.notes && (
            <p style={{ fontSize: "11px", color: "var(--color-text-sub)", fontStyle: "italic", marginTop: "12px", borderTop: "1px solid var(--color-border)", paddingTop: "10px" }}>
              {bill.notes}
            </p>
          )}
        </div>
      </div>

      {showPay && (
        <PayDialog
          bill={bill}
          onPay={handlePay}
          paying={paying}
          onClose={() => setShowPay(false)}
        />
      )}
    </>
  );
}

/* ─── Compact row (history table) ───────────────────────────────────────────── */

function CompactRow({ bill }) {
  const recon  = bill.reconciliation ?? {};
  const status = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.finalized;
  const month  = NEPALI_MONTH_NAMES[(bill.nepaliMonth ?? 1) - 1] ?? "";
  const period = `${month} ${bill.nepaliYear}`;
  const hasPdf = Boolean(bill.ftpPath);
  const diff   = recon.costDifference ?? 0;
  const isShort = recon.shortfall;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 70px 1fr 110px 110px 110px 24px",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border)",
        fontSize: "13px",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--color-text-strong)" }}>{period}</span>

      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: "99px",
          color: status.color,
          backgroundColor: status.bg,
          justifySelf: "start",
        }}
      >
        {status.label}
      </span>

      <span style={{ color: "var(--color-text-sub)", fontVariantNumeric: "tabular-nums" }}>
        {bill.totalUnits != null ? fmtKwh(bill.totalUnits) : "—"}
      </span>

      <span style={{ color: "var(--color-text-body)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
        {(bill.demandCharge ?? recon.demandCharge) != null ? fmtRs(bill.demandCharge ?? recon.demandCharge) : "—"}
      </span>

      <span style={{ fontWeight: 600, color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
        {fmtRs(recon.neaBillTotal ?? bill.totalAmount ?? 0)}
      </span>

      <span
        style={{
          fontWeight: 600,
          fontSize: "12px",
          color: recon.systemNeaCost != null
            ? (isShort ? "var(--color-danger)" : "var(--color-success)")
            : "var(--color-text-sub)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "3px",
        }}
      >
        {recon.systemNeaCost != null ? (
          <>
            {isShort
              ? <AlertTriangle size={11} />
              : <CheckCircle2 size={11} />}
            {fmtRs(Math.abs(diff))}
          </>
        ) : "—"}
      </span>

      {hasPdf ? (
        <a
          href={bill.ftpPath}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-accent)" }}
          title="View PDF"
        >
          <ExternalLink size={13} />
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}

/* ─── Public export ──────────────────────────────────────────────────────────── */

/**
 * NeaBillCard
 *
 * @param {Object}   bill      — NeaBill document with reconciliation
 * @param {boolean}  compact   — compact row (for history table)
 * @param {Function} onPay     — (billId, paymentData) => Promise — required when !compact
 * @param {boolean}  paying    — loading state from parent
 */
export function NeaBillCard({ bill, compact = false, onPay, paying = false }) {
  if (!bill) return null;
  if (compact) return <CompactRow bill={bill} />;
  return <BillDocument bill={bill} onPay={onPay} paying={paying} />;
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function ReconRow({ label, value, note, valueColor, icon: Icon, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "8px",
        padding: "9px 12px",
        borderBottom: last ? "none" : "1px solid var(--color-border)",
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--color-text-sub)" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
          {Icon && <Icon size={12} color={valueColor ?? "var(--color-text-sub)"} />}
          <span style={{ fontSize: "13px", fontWeight: 600, color: valueColor ?? "var(--color-text-strong)", fontVariantNumeric: "tabular-nums" }}>
            {value}
          </span>
        </div>
        {note && (
          <p style={{ fontSize: "10px", color: "var(--color-text-sub)", margin: "1px 0 0 0" }}>{note}</p>
        )}
      </div>
    </div>
  );
}
