import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function VendorTransactionsTable({ transactions }) {
  const getTransactionTypeBadge = (type) => {
    const typeConfig = {
      rent: {
        bg: "var(--color-success-bg)",
        text: "var(--color-success)",
        border: "var(--color-success-border)",
        label: "Rent",
      },
      electricity: {
        bg: "var(--color-warning-bg)",
        text: "var(--color-warning)",
        border: "var(--color-warning-border)",
        label: "Electricity",
      },
      expense: {
        bg: "var(--color-danger-bg)",
        text: "var(--color-danger)",
        border: "var(--color-danger-border)",
        label: "Expense",
      },
      payment: {
        bg: "var(--color-info-bg)",
        text: "var(--color-info)",
        border: "var(--color-info-border)",
        label: "Payment",
      },
      revenue: {
        bg: "var(--color-success-bg)",
        text: "var(--color-success)",
        border: "var(--color-success-border)",
        label: "Revenue",
      },
    };

    const config = typeConfig[type] || typeConfig.revenue;

    return (
      <Badge
        className="text-xs"
        style={{
          backgroundColor: config.bg,
          color: config.text,
          border: `1px solid ${config.border}`,
        }}
      >
        {config.label}
      </Badge>
    );
  };

  const formatAmount = (amount, transactionType) => {
    const isRevenue =
      transactionType === "rent" ||
      transactionType === "electricity" ||
      transactionType === "revenue";

    return (
      <span
        style={{
          color: isRevenue ? "var(--color-success)" : "var(--color-danger)",
          fontWeight: 600,
        }}
      >
        {isRevenue ? "+" : "-"} रू {Math.abs(amount || 0).toLocaleString()}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ backgroundColor: "var(--color-bg)" }}>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Transaction Type</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions && transactions.length > 0 ? (
            transactions.map((transaction, index) => (
              <TableRow key={transaction._id || transaction.id || index}>
                <TableCell>
                  <span style={{ color: "var(--color-text-body)" }}>
                    {formatDate(transaction.date)}
                  </span>
                </TableCell>
                <TableCell>
                  {getTransactionTypeBadge(transaction.transaction_type)}
                </TableCell>
                <TableCell>
                  <span style={{ color: "var(--color-text-body)" }}>
                    {transaction.description || "No description"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(
                    transaction.amount,
                    transaction.transaction_type
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <div
                    className="mb-2 text-3xl opacity-40"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    📋
                  </div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-body)" }}
                  >
                    No transactions found
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Transaction history will appear here
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
