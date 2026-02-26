import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { formatNepaliDueDate } from "../utils/dateUtils";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";
import { statusStyles } from "../constants/paymentConstants";

/**
 * Component for rendering a single rent table row.
 * Shows late fee column when a late fee has been charged on the rent.
 */
export const RentTableRow = ({ rent, cams, onOpenPaymentDialog }) => {
  const { rentAmount, camAmount, totalDue, lateFeeAmount, hasLateFee } =
    getPaymentAmounts(rent, cams);

  const status = normalizeStatus(rent.status);

  // Prefer rent-level frequency, fall back to tenant's configured frequency
  const rawFrequency = rent.rentFrequency || rent.tenant?.rentPaymentFrequency;
  const displayFrequency = rawFrequency
    ? rawFrequency.charAt(0).toUpperCase() + rawFrequency.slice(1)
    : "N/A";

  // Determine late fee badge appearance
  const lateFeePaid = (rent.lateFeeStatus || "").toLowerCase() === "paid";
  // RentTableRow.jsx — FIXED button logic
  const hasOutstandingLateFee =
    rent.lateFeeApplied &&                    // a late fee was actually charged
    rent.lateFeePaisa > 0 &&                  // and it's non-zero
    rent.lateFeeStatus !== "paid";            // and not yet paid

  const isFullySettled = rent.status === "paid" && !hasOutstandingLateFee;
  return (
    <TableRow key={rent._id}>
      <TableCell className="min-w-[140px]">
        <div className="font-medium">
          {rent.tenant ? rent.tenant.name : "No Tenant Assigned"}
        </div>
        <div className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
          {rent.innerBlock?.name || "N/A"} - {rent.block?.name || "N/A"} -{" "}
          {rent.units?.map((unit) => unit.name).join(", ")}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{displayFrequency}</TableCell>
      <TableCell className="whitespace-nowrap">₹{rentAmount.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">₹{camAmount.toLocaleString()}</TableCell>

      {/* Late Fee column — shows amount + paid/pending badge, or "—" if no fee */}
      <TableCell className="whitespace-nowrap">
        {hasLateFee ? (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-rose-700">
              ₹{lateFeeAmount.toLocaleString()}
            </span>
            <Badge
              className={`capitalize border text-[10px] px-1.5 py-0.5 w-fit ${lateFeePaid
                ? statusStyles.late_fee_paid
                : statusStyles.late_fee
                }`}
            >
              {lateFeePaid ? "Fee Paid" : "Fee Due"}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap font-semibold">
        ₹{totalDue.toLocaleString()}
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatNepaliDueDate(rent)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          className={`capitalize border ${statusStyles[status] || "bg-gray-100 text-gray-700 border-gray-300"
            }`}
        >
          {status === "partial" ? "Partially Paid" : status}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isFullySettled}
              className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white text-xs sm:text-sm"
              onClick={() => onOpenPaymentDialog(rent)}
            >
              {isFullySettled
                ? "Paid"
                : rent.status === "paid" && hasOutstandingLateFee
                  ? "Pay Late Fee"
                  : "Record Payment"}
            </Button>
          </DialogTrigger>
        </Dialog>
      </TableCell>
    </TableRow>
  );
};