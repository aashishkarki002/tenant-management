// src/pages/rent/components/RentTableRow.jsx
//
// Polished rent table row — pure Tailwind + shadcn, zero inline styles.
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatNepaliDueDate } from "../utils/dateUtils";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";

// ── Status → visual mapping ───────────────────────────────────────────────────
const STATUS_CLASS = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  partially_paid: "bg-orange-50 text-orange-700 border-orange-200",
  partial: "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_LABEL = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  partially_paid: "Partial",
  partial: "Partial",
};

// ── Frequency display ─────────────────────────────────────────────────────────
const fmtFreq = (raw) =>
  raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "N/A";

// ── Rupee formatter ───────────────────────────────────────────────────────────
const fmtRs = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// ── Main export ───────────────────────────────────────────────────────────────
export const RentTableRow = ({ rent, cams, onOpenPaymentDialog }) => {
  const navigate = useNavigate();

  const { rentAmount, camAmount, totalDue, lateFeeAmount, hasLateFee } =
    getPaymentAmounts(rent, cams);

  const status = normalizeStatus(rent.status);
  const lateFeePaid = (rent.lateFeeStatus || "").toLowerCase() === "paid";

  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";

  const isFullySettled = rent.status === "paid" && !hasOutstandingLateFee;

  const rawFrequency = rent.rentFrequency || rent.tenant?.rentPaymentFrequency;

  return (
    <TableRow className="group hover:bg-accent/50 transition-colors">

      {/* Tenant / Unit */}
      <TableCell className="min-w-[160px] py-3">
        <p className="font-medium text-sm text-foreground leading-snug">
          {rent.tenant ? rent.tenant.name : "No Tenant"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
          {[rent.innerBlock?.name, rent.block?.name, rent.units?.map((u) => u.name).join(", ")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </TableCell>

      {/* Frequency */}
      <TableCell className="whitespace-nowrap py-3">
        <span className="text-xs text-muted-foreground font-medium">
          {fmtFreq(rawFrequency)}
        </span>
      </TableCell>

      {/* Rent Amount */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-foreground">
        {fmtRs(rentAmount)}
      </TableCell>

      {/* CAM */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-foreground">
        {fmtRs(camAmount)}
      </TableCell>

      {/* Late Fee */}
      <TableCell className="whitespace-nowrap py-3">
        {hasLateFee ? (
          <div className="flex flex-col gap-1">
            <span className="tabular-nums text-sm font-medium text-rose-700">
              {fmtRs(lateFeeAmount)}
            </span>
            <Badge
              className={cn(
                "capitalize border text-[10px] px-1.5 py-0.5 w-fit font-medium",
                lateFeePaid
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200",
              )}
            >
              {lateFeePaid ? "Fee Paid" : "Fee Due"}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      {/* Total */}
      <TableCell className="whitespace-nowrap py-3">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {fmtRs(totalDue)}
        </span>
      </TableCell>

      {/* Due Date */}
      <TableCell className="whitespace-nowrap py-3">
        <span className="text-xs text-muted-foreground">
          {formatNepaliDueDate(rent)}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="whitespace-nowrap py-3">
        <Badge
          className={cn(
            "capitalize border text-xs font-medium",
            STATUS_CLASS[status] ?? "bg-gray-100 text-gray-700 border-gray-200",
          )}
        >
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </TableCell>

      {/* Actions */}
      <TableCell className="whitespace-nowrap py-3">
        {isFullySettled ? (
          <div className="flex items-center gap-2">
            {rent.latestPaymentId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                onClick={() => navigate(`/rent-payment/payments/${rent.latestPaymentId}`)}
              >
                Receipt
              </Button>
            )}
            <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
              Paid
            </Badge>
          </div>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-7 px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => onOpenPaymentDialog(rent)}
              >
                {rent.status === "paid" && hasOutstandingLateFee
                  ? "Pay Late Fee"
                  : "Record Payment"}
              </Button>
            </DialogTrigger>
          </Dialog>
        )}
      </TableCell>

    </TableRow>
  );
};