import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CreditCard, Eye, Pencil } from "lucide-react";
import { getConsumption, formatConsumption } from "../utils/electricityCalculations";
import ElectricityPaymentDialog from "./ElectricityPaymentDialog";
import { useNavigate } from "react-router-dom";

// ─── Status config ────────────────────────────────────────────────────────────
// All values use CSS variables — no Tailwind colour classes that may be purged.

const STATUS_CONFIG = {
  paid: {
    badgeBg: "var(--color-success-bg)",
    badgeText: "var(--color-success)",
    badgeBorder: "var(--color-success-border)",
    rowBg: "transparent",
  },
  pending: {
    badgeBg: "var(--color-warning-bg)",
    badgeText: "var(--color-warning)",
    badgeBorder: "var(--color-warning-border)",
    rowBg: "var(--color-warning-bg)",
  },
  overdue: {
    badgeBg: "var(--color-danger-bg)",
    badgeText: "var(--color-danger)",
    badgeBorder: "var(--color-danger-border)",
    rowBg: "var(--color-danger-bg)",
  },
  partially_paid: {
    badgeBg: "var(--color-info-bg)",
    badgeText: "var(--color-info)",
    badgeBorder: "var(--color-info-border)",
    rowBg: "var(--color-info-bg)",
  },
};

const FALLBACK_STATUS = {
  badgeBg: "var(--color-surface)",
  badgeText: "var(--color-text-sub)",
  badgeBorder: "var(--color-border)",
  rowBg: "transparent",
};

const PAYABLE_STATUSES = new Set(["pending", "partially_paid", "overdue"]);

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

// ─── Chip / badge ─────────────────────────────────────────────────────────────

function Chip({ label, bg, text, border }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: bg, color: text, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ElectricityTableRow({ record, index, onPaymentRecorded }) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Resolve display name from whichever populated field is present.
  const unitName =
    record.unit?.name ??
    record.unit?.unitName ??
    record.subMeter?.name ??
    record.subMeter?.displayName ??
    `Row ${index + 1}`;

  const status = String(record.status ?? "pending").toLowerCase();
  const statusConfig = STATUS_CONFIG[status] ?? FALLBACK_STATUS;

  const consumption =
    record.unitsConsumed != null && !Number.isNaN(Number(record.unitsConsumed))
      ? Number(record.unitsConsumed)
      : getConsumption(record);

  const totalAmount = Number(record.totalAmount) || 0;
  const paidAmount = Number(record.paidAmount) || 0;
  const remainingAmount =
    record.remainingAmount != null
      ? Number(record.remainingAmount)
      : Math.max(0, totalAmount - paidAmount);

  const totalAmountFormatted = record.totalAmountFormatted ?? fmtRs(totalAmount);
  const paidAmountFormatted = record.paidAmountFormatted ?? (paidAmount > 0 ? fmtRs(paidAmount) : null);
  const remainingAmountFormatted = record.remainingAmountFormatted ?? fmtRs(remainingAmount);

  const isPayable = remainingAmount > 0 && PAYABLE_STATUSES.has(status);

  const handleViewDetails = useCallback(() => {
    if (record.tenant?._id) navigate(`/tenant/viewDetail/${record.tenant._id}`);
  }, [record.tenant?._id, navigate]);

  return (
    <>
      <tr
        className="transition-colors"
        style={{ backgroundColor: statusConfig.rowBg }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-surface)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = statusConfig.rowBg;
        }}
      >
        {/* Name + tags */}
        <td className="py-3 px-4">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-strong)" }}
          >
            {unitName}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {record.meterType === "sub_meter" &&
              record.subMeter?.name?.startsWith("Generator –") && (
                <Chip
                  label="Generator"
                  bg="var(--color-warning-bg)"
                  text="var(--color-warning)"
                  border="var(--color-warning-border)"
                />
              )}
            {record.isTenantTransition && (
              <Chip
                label="Transition"
                bg="var(--color-warning-bg)"
                text="var(--color-warning)"
                border="var(--color-warning-border)"
              />
            )}
            {!record.tenant && record.meterType === "unit" && (
              <Chip
                label="Vacant"
                bg="var(--color-surface)"
                text="var(--color-text-sub)"
                border="var(--color-border)"
              />
            )}
          </div>
        </td>

        {/* Type */}
        <td className="py-3 px-4">
          <span
            className="text-xs font-medium capitalize"
            style={{ color: "var(--color-text-sub)" }}
          >
            {record.meterType?.replace("_", " ") || "—"}
          </span>
        </td>

        {/* Building */}
        <td
          className="py-3 px-4 text-sm"
          style={{ color: "var(--color-text-sub)" }}
        >
          {record.unit?.block?.name ?? record.subMeter?.block?.name ?? "—"}
        </td>

        {/* Previous reading */}
        <td
          className="py-3 px-4 text-sm tabular-nums"
          style={{ color: "var(--color-text-sub)" }}
        >
          {Number(record.previousReading) > 0
            ? Number(record.previousReading).toFixed(1)
            : "—"}
        </td>

        {/* Current reading */}
        <td
          className="py-3 px-4 text-sm tabular-nums"
          style={{ color: "var(--color-text-sub)" }}
        >
          {Number(record.currentReading) > 0
            ? Number(record.currentReading).toFixed(1)
            : "—"}
        </td>

        {/* Consumption */}
        <td className="py-3 px-4">
          {consumption > 0 ? (
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: "var(--color-accent)" }}
            >
              {formatConsumption(consumption)} kWh
            </span>
          ) : (
            <span className="text-sm" style={{ color: "var(--color-text-sub)" }}>
              —
            </span>
          )}
        </td>

        {/* Bill amount */}
        <td className="py-3 px-4">
          <span
            className="text-sm font-medium tabular-nums"
            style={{ color: "var(--color-text-strong)" }}
          >
            {totalAmountFormatted}
          </span>
        </td>

        {/* Status badge */}
        <td className="py-3 px-4">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: statusConfig.badgeBg,
              color: statusConfig.badgeText,
              border: `1px solid ${statusConfig.badgeBorder}`,
            }}
          >
            {status.replace("_", " ")}
          </span>
        </td>

        {/* Reading date */}
        <td
          className="py-3 px-4 text-xs tabular-nums whitespace-nowrap"
          style={{ color: "var(--color-text-sub)" }}
        >
          {record.nepaliDate ?? record.readingDate?.slice(0, 10) ?? "—"}
        </td>

        {/* Actions */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            {isPayable && (
              <Button
                size="sm"
                onClick={() => setPaymentDialogOpen(true)}
                className="h-7 px-2.5 text-xs rounded-md"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "#fff",
                  border: "none",
                }}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Pay
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {record.tenant?._id && (
                  <DropdownMenuItem
                    onClick={handleViewDetails}
                    className="text-sm cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-sm cursor-not-allowed opacity-50" disabled>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Reading
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>

      <ElectricityPaymentDialog
        paymentDialogOpen={paymentDialogOpen}
        setPaymentDialogOpen={setPaymentDialogOpen}
        unitName={unitName}
        record={record}
        totalAmountFormatted={totalAmountFormatted}
        paidAmount={paidAmount}
        paidAmountFormatted={paidAmountFormatted}
        remainingAmount={remainingAmount}
        remainingAmountFormatted={remainingAmountFormatted}
        onPaymentRecorded={onPaymentRecorded}
      />
    </>
  );
}