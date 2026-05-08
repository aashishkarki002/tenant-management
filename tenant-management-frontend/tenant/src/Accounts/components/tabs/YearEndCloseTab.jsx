import { useState } from "react";
import { useYearEndClose } from "../../hooks/useYearEndClose";
import { getCurrentFiscalYear } from "../../utils/nepaliCalendar";
import { fmtK } from "../../utils/formatter";

const MONTH_LABELS = [
  "", "Baisakh", "Jestha", "Ashad",
  "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush",
  "Magh", "Falgun", "Chaitra",
];

function StatusBadge({ status }) {
  const map = {
    COMPLETED: "bg-green-100 text-green-800",
    PENDING:   "bg-yellow-100 text-yellow-800",
    FAILED:    "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function fmtPaisa(p) {
  if (p == null) return "—";
  const sign = p < 0 ? "-" : "";
  return `${sign}Rs ${fmtK(Math.abs(p) / 100)}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NP", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

export default function YearEndCloseTab({ entityId }) {
  const currentFY = getCurrentFiscalYear();
  const [fiscalYear, setFiscalYear] = useState(currentFY);
  const [closeNote, setCloseNote]   = useState("");
  const [reopenNote, setReopenNote] = useState("");
  const [showCloseModal, setShowCloseModal]   = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { status, history, loading, error, refetch, closeYear, reopenYear } =
    useYearEndClose(entityId, fiscalYear);

  const handleClose = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await closeYear({ closeNote });
      setShowCloseModal(false);
      setCloseNote("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenNote.trim()) {
      setActionError("Reopen note is required.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await reopenYear({ reopenNote });
      setShowReopenModal(false);
      setReopenNote("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isCompleted = status?.closeDoc?.status === "COMPLETED";
  const canClose    = status?.canClose;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-body)]">
            Year-End Close
          </h2>
          <p className="text-[12px] text-[var(--color-text-sub)] mt-0.5">
            Zero out revenue & expense accounts and carry forward net income to Retained Earnings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
            className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
          >
            {[currentFY, currentFY - 1, currentFY - 2].map(y => (
              <option key={y} value={y}>FY {y}/{String(y + 1).slice(2)}</option>
            ))}
          </select>

          {isCompleted ? (
            <button
              onClick={() => { setShowReopenModal(true); setActionError(null); }}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"
            >
              Reopen Year
            </button>
          ) : (
            <button
              disabled={!canClose || loading}
              onClick={() => { setShowCloseModal(true); setActionError(null); }}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Execute Year-End Close
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {(error || actionError) && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
          {error ?? actionError}
        </div>
      )}

      {/* FY Summary Card */}
      {status?.closeDoc && (
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-wrap gap-6">
          <div>
            <p className="text-[11px] text-[var(--color-text-sub)] mb-0.5">Status</p>
            <StatusBadge status={status.closeDoc.status} />
          </div>
          <div>
            <p className="text-[11px] text-[var(--color-text-sub)] mb-0.5">Total Revenue</p>
            <p className="text-[14px] font-semibold text-green-600">{fmtPaisa(status.closeDoc.totalRevenuePaisa)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--color-text-sub)] mb-0.5">Total Expenses</p>
            <p className="text-[14px] font-semibold text-red-600">{fmtPaisa(status.closeDoc.totalExpensePaisa)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--color-text-sub)] mb-0.5">Net Income</p>
            <p className={`text-[14px] font-bold ${(status.closeDoc.netIncomePaisa ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmtPaisa(status.closeDoc.netIncomePaisa)}
            </p>
          </div>
          {status.closeDoc.closedAt && (
            <div>
              <p className="text-[11px] text-[var(--color-text-sub)] mb-0.5">Closed</p>
              <p className="text-[12px] text-[var(--color-text-body)]">{fmtDate(status.closeDoc.closedAt)}</p>
            </div>
          )}
        </div>
      )}

      {/* Period checklist */}
      {status?.periods && (
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text-body)] mb-2">
            Monthly Periods — {status.openPeriods?.length ?? 0} open
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {status.periods.map((p) => (
              <div
                key={`${p.nepaliYear}-${p.nepaliMonth}`}
                className={`p-2 rounded-lg border text-center text-[11px] font-medium ${
                  p.isClosed
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-orange-200 bg-orange-50 text-orange-700"
                }`}
              >
                <div>{MONTH_LABELS[p.nepaliMonth] ?? p.nepaliMonth}</div>
                <div className="text-[10px] opacity-70">{p.nepaliYear}</div>
                <div className="mt-0.5">{p.isClosed ? "✓" : "○"}</div>
              </div>
            ))}
          </div>
          {(status.openPeriods?.length ?? 0) > 0 && (
            <p className="mt-2 text-[11px] text-orange-600">
              Close all {status.openPeriods.length} open period(s) before executing year-end close.
            </p>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text-body)] mb-2">Close History</h3>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">FY</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Net Income</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Closed By</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Closed At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[var(--color-text-body)]">
                      FY {h.fiscalYear}/{String(h.fiscalYear + 1).slice(2)}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={h.status} /></td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${(h.netIncomePaisa ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtPaisa(h.netIncomePaisa)}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {h.closedBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">{fmtDate(h.closedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Close modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 shadow-2xl">
            <h3 className="text-[15px] font-bold text-[var(--color-text-body)] mb-2">
              Execute Year-End Close
            </h3>
            <p className="text-[12px] text-[var(--color-text-sub)] mb-4">
              This will zero out all Revenue and Expense accounts and transfer net income to Retained Earnings.
              <strong className="text-[var(--color-text-body)]"> This cannot be undone without reopening.</strong>
            </p>
            <textarea
              placeholder="Close note (optional)"
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              rows={2}
              className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] mb-3 resize-none"
            />
            {actionError && (
              <p className="text-[11px] text-red-600 mb-2">{actionError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-sub)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {actionLoading ? "Processing..." : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 shadow-2xl">
            <h3 className="text-[15px] font-bold text-orange-700 mb-2">
              Reopen Year-End Close
            </h3>
            <p className="text-[12px] text-[var(--color-text-sub)] mb-4">
              This reopens the fiscal year for corrections. A reason is required.
            </p>
            <textarea
              placeholder="Reason for reopening (required)"
              value={reopenNote}
              onChange={e => setReopenNote(e.target.value)}
              rows={2}
              className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-body)] mb-3 resize-none"
            />
            {actionError && (
              <p className="text-[11px] text-red-600 mb-2">{actionError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-sub)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-orange-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {actionLoading ? "Processing..." : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
