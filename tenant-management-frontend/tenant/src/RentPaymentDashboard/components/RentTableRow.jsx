import React, { useState } from "react";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
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

const fmtRs = (n) => `Rs ${Number(n).toLocaleString("en-IN")}`;

/** Minimal status pill — very low contrast, no heavy borders */
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
      onOpenPaymentDialog(rent);
    }
  };

  const payLabel =
    rent.status === "paid" && hasOutstandingLateFee ? "Pay fee" : "Pay";

  const hasDropdownItems = !!tenantId || hasTds;

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
        {fmtRs(rentAmount)}
      </TableCell>

      {/* CAM */}
      <TableCell className="whitespace-nowrap py-3 tabular-nums text-sm text-right text-foreground">
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtRs(camAmount)}</span>
          {hasLateFee && (
            <span className="text-[10px] text-muted-foreground font-normal">
              +{fmtRs(lateFeeAmount)} fee{lateFeePaid ? " · paid" : ""}
            </span>
          )}
        </div>
      </TableCell>

      {/* Total */}
      <TableCell className="whitespace-nowrap py-3 text-right">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {fmtRs(totalDue)}
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
              className="h-6 px-2 rounded text-xs font-medium   transition-colors"
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
                  className="h-6 w-6 text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-3.5" />
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
