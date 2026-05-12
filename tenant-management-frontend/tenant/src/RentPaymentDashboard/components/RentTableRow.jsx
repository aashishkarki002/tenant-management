import React, { useState } from "react";
import { AlertTriangle, MoreHorizontal, Zap, FileDown, Send, Mail, Copy, History } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrearsPaymentDialog } from "./ArrearsPaymentDialog";
import { cn } from "@/lib/utils";
import { formatNepaliDueDate } from "../utils/dateUtils";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";
import { getTodayNepali } from "@/utils/nepaliDate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { STATUS_LABEL, STATUS_BADGE_STYLES } from "../constants/paymentConstants";


const StatusPill = ({ status }) => (
  <span
    className={cn(
      "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-normal border",
      STATUS_BADGE_STYLES[status] ??
      "bg-muted text-muted-foreground border-transparent",
    )}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
);

export const RentTableRow = ({
  rent,
  cams,
  bankAccounts,
  electricityRecords = [],
  onOpenPaymentDialog,
  onRefresh,
  selected,
  onToggleSelected,
}) => {
  const navigate = useNavigate();
  const [arrearsOpen, setArrearsOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const hasTds = (rent.tdsAmountPaisa || 0) > 0;
  const tenantEmail = rent.tenant?.email;
  const isPaid = rent.status === "paid";
  const isUnpaid = ["pending", "overdue", "partially_paid"].includes(rent.status);

  const handleDownloadTdsCert = async () => {
    const tenantId = rent.tenant?._id;
    const year = rent.nepaliYear;
    if (!tenantId || !year) return;
    setCertLoading(true);
    try {
      const res = await api.get(
        `/api/rent/tds/certificate/${tenantId}?nepaliYear=${year}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `TDS-Certificate-${rent.tenant.name.replace(/\s+/g, "-")}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to generate TDS certificate",
      );
    } finally {
      setCertLoading(false);
    }
  };

  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const handleDownloadInvoice = async () => {
    const tenantId = rent.tenant?._id;
    if (!tenantId || !rent.nepaliYear) return;
    setInvoiceLoading(true);
    try {
      const params = new URLSearchParams({
        nepaliYear: rent.nepaliYear,
        tenantId,
      });
      if (rent.nepaliMonth) params.append("nepaliMonth", rent.nepaliMonth);
      const res = await api.get(`/api/rent/export/pdf?${params.toString()}`, {
        responseType: "blob",
      });
      const name = (rent.tenant?.name || "tenant").replace(/\s+/g, "-");
      const month = rent.nepaliMonth ? `-M${rent.nepaliMonth}` : "";
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${name}-${rent.nepaliYear}${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Invoice downloaded.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const [reminderLoading, setReminderLoading] = useState(false);
  const handleSendReminder = async () => {
    if (!tenantEmail) {
      toast.error("Tenant has no email on record.");
      return;
    }
    setReminderLoading(true);
    try {
      const res = await api.post("/api/rent/send-email-to-tenants");
      if (res.data.success) {
        toast.success(res.data.message || "Reminder sent.");
      } else {
        toast.error(res.data.message || "Failed to send reminder.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send reminder.");
    } finally {
      setReminderLoading(false);
    }
  };

  const [receiptLoading, setReceiptLoading] = useState(false);
  const handleSendReceipt = async () => {
    if (!tenantEmail) {
      toast.error("Tenant has no email on record.");
      return;
    }
    setReceiptLoading(true);
    try {
      // Get the latest payment for this rent first
      const paymentRes = await api.get(
        `/api/payment/get-payment-by-rent-id/${rent._id}`,
      );
      const payments = paymentRes.data.data || paymentRes.data.payments || [];
      const latest = Array.isArray(payments) ? payments[0] : payments;
      if (!latest?._id) {
        toast.error("No payment record found for this rent.");
        return;
      }
      const receiptRes = await api.post(
        `/api/payment/send-receipt/${latest._id}`,
      );
      if (receiptRes.data.success) {
        toast.success(
          receiptRes.data.message || `Receipt sent to ${tenantEmail}.`,
        );
      } else {
        toast.error(receiptRes.data.message || "Failed to send receipt.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send receipt.");
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleCopyEmail = () => {
    if (!tenantEmail) return;
    navigator.clipboard.writeText(tenantEmail).then(
      () => toast.success(`Copied ${tenantEmail}`),
      () => toast.error("Failed to copy email"),
    );
  };

  const { rentAmount, camAmount, totalDue, lateFeeAmount, hasLateFee } =
    getPaymentAmounts(rent, cams);

  const status = normalizeStatus(rent.status);
  const lateFeePaid = (rent.lateFeeStatus || "").toLowerCase() === "paid";

  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";

  // Compute total electricity still due for this tenant/month
  const totalElectricityDue = electricityRecords.reduce((sum, r) => {
    const remaining =
      r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
    return sum + remaining;
  }, 0);

  const isFullySettled =
    rent.status === "paid" && !hasOutstandingLateFee && totalElectricityDue <= 0;

  const propertyName = rent.block?.name || rent.innerBlock?.name || "";
  const unitNames =
    rent.units?.map((u) => u.name).filter(Boolean).join(", ") || "—";
  const subtitle =
    [propertyName || null, unitNames !== "—" ? unitNames : null]
      .filter(Boolean)
      .join(" · ") || "—";

  const tenantId = rent.tenant?._id;

  const todayNp = getTodayNepali();
  const pb = rent.prevBalance;
  const pbYear = pb?.oldestOverdueNepaliYear;
  const pbMonth = pb?.oldestOverdueNepaliMonth;
  const prevBalanceIsFromPastCycle =
    pb != null &&
    pbYear != null &&
    pbMonth != null &&
    (pbYear < todayNp.year ||
      (pbYear === todayNp.year && pbMonth < todayNp.month));
  const showPrevBalance = prevBalanceIsFromPastCycle;

  const handlePay = () => {
    if (showPrevBalance) {
      setArrearsOpen(true);
    } else {
      onOpenPaymentDialog(rent, electricityRecords);
    }
  };

  // Dynamic button label based on what's outstanding
  let payLabel = "Record payment";
  if (rent.status === "paid" && hasOutstandingLateFee) {
    payLabel = "Record fee payment";
  } else if (rent.status === "paid" && !hasOutstandingLateFee && totalElectricityDue > 0) {
    payLabel = "Record electricity payment";
  }

  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <TableRow
      className={cn(
        "group border-b border-border/50 last:border-0 transition-colors",
        status === "overdue"
          ? "bg-red-50/20 hover:bg-red-50/40 dark:bg-red-950/10 dark:hover:bg-red-950/20"
          : "hover:bg-muted/25",
      )}
      data-state={selected ? "selected" : undefined}
    >
      {/* Checkbox */}
      <TableCell className="w-10 px-3 py-3 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-3.5 rounded border border-input accent-primary cursor-pointer"
          aria-label={`Select ${rent.tenant?.name || "row"}`}
        />
      </TableCell>

      {/* Tenant */}
      <TableCell className="min-w-[140px] max-w-[200px] py-3 align-top">
        <p className="text-sm font-medium text-foreground leading-snug">
          {rent.tenant ? rent.tenant.name : "No tenant"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
          {subtitle}
        </p>
        {showPrevBalance && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-orange-200/60 bg-orange-50/70 px-1.5 py-0.5 dark:bg-orange-950/30 dark:border-orange-800/40">
            <AlertTriangle className="size-3 shrink-0 text-orange-500" />
            <span className="text-[10px] font-medium text-orange-700 tabular-nums dark:text-orange-300">
              +{pb.formatted.prevBalance} arrears
            </span>
          </div>
        )}
      </TableCell>

      {/* Unit */}
      <TableCell className="min-w-[72px] py-3 text-xs text-muted-foreground align-top">
        {unitNames}
      </TableCell>

      {/* Rent */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-right text-foreground">
        {(rentAmount)}
      </TableCell>

      {/* CAM */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-right text-foreground">
        <div className="flex flex-col items-end gap-0.5">
          <span>{(camAmount)}</span>
          {hasLateFee && (
            <span className="text-[10px] text-muted-foreground font-normal">
              +{(lateFeeAmount)} fee{lateFeePaid ? " · paid" : ""}
            </span>
          )}
        </div>
      </TableCell>

      {/* Electricity */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-right">
        {totalElectricityDue > 0 ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {(totalElectricityDue)}
            </span>
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
              <Zap className="size-2.5" />
              {electricityRecords.length} unit{electricityRecords.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </TableCell>

      {/* Total */}
      <TableCell className="whitespace-nowrap py-3 text-right">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {(totalDue + totalElectricityDue)}
        </span>
      </TableCell>

      {/* Due date */}
      <TableCell className="whitespace-nowrap py-3">
        <span className="text-xs text-muted-foreground">
          {formatNepaliDueDate(rent)}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="whitespace-nowrap py-3">
        <StatusPill status={status} />
      </TableCell>

      {/* Actions */}
      <TableCell className="whitespace-nowrap py-3 text-right">
        <div className="flex items-center justify-end gap-0.5">
          {!isFullySettled && (
            <Button
              type="button"
              onClick={handlePay}
              className="h-6 px-2 rounded text-xs font-medium transition-colors"
            >
              {payLabel}
            </Button>
          )}

          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 text-muted-foreground/60 hover:text-foreground transition-opacity",
                  dropdownOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
                aria-label="More actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Navigation */}
              {tenantId && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={() => navigate(`/tenant/viewDetail/${tenantId}`)}
                >
                  <span className="size-3.5 opacity-60">👤</span>
                  View tenant
                </DropdownMenuItem>
              )}
              {tenantId && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={() => navigate(`/tenant/viewDetail/${tenantId}?tab=payments`)}
                >
                  <History className="size-3.5 opacity-60" />
                  Payment history
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Communication */}
              {isUnpaid && tenantEmail && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  disabled={reminderLoading}
                  onClick={handleSendReminder}
                >
                  <Send className="size-3.5 opacity-60" />
                  {reminderLoading ? "Sending…" : "Send reminder"}
                </DropdownMenuItem>
              )}
              {isPaid && tenantEmail && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  disabled={receiptLoading}
                  onClick={handleSendReceipt}
                >
                  <Mail className="size-3.5 opacity-60" />
                  {receiptLoading ? "Sending…" : "Send receipt"}
                </DropdownMenuItem>
              )}
              {tenantEmail && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={handleCopyEmail}
                >
                  <Copy className="size-3.5 opacity-60" />
                  Copy email
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Documents */}
              <DropdownMenuItem
                className="text-xs gap-2"
                disabled={invoiceLoading}
                onClick={handleDownloadInvoice}
              >
                <FileDown className="size-3.5 opacity-60" />
                {invoiceLoading ? "Generating…" : "Download invoice"}
              </DropdownMenuItem>

              {hasTds && (
                <DropdownMenuItem
                  className="text-xs gap-2"
                  disabled={certLoading}
                  onClick={handleDownloadTdsCert}
                >
                  <FileDown className="size-3.5 opacity-60" />
                  {certLoading ? "Generating…" : "Download TDS certificate"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showPrevBalance && (
          <ArrearsPaymentDialog
            open={arrearsOpen}
            onClose={() => setArrearsOpen(false)}
            tenant={rent.tenant}
            bankAccounts={bankAccounts}
            onSuccess={() => {
              setArrearsOpen(false);
              onRefresh?.();
            }}
          />
        )}
      </TableCell>
    </TableRow>
  );
};
