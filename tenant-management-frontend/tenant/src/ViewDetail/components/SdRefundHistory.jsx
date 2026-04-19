
import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import { Wrench, Home, Building, Lightbulb } from "lucide-react";
const TYPE_LABELS = {
  CASH_REFUND: "Cash Refund",
  MAINTENANCE_ADJUSTMENT: "Maintenance Deduction",
  MAINTENANCE_EXPENSE_OFFSET: "Expense Offset",
  RENT_ADJUSTMENT: "Rent Adjustment",
  CAM_ADJUSTMENT: "CAM Adjustment",
  ELECTRICITY_ADJUSTMENT: "Electricity Adjustment",
};

const TYPE_ICONS = {
  CASH_REFUND: " RS ",
  MAINTENANCE_ADJUSTMENT: <Wrench className="w-4 h-4" />,
  MAINTENANCE_EXPENSE_OFFSET: <Wrench className="w-4 h-4" />,
  RENT_ADJUSTMENT: <Home className="w-4 h-4" />,
  CAM_ADJUSTMENT: <Building className="w-4 h-4" />,
  ELECTRICITY_ADJUSTMENT: <Lightbulb className="w-4 h-4" />,
};

const STATUS_LABELS = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  POSTED: "Posted",
  REVERSED: "Reversed",
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
      .get(`api/sd-refund/by-sd/${sdId}`)
      .then((r) => setRefunds(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [sdId]);

  if (loading) {
    return <div className="sdrh-loading">Loading settlement history…</div>;
  }

  return (
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
            const statusKey =
              r.status in STATUS_LABELS ? r.status : "DRAFT";
            const statusLabel =
              STATUS_LABELS[r.status] ?? r.status ?? "—";
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
                      data-sdrh-status={statusKey}
                    >
                      {statusLabel}
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
                      <p className="sdrh-notes"> {r.internalNotes}</p>
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
  );
}

