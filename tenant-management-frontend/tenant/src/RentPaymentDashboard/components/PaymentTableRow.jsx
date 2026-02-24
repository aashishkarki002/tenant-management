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
import { statusStyles } from "../constants/paymentConstants";

/**
 * Component for rendering a single payment table row
 */
export const PaymentTableRow = ({ payment }) => {
  const navigate = useNavigate();

  return (
    <TableRow key={payment._id}>
      <TableCell className="min-w-[100px]">
        <div className="font-medium">{payment.tenant?.name || "N/A"}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatPaymentDate(payment.paymentDate)}</TableCell>
      <TableCell className="whitespace-nowrap">₹{payment.amount?.toLocaleString() || "0"}</TableCell>
      <TableCell className="whitespace-nowrap">{formatPaymentMethod(payment.paymentMethod)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          className={`capitalize border ${
            statusStyles[normalizeStatus(payment.paymentStatus)] ||
            "bg-gray-100 text-gray-700 border-gray-300"
          }`}
        >
          {formatPaymentStatus(payment.paymentStatus)}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[120px] truncate" title={payment.note || ""}>{payment.note || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Button
          variant="outline"
          size="sm"
          className="bg-gray-200 text-black hover:bg-gray-200 min-w-[60px]"
          onClick={() => {
            navigate(`/rent-payment/payments/${payment._id}`);
          }}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  );
};
