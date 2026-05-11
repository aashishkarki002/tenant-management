import { useState } from "react";
import { useAuditLog, useAuditEventTypes } from "../../hooks/useAuditLog";
import { fmtRs } from "../../../utils/formatter";

const EVENT_LABELS = {
  TRANSACTION_CREATED:      "Transaction Created",
  TRANSACTION_VOIDED:       "Transaction Voided",
  TRANSACTION_REVERSED:     "Transaction Reversed",
  PERIOD_CLOSED:            "Period Closed",
  PERIOD_REOPENED:          "Period Reopened",
  YEAR_END_CLOSED:          "Year-End Closed",
  YEAR_END_REOPENED:        "Year-End Reopened",
  TENANT_VACATED:           "Tenant Vacated",
  LEDGER_LOCKED:            "Ledger Locked",
  ADJUSTMENT_POSTED:        "Adjustment Posted",
  DEBIT_NOTE_POSTED:        "Debit Note",
  CREDIT_NOTE_POSTED:       "Credit Note",
  BUDGET_CREATED:           "Budget Created",
  BUDGET_UPDATED:           "Budget Updated",
  ACCOUNT_BALANCE_REBUILT:  "Balance Rebuilt",
};

const EVENT_COLORS = {
  TRANSACTION_CREATED:     "bg-green-100 text-green-800",
  TRANSACTION_VOIDED:      "bg-red-100 text-red-800",
  TRANSACTION_REVERSED:    "bg-orange-100 text-orange-800",
  PERIOD_CLOSED:           "bg-blue-100 text-blue-800",
  PERIOD_REOPENED:         "bg-yellow-100 text-yellow-800",
  YEAR_END_CLOSED:         "bg-purple-100 text-purple-800",
  YEAR_END_REOPENED:       "bg-orange-100 text-orange-800",
  TENANT_VACATED:          "bg-gray-100 text-gray-800",
  LEDGER_LOCKED:           "bg-red-100 text-red-800",
  ADJUSTMENT_POSTED:       "bg-teal-100 text-teal-800",
  DEBIT_NOTE_POSTED:       "bg-amber-100 text-amber-800",
  CREDIT_NOTE_POSTED:      "bg-sky-100 text-sky-800",
  ACCOUNT_BALANCE_REBUILT: "bg-gray-100 text-gray-600",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NP", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditLogTab({ entityId }) {
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [page, setPage]           = useState(1);
  const limit = 50;

  const eventTypes = useAuditEventTypes();
  const { logs, total, pages, loading, error, refetch } = useAuditLog({
    entityId,
    eventType: eventType || undefined,
    startDate: startDate || undefined,
    endDate:   endDate   || undefined,
    page,
    limit,
  });

  const exportCSV = () => {
    const header = "Date,Event,Performed By,Amount (Rs),Period,Reason";
    const rows = logs.map(l => {
      const who    = l.performedBy?.name ?? l.performedBy ?? "—";
      const amount = l.amountPaisa != null ? (l.amountPaisa / 100).toFixed(2) : "";
      const period = l.nepaliYear ? `${l.nepaliYear}/${String(l.nepaliMonth ?? "").padStart(2,"0")}` : "";
      return [
        formatDate(l.performedAt),
        EVENT_LABELS[l.eventType] ?? l.eventType,
        who,
        amount,
        period,
        (l.reason ?? "").replace(/,/g, ";"),
      ].join(",");
    });
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-body)]">
            Audit Log
          </h2>
          <p className="text-[12px] text-[var(--color-text-sub)] mt-0.5">
            Immutable record of all accounting actions — IRD compliant
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || logs.length === 0}
          className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-sub)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <select
          value={eventType}
          onChange={e => { setEventType(e.target.value); setPage(1); }}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        >
          <option value="">All events</option>
          {eventTypes.map(t => (
            <option key={t} value={t}>{EVENT_LABELS[t] ?? t}</option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1); }}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1); }}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        />

        {(eventType || startDate || endDate) && (
          <button
            onClick={() => { setEventType(""); setStartDate(""); setEndDate(""); setPage(1); }}
            className="text-[11px] px-2 py-1 rounded-lg text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-[11px] text-[var(--color-text-sub)] self-center">
          {total} events total
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Date</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Event</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Performed By</th>
              <th className="text-right px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Amount</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Period</th>
              <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[var(--color-text-sub)]">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[var(--color-text-sub)]">
                  No audit events found
                </td>
              </tr>
            )}
            {!loading && logs.map((log, i) => (
              <tr
                key={log._id ?? i}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors"
              >
                <td className="px-4 py-2.5 text-[var(--color-text-sub)] whitespace-nowrap">
                  {formatDate(log.performedAt)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EVENT_COLORS[log.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                    {EVENT_LABELS[log.eventType] ?? log.eventType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-body)]">
                  {log.performedBy?.name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--color-text-body)]">
                  {log.amountPaisa != null
                    ? `Rs ${fmtRs(log.amountPaisa / 100)}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                  {log.nepaliYear
                    ? `${log.nepaliYear}/${String(log.nepaliMonth ?? "").padStart(2, "0")}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-sub)] max-w-[200px] truncate">
                  {log.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
          >
            Previous
          </button>
          <span className="text-[12px] text-[var(--color-text-sub)]">
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
