import React, { useState } from "react";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const STATUS_CLASS = {
  paid: "bg-emerald-50/90 text-emerald-800 border-emerald-200/70 font-medium dark:bg-emerald-950/35 dark:text-emerald-200 dark:border-emerald-800/50",
  pending: "bg-orange-50/90 text-orange-800 border-orange-200/70 font-medium dark:bg-orange-950/35 dark:text-orange-200 dark:border-orange-800/50",
  overdue: "bg-red-50/90 text-red-800 border-red-200/70 font-medium dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/50",
  partially_paid: "bg-yellow-50/90 text-yellow-900 border-yellow-200/70 font-medium dark:bg-yellow-950/35 dark:text-yellow-100 dark:border-yellow-800/50",
  partial: "bg-yellow-50/90 text-yellow-900 border-yellow-200/70 font-medium dark:bg-yellow-950/35 dark:text-yellow-100 dark:border-yellow-800/50",
};

const STATUS_LABEL = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  partially_paid: "Partial",
  partial: "Partial",
};

const fmtRs = (n) => `Rs ${Number(n).toLocaleString("en-IN")}`;

export const RentTableRow = ({
  rent,
  cams,
  bankAccounts,
  onOpenPaymentDialog,
  onRefresh,
  selected,
  onToggleSelected,
}) => {
  const navigate = useNavigate();
  const [arrearsOpen, setArrearsOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const hasTds = (rent.tdsAmountPaisa || 0) > 0;

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
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `TDS-Certificate-${rent.tenant.name.replace(/\s+/g, "-")}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate TDS certificate");
    } finally {
      setCertLoading(false);
    }
  };

  const { rentAmount, camAmount, totalDue, lateFeeAmount, hasLateFee } =
    getPaymentAmounts(rent, cams);

  const status = normalizeStatus(rent.status);
  const lateFeePaid = (rent.lateFeeStatus || "").toLowerCase() === "paid";

  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";

  const isFullySettled = rent.status === "paid" && !hasOutstandingLateFee;

  const propertyName = rent.block?.name || rent.innerBlock?.name || "";
  const unitNames =
    rent.units?.map((u) => u.name).filter(Boolean).join(", ") || "—";
  const subtitle =
    [propertyName || null, unitNames !== "—" ? unitNames : null]
      .filter(Boolean)
      .join(" • ") || "—";

  const tenantId = rent.tenant?._id;

  // Only show the arrears badge when the oldest unpaid balance is from a
  // PREVIOUS Nepali month. If oldestOverdueNepaliYear/Month equals the current
  // month the tenant simply hasn't paid yet this cycle — the due date may not
  // have arrived, so labelling it "overdue" is misleading.
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
  // Show arrears badge only when confirmed to be from a previous cycle
  const showPrevBalance = prevBalanceIsFromPastCycle;

  // Single pay handler — routes to arrears dialog only for genuine past-cycle
  // arrears; current-month pending rents go through the normal payment dialog.
  const handlePay = () => {
    if (showPrevBalance) {
      setArrearsOpen(true);
    } else {
      onOpenPaymentDialog(rent);
    }
  };

  const payLabel =
    rent.status === "paid" && hasOutstandingLateFee ? "Pay fee" : "Pay";

  // Dropdown has secondary actions only — primary "Pay" is now an inline button
  const hasDropdownItems = !!tenantId || hasTds;

  return (
    <TableRow
      className={cn(
        "group border-b border-border/80 transition-colors",
        status === "overdue" && "bg-red-50/35 hover:bg-red-50/50 dark:bg-red-950/15 dark:hover:bg-red-950/25",
        status !== "overdue" && "hover:bg-muted/35",
      )}
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="w-10 px-2 py-2.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-3.5 rounded border border-input accent-primary cursor-pointer"
          aria-label={`Select ${rent.tenant?.name || "row"}`}
        />
      </TableCell>

      <TableCell className="min-w-[140px] max-w-[220px] py-2.5 align-top">
        <p className="font-semibold text-sm text-foreground leading-snug">
          {rent.tenant ? rent.tenant.name : "No tenant"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
          {subtitle}
        </p>
        {showPrevBalance && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-orange-200/80 bg-orange-50/80 px-2 py-0.5 dark:bg-orange-950/40 dark:border-orange-800/50">
            <AlertTriangle className="size-3 shrink-0 text-orange-600" />
            <span className="text-[10px] font-semibold text-orange-800 tabular-nums dark:text-orange-200">
              +{pb.formatted.prevBalance} arrears
            </span>
            <span className="text-[10px] text-orange-700 dark:text-orange-300">
              since {pbMonth != null
                ? `${pbYear}/${String(pbMonth).padStart(2, "0")}`
                : pbYear}
            </span>
          </div>
        )}
      </TableCell>

      <TableCell className="min-w-[72px] py-2.5 text-xs text-muted-foreground align-top">
        {unitNames}
      </TableCell>

      <TableCell className="whitespace-nowrap py-2.5 tabular-nums text-sm text-foreground">
        {fmtRs(rentAmount)}
      </TableCell>

      <TableCell className="whitespace-nowrap py-2.5 tabular-nums text-sm text-foreground">
        <div className="flex flex-col gap-0.5">
          <span>{fmtRs(camAmount)}</span>
          {hasLateFee && (
            <span className="text-[10px] text-muted-foreground font-normal">
              Late fee {fmtRs(lateFeeAmount)}
              {lateFeePaid ? " · paid" : " · due"}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap py-2.5">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {fmtRs(totalDue)}
        </span>
      </TableCell>

      <TableCell className="whitespace-nowrap py-2.5">
        <span className="text-xs text-muted-foreground">
          {formatNepaliDueDate(rent)}
        </span>
      </TableCell>

      <TableCell className="whitespace-nowrap py-2.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[11px] font-medium border",
            STATUS_CLASS[status] ?? "bg-muted text-muted-foreground border-border",
          )}
        >
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </TableCell>

      {/* Actions cell: visible Pay button + secondary actions in dropdown */}
      <TableCell className="whitespace-nowrap py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {!isFullySettled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium border-border hover:bg-muted/60"
              onClick={handlePay}
            >
              {payLabel}
            </Button>
          )}

          {hasDropdownItems && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {tenantId && (
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => navigate(`/tenant/viewDetail/${tenantId}`)}
                  >
                    View tenant
                  </DropdownMenuItem>
                )}
                {tenantId && hasTds && <DropdownMenuSeparator />}
                {hasTds && (
                  <DropdownMenuItem
                    className="text-xs"
                    disabled={certLoading}
                    onClick={handleDownloadTdsCert}
                  >
                    {certLoading ? "Generating…" : "Download TDS Certificate"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
