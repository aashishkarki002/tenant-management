import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CreditCard, Eye, Pencil, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getConsumption, formatConsumption } from "../utils/electricityCalculations";
import ElectricityPaymentDialog from "./ElectricityPaymentDialog";
import { generateBill } from "../utils/electricityApi";
import { useNavigate } from "react-router-dom";

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

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

function Chip({ label, bg, text, border }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: "99px",
        fontSize: "10px",
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}

const TD = ({ children, style = {} }) => (
  <td style={{ padding: "10px 14px", fontSize: "13px", color: "var(--color-text-body)", ...style }}>
    {children}
  </td>
);

export function ElectricityTableRow({ record, index, onPaymentRecorded, onEditReading }) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [billPath, setBillPath] = useState(record.bill?.ftpPath ?? null);
  const navigate = useNavigate();

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

  const isPayable = remainingAmount > 0 && PAYABLE_STATUSES.has(status);

  const handleViewDetails = useCallback(() => {
    if (record.tenant?._id) navigate(`/tenant/viewDetail/${record.tenant._id}`);
  }, [record.tenant?._id, navigate]);

  const handleGenerateBill = useCallback(async () => {
    setGeneratingBill(true);
    try {
      const data = await generateBill(record._id);
      setBillPath(data.ftpPath);
      toast.success("Bill generated and uploaded to FTP");
    } catch (err) {
      toast.error(err.message || "Failed to generate bill");
    } finally {
      setGeneratingBill(false);
    }
  }, [record._id]);

  return (
    <>
      <tr
        style={{
          backgroundColor: statusConfig.rowBg,
          borderBottom: "1px solid var(--color-border)",
          transition: "background-color 0.1s",
        }}
        onMouseEnter={(e) => {
          if (!statusConfig.rowBg || statusConfig.rowBg === "transparent") {
            e.currentTarget.style.backgroundColor = "var(--color-surface)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = statusConfig.rowBg;
        }}
      >
        {/* Name */}
        <TD>
          <p style={{ fontWeight: 600, color: "var(--color-text-strong)", fontSize: "13px" }}>
            {unitName}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
            {record.meterType === "sub_meter" &&
              record.subMeter?.name?.startsWith("Generator –") && (
                <Chip label="Generator" bg="var(--color-warning-bg)" text="var(--color-warning)" border="var(--color-warning-border)" />
              )}
            {record.isTenantTransition && (
              <Chip label="Transition" bg="var(--color-warning-bg)" text="var(--color-warning)" border="var(--color-warning-border)" />
            )}
            {!record.tenant && record.meterType === "unit" && (
              <Chip label="Vacant" bg="var(--color-surface)" text="var(--color-text-sub)" border="var(--color-border)" />
            )}
          </div>
        </TD>

        {/* Type */}
        <TD style={{ color: "var(--color-text-sub)", fontSize: "12px" }}>
          {record.meterType?.replace("_", " ") || "—"}
        </TD>

        {/* Building */}
        <TD style={{ color: "var(--color-text-sub)", fontSize: "12px" }}>
          {record.unit?.block?.name ?? record.subMeter?.block?.name ?? "—"}
        </TD>

        {/* Previous */}
        <TD style={{ color: "var(--color-text-sub)", fontVariantNumeric: "tabular-nums" }}>
          {Number(record.previousReading) > 0 ? Number(record.previousReading).toFixed(1) : "—"}
        </TD>

        {/* Current */}
        <TD style={{ color: "var(--color-text-sub)", fontVariantNumeric: "tabular-nums" }}>
          {Number(record.currentReading) > 0 ? Number(record.currentReading).toFixed(1) : "—"}
        </TD>

        {/* Consumption */}
        <TD>
          {consumption > 0 ? (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatConsumption(consumption)} kWh
            </span>
          ) : (
            <span style={{ color: "var(--color-text-sub)" }}>—</span>
          )}
        </TD>

        {/* Bill amount */}
        <TD style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {fmtRs(totalAmount)}
        </TD>

        {/* Status */}
        <TD>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: "99px",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              backgroundColor: statusConfig.badgeBg,
              color: statusConfig.badgeText,
              border: `1px solid ${statusConfig.badgeBorder}`,
            }}
          >
            {status.replace("_", " ")}
          </span>
        </TD>

        {/* Date */}
        <TD style={{ color: "var(--color-text-sub)", fontSize: "12px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {record.nepaliDate ?? record.readingDate?.slice(0, 10) ?? "—"}
        </TD>

        {/* Actions */}
        <TD>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
            {isPayable && (
              <button
                type="button"
                onClick={() => setPaymentDialogOpen(true)}
                style={{
                  height: "26px",
                  padding: "0 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: "var(--color-accent)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <CreditCard style={{ width: "11px", height: "11px" }} />
                Pay
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  style={{
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--color-text-sub)",
                  }}
                >
                  <MoreHorizontal style={{ width: "13px", height: "13px" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {record.tenant?._id && (
                  <DropdownMenuItem onClick={handleViewDetails} className="text-sm cursor-pointer">
                    <Eye className="w-3.5 h-3.5 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onEditReading?.(record)}
                  className="text-sm cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Reading
                </DropdownMenuItem>
                {/* Bill PDF — only for tenant-billed readings */}
                {record.meterType === "unit" && record.tenant && (
                  billPath ? (
                    <DropdownMenuItem asChild className="text-sm cursor-pointer">
                      <a href={billPath} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-3.5 h-3.5 mr-2" />
                        Download Bill
                      </a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleGenerateBill}
                      disabled={generatingBill}
                      className="text-sm cursor-pointer"
                    >
                      {generatingBill
                        ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        : <FileText className="w-3.5 h-3.5 mr-2" />}
                      {generatingBill ? "Generating…" : "Generate Bill"}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TD>
      </tr>

      <ElectricityPaymentDialog
        paymentDialogOpen={paymentDialogOpen}
        setPaymentDialogOpen={setPaymentDialogOpen}
        unitName={unitName}
        record={record}
        totalAmount={totalAmount}
        paidAmount={paidAmount}
        remainingAmount={remainingAmount}
        onPaymentRecorded={onPaymentRecorded}
      />
    </>
  );
}