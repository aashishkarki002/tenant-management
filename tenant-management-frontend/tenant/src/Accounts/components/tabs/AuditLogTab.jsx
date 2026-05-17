import { useState } from "react";
import { useAuditLog, useAuditEventTypes } from "../../hooks/useAuditLog";
import { fmtRs } from "../../../utils/formatter";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";

const EVENT_CATEGORY = {
  TRANSACTION_CREATED: "success",
  TRANSACTION_VOIDED: "danger",
  TRANSACTION_REVERSED: "warning",
  PERIOD_CLOSED: "info",
  PERIOD_REOPENED: "warning",
  YEAR_END_CLOSED: "accent",
  YEAR_END_REOPENED: "warning",
  TENANT_VACATED: "muted",
  LEDGER_LOCKED: "danger",
  ADJUSTMENT_POSTED: "info",
  DEBIT_NOTE_POSTED: "warning",
  CREDIT_NOTE_POSTED: "info",
  BUDGET_CREATED: "success",
  BUDGET_UPDATED: "info",
  ACCOUNT_BALANCE_REBUILT: "muted",
};

const CATEGORY_STYLE = {
  success: { background: "var(--color-success-bg)", color: "var(--color-success)" },
  danger: { background: "var(--color-danger-bg)", color: "var(--color-danger)" },
  warning: { background: "var(--color-warning-bg)", color: "var(--color-warning)" },
  info: { background: "var(--color-info-bg)", color: "var(--color-info)" },
  accent: { background: "var(--color-accent-light)", color: "var(--color-accent)" },
  muted: { background: "var(--color-surface)", color: "var(--color-text-sub)" },
};

function badgeStyle(eventType) {
  const cat = EVENT_CATEGORY[eventType] ?? "muted";
  return CATEGORY_STYLE[cat];
}

function labelFromType(eventType) {
  return eventType
    .split("_")
    .map(w => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NP", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function ActorCell({ log }) {
  if (log.actorType === "system") {
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
          color: "var(--color-accent)", background: "var(--color-accent-light)",
          borderRadius: 4, padding: "1px 5px", display: "inline-block", width: "fit-content",
        }}>
          System
        </span>
        {log.systemActor && (
          <span style={{ fontSize: 11, color: "var(--color-text-sub)", fontFamily: "var(--font-mono)" }}>
            {log.systemActor}
          </span>
        )}
      </span>
    );
  }
  return <span style={{ color: "var(--color-text-body)" }}>{log.performedBy?.name ?? "—"}</span>;
}

export default function AuditLogTab({ entityId }) {
  const [eventType, setEventType] = useState("");
  const [actorType, setActorType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const eventTypes = useAuditEventTypes();
  const { logs, total, pages, loading, error } = useAuditLog({
    entityId,
    eventType: eventType || undefined,
    actorType: actorType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit,
  });

  const hasFilter = eventType || actorType || startDate || endDate;

  const exportCSV = () => {
    const header = "Date,Event,Actor Type,Performed By,Amount (Rs),Period,Reason";
    const rows = logs.map(l => {
      const actor = l.actorType === "system"
        ? `system:${l.systemActor ?? ""}`
        : (l.performedBy?.name ?? "—");
      const amount = l.amountPaisa != null ? (l.amountPaisa / 100).toFixed(2) : "";
      const period = l.nepaliYear ? `${l.nepaliYear}/${String(l.nepaliMonth ?? "").padStart(2, "0")}` : "";
      return [
        formatDate(l.performedAt),
        labelFromType(l.eventType),
        l.actorType ?? "user",
        actor,
        amount,
        period,
        (l.reason ?? "").replace(/,/g, ";"),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
        <Button
          onClick={exportCSV}
          variant="outline"
          size="sm"

          disabled={loading || logs.length === 0}
        >
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <Select
          value={eventType || "all"}
          onValueChange={(value) => {
            setEventType(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px] text-[12px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">
                All events
              </SelectItem>

              {eventTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {labelFromType(t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={actorType || "all"}
          onValueChange={(value) => {
            setActorType(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px] text-[12px]">
            <SelectValue placeholder="All actors" />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">
                All actors
              </SelectItem>

              <SelectItem value="user">
                User
              </SelectItem>

              <SelectItem value="system">
                System
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        />

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEventType("");
              setActorType("");
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
            className="text-[11px]"
          >
            Clear
          </Button>
        )}

        <span className="ml-auto text-[11px] text-[var(--color-text-sub)] self-center">
          {total} events total
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl text-[12px]" style={{
          background: "var(--color-danger-bg)",
          border: "1px solid var(--color-danger-border)",
          color: "var(--color-danger)",
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--color-surface)] hover:bg-[var(--color-surface)]">
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-[var(--color-text-sub)]"
                >
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-[var(--color-text-sub)]"
                >
                  No audit events found
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              logs.map((log, i) => (
                <TableRow
                  key={log._id ?? i}
                  className="hover:bg-[var(--color-surface)]"
                >
                  <TableCell className="whitespace-nowrap text-[var(--color-text-sub)]">
                    {formatDate(log.performedAt)}
                  </TableCell>

                  <TableCell>
                    <span
                      style={{
                        ...badgeStyle(log.eventType),
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        display: "inline-block",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {labelFromType(log.eventType)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <ActorCell log={log} />
                  </TableCell>

                  <TableCell className="text-right font-mono text-[var(--color-text-body)]">
                    {log.amountPaisa != null
                      ? `Rs ${fmtRs(log.amountPaisa)}`
                      : "—"}
                  </TableCell>

                  <TableCell className="text-[var(--color-text-sub)]">
                    {log.nepaliYear
                      ? `${log.nepaliYear}/${String(
                        log.nepaliMonth ?? ""
                      ).padStart(2, "0")}`
                      : "—"}
                  </TableCell>

                  <TableCell className="max-w-[220px] truncate text-[var(--color-text-sub)]">
                    {log.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>

          <span className="text-[12px] text-[var(--color-text-sub)]">
            Page {page} of {pages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
