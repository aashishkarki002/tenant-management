import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { PaymentTableRow } from "./PaymentTableRow";

/**
 * Component for displaying payments table
 */
export const PaymentsTable = ({ payments }) => {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-md border">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Tenant</TableHead>
            <TableHead className="whitespace-nowrap">Payment Date</TableHead>
            <TableHead className="whitespace-nowrap">Amount</TableHead>
            <TableHead className="whitespace-nowrap">Payment Method</TableHead>
            <TableHead className="whitespace-nowrap">Payment Status</TableHead>
            <TableHead className="whitespace-nowrap">Note</TableHead>
            <TableHead className="whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-12"
              >
                No payments found
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment, idx) => (
              <PaymentTableRow key={payment._id || idx} payment={payment} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PaymentsTable;
