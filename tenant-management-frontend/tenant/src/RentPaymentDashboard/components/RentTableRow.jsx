import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { formatNepaliDueDate } from "../utils/dateUtils";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";
import { statusStyles } from "../constants/paymentConstants";

/**
 * Component for rendering a single rent table row
 */
export const RentTableRow = ({ rent, cams, onOpenPaymentDialog }) => {
  const { rentAmount, camAmount, totalDue } = getPaymentAmounts(rent, cams);
  const status = normalizeStatus(rent.status);

  // Prefer rent-level frequency, fall back to tenant's configured frequency
  const rawFrequency = rent.rentFrequency || rent.tenant?.rentPaymentFrequency;
  const displayFrequency = rawFrequency
    ? rawFrequency.charAt(0).toUpperCase() + rawFrequency.slice(1)
    : "N/A";

  return (
    <TableRow key={rent._id}>
      <TableCell className="min-w-[140px]">
        <div className="font-medium">
          {rent.tenant ? rent.tenant.name : "No Tenant Assigned"}
        </div>
        <div className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
          {rent.innerBlock?.name || "N/A"} - {rent.block?.name || "N/A"}-
          {rent.units?.map((unit) => unit.name).join(", ")}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{displayFrequency}</TableCell>
      <TableCell className="whitespace-nowrap">₹{rentAmount.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">₹{camAmount.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">₹{totalDue.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">{formatNepaliDueDate(rent)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          className={`capitalize border ${statusStyles[status] ||
            "bg-gray-100 text-gray-700 border-gray-300"
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
              disabled={rent.status === "paid"}
              className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white text-xs sm:text-sm"
              onClick={() => onOpenPaymentDialog(rent)}
            >
              {rent.status === "paid" ? "Paid" : "Record Payment"}
            </Button>
          </DialogTrigger>
        </Dialog>
      </TableCell>
    </TableRow>
  );
};
