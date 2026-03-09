import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PaymentTableRow } from "./PaymentTableRow";
import { Download, ChevronUp, ChevronDown } from "lucide-react";

const SortIcon = ({ column, sortKey, sortDir }) => {
  if (sortKey !== column)
    return <span className="opacity-30 ml-1 text-[10px]">↕</span>;
  return sortDir === "asc"
    ? <ChevronUp className="inline w-3 h-3 ml-1" />
    : <ChevronDown className="inline w-3 h-3 ml-1" />;
};

const SORTABLE_HEADS = [
  { key: "tenant", label: "Tenant" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "amount", label: "Amount" },
  { key: null, label: "Payment Method" },
  { key: null, label: "Payment Status" },
  { key: "billingPeriod", label: "For Period" },
  { key: null, label: "Note" },
  { key: null, label: "Actions" },
];

const exportCSV = (payments) => {
  const headers = ["Tenant", "Payment Date", "For Period", "Amount", "Method", "Status", "Note"];
  const rows = payments.map((p) => [
    p.tenant?.name || "",
    p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "",
    [p.billingPeriod, p.billingYear].filter(Boolean).join(" ") || "",
    p.amount || 0,
    p.paymentMethod || "",
    p.paymentStatus || "",
    (p.note || "").replace(/,/g, ";"),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Component for displaying payments table with sort + CSV export
 */
export const PaymentsTable = ({ payments }) => {
  const [sortKey, setSortKey] = useState("paymentDate");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...payments].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "amount") return ((a.amount || 0) - (b.amount || 0)) * dir;
    if (sortKey === "paymentDate")
      return (new Date(a.paymentDate) - new Date(b.paymentDate)) * dir;
    if (sortKey === "tenant")
      return (a.tenant?.name || "").localeCompare(b.tenant?.name || "") * dir;
    if (sortKey === "billingPeriod")
      return (
        `${a.billingYear || ""}${a.billingPeriod || ""}`.localeCompare(
          `${b.billingYear || ""}${b.billingPeriod || ""}`
        ) * dir
      );
    return 0;
  });

  return (
    <div>
      {payments.length > 0 && (
        <div className="flex justify-end mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => exportCSV(sorted)}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      )}
      <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-md border">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              {SORTABLE_HEADS.map(({ key, label }) => (
                <TableHead
                  key={label}
                  className={`whitespace-nowrap select-none ${key ? "cursor-pointer hover:text-foreground" : ""}`}
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {key && <SortIcon column={key} sortKey={sortKey} sortDir={sortDir} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                >
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((payment, idx) => (
                <PaymentTableRow key={payment._id || idx} payment={payment} showBillingPeriod />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PaymentsTable;
