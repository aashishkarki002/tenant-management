import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  formatPaymentDate,
  formatPaymentMethod,
  formatPaymentStatus,
  normalizeStatus,
} from "../utils/paymentUtil";


/**
 * Component for rendering a single payment table row
 */
export const PaymentTableRow = ({ payment, showBillingPeriod = false }) => {
  const navigate = useNavigate();

  const billingPeriodLabel = [payment.billingPeriod, payment.billingYear]
    .filter(Boolean)
    .join(" ") || "—";

  return (
    <TableRow key={payment._id}>
      <TableCell className="min-w-[100px]">
        <div className="font-medium">{payment.tenant?.name || "N/A"}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatPaymentDate(payment.paymentDate)}</TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">Rs {Number(payment.amount || 0).toLocaleString("en-IN")}</TableCell>
      <TableCell className="whitespace-nowrap">{formatPaymentMethod(payment.paymentMethod)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          className={`capitalize border ${[normalizeStatus(payment.paymentStatus)] ||
            "bg-muted text-muted-foreground border-border"
            }`}
        >
          {formatPaymentStatus(payment.paymentStatus)}
        </Badge>
      </TableCell>
      {showBillingPeriod && (
        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
          {billingPeriodLabel}
        </TableCell>
      )}
      <TableCell className="max-w-[120px] truncate" title={payment.note || ""}>{payment.note || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-medium text-foreground min-w-[90px] hover:bg-accent"
          onClick={() => {
            navigate(`/rent-payment/payments/${payment._id}`);
          }}
        >
          View Receipt
        </Button>
      </TableCell>
    </TableRow>
  );
};