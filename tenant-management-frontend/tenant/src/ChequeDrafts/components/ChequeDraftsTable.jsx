import {
  CheckCircle,
  XCircle,
  Ban,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Clock,
} from "lucide-react";

import { C } from "../../Loans/loan.constants";
import { fmtRs } from "../../utils/formatter";
import { toNepaliDate } from "@/utils/nepaliDate";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATUS_STYLE = {
  PENDING: {
    label: "Pending",
    color: C.amber,
    bg: C.amberBg,
    icon: Clock,
  },
  DEPOSITED: {
    label: "Deposited",
    color: C.positive,
    bg: C.positiveBg,
    icon: CheckCircle,
  },
  BOUNCED: {
    label: "Bounced",
    color: C.negative,
    bg: C.negativeBg,
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    color: C.textMuted,
    bg: C.surface,
    icon: Ban,
  },
};

function StatusBadge({ value }) {
  const s =
    STATUS_STYLE[value] ?? {
      label: value,
      color: C.textMuted,
      bg: C.surface,
      icon: Clock,
    };

  const Icon = s.icon;

  return (
    <Badge
      className="gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border-0"
      style={{
        background: s.bg,
        color: s.color,
      }}
    >
      <Icon size={10} />
      {s.label}
    </Badge>
  );
}

/** Show extra context for non-PENDING rows */
function StatusDetail({ draft }) {
  if (draft.status === "DEPOSITED" && draft.depositedAt) {
    return (
      <p
        className="text-[10px] mt-1"
        style={{ color: C.positive }}
      >
        Cleared {toNepaliDate(draft.depositedAt)}
        {draft.depositNotes ? ` · ${draft.depositNotes}` : ""}
      </p>
    );
  }

  if (draft.status === "BOUNCED" && draft.bounceReason) {
    return (
      <p
        className="text-[10px] mt-1"
        style={{ color: C.negative }}
      >
        {draft.bounceReason}
      </p>
    );
  }

  return null;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-xl animate-pulse"
          style={{ background: C.surface }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="py-16 flex flex-col items-center justify-center gap-3 border-dashed">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: C.surface }}
      >
        <FileText
          size={18}
          style={{ color: C.textMuted }}
        />
      </div>

      <p
        className="text-sm"
        style={{ color: C.textMuted }}
      >
        No cheque drafts found
      </p>
    </Card>
  );
}

export function ChequeDraftsTable({
  drafts,
  loading,
  onDeposit,
  onBounce,
  onCancel,
}) {
  if (loading) return <LoadingSkeleton />;

  if (!drafts.length) return <EmptyState />;

  return (
    <Card className="overflow-hidden rounded-2xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow
              style={{
                background: C.surface,
                borderColor: C.border,
              }}
            >
              {[
                "Cheque #",
                "Date",
                "Party",
                "Direction",
                "Amount",
                "Status",
                "Actions",
              ].map((h) => (
                <TableHead
                  key={h}
                  className={`px-4 py-3 uppercase tracking-wider text-[10px] font-semibold ${h === "Amount" ? "text-right" : "text-left"
                    }`}
                  style={{ color: C.textMuted }}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {drafts.map((d, i) => (
              <TableRow
                key={d._id}
                className="transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: C.border,
                  opacity: d.status === "CANCELLED" ? 0.6 : 1,
                }}
              >
                {/* Cheque # */}
                <TableCell
                  className="px-4 py-3 font-mono font-semibold"
                  style={{ color: C.text }}
                >
                  {d.chequeNumber}
                </TableCell>

                {/* Date */}
                <TableCell
                  className="px-4 py-3"
                  style={{ color: C.textMid }}
                >
                  {toNepaliDate(d.chequeDate)}
                </TableCell>

                {/* Party */}
                <TableCell
                  className="px-4 py-3 max-w-[140px] truncate"
                  style={{ color: C.textMid }}
                >
                  {d.partyName ?? "—"}
                </TableCell>

                {/* Direction */}
                <TableCell className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold"
                    style={{
                      color:
                        d.direction === "ISSUED"
                          ? C.negative
                          : C.positive,
                    }}
                  >
                    {d.direction === "ISSUED" ? (
                      <>
                        <ArrowUpRight size={11} />
                        Issued
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft size={11} />
                        Received
                      </>
                    )}
                  </span>
                </TableCell>

                {/* Amount */}
                <TableCell
                  className="px-4 py-3 text-right font-semibold tabular-nums"
                  style={{ color: C.text }}
                >
                  {fmtRs(d.amountPaisa)}
                </TableCell>

                {/* Status */}
                <TableCell className="px-4 py-3">
                  <StatusBadge value={d.status} />
                  <StatusDetail draft={d} />
                </TableCell>

                {/* Actions */}
                <TableCell className="px-4 py-3 whitespace-nowrap">
                  {d.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => onDeposit(d)}
                        className="h-7 rounded-lg text-[10px] font-bold"
                        style={{
                          background: C.positive,
                          color: "#fff",
                        }}
                        title="Mark deposited — clears to bank"
                      >
                        <CheckCircle size={11} />
                        Deposit
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => onBounce(d)}
                        className="h-7 rounded-lg text-[10px] font-bold"
                        style={{
                          background: C.negative,
                          color: "#fff",
                        }}
                        title="Mark bounced — reverses journal"
                      >
                        <XCircle size={11} />
                        Bounce
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancel(d)}
                        className="h-7 rounded-lg text-[10px] font-bold"
                        style={{
                          borderColor: C.border,
                          color: C.textMid,
                        }}
                        title="Cancel cheque — reverses journal"
                      >
                        <Ban size={11} />
                        Cancel
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}