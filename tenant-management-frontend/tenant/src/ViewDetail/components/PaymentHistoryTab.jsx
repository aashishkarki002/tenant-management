import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Download, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPaymentMethodLabel } from "@/constants/paymentMethods.js";

export function PaymentHistoryTab({ tenantId }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 0,
  });
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchPaymentHistory = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const limit = pagination.limit || 10;
      const response = await api.get(
        `/api/payment/get-payment-history-by-tenant/${tenantId}?page=${page}&limit=${limit}`
      );
      if (response.data.success) {
        setPayments(response.data.data || []);
        setPagination((prev) => ({ ...prev, ...response.data.pagination }));
      } else {
        setError(response.data.message || "Failed to fetch payment history");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchPaymentHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "—";
    }
  };

  const formatMethod = (method) =>
    method ? getPaymentMethodLabel(method) : "—";

  const handleDownloadLedger = () => {
    const headers = ["Date", "Amount (रु)", "Method", "Status"];
    const rows = payments.map((p) => [
      formatDate(p.paymentDate),
      p.amount?.toLocaleString() || "0",
      formatMethod(p.paymentMethod),
      p.paymentStatus?.toUpperCase() || "—",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `payment-ledger-${tenantId}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border border-border shadow-sm rounded-xl bg-background">
      <CardHeader className="p-4 sm:p-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg leading-tight">Payment History</CardTitle>
              {pagination.totalRecords > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pagination.totalRecords} total transactions
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleDownloadLedger}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors duration-150 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading payments…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden px-4 pb-4 space-y-2">
              {payments.length === 0 ? (
                <EmptyState />
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment._id}
                    className="rounded-xl border border-border bg-background p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums">
                        रू {payment.amount?.toLocaleString() || "0"}
                      </span>
                      <PaymentStatusBadge status={payment.paymentStatus} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium mt-0.5">{formatDate(payment.paymentDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Method</p>
                        <p className="font-medium mt-0.5">{formatMethod(payment.paymentMethod)}</p>
                      </div>
                    </div>
                    {payment.receipt?.url && (
                      <button
                        onClick={() => setSelectedReceipt(payment.receipt.url)}
                        className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        View Receipt
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-y border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Method</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12">
                        <EmptyState />
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment, idx) => (
                      <TableRow
                        key={payment._id}
                        className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                          }`}
                      >
                        <TableCell className="py-3 text-sm text-foreground font-medium">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-semibold tabular-nums">
                          रू {payment.amount?.toLocaleString() || "0"}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {formatMethod(payment.paymentMethod)}
                        </TableCell>
                        <TableCell className="py-3">
                          <PaymentStatusBadge status={payment.paymentStatus} />
                        </TableCell>
                        <TableCell className="py-3">
                          {payment.receipt?.url ? (
                            <button
                              onClick={() => setSelectedReceipt(payment.receipt.url)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.totalRecords)} of{" "}
                  {pagination.totalRecords} payments
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPaymentHistory(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs px-3 py-1 rounded border border-border bg-muted/30 font-medium">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPaymentHistory(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] p-2 sm:p-6">
            <DialogHeader className="p-2 sm:p-0">
              <DialogTitle className="text-base sm:text-lg">Payment Receipt</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-2 sm:p-0">
              <iframe
                src={selectedReceipt}
                className="w-full h-[400px] sm:h-[500px] md:h-[600px] border border-border rounded-lg"
                title="Payment Receipt"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function PaymentStatusBadge({ status }) {
  const s = status?.toLowerCase() || "";
  if (s === "paid") {
    return (
      <Badge className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-50">
        Paid
      </Badge>
    );
  }
  if (s === "pending" || s === "upcoming") {
    return (
      <Badge className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">
        Upcoming
      </Badge>
    );
  }
  if (s === "overdue") {
    return (
      <Badge className="text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
        Overdue
      </Badge>
    );
  }
  return (
    <Badge className="text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-50">
      {status?.toUpperCase() || "—"}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No payments yet</p>
      <p className="text-xs text-muted-foreground mt-1">Payment records will appear here</p>
    </div>
  );
}
