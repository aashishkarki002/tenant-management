import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
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
        setPagination((prev) => ({
          ...prev,
          ...response.data.pagination,
        }));
      } else {
        setError(response.data.message || "Failed to fetch payment history");
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
      setError(
        err.response?.data?.message || "Failed to fetch payment history"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchPaymentHistory(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const formatPaymentDate = (date) => {
    if (!date) return "N/A";
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return "N/A";
      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "N/A";
    }
  };

  const formatPaymentMethod = (method) => {
    if (!method) return "N/A";
    const methodMap = {
      bank_transfer: "Bank Deposit",
      cheque: "Cheque",
      cash: "Cash",
      esewa: "eSewa Transfer",
    };
    return (
      methodMap[method] ||
      method.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower === "paid") {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          PAID
        </Badge>
      );
    } else if (statusLower === "pending" || statusLower === "upcoming") {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          UPCOMING
        </Badge>
      );
    } else if (statusLower === "overdue") {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-300">
          OVERDUE
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          {status?.toUpperCase() || "N/A"}
        </Badge>
      );
    }
  };

  const handleDownloadLedger = () => {
    const headers = ["Date", "Amount (रु)", "Method", "Status"];
    const rows = payments.map((payment) => [
      formatPaymentDate(payment.paymentDate),
      payment.amount?.toLocaleString() || "0",
      formatPaymentMethod(payment.paymentMethod),
      payment.paymentStatus?.toUpperCase() || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment-ledger-${tenantId}-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
      <CardHeader className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            <CardTitle className="text-lg sm:text-xl">
              Payment History Ledger
            </CardTitle>
          </div>
          <button
            onClick={handleDownloadLedger}
            className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 transition-colors text-sm sm:text-base px-3 py-2 rounded-md hover:bg-blue-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Ledger</span>
            <span className="sm:hidden">Download</span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm sm:text-base text-muted-foreground">
              Loading payment history...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm sm:text-base text-red-600">{error}</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="block sm:hidden space-y-3">
                  {payments.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No payment history found
                    </div>
                  ) : (
                    payments.map((payment) => (
                      <Card key={payment._id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Date
                            </span>
                            <span className="text-sm font-medium">
                              {formatPaymentDate(payment.paymentDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Amount (रु)
                            </span>
                            <span className="text-sm font-semibold">
                              {payment.amount?.toLocaleString() || "0"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Method
                            </span>
                            <span className="text-sm">
                              {formatPaymentMethod(payment.paymentMethod)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Status
                            </span>
                            {getStatusBadge(payment.paymentStatus)}
                          </div>
                          {payment.receipt?.url && (
                            <div className="pt-2 border-t">
                              <button
                                onClick={() =>
                                  setSelectedReceipt(payment.receipt.url)
                                }
                                className="w-full text-center text-blue-600 hover:text-blue-800 transition-colors text-sm py-1"
                              >
                                View Receipt
                              </button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">DATE</TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        AMOUNT (रु)
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        METHOD
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        STATUS
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No payment history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell className="font-medium text-xs sm:text-sm">
                            {formatPaymentDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {payment.amount?.toLocaleString() || "0"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {formatPaymentMethod(payment.paymentMethod)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(payment.paymentStatus)}
                          </TableCell>
                          <TableCell>
                            {payment.receipt?.url ? (
                              <button
                                onClick={() =>
                                  setSelectedReceipt(payment.receipt.url)
                                }
                                className="text-blue-600 hover:text-blue-800 transition-colors text-xs sm:text-sm"
                              >
                                View Receipt
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                N/A
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.totalRecords
                  )}{" "}
                  of {pagination.totalRecords} payments
                </div>
                <div className="flex gap-2 justify-center sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPaymentHistory(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="text-xs sm:text-sm"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPaymentHistory(pagination.page + 1)}
                    disabled={
                      pagination.page >= pagination.totalPages || loading
                    }
                    className="text-xs sm:text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {selectedReceipt && (
        <Dialog
          open={!!selectedReceipt}
          onOpenChange={(open) => !open && setSelectedReceipt(null)}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] p-2 sm:p-6">
            <DialogHeader className="p-2 sm:p-0">
              <DialogTitle className="text-base sm:text-lg">
                Payment Receipt
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-2 sm:p-0">
              <iframe
                src={selectedReceipt}
                className="w-full h-[400px] sm:h-[500px] md:h-[600px] border rounded-lg"
                title="Payment Receipt"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
